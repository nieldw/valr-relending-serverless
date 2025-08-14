import {Handler, HandlerContext, HandlerEvent} from '@netlify/functions';
import {ValrClient} from '../utils/valr-client';
import {Logger, LogLevel} from '../utils/logger';
import {calculateIncrease, parseFinancialAmount} from '../utils/decimal';
import {validateAllEnvironmentVariables} from '../utils/validation';
import {getCredentials, getLoanManagementConfig} from '../config';
import {
    ExecutionResult,
    ExecutionSummary,
    LoanExecutionPlan,
    LoanManagementConfig,
    OpenLoan,
    PlannedLoanIncrease,
    ProcessingResult,
    Subaccount,
    UpdateLoanRequest
} from '../types/valr';

const logger = new Logger(LogLevel.INFO);

async function planSubaccountIncreases(
    client: ValrClient,
    subaccount: Subaccount,
    config: LoanManagementConfig,
    cachedLoans?: OpenLoan[]
): Promise<PlannedLoanIncrease[]> {
    const plannedIncreases: PlannedLoanIncrease[] = [];

    try {
        logger.info(`Planning increases for subaccount: ${subaccount.label} (${subaccount.id})`);

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

                // Truncate increase amount to currency's decimal places for API compliance
                const decimalPlaces = config.currencyDecimalPlaces[currency] || 8;
                const truncatedIncrease = actualIncrease.truncateToDecimalPlaces(decimalPlaces);
                const truncatedIncreaseAmount = truncatedIncrease.toString();

                const newQuantity = currentQuantity.add(truncatedIncrease);

                const plannedIncrease: PlannedLoanIncrease = {
                    subaccountId: subaccount.id,
                    subaccountLabel: subaccount.label,
                    loanId: loan.loanId,
                    currency: currency,
                    currentAmount: currentQuantity.toString(),
                    increaseAmount: truncatedIncreaseAmount,
                    newAmount: newQuantity.toString(),
                };

                plannedIncreases.push(plannedIncrease);

                logger.info(`Planned increase for loan ${loan.loanId} from ${currentQuantity.toString()} to ${newQuantity.toString()} ${currency}`, {
                    loanId: loan.loanId,
                    currency: currency,
                    currentQuantity: currentQuantity.toString(),
                    increaseAmount: truncatedIncreaseAmount,
                    newQuantity: newQuantity.toString(),
                });

            } catch (error: any) {
                logger.error(`Failed to plan increase for loan ${loan.loanId}`, {
                    loanId: loan.loanId,
                    error: error.message
                }, error);
            }
        }

    } catch (error: any) {
        logger.error(`Failed to plan increases for subaccount ${subaccount.id}`, {
            subaccountId: subaccount.id,
            error: error.message
        }, error);
    }

    return plannedIncreases;
}

async function executeIncrease(
    client: ValrClient,
    plannedIncrease: PlannedLoanIncrease,
    config: LoanManagementConfig
): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
        logger.info(`Executing increase for loan ${plannedIncrease.loanId}`, {
            loanId: plannedIncrease.loanId,
            currency: plannedIncrease.currency,
            from: plannedIncrease.currentAmount,
            to: plannedIncrease.newAmount,
            increase: plannedIncrease.increaseAmount
        });

        if (!config.dryRun) {
            const updateRequest: UpdateLoanRequest = {
                currencySymbol: plannedIncrease.currency,
                increaseLoanAmountBy: plannedIncrease.increaseAmount,
                loanId: plannedIncrease.loanId,
            };

            await client.increaseLoan(plannedIncrease.subaccountId, updateRequest);

            logger.info(`Successfully increased loan ${plannedIncrease.loanId}`, {
                loanId: plannedIncrease.loanId,
                newQuantity: plannedIncrease.newAmount,
            });
        } else {
            logger.info(`DRY RUN: Would increase loan ${plannedIncrease.loanId}`, {
                loanId: plannedIncrease.loanId,
                newQuantity: plannedIncrease.newAmount,
            });
        }

        return {
            plannedIncrease,
            success: true,
            executedAt: new Date().toISOString(),
            durationMs: Date.now() - startTime
        };

    } catch (error: any) {
        const errorMsg = `Failed to execute increase for loan ${plannedIncrease.loanId}: ${error.message}`;
        logger.error(errorMsg, {loanId: plannedIncrease.loanId}, error);

        return {
            plannedIncrease,
            success: false,
            error: errorMsg,
            executedAt: new Date().toISOString(),
            durationMs: Date.now() - startTime
        };
    }
}

