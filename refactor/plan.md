# Refactor Plan - Configuration Extraction
*Generated: 2025-08-13*

## Initial State Analysis

### Current Architecture
Configuration is currently scattered across multiple files with different patterns:

**Existing Configuration Structure:**
1. **Constants File**: `src/constants/currency-defaults.ts`
   - DEFAULT_CURRENCY_INCREMENTS
   - API_TIMEOUT_MS, DEFAULT_RETRY_ATTEMPTS
   - DEFAULT_MAX_LOAN_RATIO, DEFAULT_DRY_RUN

2. **Environment Variable Handling**: `src/functions/manage-loans.ts`
   - `getConfigInput()` function handles env vars manually
   - Direct `process.env` access scattered throughout

3. **Validation Logic**: `src/utils/validation.ts`
   - Individual validation functions for each env var
   - Duplicated error handling logic

4. **Magic Numbers**: Scattered throughout codebase
   - Hardcoded fallback value `'0.001'` 
   - Rate limiting multipliers (1000, 30000)
   - Validation thresholds (1000000)

### Problem Areas

1. **Scattered Configuration Logic**: Environment variable parsing spread across multiple functions
2. **Mixed Concerns**: Business logic mixed with configuration handling
3. **Duplicate Validation**: Similar validation patterns repeated
4. **Hard to Test**: Configuration logic embedded in main functions
5. **Poor Maintainability**: Adding new config requires touching multiple files
6. **No Type Safety**: Environment variables not properly typed
7. **Magic Numbers**: Hardcoded values without clear meaning

### Current Usage Locations

**Environment Variables:**
- `VALR_API_KEY` - API authentication
- `VALR_API_SECRET` - API authentication  
- `MAX_LOAN_RATIO` - Maximum loan ratio (0-1)
- `MIN_INCREMENT_AMOUNT` - JSON object with currency increments
- `DRY_RUN` - Boolean flag for test mode

**Constants:**
- Currency increments for fallback scenarios
- API timeouts and retry configurations
- Default values for optional parameters

## Target Architecture

### Centralized Configuration Module
**Goal**: Create a single, type-safe configuration module that handles all environment variables, constants, and validation.

**New Structure:**
```
src/config/
├── index.ts          # Main config export
├── environment.ts    # Environment variable handling
├── constants.ts      # All constants and defaults
├── validation.ts     # Configuration validation
└── types.ts          # Configuration types
```

**Key Benefits:**
1. **Single Source of Truth**: All configuration in one place
2. **Type Safety**: Proper TypeScript interfaces for all config
3. **Centralized Validation**: Consistent error handling and validation
4. **Easy Testing**: Configuration logic can be unit tested
5. **Environment Aware**: Different configs for different environments
6. **Documentation**: Clear documentation of all available options

### New Configuration Interface
```typescript
export interface AppConfig {
  // API Configuration
  api: {
    key: string;
    secret: string;
    timeout: number;
    retryAttempts: number;
    minRetryDelay: number;
    maxRetryDelay: number;
  };
  
  // Loan Management Configuration
  loans: {
    maxRatio: number;
    dryRun: boolean;
    customIncrements?: Record<string, string>;
    fallbackIncrement: string;
  };
  
  // Currency Configuration
  currencies: {
    defaultIncrements: Record<string, string>;
  };
  
  // Special Identifiers
  identifiers: {
    mainAccountId: string;
  };
}
```

## Refactoring Tasks

### 1. Create Configuration Types (Low Risk)
**File**: `src/config/types.ts`
**Status**: Pending

**Actions**:
- Define comprehensive `AppConfig` interface
- Define environment variable types
- Define validation result types
- Export all configuration types

### 2. Create Constants Module (Low Risk)
**File**: `src/config/constants.ts`
**Status**: Pending

**Actions**:
- Move all constants from `currency-defaults.ts`
- Add missing magic numbers as named constants
- Organize by category (API, loans, currencies, etc.)
- Add JSDoc documentation for each constant

### 3. Create Environment Handler (Medium Risk)
**File**: `src/config/environment.ts`
**Status**: Pending

**Actions**:
- Extract all `process.env` access to this module
- Implement type-safe environment variable parsing
- Handle optional vs required environment variables
- Provide sensible defaults

### 4. Create Configuration Validation (Medium Risk)
**File**: `src/config/validation.ts`
**Status**: Pending

