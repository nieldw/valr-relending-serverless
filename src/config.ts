/**
 * Centralized configuration management
 * Consolidates all environment variables and constants in one place
 */

import {
    DEFAULT_CURRENCY_INCREMENTS,
    DEFAULT_FALLBACK_INCREMENT,
    DEFAULT_MAX_LOAN_RATIO
} from './constants/currency-defaults';
import {determineIncrements} from './utils/decimal';
import {Logger, LogLevel} from './utils/logger';
import {ValrClient} from './utils/valr-client';
import {LoanManagementConfig, ValrCredentials} from './types/valr';

const logger = new Logger(LogLevel.INFO);

export interface AppConfig {
    maxLoanRatio: number;
    dryRun: boolean;
    customMinIncrements: Record<string, string> | undefined;
    fallbackIncrement: string;
    apiKey: string;
    apiSecret: string;
}

/**
 * Get application configuration from environment variables with validation
 * @returns Parsed and validated application configuration
 */
export function getConfig(): AppConfig {
    // Parse MIN_INCREMENT_AMOUNT
    let customMinIncrements: Record<string, string> | undefined;
    if (process.env['MIN_INCREMENT_AMOUNT']) {
        try {
            const parsed = JSON.parse(process.env['MIN_INCREMENT_AMOUNT']);
            // Validate that it's an object with string values
            if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
                customMinIncrements = parsed;
            }
        } catch {
            // Invalid JSON, use undefined - error handling will be done by caller
        }
    }

    // Parse MAX_LOAN_RATIO
    const maxRatioStr = process.env['MAX_LOAN_RATIO'];
    let maxLoanRatio = DEFAULT_MAX_LOAN_RATIO;
    if (maxRatioStr) {
        const parsed = parseFloat(maxRatioStr);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
            maxLoanRatio = parsed;
        }
    }

    return {
        maxLoanRatio,
        dryRun: process.env['DRY_RUN'] === 'true',
        customMinIncrements,
        fallbackIncrement: DEFAULT_FALLBACK_INCREMENT,
        apiKey: process.env['VALR_API_KEY'] || '',
        apiSecret: process.env['VALR_API_SECRET'] || '',
    };
}

/**
 * Get VALR API credentials from configuration
 * @returns Validated API credentials
 * @throws Error if credentials are missing
 */
export function getCredentials(): ValrCredentials {
    const appConfig = getConfig();

    if (!appConfig.apiKey || !appConfig.apiSecret) {
        throw new Error('Missing required environment variables: VALR_API_KEY and VALR_API_SECRET');
    }

    return {apiKey: appConfig.apiKey, apiSecret: appConfig.apiSecret};
}

/**
 * Get loan management configuration with currency-specific settings
 * @param client VALR API client for fetching currency information
 * @param activeCurrencies List of currencies to configure
 * @returns Complete loan management configuration
 */
export async function getLoanManagementConfig(client: ValrClient, activeCurrencies: string[]): Promise<LoanManagementConfig> {
    const appConfig = getConfig();

    try {
        const currencies = await client.getCurrencies();
        const minIncrementAmount: Record<string, string> = {};
        const currencyDecimalPlaces: Record<string, number> = {};

        for (const currency of activeCurrencies) {
            const currencyInfo = currencies.find(c => c.shortName === currency);
            let minIncrement: string;
            let decimalPlaces: number;

            if (appConfig.customMinIncrements?.[currency]) {
                const customIncrement = appConfig.customMinIncrements[currency];
                ({minIncrement, decimalPlaces} = determineIncrements(customIncrement, currencyInfo));
            } else if (currencyInfo) {
                const apiIncrement = (10 ** -currencyInfo.withdrawalDecimalPlaces).toFixed(currencyInfo.withdrawalDecimalPlaces);
                ({minIncrement, decimalPlaces} = determineIncrements(apiIncrement, currencyInfo));
            } else {
                const fallback = DEFAULT_CURRENCY_INCREMENTS[currency] || DEFAULT_FALLBACK_INCREMENT;
                ({minIncrement, decimalPlaces} = determineIncrements(fallback));
                logger.warn(`Currency ${currency} not found in API, using fallback minimum`, {
                    currency,
                    fallback: minIncrement
                });
            }

            minIncrementAmount[currency] = minIncrement;
            currencyDecimalPlaces[currency] = decimalPlaces;
        }

        return {
            minIncrementAmount,
            currencyDecimalPlaces,
            maxLoanRatio: appConfig.maxLoanRatio,
            dryRun: appConfig.dryRun,
        };
    } catch (error: any) {
        logger.warn('Failed to fetch currency info, using fallback values', {error: error.message});

        const minIncrementAmount: Record<string, string> = {};
        const currencyDecimalPlaces: Record<string, number> = {};

        for (const currency of activeCurrencies) {
            let minIncrement: string;
            let decimalPlaces: number;

            const incrementValue = appConfig.customMinIncrements?.[currency]
                || DEFAULT_CURRENCY_INCREMENTS[currency]
                || DEFAULT_FALLBACK_INCREMENT;
            ({minIncrement, decimalPlaces} = determineIncrements(incrementValue));

            minIncrementAmount[currency] = minIncrement;
            currencyDecimalPlaces[currency] = decimalPlaces;
        }

        return {
            minIncrementAmount,
            currencyDecimalPlaces,
            maxLoanRatio: appConfig.maxLoanRatio,
            dryRun: appConfig.dryRun,
        };
    }
}