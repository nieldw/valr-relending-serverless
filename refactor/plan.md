# Refactor Plan - Sequential Loan Processing Architecture
*Generated: 2025-08-12*

## Initial State Analysis

### Current Architecture
The VALR loan management system currently uses an **immediate processing** pattern:

1. **Data Collection Phase** (parallel):
   - Fetch all subaccounts
   - Fetch loans for each subaccount 
   - Build currency cache and loan cache

2. **Processing Phase** (parallel):
   - For each subaccount, call `processSubaccount()`
   - Each `processSubaccount()` calculates AND applies increases immediately
   - Each loan increase is applied via API as soon as it's calculated

### Current Flow in `processSubaccount()` (lines 115-219):
```
For each loan in subaccount:
  ├── Calculate if increase is warranted
  ├── If yes: Log planned increase  
  ├── Immediately apply via API call (lines 183-199)
  └── Update metrics
```

### Problem Areas
- **Tight coupling**: Calculation and execution are intertwined
- **Limited visibility**: Can't see total planned changes before execution
- **Error handling**: Partial failures leave system in unknown state
- **Resource planning**: No upfront view of total financial impact
- **Optimization**: Can't prioritize or reorder increases strategically

## Target Architecture

### New Sequential Processing Pattern
> **Goal**: "Calculate all loan increases across all subaccounts before applying the increases sequentially"

**Phase 1: Planning** (calculate all increases):
```
For each subaccount:
  For each loan:
    ├── Calculate potential increase
    ├── Store in planned increases list
    └── NO API calls yet
```

**Phase 2: Execution** (apply sequentially):
```
For each planned increase (in sequence):
  ├── Apply via API call
  ├── Update metrics
  └── Handle errors individually
```

### Benefits
1. **Resource Planning**: Know total financial impact upfront
2. **Better Error Handling**: Can validate all before applying any  
3. **Optimization**: Can prioritize increases by amount, currency, risk
4. **Better Reporting**: Show complete execution plan before starting
5. **Atomic-like Behavior**: Clear separation between planning and execution

## Refactoring Tasks

### High Priority Tasks

#### 1. Create New Data Structures
**File**: `src/types/valr.ts`
**Risk**: Low
**Status**: Pending

Add new interfaces to support planned increases:
```typescript
export interface PlannedLoanIncrease {
  subaccountId: string;
  subaccountLabel: string; 
  loanId: string;
  currency: string;
  currentAmount: string;
  increaseAmount: string;
  newAmount: string;
  priority?: number;
}

export interface LoanExecutionPlan {
  plannedIncreases: PlannedLoanIncrease[];
  totalIncreasesByCurrency: Record<string, string>;
  estimatedExecutionTime: number;
  riskAssessment: string;
}

export interface ExecutionResult {
  plannedIncrease: PlannedLoanIncrease;
  success: boolean;
  error?: string;
  executedAt: string;
}
```

#### 2. Split processSubaccount() Function
**File**: `src/functions/manage-loans.ts`
**Risk**: Medium
**Status**: Pending

Create two new functions:
- `planSubaccountIncreases()`: Calculate increases without applying
- `executeIncrease()`: Apply a single planned increase

#### 3. Create Planning Phase Function
**File**: `src/functions/manage-loans.ts`
**Risk**: Medium  
**Status**: Pending

New function: `createExecutionPlan()` that:
- Calls `planSubaccountIncreases()` for each subaccount
- Collects all planned increases
- Calculates totals and risk assessment
- Returns `LoanExecutionPlan`

#### 4. Create Sequential Execution Function
**File**: `src/functions/manage-loans.ts`
**Risk**: High
**Status**: Pending

New function: `executeSequentially()` that:
- Takes a `LoanExecutionPlan`
- Applies increases one by one (not parallel)
- Tracks success/failure for each
- Provides detailed execution report

#### 5. Update Main Handler
**File**: `src/functions/manage-loans.ts` 
**Risk**: High
**Status**: Pending