**Actions**:
- Move validation logic from `utils/validation.ts`
- Consolidate validation patterns
- Create comprehensive configuration validation
- Improve error messages and warnings

### 5. Create Main Configuration Module (Medium Risk)
**File**: `src/config/index.ts`
**Status**: Pending

**Actions**:
- Combine environment, constants, and validation
- Export single `getConfig()` function
- Cache configuration after first load
- Handle configuration errors gracefully

### 6. Update All Imports and Usage (High Risk)
**Files**: `src/functions/manage-loans.ts`, `src/utils/validation.ts`, etc.
**Status**: Pending

**Actions**:
- Replace scattered configuration access with centralized config
- Remove `getConfigInput()` function from manage-loans.ts
- Update all imports to use new config module
- Update validation.ts to use new validation module
- Remove deprecated constants file

## Implementation Strategy

### Phase 1: Create New Configuration Infrastructure (Low-Medium Risk)
1. ✅ Create configuration types interface
2. ✅ Create constants module with all existing constants
3. ✅ Create environment variable handler
4. ✅ Create validation module

### Phase 2: Create Main Configuration Module (Medium Risk)
1. ✅ Combine all config components into main module
2. ✅ Add comprehensive error handling
3. ✅ Add configuration caching
4. ✅ Add JSDoc documentation

### Phase 3: Update Usage Throughout Codebase (High Risk)
1. ✅ Update manage-loans.ts to use new config
2. ✅ Remove old getConfigInput() function
3. ✅ Update imports and references
4. ✅ Remove deprecated files

### Phase 4: Validation and Testing (Low Risk)
1. ✅ Run TypeScript compilation
2. ✅ Run build process
3. ✅ Run all tests
4. ✅ Verify no behavioral changes

## Detailed Implementation

### New Configuration Structure

**`src/config/types.ts`**:
```typescript
export interface ApiConfig {
  key: string;
  secret: string;
  timeout: number;
  retryAttempts: number;
  minRetryDelay: number;
  maxRetryDelay: number;
}

export interface LoanConfig {
  maxRatio: number;
  dryRun: boolean;
  customIncrements?: Record<string, string>;
  fallbackIncrement: string;
}

export interface CurrencyConfig {
  defaultIncrements: Record<string, string>;
}

export interface AppConfig {
  api: ApiConfig;
  loans: LoanConfig;
  currencies: CurrencyConfig;
  mainAccountId: string;
}
```

**`src/config/constants.ts`**:
```typescript
// Currency defaults
export const DEFAULT_CURRENCY_INCREMENTS: Record<string, string> = {
  'ZAR': '1.0',
  'BTC': '0.00001',
  'ETH': '0.0001',
  'USDC': '0.01',
  'USDT': '0.01',
  'XRP': '0.000001',
};

// API Configuration
export const API_TIMEOUT_MS = 30000;
export const DEFAULT_RETRY_ATTEMPTS = 3;
export const MIN_RETRY_DELAY_MS = 1000;
export const MAX_RETRY_DELAY_MS = 30000;

// Loan Configuration
export const DEFAULT_MAX_LOAN_RATIO = 1.0;
export const DEFAULT_DRY_RUN = false;
export const DEFAULT_FALLBACK_INCREMENT = '0.001';

// Identifiers
export const MAIN_ACCOUNT_ID = '0';

// Validation Limits
export const MAX_INCREMENT_AMOUNT = 1000000;
export const RATE_LIMIT_MULTIPLIER = 1000;
```

