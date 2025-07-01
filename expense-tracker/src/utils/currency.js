// Currency utility functions

const CURRENCY_SYMBOLS = {
  'CNY': '¥',
  'USD': '$',
  'EUR': '€',
  'GBP': '£',
  'JPY': '¥'
};

export function getCurrencySymbol(currencyCode) {
  return CURRENCY_SYMBOLS[currencyCode] || '$';
}

export function formatCurrency(amount, currencyCode = 'USD') {
  const symbol = getCurrencySymbol(currencyCode);
  return `${symbol}${amount.toFixed(2)}`;
}

export function formatCurrencyWithSign(amount, currencyCode = 'USD', isIncome = false) {
  const symbol = getCurrencySymbol(currencyCode);
  const sign = isIncome ? '+' : '-';
  return `${sign}${symbol}${Math.abs(amount).toFixed(2)}`;
}

