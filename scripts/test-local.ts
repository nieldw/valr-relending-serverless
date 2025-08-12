#!/usr/bin/env tsx

import * as dotenv from 'dotenv';
import { handler } from '../src/functions/manage-loans';
import { HandlerEvent, HandlerContext } from '@netlify/functions';

dotenv.config();

async function testLocal() {
  console.log('🚀 Starting local test of VALR loan management function...\n');

  const mockEvent: HandlerEvent = {
    httpMethod: 'POST',
    headers: {},
    multiValueHeaders: {},
    path: '/.netlify/functions/manage-loans',
    queryStringParameters: {},
    multiValueQueryStringParameters: {},
    body: null,
    isBase64Encoded: false,
    rawUrl: 'http://localhost:8888/.netlify/functions/manage-loans',
    rawQuery: '',
  };

  const mockContext: HandlerContext = {
    callbackWaitsForEmptyEventLoop: true,
    functionName: 'manage-loans',
    functionVersion: '1',
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:manage-loans',
    memoryLimitInMB: '128',
    awsRequestId: 'test-request-id',
    logGroupName: '/aws/lambda/manage-loans',
    logStreamName: '2024/01/01/[$LATEST]abcdef123456789',
    getRemainingTimeInMillis: () => 30000,
    done: () => {},
    fail: () => {},
    succeed: () => {},
  };

  console.log('📊 Environment check:');
  console.log(`- VALR_API_KEY: ${process.env['VALR_API_KEY'] ? '✅ Set' : '❌ Missing'}`);
  console.log(`- VALR_API_SECRET: ${process.env['VALR_API_SECRET'] ? '✅ Set' : '❌ Missing'}`);
  console.log(`- DRY_RUN: ${process.env['DRY_RUN'] || 'false'}`);
  
  const minIncrement = process.env['MIN_INCREMENT_AMOUNT'];
  if (minIncrement) {
    try {
      const currencies = Object.keys(JSON.parse(minIncrement));
      console.log(`- MIN_INCREMENT_AMOUNT: ✅ Set (${currencies.length} currencies configured)`);
    } catch {
      console.log(`- MIN_INCREMENT_AMOUNT: ❌ Invalid JSON format`);
    }
  } else {
    console.log(`- MIN_INCREMENT_AMOUNT: ❌ Not set (will use API defaults)`);
  }
  
  console.log(`- MAX_LOAN_RATIO: ${process.env['MAX_LOAN_RATIO'] || '1.0'}\n`);

  if (!process.env['VALR_API_KEY'] || !process.env['VALR_API_SECRET']) {
    console.error('❌ Missing required environment variables. Please check your .env file.');
    console.log('\nRequired variables:');
    console.log('- VALR_API_KEY=your_api_key_here');
    console.log('- VALR_API_SECRET=your_api_secret_here');
    console.log('\nOptional variables:');
    console.log('- DRY_RUN=true (for testing without making actual changes)');
    console.log('- MIN_INCREMENT_AMOUNT={"ZAR": "100", "BTC": "0.0001", "ETH": "0.001"}');
    console.log('- MAX_LOAN_RATIO=0.8');
    process.exit(1);
  }

  try {
    console.log('⏳ Executing function...\n');
    const startTime = Date.now();
    
    const result = await handler(mockEvent, mockContext);
    
    const duration = Date.now() - startTime;
    
    console.log('✅ Function executed successfully!');
    console.log(`⏱️  Duration: ${duration}ms\n`);
    
    if (!result) {
      console.log('No result returned from handler');
      return;
    }
    
    console.log('📋 Response:');
    console.log(`Status Code: ${result.statusCode}`);
    console.log('Headers:', JSON.stringify(result.headers, null, 2));
    
    if (result.body) {
      try {
        const body = JSON.parse(result.body);
        console.log('Body:', JSON.stringify(body, null, 2));
        
        if (body.summary) {
          console.log('\n📊 Execution Summary:');
          console.log(`- Total subaccounts: ${body.summary.totalSubaccounts}`);
          console.log(`- Processed subaccounts: ${body.summary.processedSubaccounts}`);
          console.log(`- Total loans processed: ${body.summary.totalLoansProcessed}`);
          console.log(`- Total loans increased: ${body.summary.totalLoansIncreased}`);
          console.log(`- Errors: ${body.summary.errors.length}`);
          console.log(`- Duration: ${body.summary.durationMs}ms`);
          
          if (body.summary.errors.length > 0) {
            console.log('\n❌ Errors encountered:');
            body.summary.errors.forEach((error: string, index: number) => {
              console.log(`${index + 1}. ${error}`);
            });
          }
          
          if (body.summary.results.length > 0) {
            console.log('\n📈 Results by subaccount:');
            body.summary.results.forEach((result: any) => {
              console.log(`- ${result.subaccountLabel} (${result.subaccountId}):`);
              console.log(`  • Processed loans: ${result.processedLoans}`);
              console.log(`  • Increased loans: ${result.increasedLoans}`);
              if (Object.keys(result.totalAmountIncreased).length > 0) {
                console.log(`  • Amount increased:`, result.totalAmountIncreased);
              }
              if (result.errors.length > 0) {
                console.log(`  • Errors: ${result.errors.length}`);
              }
            });
          }
        }
      } catch (parseError) {
        if (result && result.body) {
          console.log('Raw Body:', result.body);
        }
      }
    }
    
  } catch (error: any) {
    console.error('❌ Function execution failed:');
    console.error(error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  testLocal().catch(console.error);
}