async function createExecutionPlan(
    client: ValrClient,
    subaccounts: Subaccount[],
    config: LoanManagementConfig,
    loanCache: Map<string, OpenLoan[]>
): Promise<LoanExecutionPlan> {
    const allPlannedIncreases: PlannedLoanIncrease[] = [];

    logger.info('Creating execution plan for all subaccounts');

    // Collect planned increases from all subaccounts in parallel
    const planningPromises = subaccounts.map(async (subaccount) => {
        try {
            const cachedLoans = loanCache.get(subaccount.id) || [];
            const plannedIncreases = await planSubaccountIncreases(client, subaccount, config, cachedLoans);
            return {subaccountId: subaccount.id, plannedIncreases, error: null};
        } catch (error: any) {
            logger.error(`Failed to plan increases for subaccount ${subaccount.id}`, {
                subaccountId: subaccount.id,
                error: error.message
            }, error);
            return {subaccountId: subaccount.id, plannedIncreases: [], error: error.message};
        }
    });

    const planningResults = await Promise.allSettled(planningPromises);
    planningResults.forEach(result => {
        if (result.status === 'fulfilled') {
            allPlannedIncreases.push(...result.value.plannedIncreases);
        }
    });

    // Calculate totals by currency
    const totalIncreasesByCurrency: Record<string, string> = {};
    for (const increase of allPlannedIncreases) {
        const current = parseFinancialAmount(totalIncreasesByCurrency[increase.currency] || '0');
        const additional = parseFinancialAmount(increase.increaseAmount);
        totalIncreasesByCurrency[increase.currency] = current.add(additional).toString();
    }

    // Estimate execution time (conservative: 200ms per increase + 500ms buffer)
    const estimatedExecutionTimeMs = allPlannedIncreases.length * 200 + 500;

    // Simple risk assessment
    const riskAssessment = allPlannedIncreases.length === 0
        ? 'No increases planned'
        : allPlannedIncreases.length < 5
            ? 'Low risk - few increases'
            : allPlannedIncreases.length < 15
                ? 'Medium risk - moderate increases'
                : 'High risk - many increases';

    const executionPlan: LoanExecutionPlan = {
        plannedIncreases: allPlannedIncreases,
        totalIncreasesByCurrency,
        estimatedExecutionTimeMs,
        riskAssessment
    };

    logger.info('Execution plan created', {
        totalIncreases: allPlannedIncreases.length,
        totalIncreasesByCurrency,
        estimatedExecutionTimeMs,
        riskAssessment
    });

    return executionPlan;
}

async function executeSequentially(
    client: ValrClient,
    executionPlan: LoanExecutionPlan,
    config: LoanManagementConfig
): Promise<ExecutionResult[]> {
    const executionResults: ExecutionResult[] = [];

    logger.info('Starting sequential execution of planned increases', {
        totalIncreases: executionPlan.plannedIncreases.length,
        estimatedTimeMs: executionPlan.estimatedExecutionTimeMs
    });

    for (let i = 0; i < executionPlan.plannedIncreases.length; i++) {
        const plannedIncrease = executionPlan.plannedIncreases[i];
        if (!plannedIncrease) continue;

        logger.info(`Executing increase ${i + 1}/${executionPlan.plannedIncreases.length}`, {
            progress: `${i + 1}/${executionPlan.plannedIncreases.length}`,
            loanId: plannedIncrease.loanId,
            currency: plannedIncrease.currency,
            amount: plannedIncrease.increaseAmount
        });

        const result = await executeIncrease(client, plannedIncrease, config);
        executionResults.push(result);

        if (!result.success) {
            logger.warn('Failed to execute increase, continuing with next', {
                loanId: plannedIncrease.loanId,
                error: result.error,
                remaining: executionPlan.plannedIncreases.length - i - 1
            });
        }

        // No artificial delays - rely on intelligent retry logic in ValrClient
    }

    const successCount = executionResults.filter(r => r.success).length;
    const failureCount = executionResults.filter(r => !r.success).length;

    logger.info('Sequential execution completed', {
        totalExecuted: executionResults.length,
        successCount,
        failureCount,
        successRate: `${Math.round((successCount / executionResults.length) * 100)}%`
    });

    return executionResults;
}


