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

export interface LoanOffer {
  id: string;
  currency_pair: string;
  side: 'buy' | 'sell';
  quantity: string;
  price: string;
  order_id: string;
  fee_currency: string;
  fee_amount: string;
  order_status_type: string;
  order_type: string;
  created_time: string;
  updated_time: string;
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

export interface CreateLoanOfferRequest {
  side: 'buy' | 'sell';
  quantity: string;
  price: string;
  pair: string;
  post_only?: boolean;
  customer_order_id?: string;
}

export interface UpdateLoanOfferRequest {
  quantity?: string;
  price?: string;
}

export interface UpdateLoanRequest {
  totalAmount: string;
}

export interface LoanManagementConfig {
  minIncrementAmount: Record<string, string>;
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