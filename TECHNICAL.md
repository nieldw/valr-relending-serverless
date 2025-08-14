# Technical Documentation

← [Back to README](README.md)

## Table of Contents

- [Project Structure](#project-structure)
- [Configuration Reference](#configuration-reference)
- [Development Guide](#development-guide)
- [Deployment](#deployment)
- [How It Works](#how-it-works)
- [Security Features](#security-features)
- [Performance](#performance)
- [Monitoring & Logging](#monitoring--logging)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

## Project Structure

```
├── src/
│   ├── functions/
│   │   └── manage-loans.ts        # Main serverless function
│   ├── types/
│   │   └── valr.ts               # TypeScript interfaces
│   ├── utils/
│   │   ├── valr-client.ts        # VALR API client with retry logic
│   │   ├── logger.ts             # Structured logging
│   │   ├── decimal.ts            # Financial arithmetic utilities
│   │   └── validation.ts         # Input validation functions
│   ├── constants/
│   │   └── currency-defaults.ts  # Default configurations
│   └── config.ts                 # Centralized configuration management
├── scripts/
│   └── test-local.ts             # Local testing script
├── tests/
│   └── decimal.test.ts           # Unit tests for decimal utilities
├── netlify.toml                  # Netlify configuration
├── tsconfig.json                 # TypeScript configuration
└── package.json                  # Dependencies and scripts
```

## Configuration Reference

### Required Environment Variables

| Variable | Description | Format | Example |
|----------|-------------|--------|---------|
| `VALR_API_KEY` | Your VALR API key (64 chars) | Hexadecimal string | `abc123...` (64 chars) |
| `VALR_API_SECRET` | Your VALR API secret (64 chars) | Hexadecimal string | `def456...` (64 chars) |

### Optional Environment Variables

| Variable | Description | Format | Default |
|----------|-------------|--------|---------|
| `DRY_RUN` | Test mode without actual changes | `true` or `false` | `false` |
| `MIN_INCREMENT_AMOUNT` | Minimum amounts per currency | JSON object | Auto-calculated |
| `MAX_LOAN_RATIO` | Max balance percentage to use | `0.0` to `1.0` | `1.0` |
| `LOG_LEVEL` | Logging verbosity | `DEBUG/INFO/WARN/ERROR` | `INFO` |

### Getting VALR API Credentials

1. Log into your [VALR account](https://www.valr.com)
2. Go to **Settings** → **API**
3. Create a new API key with **trading permissions**
4. Copy the 64-character API key and secret to your environment variables

**Important**: Your API key must have trading permissions to modify loan offers.

### Configuration Examples

**Basic Configuration (.env file):**
Refer to `.env.example` for a sample configuration and placeholder values.

If `MIN_INCREMENT_AMOUNT` is not provided, the system automatically determines minimum amounts based on each currency's withdrawal decimal places from the VALR API.

## Development Guide

### Local Development Setup

1. **Clone and Install Dependencies:**
   ```bash
   git clone https://github.com/yourusername/valr-relending-serverless.git
   cd valr-relending-serverless
   npm install
   ```

2. **Configure Environment Variables:**
   Create a `.env` file with your VALR credentials (see Configuration Reference above).

3. **Build the Project:**
   ```bash
   npm run build
   ```

### Local Testing

Test the function locally before deployment:

```bash
# Test with current configuration
DRY_RUN=true npm run test:local

# Type checking
npm run type-check

# Run unit tests
npm test
```

The test script will:
- ✅ Validate environment variables
- ✅ Execute the function safely
- ✅ Display execution plan and results
- ✅ Show any errors or configuration issues

### Development Server

Run the Netlify development server:

```bash
npm run dev
```

The function will be available at:
`http://localhost:8888/.netlify/functions/manage-loans`

### Testing API Connection

Verify your setup with the test script:

```bash
npm run test:local
```

This will validate:
- Environment variable configuration
- API credential authentication
- Subaccount access
- Loan detection and calculation logic

## Deployment

### Netlify Deployment

1. **Deploy the function:**
   ```bash
   npm run deploy
   ```

2. **Configure environment variables** in Netlify dashboard:
   - Go to **Site settings** → **Environment variables**
   - Add all variables from your `.env` file
   - Set `DRY_RUN=false` for production

3. **Scheduled execution** is automatically configured to run daily

### Environment Variables in Netlify

In your Netlify dashboard, add these environment variables:

| Variable | Value | Note |
|----------|-------|------|
| `VALR_API_KEY` | Your 64-character API key | Keep secure |
| `VALR_API_SECRET` | Your 64-character API secret | Keep secure |
| `DRY_RUN` | `false` | Set to `true` for testing |
| `MAX_LOAN_RATIO` | `1.0` | Adjust based on risk tolerance |
| `LOG_LEVEL` | `INFO` | Use `DEBUG` for troubleshooting |

## How It Works

### Two-Phase Architecture

The system uses an intelligent two-phase approach:

#### Phase 1: Planning
1. **Parallel Data Collection**: Fetches all subaccounts and their loans simultaneously
2. **Financial Analysis**: Calculates optimal increases for each loan
3. **Risk Assessment**: Validates total impact and resource usage
4. **Execution Plan**: Creates comprehensive plan with timing estimates

#### Phase 2: Sequential Execution  
1. **Controlled Execution**: Applies increases one by one with progress tracking
2. **Intelligent Rate Limiting**: Uses API response headers for optimal timing
3. **Error Resilience**: Continues processing even if individual loans fail
4. **Comprehensive Reporting**: Tracks success/failure for each operation

### Smart Rate Limiting

- **Header-Based Timing**: Uses `Retry-After` and `X-RateLimit-Reset` headers
- **Exponential Backoff**: Intelligent fallback when headers unavailable
- **No Artificial Delays**: Only waits when actually rate limited
- **Auth Error Handling**: Doesn't retry authorization failures

### Financial Safety Controls

- **Decimal Arithmetic**: Prevents floating-point precision errors
- **Maximum Loan Ratio**: Limits percentage of available balance used
- **Minimum Increments**: Avoids economically unviable small increases
- **Currency Validation**: Only processes valid, active currencies
- **Comprehensive Validation**: Validates all inputs before execution

## Security Features

### Credential Protection
- ✅ No credentials logged in error messages
- ✅ Sanitized error responses without sensitive data
- ✅ Secure HMAC-SHA512 API authentication
- ✅ Environment variable validation

### Input Validation
- ✅ API key format validation (64 chars, hexadecimal)
- ✅ Financial amount validation and sanitization
- ✅ Configuration parameter bounds checking
- ✅ JSON structure validation for complex inputs

### Error Handling
- ✅ Graceful degradation on individual loan failures
- ✅ Comprehensive error logging with context
- ✅ No sensitive data exposure in HTTP responses
- ✅ Structured error reporting

## Performance

### Optimization Features
- **No Artificial Delays**: Only waits when actually rate limited
- **Parallel Data Collection**: Fetches all data simultaneously
- **Intelligent Retry Logic**: Uses API guidance for optimal timing
- **Efficient Error Handling**: Fails fast on non-retryable errors

### Typical Performance
- **Planning Phase**: ~1-2 seconds for 20+ subaccounts
- **Execution Phase**: ~200ms per loan increase (when not rate limited)
- **Total Execution**: Usually under 30 seconds for moderate loan counts

## Monitoring & Logging

### Execution Summary

The function returns detailed execution summaries:

```json
{
  "success": true,
  "summary": {
    "timestamp": "2025-08-12T15:36:30.061Z",
    "totalSubaccounts": 17,
    "processedSubaccounts": 17,
    "totalLoansProcessed": 6,
    "totalLoansIncreased": 5,
    "durationMs": 2260,
    "executionPlan": {
      "plannedIncreases": [...],
      "totalIncreasesByCurrency": {
        "ZAR": "23.70",
        "BTC": "0.00008044",
        "ETH": "0.00010946"
      },
      "riskAssessment": "Medium risk - moderate increases"
    },
    "executionResults": [...]
  }
}
```

### Logging Levels

- **DEBUG**: Detailed execution flow and calculations
- **INFO**: Standard operation logs and summaries  
- **WARN**: Non-critical issues and configuration warnings
- **ERROR**: Failures and critical issues

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|--------|----------|
| **"API key must be exactly 64 characters"** | Invalid API key format | Verify API key is 64-character hex string |
| **"Unauthorized"** (-93 error) | API permissions or invalid credentials | Check API key has trading permissions |
| **"Rate limit exceeded"** | Too many API calls | System automatically retries with delays |
| **"No loans processed"** | No active loan offers | Verify subaccounts have active sell orders |
| **"Insufficient funds"** | Balance below minimum | Check available balances meet increment thresholds |

### Debug Mode

Enable detailed logging for troubleshooting:

```env
LOG_LEVEL=DEBUG
```

This will show:
- Detailed execution flow
- Financial calculations
- API request/response details
- Rate limiting decisions

### Testing API Connection

Verify your setup with the test script:

```bash
npm run test:local
```

This will validate:
- Environment variable configuration
- API credential authentication
- Subaccount access
- Loan detection and calculation logic

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Ensure TypeScript compilation passes
5. Submit a pull request

### Development Guidelines

- Use TypeScript for all new code
- Add unit tests for new functionality
- Follow existing code style and patterns
- Update documentation for any API changes
- Test locally before submitting PRs