export const handler: Handler = async (_event: HandlerEvent, _context: HandlerContext) => {
    const startTime = Date.now();
    logger.info('Starting VALR loan management execution');

    try {
        // Validate environment variables first
        const validation = validateAllEnvironmentVariables();

        // Log any validation warnings
        validation.warnings.forEach(warning => {
            logger.warn('Configuration warning', {warning});
        });

        // Exit early if there are validation errors
        if (!validation.isValid) {
            logger.error('Configuration validation failed', {errors: validation.errors});

            return {
                statusCode: 400,
                headers: {'Content-Type': 'application/json'},
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
                return {subaccount, openLoans, error: null};
            } catch (error: any) {
                logger.warn(`Failed to fetch loans for subaccount ${subaccount.id}`, {
                    subaccountId: subaccount.id,
                    error: error.message
                });
                loanCache.set(subaccount.id, []);
                return {subaccount, openLoans: [], error: error.message};
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

        const config = await getLoanManagementConfig(client, activeCurrencyList);

        logger.info('Configuration loaded', {
            minIncrementAmount: config.minIncrementAmount,
            maxLoanRatio: config.maxLoanRatio,
            dryRun: config.dryRun,
            activeCurrencies: activeCurrencyList,
        });

        // PHASE 1: Create execution plan by calculating all increases
        const executionPlan = await createExecutionPlan(client, subaccounts, config, loanCache);

        logger.info('Execution plan created', {
            totalIncreases: executionPlan.plannedIncreases.length,
            totalIncreasesByCurrency: executionPlan.totalIncreasesByCurrency,
            estimatedExecutionTimeMs: executionPlan.estimatedExecutionTimeMs,
            riskAssessment: executionPlan.riskAssessment
        });

        // PHASE 2: Execute increases sequentially
        const executionResults = await executeSequentially(client, executionPlan, config);

        // Convert execution results back to legacy ProcessingResult format for compatibility
        const results: ProcessingResult[] = [];
        const globalErrors: string[] = [];

        // Group execution results by subaccount for legacy compatibility
        const resultsBySubaccount = new Map<string, ExecutionResult[]>();
        for (const execResult of executionResults) {
            const subaccountId = execResult.plannedIncrease.subaccountId;
            if (!resultsBySubaccount.has(subaccountId)) {
                resultsBySubaccount.set(subaccountId, []);
            }
            resultsBySubaccount.get(subaccountId)!.push(execResult);
        }

        // Create ProcessingResult for each subaccount
        for (const subaccount of subaccounts) {
            const subaccountResults = resultsBySubaccount.get(subaccount.id) || [];
            const successfulResults = subaccountResults.filter(r => r.success);
            const failedResults = subaccountResults.filter(r => !r.success);

            const totalAmountIncreased: Record<string, string> = {};
            for (const result of successfulResults) {
                const currency = result.plannedIncrease.currency;
                const current = parseFinancialAmount(totalAmountIncreased[currency] || '0');
                const additional = parseFinancialAmount(result.plannedIncrease.increaseAmount);
                totalAmountIncreased[currency] = current.add(additional).toString();
            }

            const subaccountErrors = failedResults.map(r => r.error || 'Unknown error');
            globalErrors.push(...subaccountErrors);

            results.push({
                subaccountId: subaccount.id,
                subaccountLabel: subaccount.label,
                processedLoans: subaccountResults.length,
                increasedLoans: successfulResults.length,
                totalAmountIncreased,
                errors: subaccountErrors
            });
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
            executionPlan,
            executionResults
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