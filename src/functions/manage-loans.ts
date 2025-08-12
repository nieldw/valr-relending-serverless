import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { ValrClient } from '../utils/valr-client';
import { Logger, LogLevel } from '../utils/logger';
import { parseFinancialAmount, calculateIncrease } from '../utils/decimal';
import { validateAllEnvironmentVariables } from '../utils/validation';
import { DEFAULT_CURRENCY_INCREMENTS, DEFAULT_MAX_LOAN_RATIO } from '../constants/currency-defaults';
import {
  ValrCredentials,
  LoanManagementConfig,
  LoanManagementConfigInput,
  ProcessingResult,
  ExecutionSummary,
  Subaccount,
  UpdateLoanRequest,
  OpenLoan
} from '../types/valr';

const logger = new Logger(LogLevel.INFO);

function getConfigInput(): LoanManagementConfigInput {
  let customMinIncrements: Record<string, string> | undefined;
  
  if (process.env['MIN_INCREMENT_AMOUNT']) {
    try {
      customMinIncrements = JSON.parse(process.env['MIN_INCREMENT_AMOUNT']);
      // Validate that it's an object with string values
      if (typeof customMinIncrements !== 'object' || customMinIncrements === null) {
        throw new Error('MIN_INCREMENT_AMOUNT must be a JSON object');
      }
    } catch (error) {
      logger.error('Failed to parse MIN_INCREMENT_AMOUNT environment variable', {
        value: process.env['MIN_INCREMENT_AMOUNT'],
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      customMinIncrements = undefined;
    }
  }

  const maxLoanRatio = parseFloat(process.env['MAX_LOAN_RATIO'] || DEFAULT_MAX_LOAN_RATIO.toString());
  if (isNaN(maxLoanRatio) || maxLoanRatio < 0 || maxLoanRatio > 1) {
    logger.warn('Invalid MAX_LOAN_RATIO, using default', {
      provided: process.env['MAX_LOAN_RATIO'],
      using: DEFAULT_MAX_LOAN_RATIO.toString()
    });
  }

  return {
    maxLoanRatio: isNaN(maxLoanRatio) || maxLoanRatio < 0 || maxLoanRatio > 1 ? DEFAULT_MAX_LOAN_RATIO : maxLoanRatio,
    dryRun: process.env['DRY_RUN'] === 'true',
    customMinIncrements,
  };
}

async function getConfig(client: ValrClient, activeCurrencies: string[]): Promise<LoanManagementConfig> {
  const input = getConfigInput();
  
  try {
    const currencies = await client.getCurrencies();
    const minIncrementAmount: Record<string, string> = {};
    
    for (const currency of activeCurrencies) {
      const currencyInfo = currencies.find(c => c.shortName === currency);
      
      if (input.customMinIncrements?.[currency]) {
        minIncrementAmount[currency] = input.customMinIncrements[currency];
      } else if (currencyInfo) {
        const decimals = currencyInfo.withdrawalDecimalPlaces;
        minIncrementAmount[currency] = (10 ** -decimals).toFixed(decimals);
      } else {
        minIncrementAmount[currency] = DEFAULT_CURRENCY_INCREMENTS[currency] || '0.001';
        logger.warn(`Currency ${currency} not found in API, using fallback minimum`, {
          currency,
          fallback: minIncrementAmount[currency]
        });
      }
    }
    
    return {
      minIncrementAmount,
      maxLoanRatio: input.maxLoanRatio,
      dryRun: input.dryRun,
    };
  } catch (error: any) {
    logger.warn('Failed to fetch currency info, using fallback values', { error: error.message });
    
    const fallbackMinIncrements: Record<string, string> = {};
    
    for (const currency of activeCurrencies) {
      if (input.customMinIncrements?.[currency]) {
        fallbackMinIncrements[currency] = input.customMinIncrements[currency];
      } else {
        fallbackMinIncrements[currency] = DEFAULT_CURRENCY_INCREMENTS[currency] || '0.001';
      }
    }
    
    return {
      minIncrementAmount: fallbackMinIncrements,
      maxLoanRatio: input.maxLoanRatio,
      dryRun: input.dryRun,
    };
  }
}

function getCredentials(): ValrCredentials {
  const apiKey = process.env['VALR_API_KEY'];
  const apiSecret = process.env['VALR_API_SECRET'];
  
  if (!apiKey || !apiSecret) {
    throw new Error('Missing required environment variables: VALR_API_KEY and VALR_API_SECRET');
  }
  
  return { apiKey, apiSecret };
}

async function processSubaccount(
  client: ValrClient,
  subaccount: Subaccount,
  config: LoanManagementConfig,
  cachedLoans?: OpenLoan[]
): Promise<ProcessingResult> {
  const result: ProcessingResult = {
    subaccountId: subaccount.id,
    subaccountLabel: subaccount.label,
    processedLoans: 0,
    increasedLoans: 0,
    totalAmountIncreased: {},
    errors: [],
  };

  try {
    logger.info(`Processing subaccount: ${subaccount.label} (${subaccount.id})`);

    const balances = await client.getSubaccountBalances(subaccount.id);
    const openLoans = cachedLoans || await client.getOpenLoans(subaccount.id);

    logger.debug(`Found ${balances.length} balances and ${openLoans.length} open loans`, {
      subaccountId: subaccount.id,
      balanceCount: balances.length,
      loanCount: openLoans.length,
    });

    const availableBalances = balances.reduce((acc, balance) => {
      acc[balance.currency] = balance.available;
      return acc;
    }, {} as Record<string, string>);

    result.processedLoans = openLoans.length;

    for (const loan of openLoans) {
      try {
        const currency = loan.currency;
        
        const availableAmountStr = availableBalances[currency] || '0';
        const minIncrementStr = config.minIncrementAmount[currency] || '0';
        
        // Use decimal arithmetic for financial calculations
        const availableAmount = parseFinancialAmount(availableAmountStr);
        const minIncrement = parseFinancialAmount(minIncrementStr);
        const currentQuantity = parseFinancialAmount(loan.totalAmount);
        
        if (availableAmount.isLessThan(minIncrement)) {
          logger.debug(`Insufficient funds for ${currency}: ${availableAmount.toString()} < ${minIncrement.toString()}`);
          continue;
        }

        const actualIncrease = calculateIncrease(loan.totalAmount, availableAmountStr, config.maxLoanRatio);
        
        if (actualIncrease.isLessThan(minIncrement)) {
          logger.debug(`Increase amount too small for ${currency}: ${actualIncrease.toString()} < ${minIncrement.toString()}`);
          continue;
        }

        const newQuantity = currentQuantity.add(actualIncrease);

        logger.info(`Planning to increase loan ${loan.loanId} from ${currentQuantity.toString()} to ${newQuantity.toString()} ${currency}`, {
          loanId: loan.loanId,
          currency: currency,
          currentQuantity: currentQuantity.toString(),
          increaseAmount: actualIncrease.toString(),
          newQuantity: newQuantity.toString(),
        });

        if (!config.dryRun) {
          const updateRequest: UpdateLoanRequest = {
            totalAmount: newQuantity.toString(),
          };

          await client.updateLoan(subaccount.id, loan.loanId, updateRequest);
          
          logger.info(`Successfully increased loan ${loan.loanId}`, {
            loanId: loan.loanId,
            newQuantity: newQuantity.toString(),
          });
        } else {
          logger.info(`DRY RUN: Would increase loan ${loan.loanId}`, {
            loanId: loan.loanId,
            newQuantity: newQuantity.toString(),
          });
        }

        result.increasedLoans++;
        const previousTotal = parseFinancialAmount(result.totalAmountIncreased[currency] || '0');
        result.totalAmountIncreased[currency] = previousTotal.add(actualIncrease).toString();

      } catch (error: any) {
        const errorMsg = `Failed to process loan ${loan.loanId}: ${error.message}`;
        logger.error(errorMsg, { loanId: loan.loanId }, error);
        result.errors.push(errorMsg);
      }
    }

  } catch (error: any) {
    const errorMsg = `Failed to process subaccount ${subaccount.id}: ${error.message}`;
    logger.error(errorMsg, { subaccountId: subaccount.id }, error);
    result.errors.push(errorMsg);
  }

  return result;
}

export const handler: Handler = async (_event: HandlerEvent, _context: HandlerContext) => {
  const startTime = Date.now();
  logger.info('Starting VALR loan management execution');

  try {
    // Validate environment variables first
    const validation = validateAllEnvironmentVariables();
    
    // Log any validation warnings
    validation.warnings.forEach(warning => {
      logger.warn('Configuration warning', { warning });
    });

    // Exit early if there are validation errors
    if (!validation.isValid) {
      logger.error('Configuration validation failed', { errors: validation.errors });
      
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Configuration validation failed',
          details: validation.errors
        })
      };
    }

    const credentials = getCredentials();
    const client = new ValrClient(credentials);

    const subaccounts = await client.getSubaccounts();
    logger.info(`Found ${subaccounts.length} subaccounts`);

    // Collect all currencies that have active loans across all subaccounts (parallel)
    const activeCurrencies = new Set<string>();
    const loanCache = new Map<string, OpenLoan[]>();
    
    const loanPromises = subaccounts.map(async (subaccount) => {
      try {
        const openLoans = await client.getOpenLoans(subaccount.id);
        loanCache.set(subaccount.id, openLoans);
        return { subaccount, openLoans, error: null };
      } catch (error: any) {
        logger.warn(`Failed to fetch loans for subaccount ${subaccount.id}`, { 
          subaccountId: subaccount.id,
          error: error.message 
        });
        loanCache.set(subaccount.id, []);
        return { subaccount, openLoans: [], error: error.message };
      }
    });
    
    const loanResults = await Promise.allSettled(loanPromises);
    loanResults.forEach(result => {
      if (result.status === 'fulfilled') {
        result.value.openLoans.forEach(loan => activeCurrencies.add(loan.currency));
      }
    });
    
    const activeCurrencyList = Array.from(activeCurrencies);
    logger.info(`Found active loans in currencies: ${activeCurrencyList.join(', ')}`);

    const config = await getConfig(client, activeCurrencyList);

    logger.info('Configuration loaded', {
      minIncrementAmount: config.minIncrementAmount,
      maxLoanRatio: config.maxLoanRatio,
      dryRun: config.dryRun,
      activeCurrencies: activeCurrencyList,
    });

    // Process subaccounts in parallel using cached loan data
    const processingPromises = subaccounts.map(async (subaccount) => {
      try {
        const cachedLoans = loanCache.get(subaccount.id) || [];
        const result = await processSubaccount(client, subaccount, config, cachedLoans);
        return { success: true, result, error: null };
      } catch (error: any) {
        const errorMsg = `Critical error processing subaccount ${subaccount.id}: ${error.message}`;
        logger.error(errorMsg, { subaccountId: subaccount.id }, error);
        return { success: false, result: null, error: errorMsg };
      }
    });

    const processingResults = await Promise.allSettled(processingPromises);
    const results: ProcessingResult[] = [];
    const globalErrors: string[] = [];

    processingResults.forEach((promiseResult, index) => {
      if (promiseResult.status === 'fulfilled') {
        const { success, result, error } = promiseResult.value;
        if (success && result) {
          results.push(result);
          if (result.errors.length > 0) {
            globalErrors.push(...result.errors);
          }
        } else if (error) {
          globalErrors.push(error);
        }
      } else {
        const subaccount = subaccounts[index];
        const subaccountId = subaccount?.id || `unknown-${index}`;
        const errorMsg = `Promise rejected for subaccount ${subaccountId}: ${promiseResult.reason}`;
        logger.error(errorMsg, { subaccountId });
        globalErrors.push(errorMsg);
      }
    });

    const executionSummary: ExecutionSummary = {
      timestamp: new Date().toISOString(),
      totalSubaccounts: subaccounts.length,
      processedSubaccounts: results.length,
      totalLoansProcessed: results.reduce((sum, r) => sum + r.processedLoans, 0),
      totalLoansIncreased: results.reduce((sum, r) => sum + r.increasedLoans, 0),
      results,
      errors: globalErrors,
      durationMs: Date.now() - startTime,
    };

    logger.info('Execution completed', {
      durationMs: executionSummary.durationMs,
      processedSubaccounts: executionSummary.processedSubaccounts,
      totalLoansProcessed: executionSummary.totalLoansProcessed,
      totalLoansIncreased: executionSummary.totalLoansIncreased,
      errorCount: globalErrors.length,
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: true,
        summary: executionSummary,
      }),
    };

  } catch (error: any) {
    logger.error('Critical execution error', {}, error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: false,
        error: 'Internal server error occurred during execution',
      }),
    };
  }
};