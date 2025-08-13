export interface ValrCredentials {
  apiKey: string;
  apiSecret: string;
}


export interface Subaccount {
  id: string;
  label: string;
}

export interface SubaccountBalance {
  currency: string;
  available: string;
  reserved: string;
  total: string;
}

export interface OpenLoan {
  loanId: string;
  currency: string;
  totalAmount: string;
  usedAmount: string;
  hourlyRate: string;
  createdAt: string;
  updatedAt: string;
}

export interface CurrencyInfo {
  symbol: string;
  isActive: boolean;
  shortName: string;
  longName: string;
  decimalPlaces: number;
  withdrawalDecimalPlaces: number;
}

export interface UpdateLoanRequest {
  currencySymbol: string;
  increaseLoanAmountBy: string;
  loanId: string;
}

export interface LoanManagementConfig {
  minIncrementAmount: Record<string, string>;
  currencyDecimalPlaces: Record<string, number>;
  maxLoanRatio: number;
  dryRun: boolean;
}

export interface LoanManagementConfigInput {
  maxLoanRatio: number;
  dryRun: boolean;
  customMinIncrements?: Record<string, string> | undefined;
}

export interface ProcessingResult {
  subaccountId: string;
  subaccountLabel: string;
  processedLoans: number;
  increasedLoans: number;
  totalAmountIncreased: Record<string, string>;
  errors: string[];
}

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
  estimatedExecutionTimeMs: number;
  riskAssessment: string;
}

export interface ExecutionResult {
  plannedIncrease: PlannedLoanIncrease;
  success: boolean;
  error?: string;
  executedAt: string;
  durationMs: number;
}

export interface ExecutionSummary {
  timestamp: string;
  totalSubaccounts: number;
  processedSubaccounts: number;
  totalLoansProcessed: number;
  totalLoansIncreased: number;
  results: ProcessingResult[];
  errors: string[];
  durationMs: number;
  executionPlan?: LoanExecutionPlan;
  executionResults?: ExecutionResult[];
}