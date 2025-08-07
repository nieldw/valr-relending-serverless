import axios, { AxiosInstance, AxiosResponse } from 'axios';
import * as crypto from 'crypto';
import {
  ValrCredentials,
  ValrApiResponse,
  Subaccount,
  SubaccountBalance,
  LoanOffer,
  CreateLoanOfferRequest,
  UpdateLoanOfferRequest
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
      
      const signature = this.createSignature(timestamp, method, path, body);
      
      config.headers['X-VALR-API-KEY'] = this.credentials.apiKey;
      config.headers['X-VALR-SIGNATURE'] = signature;
      config.headers['X-VALR-TIMESTAMP'] = timestamp;
      
      return config;
    });
  }

  private createSignature(timestamp: string, method: string, path: string, body: string = ''): string {
    const payload = `${timestamp}${method}${path}${body}`;
    return crypto
      .createHmac('sha512', this.credentials.apiSecret)
      .update(payload)
      .digest('hex');
  }

  private async makeRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: any
  ): Promise<T> {
    try {
      const response: AxiosResponse<T> = await this.axiosInstance.request({
        method,
        url: endpoint,
        data,
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
    return this.makeRequest<SubaccountBalance[]>('GET', `/v1/account/${subaccountId}/balances`);
  }

  async getOpenOrders(subaccountId: string, currencyPair?: string): Promise<LoanOffer[]> {
    const params = currencyPair ? `?currency_pair=${currencyPair}` : '';
    return this.makeRequest<LoanOffer[]>('GET', `/v1/orders/open${params}`, {
      headers: { 'X-VALR-SUB-ACCOUNT-ID': subaccountId }
    });
  }

  async createLoanOffer(subaccountId: string, orderRequest: CreateLoanOfferRequest): Promise<LoanOffer> {
    return this.makeRequest<LoanOffer>('POST', '/v1/orders/limit', {
      ...orderRequest,
      headers: { 'X-VALR-SUB-ACCOUNT-ID': subaccountId }
    });
  }

  async updateLoanOffer(
    subaccountId: string,
    orderId: string,
    updateRequest: UpdateLoanOfferRequest
  ): Promise<LoanOffer> {
    return this.makeRequest<LoanOffer>('PUT', `/v1/orders/${orderId}`, {
      ...updateRequest,
      headers: { 'X-VALR-SUB-ACCOUNT-ID': subaccountId }
    });
  }

  async cancelOrder(subaccountId: string, orderId: string): Promise<void> {
    await this.makeRequest<void>('DELETE', `/v1/orders/${orderId}`, {
      headers: { 'X-VALR-SUB-ACCOUNT-ID': subaccountId }
    });
  }

  async getOrderBook(currencyPair: string): Promise<any> {
    return this.makeRequest<any>('GET', `/v1/public/orderbook/${currencyPair}`);
  }

  async getTicker(currencyPair: string): Promise<any> {
    return this.makeRequest<any>('GET', `/v1/public/ticker/${currencyPair}`);
  }
}