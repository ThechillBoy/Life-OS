import { saveExpense, repository } from '../core/storage.js';
import { record, touched, CATEGORIES, currencyDigits, parseMoney, moneyInput, formatMoney, monthlyExpenses, expenseTotal } from '../core/models.js';
import { localDate, validDate, dateLabel } from '../core/dates.js';
import { el, icon, iconButton, button, heading, empty, metric, cardHeading } from '../ui/dom.js';
import { openForm, confirmAction } from '../ui/dialogs.js';

export function expenseForm(ctx, preferences, expense) {
  const currency = preferences.currency;
  openForm({ title: expense ? 'Edit expense' : 'Keep a little perspective', description: `A simple record of where your money goes. Amounts are in ${currency}.`, submitLabel: expense ? 'Save changes' : 'Add expense', fields: [
    { name: 'amount', label: `Amount (${currency})`, required: true, placeholder: (10).toFixed(currencyDigits(currency)), inputmode: 'decimal', value: expense ? moneyInput(expense.amount, currency) : '' },
    { name: 'date', label: 'Date', type: 'date', required: true, value: expense?.date || localDate() },
    { name: 'category', label: 'Category', options: CATEGORIES, value: expense?.category },
    { name: 'description', label: 'Description (optional)', maxlength: 240, placeholder: 'A coffee with a friend', value: expense?.description }
  ], onSave: async values => {
    if (!validDate(values.date)) throw new Error('Choose a date between 2000 and 2199.');
    const valuesToSave = { amount: parseMoney(values.amount, currency), currency, date: values.date, category: values.category, description: values.description };
    await saveExpense(expense ? touched({ ...expense, ...valuesToSave }) : record(valuesToSave));
    ctx.toast(expense ? 'Expense updated' : 'Expense recorded'); await ctx.refresh();
  } });
}
export function categorySummary(expenses, currency) {
  const total = expenseTotal(expenses);
  const values = CATEGORIES.map(category => ({ category, amount: expenseTotal(expenses.filter(e => e.category === category)) })).filter(c => c.amount).sort((a, b) => b.amount - a.amount);
  return values.length ? el('div', {}, values.map(c => el('div', { class: 'category-row' }, el('div', { class: 'category-label' }, el('span', {}, c.category), el('strong', {}, formatMoney(c.amount, currency))), el('progress', { max: total, value: c.amount, 'aria-label': `${c.category}: ${formatMoney(c.amount, currency)}` })))) : el('p', { class: 'muted text-small' }, 'Your category breakdown will appear as you add expenses.');
}
export function renderExpenses(ctx, data) {
  const currency = ctx.preferences.currency;
  const month = ctx.state.expenseMonth || localDate().slice(0, 7);
  const expenses = monthlyExpenses(data.expenses, month);
  const total = expenseTotal(expenses);
  const categoryCount = new Set(expenses.map(e => e.category)).size;
  const monthInput = el('input', { type: 'month', id: 'expense-month', value: month, min: '2000-01', max: '2199-12', onchange: () => { if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthInput.value)) return; ctx.state.expenseMonth = monthInput.value; ctx.refresh(); } });
  return el('section', {}, heading('Know where the little things go.', 'A simple, honest view of your spending.', button('Add expense', 'plus', () => expenseForm(ctx, ctx.preferences))), el('div', { class: 'toolbar' }, el('div', {}, el('label', { for: 'expense-month', class: 'sr-only' }, 'Expense month'), monthInput), el('a', { href: '#settings', class: 'text-link' }, `Currency: ${currency}`, icon('settings', 14))), el('div', { class: 'metrics-grid' }, metric('Monthly spending', formatMoney(total, currency), 'Based on your manual entries', 'wallet'), metric('Transactions', expenses.length, 'This selected month', 'note'), metric('Categories', categoryCount, 'A little more perspective', 'grid'), metric('Average expense', formatMoney(expenses.length ? Math.round(total / expenses.length) : 0, currency), 'Per recorded transaction', 'wallet')),
    el('div', { class: 'expenses-layout' }, el('div', { class: 'card' }, cardHeading('Your expenses', new Date(`${month}-15T12:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })), expenses.length ? el('ul', {}, expenses.map(expense => el('li', { class: 'expense-row' }, el('span', { class: 'icon-tile' }, icon('wallet', 16)), el('div', { class: 'expense-info' }, el('strong', {}, expense.description || expense.category), el('p', {}, `${expense.category} · ${dateLabel(expense.date)}`)), el('span', { class: 'expense-amount' }, formatMoney(expense.amount, currency)), el('div', { class: 'task-actions' }, iconButton(`Edit expense ${expense.description || expense.category}`, 'edit', () => expenseForm(ctx, ctx.preferences, expense)), iconButton(`Delete expense ${expense.description || expense.category}`, 'trash', () => ctx.run(async () => {
      if (await confirmAction('Delete this expense?', `${formatMoney(expense.amount, currency)} for ${expense.description || expense.category} will be removed.`)) { await repository.delete('expenses', expense.id); ctx.toast('Expense deleted'); await ctx.refresh(); }
    }), true))))) : empty('wallet', 'A clearer picture starts small', 'Record your first expense. Choose your currency in Settings before you begin.')), el('aside', { class: 'card card-pad' }, el('h2', {}, 'By category'), el('p', { class: 'muted text-small' }, 'A simple breakdown of this month.'), categorySummary(expenses, currency))));
}
