export const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'JPY', 'CHF', 'CNY', 'SGD'];
export const CATEGORIES = ['Food & drink', 'Home', 'Transport', 'Health', 'Shopping', 'Leisure', 'Other'];
export const STORES = ['tasks', 'habits', 'checkins', 'notes', 'expenses', 'focusSessions', 'settings'];
export const defaults = { id: 'preferences', theme: 'system', currency: 'USD' };
export function record(values) {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), createdAt: now, updatedAt: now, ...values };
}
export function touched(values) { return { ...values, updatedAt: new Date().toISOString() }; }
export function currencyDigits(currency) {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits;
}
export function parseMoney(input, currency) {
  const digits = currencyDigits(currency);
  const value = String(input).trim();
  const pattern = digits ? new RegExp(`^\\d+(?:\\.\\d{1,${digits}})?$`) : /^\d+$/;
  if (!pattern.test(value)) throw new Error(`Enter a positive amount with at most ${digits} decimal places.`);
  const [whole, fraction = ''] = value.split('.');
  const minor = Number(whole) * 10 ** digits + Number(fraction.padEnd(digits, '0'));
  if (!Number.isSafeInteger(minor) || minor <= 0 || minor > 1_000_000_000_000) throw new Error('Enter an amount greater than zero and no more than 1 trillion minor units.');
  return minor;
}
export function moneyInput(minor, currency) { return (minor / 10 ** currencyDigits(currency)).toFixed(currencyDigits(currency)); }
export function formatMoney(minor, currency) { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(minor / 10 ** currencyDigits(currency)); }
export function monthlyExpenses(expenses, month) { return expenses.filter(e => e.date.startsWith(month)).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)); }
export function expenseTotal(expenses) { return expenses.reduce((sum, e) => sum + e.amount, 0); }
