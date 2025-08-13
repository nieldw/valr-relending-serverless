# VALR Relending Serverless

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/nieldw/valr-relending-serverless)

A production-ready TypeScript serverless function that automatically manages VALR loan offers with intelligent rate limiting, comprehensive security, and advanced financial controls. The system uses a two-phase architecture: planning all increases upfront, then executing them sequentially with smart retry logic.

## 🚀 Features

### Core Functionality
- 🔄 **Automated Loan Management**: Intelligent loan offer increases when funds are available
- 🏦 **Multi-Subaccount Support**: Processes all active subaccounts in parallel
- 📊 **Two-Phase Execution**: Plans all increases first, then executes sequentially
- ⚡ **Intelligent Rate Limiting**: Header-based retry logic with exponential backoff
- 💰 **Precise Financial Calculations**: Decimal arithmetic prevents floating-point errors

### Security & Reliability
- 🔒 **Enterprise Security**: HMAC-SHA512 API authentication with credential protection
- 🛡️ **Input Validation**: Comprehensive environment variable and configuration validation
- 🔍 **Error Sanitization**: No sensitive data exposure in logs or responses
- 🧪 **Dry Run Mode**: Safe testing without making actual transactions
- 📋 **Comprehensive Logging**: Structured logging with execution tracking

### Performance & Control
- ⚙️ **Configurable**: Customizable increments, ratios, and safety controls
- ⏰ **Scheduled Execution**: Automatic execution via Netlify (every 6 hours)
- 📈 **Performance Optimized**: No artificial delays, intelligent API usage
- 🎯 **Resource Planning**: Complete visibility of planned changes before execution

## 📁 Project Structure

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
│   └── constants/
│       └── currency-defaults.ts  # Default configurations
├── scripts/
│   └── test-local.ts             # Local testing script
├── netlify.toml                  # Netlify configuration
├── tsconfig.json                 # TypeScript configuration
└── package.json                  # Dependencies and scripts
```

## 🚀 Quick Start

### Option 1: Deploy to Netlify (Recommended)

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/nieldw/valr-relending-serverless)

1. Click the deploy button above
2. Connect your GitHub account
3. Configure environment variables in Netlify dashboard
4. Your function will be deployed and ready to use!

### Option 2: Manual Setup

#### 1. Clone and Install

```bash
git clone https://github.com/yourusername/valr-relending-serverless.git
cd valr-relending-serverless
npm install
```

#### 2. Configure Environment Variables

Create a `.env` file with your VALR credentials:

```env
# VALR API Credentials (Required)
# Get these from your VALR account API settings
VALR_API_KEY=your_64_character_api_key_here
VALR_API_SECRET=your_64_character_api_secret_here

# Loan Management Configuration
# Set to true for testing without making actual changes
DRY_RUN=false

# Optional: Custom minimum amounts to add to loan offers (JSON format)
# If not set, amounts will be automatically determined based on each currency's withdrawal decimal places
MIN_INCREMENT_AMOUNT={"ZAR": "1", "BTC": "0.00001", "ETH": "0.0001", "XRP": "0.1"}

# Maximum ratio of available balance to use for loan increases (0.0 to 1.0)
# 0.8 means use up to 80% of available balance
MAX_LOAN_RATIO=1.0

# Optional: Logging level (DEBUG, INFO, WARN, ERROR)
LOG_LEVEL=DEBUG
```

#### 3. Get VALR API Credentials

1. Log into your [VALR account](https://www.valr.com)
2. Go to **Settings** → **API**
3. Create a new API key with **trading permissions**
4. Copy the 64-character API key and secret to your `.env` file

**Important**: Your API key must have trading permissions to modify loan offers.

## ⚙️ Configuration Reference

| Variable | Description | Format | Default |
|----------|-------------|--------|---------|
| `VALR_API_KEY` | Your VALR API key (64 chars) | Hexadecimal string | **Required** |
| `VALR_API_SECRET` | Your VALR API secret (64 chars) | Hexadecimal string | **Required** |
| `DRY_RUN` | Test mode without actual changes | `true` or `false` | `false` |
| `MIN_INCREMENT_AMOUNT` | Minimum amounts per currency | JSON object | Auto-calculated |
| `MAX_LOAN_RATIO` | Max balance percentage to use | `0.0` to `1.0` | `1.0` |
| `LOG_LEVEL` | Logging verbosity | `DEBUG/INFO/WARN/ERROR` | `INFO` |

### MIN_INCREMENT_AMOUNT Format

```json
{
  "ZAR": "1.0",
  "BTC": "0.00001",
  "ETH": "0.0001",
  "USDC": "0.01",
  "USDT": "0.01",
  "XRP": "0.000001"
}
```

If not provided, the system automatically determines minimum amounts based on each currency's withdrawal decimal places from the VALR API.

## 🛠️ Development

### Local Testing

Test the function locally before deployment:

```bash
# Test with current configuration
npm run test:local

# Build the project
npm run build

# Type checking
npm run type-check
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

## 🚀 Deployment

### Netlify Deployment

1. **Deploy the function:**
   ```bash
   npm run deploy
   ```

2. **Configure environment variables** in Netlify dashboard:
   - Go to **Site settings** → **Environment variables**
   - Add all variables from your `.env` file
   - Set `DRY_RUN=false` for production

3. **Scheduled execution** is automatically configured to run every 6 hours

### Environment Variables in Netlify

In your Netlify dashboard, add these environment variables:

| Variable | Value | Note |
|----------|-------|------|
| `VALR_API_KEY` | Your 64-character API key | Keep secure |
| `VALR_API_SECRET` | Your 64-character API secret | Keep secure |
| `DRY_RUN` | `false` | Set to `true` for testing |
| `MAX_LOAN_RATIO` | `1.0` | Adjust based on risk tolerance |
| `LOG_LEVEL` | `INFO` | Use `DEBUG` for troubleshooting |

## 🔄 How It Works

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

## 📊 Monitoring & Logging

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

## 🔒 Security Features

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

## 🚨 Troubleshooting

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

## 📈 Performance

### Optimization Features
- **No Artificial Delays**: Only waits when actually rate limited
- **Parallel Data Collection**: Fetches all data simultaneously
- **Intelligent Retry Logic**: Uses API guidance for optimal timing
- **Efficient Error Handling**: Fails fast on non-retryable errors

### Typical Performance
- **Planning Phase**: ~1-2 seconds for 20+ subaccounts
- **Execution Phase**: ~200ms per loan increase (when not rate limited)
- **Total Execution**: Usually under 30 seconds for moderate loan counts

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Ensure TypeScript compilation passes
5. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer

This software is provided as-is for educational and automation purposes. Always test thoroughly with `DRY_RUN=true` before using in production. Users are responsible for understanding VALR's terms of service and API usage policies.

**Use at your own risk. The authors are not responsible for any financial losses.**