# VALR Relending Serverless

A TypeScript-based Netlify serverless function that automatically manages loan offers across VALR subaccounts. The function loops through all active subaccounts, checks available balances, and increases loan offers when sufficient funds are available.

## Features

- 🔄 **Automated Loan Management**: Automatically increases loan offers when funds are available
- 🏦 **Multi-Subaccount Support**: Processes all active subaccounts
- ⚙️ **Configurable**: Customizable minimum increments, currencies, and safety ratios
- 🔒 **Secure**: Proper VALR API authentication with HMAC signatures
- 🧪 **Testable**: Local testing support with dry-run mode
- 📊 **Comprehensive Logging**: Detailed execution logs and summaries
- ⏰ **Scheduled Execution**: Runs automatically via Netlify scheduled functions

## Project Structure

```
├── src/
│   ├── functions/
│   │   └── manage-loans.ts        # Main serverless function
│   ├── types/
│   │   └── valr.ts               # TypeScript type definitions
│   └── utils/
│       ├── valr-client.ts        # VALR API client
│       └── logger.ts             # Logging utility
├── scripts/
│   └── test-local.ts             # Local testing script
├── netlify.toml                  # Netlify configuration
├── tsconfig.json                 # TypeScript configuration
├── package.json                  # Dependencies and scripts
└── .env.example                  # Environment variables template
```

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy the example environment file and configure your settings:

```bash
cp .env.example .env
```

Edit `.env` with your VALR API credentials and preferences:

```env
# Required
VALR_API_KEY=your_api_key_here
VALR_API_SECRET=your_api_secret_here

# Optional (with defaults shown)
DRY_RUN=true
ENABLED_CURRENCIES=ZAR,BTC,ETH
MIN_INCREMENT_AMOUNT={"ZAR": "100", "BTC": "0.0001", "ETH": "0.001"}
MAX_LOAN_RATIO=0.8
```

### 3. Get VALR API Credentials

1. Log into your VALR account
2. Go to API settings
3. Create a new API key with trading permissions
4. Copy the API key and secret to your `.env` file

## Configuration Options

| Variable | Description | Default |
|----------|-------------|---------|
| `VALR_API_KEY` | Your VALR API key | Required |
| `VALR_API_SECRET` | Your VALR API secret | Required |
| `DRY_RUN` | Test mode without making changes | `true` |
| `ENABLED_CURRENCIES` | Currencies to manage (comma-separated) | `ZAR,BTC,ETH` |
| `MIN_INCREMENT_AMOUNT` | Minimum amounts to add per currency (JSON) | `{"ZAR": "100", "BTC": "0.0001", "ETH": "0.001"}` |
| `MAX_LOAN_RATIO` | Max percentage of balance to use (0.0-1.0) | `0.8` |

## Development

### Build the Project

```bash
npm run build
```

### Local Testing

Test the function locally before deployment:

```bash
npm run test:local
```

This will:
- Validate your environment variables
- Execute the function in test mode
- Display detailed execution results
- Show any errors or issues

### Development Server

Run the Netlify development server:

```bash
npm run dev
```

The function will be available at `http://localhost:8888/.netlify/functions/manage-loans`

## Deployment

### 1. Deploy to Netlify

```bash
npm run deploy
```

### 2. Configure Environment Variables in Netlify

In your Netlify dashboard:
1. Go to Site settings → Environment variables
2. Add all required environment variables from your `.env` file
3. Set `DRY_RUN=false` for production use

### 3. Scheduled Execution

The function is configured to run every 6 hours automatically. You can modify the schedule in `netlify.toml`:

```toml
[[functions]]
  path = "dist/functions/manage-loans.js"
  schedule = "0 */6 * * *"  # Every 6 hours
```

## How It Works

1. **Authentication**: Connects to VALR API using HMAC-signed requests
2. **Subaccount Discovery**: Fetches all active subaccounts
3. **Balance Check**: Gets available balances for each subaccount
4. **Loan Analysis**: Identifies active loan offers (sell orders)
5. **Increase Calculation**: Determines safe increase amounts based on:
   - Available balance
   - Minimum increment thresholds
   - Maximum loan ratio limits
6. **Execution**: Updates loan offers (or logs in dry-run mode)
7. **Reporting**: Returns comprehensive execution summary

## Safety Features

- **Dry Run Mode**: Test without making actual changes
- **Maximum Loan Ratio**: Prevents using all available balance
- **Minimum Increments**: Avoids tiny, uneconomical increases
- **Currency Filtering**: Only processes enabled currencies
- **Error Handling**: Continues processing other loans if one fails
- **Comprehensive Logging**: Tracks all actions and decisions

## Monitoring

The function returns detailed execution summaries including:
- Number of subaccounts processed
- Total loans analyzed and increased
- Amount increased per currency
- Execution time and any errors

Example response:
```json
{
  "success": true,
  "summary": {
    "totalSubaccounts": 3,
    "processedSubaccounts": 3,
    "totalLoansProcessed": 12,
    "totalLoansIncreased": 5,
    "durationMs": 2340
  }
}
```

## Security

- API credentials are handled securely with HMAC signing
- No sensitive data is logged
- Environment variables are used for configuration
- All requests use HTTPS

## Troubleshooting

### Common Issues

1. **Missing API credentials**: Ensure `VALR_API_KEY` and `VALR_API_SECRET` are set
2. **Authentication errors**: Verify API key has trading permissions
3. **No loans processed**: Check if subaccounts have active loan offers
4. **Insufficient funds**: Verify balances meet minimum increment requirements

### Debug Mode

Set logging to debug level for detailed information:
```env
LOG_LEVEL=DEBUG
```

### Testing API Connection

Use the local test script to verify your API connection:
```bash
npm run test:local
```

## License

MIT Licence - see LICENCE file for details.