# Refactor Plan - determineIncrements Enhancement
*Generated: 2025-08-13*

## Initial State Analysis

### Current Architecture
The `determineIncrements` function currently has several issues:

**Current Implementation (lines 59-66 in manage-loans.ts):**
```typescript
const determineIncrements = (increment: string) => {
    const parts = increment.split('.');
    return {
        minIncrement: increment,
        decimalPlaces: parts.length > 1 && parts[1] ? parts[1].length : 0
    }
}
```

### Problem Areas

1. **Local Function Scope**: Defined inside `getConfig()`, not reusable
2. **Scattered Logic**: Decision between API decimal places vs string-derived decimal places is spread across multiple places:
   - Line 82: `currencyInfo ? currencyInfo.withdrawalDecimalPlaces : determineIncrements(customIncrement).decimalPlaces`
   - Line 84: `currencyInfo.withdrawalDecimalPlaces` 
   - Lines 88, 119, 122: `determineIncrements(fallback)` calls
3. **Inconsistent Usage Patterns**:
   - Sometimes: `determineIncrements(customIncrement).decimalPlaces` (only accessing decimalPlaces)
   - Sometimes: `({minIncrement, decimalPlaces} = determineIncrements(fallback))` (destructuring both)
4. **Repeated Logic**: Similar conditional logic in both success and error handling paths
5. **No CurrencyInfo Integration**: Function doesn't know about API currency information

### Current Usage Locations
1. **Line 82**: `determineIncrements(customIncrement).decimalPlaces` - only need decimal places
2. **Line 88**: `({minIncrement, decimalPlaces} = determineIncrements(fallback))` - need both
3. **Line 119**: `determineIncrements(customIncrement).decimalPlaces` - only need decimal places
4. **Line 122**: `({minIncrement, decimalPlaces} = determineIncrements(fallback))` - need both

## Target Architecture

### Enhanced determineIncrements Function
**Goal**: Create a centralized utility that handles currency increment determination with optional API currency information.

**New Function Signature:**
```typescript
export function determineIncrements(
  increment: string,
  currencyInfo?: CurrencyInfo
): {
  minIncrement: string;
  decimalPlaces: number;
}
```

**Logic Priority:**
1. **If currencyInfo provided**: Use `currencyInfo.withdrawalDecimalPlaces` for decimal places
2. **If no currencyInfo**: Parse decimal places from increment string
3. **Always**: Return the increment string as minIncrement

### Benefits
1. **Centralized Logic**: All increment determination logic in one place
2. **API-First Approach**: Automatically prefers API decimal places when available
3. **Reusable**: Can be used anywhere in the codebase
4. **Testable**: Standalone function that can be unit tested
5. **Consistent Interface**: Always returns same structure regardless of input
6. **Simplified Calling Code**: No more conditional logic at call sites

## Refactoring Tasks

### 1. Extract and Enhance determineIncrements Function
**File**: `src/utils/decimal.ts`
**Risk**: Low
**Status**: Pending

**Actions**:
- Move `determineIncrements` from `manage-loans.ts` to `decimal.ts`
- Add optional `currencyInfo?: CurrencyInfo` parameter
- Implement API-first decimal place determination logic
- Add JSDoc documentation
- Export the function

**New Implementation**:
```typescript
/**
 * Determines minimum increment amount and decimal places for a currency
 * @param increment - The increment amount as string (e.g., "1", "0.01", "0.001")
 * @param currencyInfo - Optional API currency information
 * @returns Object with minIncrement string and decimalPlaces number
 */
export function determineIncrements(
  increment: string,
  currencyInfo?: CurrencyInfo
): {
  minIncrement: string;
  decimalPlaces: number;
} {
  const minIncrement = increment;
  
  // Prefer API decimal places when available
  if (currencyInfo) {
    return {
      minIncrement,
      decimalPlaces: currencyInfo.withdrawalDecimalPlaces
    };
  }
  
  // Fallback: Parse decimal places from increment string
  const parts = increment.split('.');
  const decimalPlaces = parts.length > 1 && parts[1] ? parts[1].length : 0;
  
  return {
    minIncrement,
    decimalPlaces
  };
}
```

### 2. Update Imports in manage-loans.ts
**File**: `src/functions/manage-loans.ts`
**Risk**: Low
**Status**: Pending

**Actions**:
- Add `determineIncrements` to import from `../utils/decimal`
- Remove local `determineIncrements` function definition

**Before**:
```typescript
import {calculateIncrease, parseFinancialAmount} from '../utils/decimal';
```

**After**:
```typescript
import {calculateIncrease, parseFinancialAmount, determineIncrements} from '../utils/decimal';
```

### 3. Simplify getConfig Success Path Logic
**File**: `src/functions/manage-loans.ts` 
**Risk**: Medium
**Status**: Pending

**Actions**:
- Replace complex conditional logic with simple `determineIncrements` calls
- Pass `currencyInfo` when available

