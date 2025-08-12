import axios, { AxiosInstance, AxiosResponse } from 'axios';
import * as crypto from 'crypto';
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
      timeout: 30000,
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
      const signatureSubaccountId = (subaccountId && subaccountId !== '0') ? subaccountId : undefined;
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
      // Don't add subaccount header for main account (ID "0")
      if (subaccountId && subaccountId !== '0') {
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
      if (error.response?.data) {
        throw new Error(`VALR API Error: ${JSON.stringify(error.response.data)}`);
      }
      throw new Error(`Request failed: ${error.message}`);
    }
  }

  async getSubaccounts(): Promise<Subaccount[]> {
    return this.makeRequest<Subaccount[]>('GET', '/v1/account/subaccounts');
  }

  async getSubaccountBalances(subaccountId: string): Promise<SubaccountBalance[]> {
    return this.makeRequest<SubaccountBalance[]>('GET', '/v1/account/balances', undefined, subaccountId);
  }

  async getOpenLoans(subaccountId: string, currency?: string): Promise<OpenLoan[]> {
    const params = currency ? `?currency=${currency}` : '';
    return this.makeRequest<OpenLoan[]>('GET', `/v1/loans/open${params}`, undefined, subaccountId);
  }

  async updateLoan(
    subaccountId: string,
    loanId: string,
    updateRequest: UpdateLoanRequest
  ): Promise<OpenLoan> {
    return this.makeRequest<OpenLoan>('PUT', '/v1/loans/increase', {
      loanId,
      ...updateRequest
    }, subaccountId);
  }

  async getCurrencies(): Promise<CurrencyInfo[]> {
    return this.makeRequest<CurrencyInfo[]>('GET', '/v1/public/currencies');
  }
}