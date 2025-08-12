import axios, { AxiosInstance, AxiosResponse } from 'axios';
import * as crypto from 'crypto';
import { 
  API_TIMEOUT_MS, 
  MAIN_ACCOUNT_ID, 
  DEFAULT_RETRY_ATTEMPTS,
  MIN_RETRY_DELAY_MS,
  MAX_RETRY_DELAY_MS
} from '../constants/currency-defaults';
import {
  ValrCredentials,
  Subaccount,
  SubaccountBalance,
  OpenLoan,
  CurrencyInfo,
  UpdateLoanRequest
} from '../types/valr';

export class ValrClient {
  private axiosInstance: AxiosInstance;
  private credentials: ValrCredentials;
  private baseUrl = 'https://api.valr.com';

  constructor(credentials: ValrCredentials) {
    this.credentials = credentials;
    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: API_TIMEOUT_MS,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.axiosInstance.interceptors.request.use((config) => {
      const timestamp = Date.now().toString();
      const method = config.method?.toUpperCase() || 'GET';
      const path = config.url || '';
      const body = config.data ? JSON.stringify(config.data) : '';
      const subaccountId = config.headers?.['X-VALR-SUB-ACCOUNT-ID'] as string;

      // Only include subaccount ID in signature if it's not the main account
      const signatureSubaccountId = (subaccountId && subaccountId !== MAIN_ACCOUNT_ID) ? subaccountId : undefined;
      const signature = this.createSignature(timestamp, method, path, body, signatureSubaccountId);
      
      config.headers['X-VALR-API-KEY'] = this.credentials.apiKey;
      config.headers['X-VALR-SIGNATURE'] = signature;
      config.headers['X-VALR-TIMESTAMP'] = timestamp;
      
      return config;
    });
  }

  private createSignature(timestamp: string, method: string, path: string, body: string = '', subaccountId?: string): string {
    let payload = `${timestamp}${method}${path}${body}`;
    if (subaccountId) {
      payload += subaccountId;
    }
    return crypto
      .createHmac('sha512', this.credentials.apiSecret)
      .update(payload)
      .digest('hex');
  }

  private async makeRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: any,
    subaccountId?: string
  ): Promise<T> {
    try {
      const headers: Record<string, string> = {};
      // Don't add subaccount header for main account
      if (subaccountId && subaccountId !== MAIN_ACCOUNT_ID) {
        headers['X-VALR-SUB-ACCOUNT-ID'] = subaccountId;
      }

      const response: AxiosResponse<T> = await this.axiosInstance.request({
        method,
        url: endpoint,
        data,
        headers,
      });
      return response.data;
    } catch (error: any) {
      // Log sanitized error details without exposing sensitive data
      console.error('VALR API request failed:', {
        method,
        endpoint,
        status: error.response?.status,
        hasResponseData: !!error.response?.data,
        message: error.message,
        timestamp: new Date().toISOString()
      });

      if (error.response) {
        const statusCode = error.response.status;
        const apiData = error.response.data;
        
        // Handle rate limiting first (can have empty data)
        if (statusCode === 429) {
          // Extract rate limit information from headers
          const retryAfter = error.response.headers['retry-after'];
          const rateLimitReset = error.response.headers['x-ratelimit-reset'];
          const rateLimitRemaining = error.response.headers['x-ratelimit-remaining'];
          
          // Create detailed rate limit error with timing information
          const rateLimitInfo = {
            retryAfter: retryAfter ? parseInt(retryAfter) : null,
            rateLimitReset: rateLimitReset ? parseInt(rateLimitReset) : null,
            rateLimitRemaining: rateLimitRemaining ? parseInt(rateLimitRemaining) : null
          };
          
          const error429 = new Error('VALR API Error: Rate limit exceeded');
          (error429 as any).rateLimitInfo = rateLimitInfo;
          throw error429;
        }
        
        // Handle responses with data
        if (apiData && apiData.code && typeof apiData.code === 'number') {
          throw new Error(`VALR API Error: {"code":${apiData.code},"message":"${apiData.message || 'Unknown error'}"}`);
        }
        
        // Fallback for other HTTP status codes
        if (statusCode === 401 || statusCode === 403) {
          throw new Error('VALR API Error: Unauthorized access');
        } else if (statusCode >= 400 && statusCode < 500) {
          throw new Error('VALR API Error: Invalid request');
        } else {
          throw new Error('VALR API Error: Service unavailable');
        }
      }
      
      // Generic error for network/other issues
      throw new Error('Request failed: Network or service error');
    }
  }

  private async makeRequestWithRetry<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: any,
    subaccountId?: string,
    maxRetries: number = DEFAULT_RETRY_ATTEMPTS
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.makeRequest<T>(method, endpoint, data, subaccountId);
      } catch (error: any) {
        lastError = error;
        
        // Check if this is a rate limit error with retry information
        if (error.message?.includes('Rate limit exceeded') && (error as any).rateLimitInfo && attempt < maxRetries) {
          const rateLimitInfo = (error as any).rateLimitInfo;
          
          // Calculate optimal wait time based on response headers
          let waitTimeMs = MIN_RETRY_DELAY_MS;
          
          if (rateLimitInfo.retryAfter) {
            // Use Retry-After header (in seconds)
            waitTimeMs = rateLimitInfo.retryAfter * 1000;
          } else if (rateLimitInfo.rateLimitReset) {
            // Calculate time until rate limit resets
            const resetTime = rateLimitInfo.rateLimitReset * 1000; // Convert to milliseconds
            const currentTime = Date.now();
            waitTimeMs = Math.max(resetTime - currentTime, MIN_RETRY_DELAY_MS);
          } else {
            // Exponential backoff if no header information
            waitTimeMs = Math.min(MIN_RETRY_DELAY_MS * Math.pow(2, attempt), MAX_RETRY_DELAY_MS);
          }
          
          console.log(`Rate limited. Waiting ${waitTimeMs}ms before retry ${attempt + 1}/${maxRetries}`, {
            endpoint,
            waitTimeMs
          });
          
          await new Promise(resolve => setTimeout(resolve, waitTimeMs));
          continue;
        }
        
        // For non-rate-limit errors, don't retry
        break;
      }
    }
    
    throw lastError;
  }

  async getSubaccounts(): Promise<Subaccount[]> {
    return this.makeRequestWithRetry<Subaccount[]>('GET', '/v1/account/subaccounts');
  }

  async getSubaccountBalances(subaccountId: string): Promise<SubaccountBalance[]> {
    return this.makeRequestWithRetry<SubaccountBalance[]>('GET', '/v1/account/balances', undefined, subaccountId);
  }

  async getOpenLoans(subaccountId: string, currency?: string): Promise<OpenLoan[]> {
    const params = currency ? `?currency=${currency}` : '';
    return this.makeRequestWithRetry<OpenLoan[]>('GET', `/v1/loans/open${params}`, undefined, subaccountId);
  }

  async updateLoan(
    subaccountId: string,
    loanId: string,
    updateRequest: UpdateLoanRequest
  ): Promise<OpenLoan> {
    return this.makeRequestWithRetry<OpenLoan>('PUT', '/v1/loans/increase', {
      loanId,
      ...updateRequest
    }, subaccountId);
  }

  async getCurrencies(): Promise<CurrencyInfo[]> {
    return this.makeRequestWithRetry<CurrencyInfo[]>('GET', '/v1/public/currencies');
  }
}