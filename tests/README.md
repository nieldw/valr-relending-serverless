# Unit Tests

This directory contains unit tests for the VALR relending serverless functions.

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run specific test file
npm test decimal.test.ts
```

## Test Coverage

### `decimal.test.ts`
Comprehensive tests for the `determineIncrements()` function covering:

- ✅ **Basic functionality** (30 test cases)
- ✅ **API integration** with `currencyInfo` parameter
- ✅ **Edge cases** and error conditions
- ✅ **Real-world VALR scenarios**
- ✅ **Function contract validation**

#### Test Groups:

1. **Basic functionality (no currencyInfo)**: Tests string parsing of decimal places
2. **With currencyInfo (API priority)**: Tests that API decimal places take precedence
3. **Edge cases**: Tests unusual input formats and boundary conditions
4. **Real-world VALR scenarios**: Tests actual use cases with ZAR, BTC, USDC
5. **Function contract validation**: Tests return type consistency and data integrity

#### Key Test Scenarios:

- **Custom increments with API data**: `determineIncrements("1", zarInfo)` → uses API decimal places (2), not string-derived (0)
- **Fallback behavior**: `determineIncrements("0.01")` → uses string-derived decimal places (2)
- **High precision scenarios**: Tests with 8+ decimal places for cryptocurrencies
- **Type safety**: Ensures consistent return structure regardless of input

## Adding New Tests

When adding new functionality to decimal utilities:

1. Create test cases covering normal usage
2. Add edge case tests
3. Test API integration scenarios
4. Verify error handling
5. Ensure backward compatibility

## Test Framework

Uses Jest testing framework with TypeScript support via ts-jest. Features include:

- Descriptive test organization with `describe` and `test` blocks
- Rich assertion library with `expect()` matchers
- Built-in mocking and coverage reporting
- Watch mode for development
- TypeScript integration without compilation step