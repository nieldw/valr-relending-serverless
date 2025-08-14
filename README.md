[![Netlify Status](https://api.netlify.com/api/v1/badges/264ae0e3-7bf4-48de-8501-602b51506e72/deploy-status)](https://app.netlify.com/projects/unique-fenglisu-ccd3df/deploys)

# VALR Relending Serverless

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/nieldw/valr-relending-serverless)

A production-ready TypeScript serverless function that automatically increases [VALR.com](https://www.valr.com/invite/VARVXA5D) loan offers with any available balance on all subaccounts with active loans.

## 🚀 Features

- 🔄 **Automated Loan Management**: Intelligent loan offer increases when funds are available
- 🏦 **Multi-Subaccount Support**: Processes all active subaccounts in parallel
- ⚡ **Intelligent Rate Limiting**: Header-based retry logic with exponential backoff
- 🔒 **Enterprise Security**: HMAC-SHA512 authentication with credential protection
- 🛡️ **Comprehensive Validation**: Input validation with error sanitization
- 🧪 **Dry Run Mode**: Safe testing without making actual transactions
- ⚙️ **Configurable**: Customizable increments, ratios, and safety controls
- ⏰ **Scheduled Execution**: Automatic execution via Netlify

## 🚀 Quick Start

### Deploy to Netlify (Recommended)

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/nieldw/valr-relending-serverless)

1. Click the deploy button above
2. Connect your GitHub account
3. Configure environment variables in Netlify dashboard
4. Your function will be deployed and ready to use!

### Getting VALR API Credentials

1. Log into your [VALR account](https://www.valr.com)
2. Go to **Settings** → **API**
3. Create a new API key with **trading permissions** ONLY
4. Copy the API key and secret to your environment variables

## 📚 Documentation

- **[📖 Technical Documentation](TECHNICAL.md)** - Complete setup, configuration, and development guide
- **[🚀 Deployment Guide](TECHNICAL.md#deployment)** - Detailed deployment instructions
- **[⚙️ Configuration Reference](TECHNICAL.md#configuration-reference)** - All environment variables and options
- **[🔧 Development Guide](TECHNICAL.md#development-guide)** - Local testing and development
- **[🚨 Troubleshooting](TECHNICAL.md#troubleshooting)** - Common issues and solutions
- **[🔒 Security Features](TECHNICAL.md#security-features)** - Security implementation details

## 🔄 How It Works

The system operates in two phases:

1. **Planning Phase**: Analyses all subaccounts and calculates optimal loan increases
2. **Execution Phase**: Applies changes sequentially with intelligent rate limiting

All operations include comprehensive validation, error handling, and detailed reporting.

## ⚠️ Important Notes

- **Test First**: Always run with `DRY_RUN=true` before production use
- **API Permissions**: Your VALR API key must have trading permissions
- **Monitoring**: Check execution logs and summaries regularly

## 🫶 Tip the Developer 
Like this? Please show your gratitude by sending me a tip with VALR Pay.

**VALR Pay** me here: https://www.valr.com/payments/send?payId=NNTK2CDK5SRQGC7QE9QK

## 📄 Licence

MIT Licence - see [LICENCE](LICENCE) file for details.

## ⚠️ Disclaimer

This software is provided as-is for educational and automation purposes. Always test thoroughly with `DRY_RUN=true` before using in production. Users are responsible for understanding VALR's terms of service and API usage policies.

**Use at your own risk. The authors are not responsible for any financial losses.**