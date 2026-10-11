import { savePreferences, readAll, replaceAll } from '../core/storage.js';
import { CURRENCIES } from '../core/models.js';
import { createBackup, validateBackup } from '../core/backup.js';
import { localDate } from '../core/dates.js';
import { el, button, heading } from '../ui/dom.js';
import { confirmAction } from '../ui/dialogs.js';

export function renderSettings(ctx, data) {
  const theme = el('select', { id: 'theme-choice', 'aria-label': 'Color theme' }, ['system', 'light', 'dark'].map(value => el('option', { value }, value === 'system' ? 'Follow system' : `${value[0].toUpperCase()}${value.slice(1)}`)));
  theme.value = ctx.preferences.theme;
  theme.addEventListener('change', () => ctx.run(async () => {
    try { ctx.preferences = await savePreferences({ theme: theme.value }); ctx.applyTheme(); ctx.toast('Theme updated'); }
    catch (error) { theme.value = ctx.preferences.theme; throw error; }
  }));
  const currency = el('select', { id: 'currency-choice', 'aria-label': 'Expense currency', disabled: data.expenses.length > 0 }, CURRENCIES.map(value => el('option', { value }, value)));
  currency.value = ctx.preferences.currency;
  currency.addEventListener('change', () => ctx.run(async () => {
    try { ctx.preferences = await savePreferences({ currency: currency.value }); ctx.toast('Currency updated'); }
    catch (error) { currency.value = ctx.preferences.currency; throw error; }
  }));
  const file = el('input', { type: 'file', accept: '.json,application/json', id: 'backup-file', 'aria-label': 'Choose a LifeOS JSON backup', hidden: true });
  const exportButton = button('Export backup', 'download', () => ctx.run(async () => {
    exportButton.disabled = true;
    try {
      await ctx.reconcileTimer();
      const backup = createBackup(await readAll()); validateBackup(backup);
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob); const link = el('a', { href: url, download: `lifeos-backup-${localDate()}.json` });
      document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000); ctx.toast('Backup downloaded. Keep it somewhere safe.');
    } finally { exportButton.disabled = false; }
  }));
  const restore = button('Restore backup', 'upload', () => file.click(), 'secondary');
  file.addEventListener('change', () => ctx.run(async () => {
    const selected = file.files[0]; if (!selected) return;
    try {
      if (selected.size > 10 * 1024 * 1024) throw new Error('Backups must be 10 MB or smaller.');
      let parsed;
      try { parsed = JSON.parse(await selected.text()); } catch { throw new Error('This file is not valid JSON. Choose a LifeOS backup.'); }
      const imported = validateBackup(parsed);
      const count = imported.tasks.length + imported.habits.length + imported.notes.length + imported.expenses.length;
      if (!await confirmAction('Replace your local data?', `Restore ${count} tasks, habits, notes and expenses from this backup? Your current data in this browser will be replaced. Export a backup first if you want to keep it. Restored timers remain paused.`, 'Replace & restore')) return;
      restore.disabled = true; exportButton.disabled = true;
      await replaceAll(imported); ctx.toast('Your space has been restored'); await ctx.refresh(); ctx.applyTheme();
    } finally { file.value = ''; restore.disabled = false; exportButton.disabled = false; }
  }));
  return el('section', { class: 'settings-layout' }, heading('Make yourself at home.', 'A few simple choices for your space.'), el('div', { class: 'card card-pad settings-section' }, el('h2', {}, 'Your preferences'), el('p', {}, 'Keep things comfortable and consistent.'), el('div', { class: 'settings-row' }, el('div', {}, el('label', { for: 'theme-choice' }, 'Appearance'), el('p', {}, 'Choose a theme, or follow your device.')), theme), el('div', { class: 'settings-row' }, el('div', {}, el('label', { for: 'currency-choice' }, 'Expense currency'), el('p', {}, data.expenses.length ? 'Locked while expenses exist, so totals stay meaningful.' : 'Choose before your first expense. One currency keeps it simple.')), currency)),
    el('div', { class: 'card card-pad settings-section' }, el('h2', {}, 'A little peace of mind'), el('p', {}, 'Your data lives in this browser profile. A backup gives it another home.'), el('div', { class: 'settings-actions' }, exportButton, restore, file), el('p', { class: 'muted text-small dashboard-bottom' }, 'LifeOS JSON backups · up to 10 MB / 50,000 records · restores replace existing data. Running timers export as paused.')),
    el('div', { class: 'card card-pad settings-section' }, el('h2', {}, 'Your space stays yours'), el('p', {}, 'No account, no tracking and no data sent to a server.'), el('div', { class: 'privacy-note' }, 'Records and exported backups are unencrypted. Clearing browser data, using a different browser profile, or changing the site address can make your records unavailable. Export regular backups and store them privately.'), el('p', { class: 'muted text-small dashboard-bottom' }, 'LifeOS v1.0 · Local-first by design')));
}
