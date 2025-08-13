/**
 * Simple decimal arithmetic utilities for financial calculations
 * Avoids floating point precision errors
 */

import {CurrencyInfo} from '../types/valr';

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

    /**
     * Truncates this decimal to the specified number of decimal places
     * Uses floor to truncate (not round) to avoid exceeding precision limits
     */
    truncateToDecimalPlaces(decimalPlaces: number): Decimal {
        const num = this.toNumber();
        const multiplier = Math.pow(10, decimalPlaces);
        const truncated = Math.floor(num * multiplier) / multiplier;
        return new Decimal(truncated.toFixed(decimalPlaces), this.scale);
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

/**
 * Determines minimum increment amount and decimal places for a currency
 * @param increment - The increment amount as string (e.g., "1", "0.01", "0.001")
 * @param currencyInfo - Optional API currency information
 * @returns Object with minIncrement string and decimalPlaces number
 */
export function determineIncrements(
    increment: string,
    currencyInfo?: CurrencyInfo
): {
    minIncrement: string;
    decimalPlaces: number;
} {
    const minIncrement = increment;

    // Prefer API decimal places when available
    if (currencyInfo) {
        return {
            minIncrement,
            decimalPlaces: currencyInfo.withdrawalDecimalPlaces
        };
    }

    // Fallback: Parse decimal places from increment string
    const parts = increment.split('.');
    const decimalPlaces = parts.length > 1 && parts[1] ? parts[1].length : 0;

    return {
        minIncrement,
        decimalPlaces
    };
}