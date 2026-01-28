/**
 * Currency formatting utilities for INR (Indian Rupee)
 */

const CURRENCY_SYMBOL = '₹'
const LOCALE = 'en-IN'

/**
 * Format a number as Indian Rupees
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
    maximumFractionDigits: 2,
  })

  return showSymbol ? `${CURRENCY_SYMBOL}${formatted}` : formatted
}

/**
 * Format a number as compact currency (e.g., ₹1.5K, ₹2L)
 * @param {number|string} amount - The amount to format
 * @returns {string} Compact formatted currency string
 */
export function formatCurrencyCompact(amount) {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount
  
  if (isNaN(numAmount)) {
    return `${CURRENCY_SYMBOL}0`
  }

  if (numAmount >= 10000000) {
    return `${CURRENCY_SYMBOL}${(numAmount / 10000000).toFixed(1)}Cr`
  } else if (numAmount >= 100000) {
    return `${CURRENCY_SYMBOL}${(numAmount / 100000).toFixed(1)}L`
  } else if (numAmount >= 1000) {
    return `${CURRENCY_SYMBOL}${(numAmount / 1000).toFixed(1)}K`
  }
  
  return formatCurrency(numAmount)
}

export { CURRENCY_SYMBOL, LOCALE }
