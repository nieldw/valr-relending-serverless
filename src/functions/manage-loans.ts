import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { ValrClient } from '../utils/valr-client';
import { Logger, LogLevel } from '../utils/logger';
import {
  ValrCredentials,
  LoanManagementConfig,
  ProcessingResult,
  ExecutionSummary,
  Subaccount,
  SubaccountBalance,
  LoanOffer,
  UpdateLoanOfferRequest
} from '../types/valr';

const logger = new Logger(LogLevel.INFO);

function getConfig(): LoanManagementConfig {
  return {
    minIncrementAmount: JSON.parse(process.env.MIN_INCREMENT_AMOUNT || '{"ZAR": "100", "BTC": "0.0001", "ETH": "0.001"}'),
    maxLoanRatio: parseFloat(process.env.MAX_LOAN_RATIO || '0.8'),
    enabledCurrencies: (process.env.ENABLED_CURRENCIES || 'ZAR,BTC,ETH').split(','),
    dryRun: process.env.DRY_RUN === 'true',
  };
}

function getCredentials(): ValrCredentials {
  const apiKey = process.env.VALR_API_KEY;
  const apiSecret = process.env.VALR_API_SECRET;
  
  if (!apiKey || !apiSecret) {
    throw new Error('Missing required environment variables: VALR_API_KEY and VALR_API_SECRET');
  }
  
  return { apiKey, apiSecret };
}

async function processSubaccount(
  client: ValrClient,
  subaccount: Subaccount,
  config: LoanManagementConfig
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

    const [balances, openOrders] = await Promise.all([
      client.getSubaccountBalances(subaccount.id),
      client.getOpenOrders(subaccount.id),
    ]);

    logger.debug(`Found ${balances.length} balances and ${openOrders.length} open orders`, {
      subaccountId: subaccount.id,
      balanceCount: balances.length,
      orderCount: openOrders.length,
    });

    const availableBalances = balances.reduce((acc, balance) => {
      acc[balance.currency] = parseFloat(balance.available);
      return acc;
    }, {} as Record<string, number>);

    const loanOffers = openOrders.filter(order => 
      order.side === 'sell' && config.enabledCurrencies.includes(order.currency_pair.split('ZAR')[0])
    );

    result.processedLoans = loanOffers.length;

    for (const loan of loanOffers) {
      try {
        const [baseCurrency] = loan.currency_pair.split('ZAR');
        
        if (!config.enabledCurrencies.includes(baseCurrency)) {
          logger.debug(`Skipping loan for disabled currency: ${baseCurrency}`);
          continue;
        }

        const availableAmount = availableBalances[baseCurrency] || 0;
        const minIncrement = parseFloat(config.minIncrementAmount[baseCurrency] || '0');
        
        if (availableAmount < minIncrement) {
          logger.debug(`Insufficient funds for ${baseCurrency}: ${availableAmount} < ${minIncrement}`);
          continue;
        }

        const currentQuantity = parseFloat(loan.quantity);
        const maxAllowedIncrease = availableAmount * config.maxLoanRatio;
        const actualIncrease = Math.min(availableAmount, maxAllowedIncrease);
        
        if (actualIncrease < minIncrement) {
          logger.debug(`Increase amount too small for ${baseCurrency}: ${actualIncrease} < ${minIncrement}`);
          continue;
        }

        const newQuantity = currentQuantity + actualIncrease;

        logger.info(`Planning to increase loan ${loan.id} from ${currentQuantity} to ${newQuantity} ${baseCurrency}`, {
          loanId: loan.id,
          currency: baseCurrency,
          currentQuantity,
          increaseAmount: actualIncrease,
          newQuantity,
        });

        if (!config.dryRun) {
          const updateRequest: UpdateLoanOfferRequest = {
            quantity: newQuantity.toString(),
          };

          await client.updateLoanOffer(subaccount.id, loan.id, updateRequest);
          
          logger.info(`Successfully increased loan ${loan.id}`, {
            loanId: loan.id,
            newQuantity,
          });
        } else {
          logger.info(`DRY RUN: Would increase loan ${loan.id}`, {
            loanId: loan.id,
            newQuantity,
          });
        }

        result.increasedLoans++;
        result.totalAmountIncreased[baseCurrency] = 
          (parseFloat(result.totalAmountIncreased[baseCurrency] || '0') + actualIncrease).toString();

      } catch (error: any) {
        const errorMsg = `Failed to process loan ${loan.id}: ${error.message}`;
        logger.error(errorMsg, { loanId: loan.id }, error);
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

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  const startTime = Date.now();
  logger.info('Starting VALR loan management execution');

  try {
    const credentials = getCredentials();
    const config = getConfig();
    const client = new ValrClient(credentials);

    logger.info('Configuration loaded', {
      minIncrementAmount: config.minIncrementAmount,
      maxLoanRatio: config.maxLoanRatio,
      enabledCurrencies: config.enabledCurrencies,
      dryRun: config.dryRun,
    });

    const subaccounts = await client.getSubaccounts();
    const activeSubaccounts = subaccounts.filter(sub => sub.active);
    
    logger.info(`Found ${activeSubaccounts.length} active subaccounts out of ${subaccounts.length} total`);

    const results: ProcessingResult[] = [];
    const globalErrors: string[] = [];

    for (const subaccount of activeSubaccounts) {
      try {
        const result = await processSubaccount(client, subaccount, config);
        results.push(result);
        
        if (result.errors.length > 0) {
          globalErrors.push(...result.errors);
        }
      } catch (error: any) {
        const errorMsg = `Critical error processing subaccount ${subaccount.id}: ${error.message}`;
        logger.error(errorMsg, { subaccountId: subaccount.id }, error);
        globalErrors.push(errorMsg);
      }
    }

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
        logs: logger.getLogs(),
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
        error: error.message,
        logs: logger.getLogs(),
      }),
    };
  }
};