**Before (lines 78-88)**:
```typescript
if (input.customMinIncrements?.[currency]) {
    const customIncrement = input.customMinIncrements[currency];
    minIncrement = customIncrement;
    decimalPlaces = currencyInfo ? currencyInfo.withdrawalDecimalPlaces : determineIncrements(customIncrement).decimalPlaces;
} else if (currencyInfo) {
    decimalPlaces = currencyInfo.withdrawalDecimalPlaces;
    minIncrement = (10 ** -decimalPlaces).toFixed(decimalPlaces);
} else {
    const fallback = DEFAULT_CURRENCY_INCREMENTS[currency] || '0.001';
    ({minIncrement, decimalPlaces} = determineIncrements(fallback));
    // ... logging
}
```

**After**:
```typescript
if (input.customMinIncrements?.[currency]) {
    const customIncrement = input.customMinIncrements[currency];
    ({minIncrement, decimalPlaces} = determineIncrements(customIncrement, currencyInfo));
} else if (currencyInfo) {
    const apiIncrement = (10 ** -currencyInfo.withdrawalDecimalPlaces).toFixed(currencyInfo.withdrawalDecimalPlaces);
    ({minIncrement, decimalPlaces} = determineIncrements(apiIncrement, currencyInfo));
} else {
    const fallback = DEFAULT_CURRENCY_INCREMENTS[currency] || '0.001';
    ({minIncrement, decimalPlaces} = determineIncrements(fallback));
    logger.warn(`Currency ${currency} not found in API, using fallback minimum`, {
        currency,
        fallback: minIncrement
    });
}
```

### 4. Simplify getConfig Error Path Logic
**File**: `src/functions/manage-loans.ts`
**Risk**: Low
**Status**: Pending

**Actions**:
- Simplify error handling fallback logic using enhanced `determineIncrements`

**Before (lines 115-122)**:
```typescript
if (input.customMinIncrements?.[currency]) {
    const customIncrement = input.customMinIncrements[currency];
    minIncrement = customIncrement;
    decimalPlaces = determineIncrements(customIncrement).decimalPlaces;
} else {
    const fallback = DEFAULT_CURRENCY_INCREMENTS[currency] || '0.001';
    ({minIncrement, decimalPlaces} = determineIncrements(fallback));
}
```

**After**:
```typescript
const incrementValue = input.customMinIncrements?.[currency] 
    || DEFAULT_CURRENCY_INCREMENTS[currency] 
    || '0.001';
({minIncrement, decimalPlaces} = determineIncrements(incrementValue));
```

## Implementation Strategy

### Phase 1: Create Enhanced Utility (Low Risk)
1. ✅ Add enhanced `determineIncrements` function to `decimal.ts`
2. ✅ Add proper TypeScript imports for `CurrencyInfo`
3. ✅ Add JSDoc documentation

### Phase 2: Update Imports (Low Risk)
1. ✅ Add `determineIncrements` to imports in `manage-loans.ts`
2. ✅ Remove local function definition

### Phase 3: Simplify Usage (Medium Risk)
1. ✅ Replace success path logic with simplified calls
2. ✅ Replace error path logic with simplified calls
3. ✅ Test with TypeScript compilation

### Phase 4: Validation (Low Risk)
1. ✅ Run type check
2. ✅ Run build
3. ✅ Run local tests to ensure behavior unchanged

## Validation Checklist

**After Each Change:**
- [ ] TypeScript compilation successful
- [ ] Function signature matches expected usage
- [ ] No unused imports or variables
- [ ] Local function definition removed

**Final Validation:**
- [ ] All `determineIncrements` calls use new centralized function
- [ ] API decimal places take priority when `currencyInfo` available
- [ ] Fallback decimal place parsing works when no `currencyInfo`
- [ ] Build passes successfully
- [ ] Local tests produce same results as before
- [ ] No behavioral changes in increment determination

## De-Para Mapping

| Before | After | Status |
|--------|-------|--------|
| Local `determineIncrements` function | Utility function in `decimal.ts` | Pending |
| `currencyInfo ? currencyInfo.withdrawalDecimalPlaces : determineIncrements(...)` | `determineIncrements(increment, currencyInfo)` | Pending |
| Multiple conditional blocks for increment logic | Single `determineIncrements` call per case | Pending |
| Scattered API vs string decimal place logic | Centralized priority logic in function | Pending |

## Risk Assessment

**Low Risk Changes:**
- Adding utility function to `decimal.ts`
- Updating imports
- Simplifying error path logic

**Medium Risk Changes:**
- Modifying success path logic in `getConfig`
- Changing conditional structure

**Mitigation Strategies:**
- TypeScript compilation catches signature mismatches
- Local testing validates behavior preservation
- Incremental changes with validation after each step

**Success Criteria:**
- Same increment values and decimal places calculated as before
- Cleaner, more maintainable code
- Reusable utility function for future use
- API decimal places consistently take priority over string-derived ones