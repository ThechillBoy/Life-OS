import { STORES } from './models.js';

let connection;
const listeners = new Set();
const channel = typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('lifeos.changes') : null;
channel?.addEventListener('message', () => { for (const listener of listeners) listener(); });
export function onExternalChange(listener) { listeners.add(listener); return () => listeners.delete(listener); }
export class StorageError extends Error {
  constructor(cause) {
    super(cause?.name === 'QuotaExceededError' ? 'This browser’s storage is full. Export a backup, then free some space and retry.' : 'Your changes could not be saved. Check that browser storage is allowed, then retry.');
    this.name = 'StorageError'; this.cause = cause;
  }
}
export function database() {
  if (connection) return connection;
  connection = new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) { reject(new StorageError()); return; }
    const request = indexedDB.open('lifeos', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of STORES) if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => { db.close(); connection = null; };
      resolve(db);
    };
    request.onerror = () => { connection = null; reject(new StorageError(request.error)); };
    request.onblocked = () => { connection = null; reject(new Error('Close other LifeOS tabs and reload to update the local database.')); };
  });
  return connection;
}
export async function transaction(names, mode, operation) {
  const db = await database();
  return new Promise((resolve, reject) => {
    let tx;
    try { tx = db.transaction(names, mode); } catch (error) { reject(new StorageError(error)); return; }
    let result;
    let failure;
    const stores = Object.fromEntries(names.map(name => [name, tx.objectStore(name)]));
    const setResult = value => { result = value; };
    const abort = error => { failure = error instanceof DOMException ? new StorageError(error) : error; tx.abort(); };
    tx.oncomplete = () => { if (mode === 'readwrite') channel?.postMessage({ changed: true }); resolve(result); };
    tx.onabort = () => reject(failure || new StorageError(tx.error));
    tx.onerror = () => { /* onabort reports the committed transaction failure. */ };
    try { operation(stores, setResult, abort); } catch (error) { abort(error); }
  });
}
export const repository = {
  list: store => transaction([store], 'readonly', (s, result) => { s[store].getAll().onsuccess = event => result(event.target.result); }),
  get: (store, id) => transaction([store], 'readonly', (s, result) => { s[store].get(id).onsuccess = event => result(event.target.result); }),
  save: (store, value) => transaction([store], 'readwrite', (s, result) => { s[store].put(value); result(value); }),
  delete: (store, id) => transaction([store], 'readwrite', s => { s[store].delete(id); }),
  update: (store, id, updater) => transaction([store], 'readwrite', (s, result, abort) => {
    s[store].get(id).onsuccess = event => {
      try { const value = updater(event.target.result); if (value !== undefined) s[store].put(value); result(value); }
      catch (error) { abort(error); }
    };
  })
};
export function readAll() {
  return transaction(STORES, 'readonly', (stores, result) => {
    const data = {}; let remaining = STORES.length;
    for (const name of STORES) stores[name].getAll().onsuccess = event => { data[name] = event.target.result; if (--remaining === 0) result(data); };
  });
}
export function replaceAll(data) {
  return transaction(STORES, 'readwrite', stores => {
    for (const name of STORES) { stores[name].clear(); for (const value of data[name]) stores[name].put(value); }
  });
}
export function removeHabit(id) {
  return transaction(['habits', 'checkins'], 'readwrite', stores => {
    stores.habits.delete(id);
    stores.checkins.openCursor().onsuccess = event => { const cursor = event.target.result; if (!cursor) return; if (cursor.value.habitId === id) cursor.delete(); cursor.continue(); };
  });
}
export function setHabitCheckin(habitId, date, checked) {
  return transaction(['habits', 'checkins'], 'readwrite', (stores, result, abort) => {
    stores.habits.get(habitId).onsuccess = event => {
      try {
        if (!event.target.result) throw new Error('This habit was deleted in another tab. Refresh and try again.');
        const id = `${habitId}:${date}`;
        if (checked) stores.checkins.put({ id, habitId, date }); else stores.checkins.delete(id);
        result(checked);
      } catch (error) { abort(error); }
    };
  });
}
export function saveExpense(value) {
  return transaction(['settings', 'expenses'], 'readwrite', (stores, result, abort) => {
    stores.settings.get('preferences').onsuccess = event => {
      if (event.target.result?.currency !== value.currency) { abort(new Error('Currency changed in another tab. Reload before adding this expense.')); return; }
      stores.expenses.getAll().onsuccess = expenses => {
        try {
          const total = expenses.target.result.reduce((sum, expense) => sum + (expense.id === value.id ? 0 : expense.amount), value.amount);
          if (!Number.isSafeInteger(total)) throw new Error('This expense would make the total too large to represent exactly.');
          stores.expenses.put(value); result(value);
        } catch (error) { abort(error); }
      };
    };
  });
}
export function savePreferences(changes) {
  return transaction(['settings', 'expenses'], 'readwrite', (stores, result, abort) => {
    stores.settings.get('preferences').onsuccess = event => {
      const current = event.target.result;
      stores.expenses.count().onsuccess = count => {
        try {
          if (changes.currency && changes.currency !== current.currency && count.target.result) throw new Error('Currency is locked while expenses exist. Export a backup before deleting expenses to change it.');
          const updated = { ...current, ...changes, id: 'preferences' };
          stores.settings.put(updated); result(updated);
        } catch (error) { abort(error); }
      };
    };
  });
}
