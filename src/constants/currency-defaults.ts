/**
 * Default currency configurations for fallback scenarios
 */

export const DEFAULT_CURRENCY_INCREMENTS: Record<string, string> = {
  'ZAR': '1.0',      // 1 ZAR minimum increment
  'BTC': '0.00001',  // 1 satoshi equivalent
  'ETH': '0.0001',   // 0.1 mETH
  'USDC': '0.01',    // 1 cent
  'USDT': '0.01',    // 1 cent
  'XRP': '0.000001', // 1 drop
};

/**
 * Timeout configurations
 */
export const API_TIMEOUT_MS = 30000;

/**
 * Rate limiting configurations
 */
export const DEFAULT_RETRY_ATTEMPTS = 3;
export const MIN_RETRY_DELAY_MS = 1000;
export const MAX_RETRY_DELAY_MS = 30000;

/**
 * Special account identifiers
 */
export const MAIN_ACCOUNT_ID = '0';

/**
 * Default configuration values
 */
export const DEFAULT_MAX_LOAN_RATIO = 1.0;
export const DEFAULT_DRY_RUN = false;
export const DEFAULT_FALLBACK_INCREMENT = '0.001';