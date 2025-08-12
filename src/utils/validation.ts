/**
 * Input validation utilities for environment variables and configuration
 */

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateMaxLoanRatio(value: string | undefined): ValidationResult {
  const result: ValidationResult = { isValid: true, errors: [], warnings: [] };
  
  if (!value) {
    result.warnings.push('MAX_LOAN_RATIO not set, using default');
    return result;
  }

  const num = parseFloat(value);
  if (isNaN(num)) {
    result.isValid = false;
    result.errors.push('MAX_LOAN_RATIO must be a valid number');
    return result;
  }

  if (num < 0) {
    result.isValid = false;
    result.errors.push('MAX_LOAN_RATIO cannot be negative');
  } else if (num > 1) {
    result.isValid = false;
    result.errors.push('MAX_LOAN_RATIO cannot exceed 1.0 (100%)');
  }

  return result;
}

export function validateMinIncrementAmount(value: string | undefined): ValidationResult {
  const result: ValidationResult = { isValid: true, errors: [], warnings: [] };
  
  if (!value) {
    result.warnings.push('MIN_INCREMENT_AMOUNT not set, will use API defaults');
    return result;
  }

  try {
    const parsed = JSON.parse(value);
    
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      result.isValid = false;
      result.errors.push('MIN_INCREMENT_AMOUNT must be a JSON object');
      return result;
    }

    // Validate each currency entry
    for (const [currency, amount] of Object.entries(parsed)) {
      if (typeof currency !== 'string' || currency.length === 0) {
        result.isValid = false;
        result.errors.push('Currency codes must be non-empty strings');
        continue;
      }

      if (typeof amount !== 'string') {
        result.isValid = false;
        result.errors.push(`Amount for ${currency} must be a string`);
        continue;
      }

      const numAmount = parseFloat(amount as string);
      if (isNaN(numAmount)) {
        result.isValid = false;
        result.errors.push(`Amount for ${currency} must be a valid number`);
      } else if (numAmount <= 0) {
        result.isValid = false;
        result.errors.push(`Amount for ${currency} must be positive`);
      } else if (numAmount > 1000000) {
        result.warnings.push(`Amount for ${currency} is very large, please verify`);
      }
    }

  } catch (error) {
    result.isValid = false;
    result.errors.push('MIN_INCREMENT_AMOUNT must be valid JSON');
  }

  return result;
}

export function validateApiCredentials(apiKey: string | undefined, apiSecret: string | undefined): ValidationResult {
  const result: ValidationResult = { isValid: true, errors: [], warnings: [] };

  if (!apiKey) {
    result.isValid = false;
    result.errors.push('VALR_API_KEY is required');
  } else {
    if (apiKey.length !== 64) {
      result.isValid = false;
      result.errors.push('VALR_API_KEY must be exactly 64 characters');
    }
    if (!/^[a-f0-9]+$/i.test(apiKey)) {
      result.isValid = false;
      result.errors.push('VALR_API_KEY must be hexadecimal');
    }
  }

  if (!apiSecret) {
    result.isValid = false;
    result.errors.push('VALR_API_SECRET is required');
  } else {
    if (apiSecret.length !== 64) {
      result.isValid = false;
      result.errors.push('VALR_API_SECRET must be exactly 64 characters');
    }
    if (!/^[a-f0-9]+$/i.test(apiSecret)) {
      result.isValid = false;
      result.errors.push('VALR_API_SECRET must be hexadecimal');
    }
  }

  return result;
}

export function validateDryRun(value: string | undefined): ValidationResult {
  const result: ValidationResult = { isValid: true, errors: [], warnings: [] };

  if (value && value !== 'true' && value !== 'false') {
    result.warnings.push('DRY_RUN should be "true" or "false", treating as false');
  }

  return result;
}

export function validateAllEnvironmentVariables(): ValidationResult {
  const combined: ValidationResult = { isValid: true, errors: [], warnings: [] };

  const validations = [
    validateApiCredentials(process.env['VALR_API_KEY'], process.env['VALR_API_SECRET']),
    validateMaxLoanRatio(process.env['MAX_LOAN_RATIO']),
    validateMinIncrementAmount(process.env['MIN_INCREMENT_AMOUNT']),
    validateDryRun(process.env['DRY_RUN'])
  ];

  for (const validation of validations) {
    if (!validation.isValid) {
      combined.isValid = false;
    }
    combined.errors.push(...validation.errors);
    combined.warnings.push(...validation.warnings);
  }

  return combined;
}