/**
 * Unit tests for decimal utility functions
 * Tests the determineIncrements function with various scenarios using Jest
 */

import { determineIncrements } from '../src/utils/decimal';
import { CurrencyInfo } from '../src/types/valr';

// Mock CurrencyInfo objects for testing
const mockZAR: CurrencyInfo = {
  symbol: 'R',
  isActive: true,
  shortName: 'ZAR',
  longName: 'South African Rand',
  decimalPlaces: 2,
  withdrawalDecimalPlaces: 2
};

const mockBTC: CurrencyInfo = {
  symbol: '₿',
  isActive: true,
  shortName: 'BTC',
  longName: 'Bitcoin',
  decimalPlaces: 8,
  withdrawalDecimalPlaces: 8
};

const mockUSDC: CurrencyInfo = {
  symbol: '$',
  isActive: true,
  shortName: 'USDC',
  longName: 'USD Coin',
  decimalPlaces: 6,
  withdrawalDecimalPlaces: 6
};

describe('determineIncrements', () => {
  describe('Basic functionality (no currencyInfo)', () => {
    test('should handle integer increment', () => {
      const result = determineIncrements('1');
      expect(result.minIncrement).toBe('1');
      expect(result.decimalPlaces).toBe(0);
    });

    test('should handle decimal increment with 2 places', () => {
      const result = determineIncrements('0.01');
      expect(result.minIncrement).toBe('0.01');
      expect(result.decimalPlaces).toBe(2);
    });

    test('should handle decimal increment with 8 places', () => {
      const result = determineIncrements('0.00000001');
      expect(result.minIncrement).toBe('0.00000001');
      expect(result.decimalPlaces).toBe(8);
    });

    test('should handle increment with trailing zeros', () => {
      const result = determineIncrements('1.000');
      expect(result.minIncrement).toBe('1.000');
      expect(result.decimalPlaces).toBe(3);
    });

    test('should handle large increment', () => {
      const result = determineIncrements('1000');
      expect(result.minIncrement).toBe('1000');
      expect(result.decimalPlaces).toBe(0);
    });

    test('should handle very small increment', () => {
      const result = determineIncrements('0.000001');
      expect(result.minIncrement).toBe('0.000001');
      expect(result.decimalPlaces).toBe(6);
    });
  });

  describe('With currencyInfo (API decimal places priority)', () => {
    test('should use API decimal places for ZAR custom increment', () => {
      const result = determineIncrements('1', mockZAR);
      expect(result.minIncrement).toBe('1');
      expect(result.decimalPlaces).toBe(2); // From API, not from string (0)
    });

    test('should use API decimal places for BTC custom increment', () => {
      const result = determineIncrements('0.0001', mockBTC);
      expect(result.minIncrement).toBe('0.0001');
      expect(result.decimalPlaces).toBe(8); // From API, not from string (4)
    });

    test('should use API decimal places for USDC custom increment', () => {
      const result = determineIncrements('0.01', mockUSDC);
      expect(result.minIncrement).toBe('0.01');
      expect(result.decimalPlaces).toBe(6); // From API, not from string (2)
    });

    test('should use API decimal places even when string has more precision', () => {
      const result = determineIncrements('1.123456789', mockZAR);
      expect(result.minIncrement).toBe('1.123456789');
      expect(result.decimalPlaces).toBe(2); // From API, not from string (9)
    });

    test('should use API decimal places even when string has less precision', () => {
      const result = determineIncrements('1', mockBTC);
      expect(result.minIncrement).toBe('1');
      expect(result.decimalPlaces).toBe(8); // From API, not from string (0)
    });
  });

  describe('Edge cases', () => {
    test('should handle empty decimal part', () => {
      const result = determineIncrements('5.');
      expect(result.minIncrement).toBe('5.');
      expect(result.decimalPlaces).toBe(0); // Empty decimal part = 0 places
    });

    test('should handle increment with only zeros after decimal', () => {
      const result = determineIncrements('10.00');
      expect(result.minIncrement).toBe('10.00');
      expect(result.decimalPlaces).toBe(2);
    });

    test('should handle increment starting with decimal point', () => {
      const result = determineIncrements('.5');
      expect(result.minIncrement).toBe('.5');
      expect(result.decimalPlaces).toBe(1);
    });

    test('should handle zero increment', () => {
      const result = determineIncrements('0');
      expect(result.minIncrement).toBe('0');
      expect(result.decimalPlaces).toBe(0);
    });

    test('should handle zero with decimals', () => {
      const result = determineIncrements('0.000');
      expect(result.minIncrement).toBe('0.000');
      expect(result.decimalPlaces).toBe(3);
    });
  });

  describe('Real-world VALR scenarios', () => {
    test('should handle ZAR fallback scenario (API unavailable)', () => {
      // When API is unavailable, use string-derived decimal places
      const result = determineIncrements('1.00');
      expect(result.minIncrement).toBe('1.00');
      expect(result.decimalPlaces).toBe(2);
    });

    test('should handle BTC with API info', () => {
      // When API is available, use API decimal places
      const result = determineIncrements('0.00001', mockBTC);
      expect(result.minIncrement).toBe('0.00001');
      expect(result.decimalPlaces).toBe(8); // From API, not 5
    });

    test('should handle custom increment larger than typical', () => {
      const result = determineIncrements('100', mockZAR);
      expect(result.minIncrement).toBe('100');
      expect(result.decimalPlaces).toBe(2); // From API
    });

    test('should handle very precise custom increment', () => {
      const result = determineIncrements('0.123456', mockUSDC);
      expect(result.minIncrement).toBe('0.123456');
      expect(result.decimalPlaces).toBe(6); // From API
    });
  });

  describe('Function contract validation', () => {
    test('should always return the same minIncrement as input', () => {
      const testInputs = ['1', '0.01', '123.456', '0.00000001', '1000'];
      testInputs.forEach(input => {
        const result = determineIncrements(input);
        expect(result.minIncrement).toBe(input);
      });
    });

    test('should always return valid decimal places (non-negative integer)', () => {
      const testInputs = ['1', '0.01', '123.456', '0.00000001', '1000'];
      testInputs.forEach(input => {
        const result = determineIncrements(input);
        expect(typeof result.decimalPlaces).toBe('number');
        expect(result.decimalPlaces).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(result.decimalPlaces)).toBe(true);
      });
    });

    test('should return consistent structure with and without currencyInfo', () => {
      const result1 = determineIncrements('0.01');
      const result2 = determineIncrements('0.01', mockZAR);
      
      expect(typeof result1.minIncrement).toBe('string');
      expect(typeof result1.decimalPlaces).toBe('number');
      expect(typeof result2.minIncrement).toBe('string');
      expect(typeof result2.decimalPlaces).toBe('number');
    });

    test('should handle various currency types consistently', () => {
      const testCases = [
        { currency: mockZAR, expectedDecimalPlaces: 2 },
        { currency: mockBTC, expectedDecimalPlaces: 8 },
        { currency: mockUSDC, expectedDecimalPlaces: 6 }
      ];

      testCases.forEach(({ currency, expectedDecimalPlaces }) => {
        const result = determineIncrements('1.0', currency);
        expect(result.minIncrement).toBe('1.0');
        expect(result.decimalPlaces).toBe(expectedDecimalPlaces);
      });
    });
  });

  describe('API vs string decimal places priority', () => {
    test('should prefer API decimal places over string analysis', () => {
      // String would suggest 0 decimal places, API says 2
      const result = determineIncrements('5', mockZAR);
      expect(result.decimalPlaces).toBe(2); // API wins
    });

    test('should prefer API decimal places even with high precision strings', () => {
      // String would suggest 10 decimal places, API says 6
      const result = determineIncrements('1.1234567890', mockUSDC);
      expect(result.decimalPlaces).toBe(6); // API wins
    });

    test('should fall back to string analysis when no API info', () => {
      // No API info, string analysis should be used
      const result = determineIncrements('1.12345');
      expect(result.decimalPlaces).toBe(5); // String analysis
    });
  });

  describe('Type safety and edge cases', () => {
    test('should handle undefined currencyInfo gracefully', () => {
      const result = determineIncrements('0.01', undefined);
      expect(result.minIncrement).toBe('0.01');
      expect(result.decimalPlaces).toBe(2);
    });

    test('should handle currencyInfo with zero decimal places', () => {
      const mockIntegerCurrency: CurrencyInfo = {
        ...mockZAR,
        withdrawalDecimalPlaces: 0
      };
      const result = determineIncrements('1.123', mockIntegerCurrency);
      expect(result.decimalPlaces).toBe(0); // API says 0
    });

    test('should handle very high precision currencies', () => {
      const mockHighPrecision: CurrencyInfo = {
        ...mockBTC,
        withdrawalDecimalPlaces: 18
      };
      const result = determineIncrements('0.01', mockHighPrecision);
      expect(result.decimalPlaces).toBe(18); // API says 18
    });
  });
});