**`src/config/environment.ts`**:
```typescript
import { LoanConfig, ApiConfig } from './types';
import { DEFAULT_MAX_LOAN_RATIO, DEFAULT_DRY_RUN, DEFAULT_FALLBACK_INCREMENT } from './constants';

export function getApiConfig(): ApiConfig {
  const key = process.env['VALR_API_KEY'];
  const secret = process.env['VALR_API_SECRET'];
  
  if (!key || !secret) {
    throw new Error('VALR_API_KEY and VALR_API_SECRET are required');
  }
  
  return {
    key,
    secret,
    timeout: API_TIMEOUT_MS,
    retryAttempts: DEFAULT_RETRY_ATTEMPTS,
    minRetryDelay: MIN_RETRY_DELAY_MS,
    maxRetryDelay: MAX_RETRY_DELAY_MS,
  };
}

export function getLoanConfig(): LoanConfig {
  // Parse MAX_LOAN_RATIO
  const maxRatioStr = process.env['MAX_LOAN_RATIO'];
  let maxRatio = DEFAULT_MAX_LOAN_RATIO;
  if (maxRatioStr) {
    const parsed = parseFloat(maxRatioStr);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
      maxRatio = parsed;
    }
  }
  
  // Parse MIN_INCREMENT_AMOUNT
  let customIncrements: Record<string, string> | undefined;
  if (process.env['MIN_INCREMENT_AMOUNT']) {
    try {
      const parsed = JSON.parse(process.env['MIN_INCREMENT_AMOUNT']);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        customIncrements = parsed;
      }
    } catch {
      // Invalid JSON, use undefined
    }
  }
  
  return {
    maxRatio,
    dryRun: process.env['DRY_RUN'] === 'true',
    customIncrements,
    fallbackIncrement: DEFAULT_FALLBACK_INCREMENT,
  };
}
```

**`src/config/index.ts`**:
```typescript
import { AppConfig } from './types';
import { getApiConfig, getLoanConfig } from './environment';
import { DEFAULT_CURRENCY_INCREMENTS, MAIN_ACCOUNT_ID } from './constants';
import { validateConfiguration } from './validation';

let cachedConfig: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (cachedConfig) {
    return cachedConfig;
  }
  
  const config: AppConfig = {
    api: getApiConfig(),
    loans: getLoanConfig(),
    currencies: {
      defaultIncrements: DEFAULT_CURRENCY_INCREMENTS,
    },
    mainAccountId: MAIN_ACCOUNT_ID,
  };
  
  // Validate configuration
  const validation = validateConfiguration(config);
  if (!validation.isValid) {
    throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
  }
  
  cachedConfig = config;
  return cachedConfig;
}

// Export types and constants that may be needed elsewhere
export * from './types';
export * from './constants';
```

### Updated Usage in manage-loans.ts

**Before**:
```typescript
function getConfigInput(): LoanManagementConfigInput {
  // 40+ lines of environment variable parsing...
}

async function getConfig(client: ValrClient, activeCurrencies: string[]): Promise<LoanManagementConfig> {
  const input = getConfigInput();
  // Complex logic with scattered constants...
}
```

**After**:
```typescript
import { getConfig as getAppConfig } from '../config';

async function getConfig(client: ValrClient, activeCurrencies: string[]): Promise<LoanManagementConfig> {
  const appConfig = getAppConfig();
  // Clean, simple logic using centralized config...
}
```

## Validation Checklist

**After Each Change:**
- [ ] TypeScript compilation successful
- [ ] No missing imports or exports
- [ ] Configuration interface properly typed
- [ ] Environment variables properly handled

**Final Validation:**
- [ ] All configuration access uses new centralized module
- [ ] No direct `process.env` access in business logic
- [ ] All constants moved to constants module
- [ ] Old configuration files removed
- [ ] Build passes successfully
- [ ] All tests pass
- [ ] No behavioral changes in configuration values

## De-Para Mapping

| Before | After | Status |
|--------|-------|--------|
| `process.env['VALR_API_KEY']` | `getConfig().api.key` | Pending |
| `DEFAULT_CURRENCY_INCREMENTS` import | `getConfig().currencies.defaultIncrements` | Pending |
| `getConfigInput()` function | `getConfig().loans` | Pending |
| Manual env var validation | `src/config/validation.ts` | Pending |
| Scattered constants | `src/config/constants.ts` | Pending |
| Magic number `'0.001'` | `DEFAULT_FALLBACK_INCREMENT` | Pending |

## Risk Assessment

**Low Risk Changes:**
- Creating new configuration types
- Moving constants to new module
- Adding JSDoc documentation

**Medium Risk Changes:**
- Environment variable parsing logic
- Configuration validation changes
- Caching configuration

**High Risk Changes:**
- Removing getConfigInput() function
- Updating all configuration usage
- Changing import paths

**Mitigation Strategies:**
- Incremental implementation with validation after each step
- TypeScript compilation catches interface mismatches
- Keep original behavior exactly the same
- Comprehensive testing after each phase

**Success Criteria:**
- Single source of truth for all configuration
- Type-safe configuration access
- No direct process.env access in business logic
- Same configuration values and behavior as before
- Improved maintainability and testability