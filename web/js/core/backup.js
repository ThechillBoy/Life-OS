import { CURRENCIES, CATEGORIES, STORES, expenseTotal } from './models.js';
import { validDate } from './dates.js';
import { DURATION, idleTimer, remainingTime } from './timer.js';

const fail = message => { throw new Error(`Invalid backup: ${message}`); };
const object = value => value && typeof value === 'object' && !Array.isArray(value);
function string(value, max, label, empty = false) {
  if (typeof value !== 'string' || value.length > max || (!empty && !value.trim())) fail(`${label} is missing or too long.`);
  return value;
}
function id(value) { if (typeof value !== 'string' || !/^[a-zA-Z0-9:_-]{1,120}$/.test(value)) fail('record identifier is invalid.'); return value; }
function timestamp(value) { if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT/.test(value) || !Number.isFinite(Date.parse(value))) fail('timestamp is invalid.'); return value; }
function base(value) { if (!object(value)) fail('record is not an object.'); return { id: id(value.id), createdAt: timestamp(value.createdAt), updatedAt: timestamp(value.updatedAt) }; }
export function createBackup(data, now = Date.now()) {
  const preferences = data.settings.find(s => s.id === 'preferences');
  const timer = data.settings.find(s => s.id === 'timer') || idleTimer();
  const ms = remainingTime(timer, now);
  const safeTimer = ms > 0 ? { ...timer, status: timer.status === 'idle' ? 'idle' : 'paused', remainingMs: ms, endsAt: null } : idleTimer();
  return { app: 'LifeOS', version: 1, exportedAt: new Date(now).toISOString(), data: { ...data, settings: [preferences, safeTimer] } };
}
export function validateBackup(backup) {
  if (!object(backup) || backup.app !== 'LifeOS' || backup.version !== 1 || !object(backup.data)) fail('expected a LifeOS version 1 backup.');
  timestamp(backup.exportedAt);
  const input = backup.data;
  const data = {};
  let recordCount = 0;
  for (const store of STORES) {
    if (!Array.isArray(input[store])) fail(`${store} is missing.`);
    recordCount += input[store].length;
    if (recordCount > 50000) fail('backup exceeds 50,000 records.');
    const ids = new Set();
    for (const row of input[store]) { if (!object(row)) fail('record is not an object.'); id(row.id); if (ids.has(row.id)) fail(`duplicate identifier in ${store}.`); ids.add(row.id); }
  }
  const prefs = input.settings.find(s => s.id === 'preferences');
  if (!prefs || input.settings.length > 2 || !['system', 'light', 'dark'].includes(prefs.theme) || !CURRENCIES.includes(prefs.currency)) fail('preferences are invalid.');
  data.settings = [{ id: 'preferences', theme: prefs.theme, currency: prefs.currency }];
  const timer = input.settings.find(s => s.id === 'timer');
  if (input.settings.some(s => !['preferences', 'timer'].includes(s.id))) fail('unknown settings record.');
  if (timer) {
    if (!['focus', 'break'].includes(timer.mode) || !['idle', 'paused'].includes(timer.status) || !Number.isFinite(timer.remainingMs) || timer.remainingMs <= 0 || timer.remainingMs > DURATION[timer.mode] || timer.endsAt !== null || (timer.sessionId !== null && typeof timer.sessionId !== 'string')) fail('timer state is invalid.');
    if (timer.sessionId !== null) id(timer.sessionId);
    if (timer.status === 'paused' && !timer.sessionId) fail('paused timer has no session identifier.');
    if (timer.status === 'idle' && (timer.remainingMs !== DURATION[timer.mode] || timer.sessionId !== null)) fail('idle timer state is inconsistent.');
    data.settings.push({ id: 'timer', mode: timer.mode, status: timer.status, remainingMs: timer.remainingMs, endsAt: null, sessionId: timer.sessionId });
  } else data.settings.push(idleTimer());
  data.tasks = input.tasks.map(row => {
    if (typeof row.completed !== 'boolean' || (row.dueDate !== null && !validDate(row.dueDate))) fail('task is invalid.');
    return { ...base(row), title: string(row.title, 120, 'Task title'), completed: row.completed, dueDate: row.dueDate };
  });
  data.habits = input.habits.map(row => ({ ...base(row), title: string(row.title, 120, 'Habit title') }));
  const habitIds = new Set(data.habits.map(h => h.id));
  data.checkins = input.checkins.map(row => {
    if (!habitIds.has(row.habitId) || !validDate(row.date) || row.id !== `${row.habitId}:${row.date}`) fail('habit check-in is invalid or orphaned.');
    return { id: row.id, habitId: row.habitId, date: row.date };
  });
  data.notes = input.notes.map(row => ({ ...base(row), title: string(row.title, 120, 'Note title'), body: string(row.body, 200000, 'Note body', true) }));
  data.expenses = input.expenses.map(row => {
    if (!Number.isSafeInteger(row.amount) || row.amount <= 0 || row.amount > 1_000_000_000_000 || !validDate(row.date) || !CATEGORIES.includes(row.category) || row.currency !== prefs.currency) fail('expense is invalid or uses a different currency.');
    return { ...base(row), amount: row.amount, date: row.date, category: row.category, currency: row.currency, description: string(row.description, 240, 'Expense description', true) };
  });
  if (!Number.isSafeInteger(expenseTotal(data.expenses))) fail('expense total exceeds safe integer precision.');
  data.focusSessions = input.focusSessions.map(row => {
    if (row.durationMinutes !== 25) fail('focus duration is invalid.');
    return { id: row.id, completedAt: timestamp(row.completedAt), durationMinutes: 25 };
  });
  if (data.settings[1].sessionId && data.focusSessions.some(s => s.id === data.settings[1].sessionId)) fail('active timer was already completed.');
  return data;
}
