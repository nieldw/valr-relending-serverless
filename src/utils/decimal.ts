/**
 * Simple decimal arithmetic utilities for financial calculations
 * Avoids floating point precision errors
 */

export class Decimal {
  private value: number;
  private scale: number;

  constructor(value: string | number, scale: number = 8) {
    this.scale = scale;
    const multiplier = Math.pow(10, scale);
    
    if (typeof value === 'string') {
      // Parse string to avoid floating point issues
      const num = parseFloat(value);
      if (isNaN(num)) {
        throw new Error(`Invalid decimal value: ${value}`);
      }
      this.value = Math.round(num * multiplier);
    } else {
      this.value = Math.round(value * multiplier);
    }
  }

  add(other: Decimal): Decimal {
    if (this.scale !== other.scale) {
      throw new Error('Cannot add decimals with different scales');
    }
    const result = new Decimal(0, this.scale);
    result.value = this.value + other.value;
    return result;
  }

  multiply(factor: number): Decimal {
    const result = new Decimal(0, this.scale);
    result.value = Math.round(this.value * factor);
    return result;
  }

  isGreaterThan(other: Decimal): boolean {
    if (this.scale !== other.scale) {
      throw new Error('Cannot compare decimals with different scales');
    }
    return this.value > other.value;
  }

  isLessThan(other: Decimal): boolean {
    if (this.scale !== other.scale) {
      throw new Error('Cannot compare decimals with different scales');
    }
    return this.value < other.value;
  }

  toNumber(): number {
    return this.value / Math.pow(10, this.scale);
  }

  toString(): string {
    const num = this.toNumber();
    return num.toFixed(this.scale).replace(/\.?0+$/, '');
  }

  static fromString(value: string, scale: number = 8): Decimal {
    return new Decimal(value, scale);
  }
}

/**
 * Helper functions for common financial operations
 */
export function parseFinancialAmount(value: string, scale: number = 8): Decimal {
  return Decimal.fromString(value, scale);
}

export function calculateIncrease(_current: string, available: string, ratio: number, scale: number = 8): Decimal {
  const availableDecimal = parseFinancialAmount(available, scale);
  const maxIncrease = availableDecimal.multiply(ratio);
  
  // Return the minimum of available and max allowed increase
  return availableDecimal.isLessThan(maxIncrease) ? availableDecimal : maxIncrease;
}