/**
 * Currency formatting utilities for INR (Indian Rupee)
 */

const CURRENCY_SYMBOL = '₹'
const LOCALE = 'en-IN'

/**
 * Format a number as Indian Rupees (no decimals)
 * @param {number|string} amount - The amount to format
 * @param {boolean} showSymbol - Whether to show the ₹ symbol (default: true)
 * @returns {string} Formatted currency string
 */
export function formatCurrency(amount, showSymbol = true) {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount
  
  if (isNaN(numAmount)) {
    return showSymbol ? `${CURRENCY_SYMBOL}0` : '0'
  }

  const formatted = numAmount.toLocaleString(LOCALE, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })

  return showSymbol ? `${CURRENCY_SYMBOL}${formatted}` : formatted
}

/**
 * Format a number as compact currency without decimals (e.g., ₹2K, ₹3L)
 * @param {number|string} amount - The amount to format
 * @returns {string} Compact formatted currency string
 */
export function formatCurrencyCompact(amount) {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount
  
  if (isNaN(numAmount)) {
    return `${CURRENCY_SYMBOL}0`
  }

  if (numAmount >= 10000000) {
    return `${CURRENCY_SYMBOL}${Math.round(numAmount / 10000000)}Cr`
  } else if (numAmount >= 100000) {
    return `${CURRENCY_SYMBOL}${Math.round(numAmount / 100000)}L`
  } else if (numAmount >= 1000) {
    return `${CURRENCY_SYMBOL}${Math.round(numAmount / 1000)}K`
  }
  
  return formatCurrency(numAmount)
}

/**
 * Format a plain number according to Indian locale with no decimals
 * @param {number|string} amount
 * @returns {string}
 */
export function formatNumber(amount) {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount
  if (isNaN(numAmount)) return '0'
  return numAmount.toLocaleString(LOCALE, { maximumFractionDigits: 0 })
}

export { CURRENCY_SYMBOL, LOCALE }
