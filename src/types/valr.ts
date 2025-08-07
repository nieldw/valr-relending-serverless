export interface ValrCredentials {
  apiKey: string;
  apiSecret: string;
}

export interface ValrApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface Subaccount {
  id: string;
  label: string;
  active: boolean;
  created_at: string;
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

export interface LoanManagementConfig {
  minIncrementAmount: Record<string, string>;
  maxLoanRatio: number;
  enabledCurrencies: string[];
  dryRun: boolean;
}

export interface ProcessingResult {
  subaccountId: string;
  subaccountLabel: string;
  processedLoans: number;
  increasedLoans: number;
  totalAmountIncreased: Record<string, string>;
  errors: string[];
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
}