Modify main handler to:
```typescript
// Phase 1: Planning
const executionPlan = await createExecutionPlan(client, subaccounts, config, loanCache);
logger.info('Execution plan created', {
  totalIncreases: executionPlan.plannedIncreases.length,
  totalAmountByCurrency: executionPlan.totalIncreasesByCurrency
});

// Phase 2: Sequential Execution  
const executionResults = await executeSequentially(client, executionPlan, config);
```

### Medium Priority Tasks

#### 6. Add Increase Prioritization
**File**: `src/functions/manage-loans.ts`
**Risk**: Low
**Status**: Pending

Add logic to prioritize increases by:
- Amount (largest first)
- Currency (stable currencies first)
- Risk level (lowest risk first)

#### 7. Enhanced Logging and Reporting
**File**: `src/functions/manage-loans.ts`
**Risk**: Low  
**Status**: Pending

Add detailed logging for:
- Complete execution plan before starting
- Progress updates during sequential execution
- Rollback information if needed

#### 8. Add Execution Plan Validation
**File**: `src/functions/manage-loans.ts`
**Risk**: Low
**Status**: Pending

Validate execution plan:
- Check total increases don't exceed available balances
- Validate currency consistency
- Risk assessment before execution

### Low Priority Tasks

#### 9. Add Rollback Capability
**File**: `src/functions/manage-loans.ts`
**Risk**: Low
**Status**: Pending

If execution fails partway:
- Log exactly what succeeded
- Provide rollback instructions
- Option to retry failed increases

#### 10. Performance Monitoring
**File**: `src/functions/manage-loans.ts`
**Risk**: Low
**Status**: Pending

Track performance differences:
- Planning phase duration
- Sequential execution duration  
- Compare with current parallel approach

## Implementation Strategy

### Phase 1: Safe Foundations (Low Risk)
1. Add new data structures to types
2. Create helper functions for planning
3. Add comprehensive logging

### Phase 2: Core Refactoring (Medium Risk)  
1. Split processSubaccount() function
2. Create planning phase function
3. Create sequential execution function

### Phase 3: Integration (High Risk)
1. Update main handler to use new architecture
2. Extensive testing with dry-run mode
3. Performance validation

### Phase 4: Enhancements (Low Risk)
1. Add prioritization logic
2. Enhanced error handling and rollback
3. Performance monitoring

## Validation Checklist

**After Each Change:**
- [ ] TypeScript compilation successful
- [ ] All existing tests pass
- [ ] Dry-run execution produces same results
- [ ] No behavioral changes in planning phase
- [ ] Sequential execution matches current parallel results
- [ ] Performance acceptable (target: <20% slower)

**Final Validation:**
- [ ] All old immediate-processing patterns removed
- [ ] No broken imports or references
- [ ] All functions have proper error handling
- [ ] Complete test coverage for new functionality
- [ ] Documentation updated
- [ ] No orphaned code remains

## De-Para Mapping

| Before | After | Status |
|--------|-------|--------|
| `processSubaccount()` (immediate) | `planSubaccountIncreases()` + `executeIncrease()` | Pending |
| Parallel processing + immediate execution | Planning phase → Sequential execution | Pending |
| Mixed calculation/execution loop | Separate planning and execution phases | Pending |
| Limited visibility before execution | Complete execution plan upfront | Pending |
| Error handling during mixed operations | Clean separation: plan validation + execution errors | Pending |

## Risk Assessment

**High Risk Changes:**
- Modifying main handler flow
- Changing from parallel to sequential execution
- Potential performance impact

**Mitigation Strategies:**
- Maintain dry-run mode for safe testing
- Extensive logging for comparison
- Feature flag capability to revert if needed
- Performance benchmarking before/after

**Success Criteria:**
- Same loan increases calculated as before
- Better error reporting and recovery
- Complete execution plan visibility
- Acceptable performance (target: within 20% of current)