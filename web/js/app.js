import { repository, readAll, onExternalChange, savePreferences } from './core/storage.js';
import { defaults } from './core/models.js';
import { localDate } from './core/dates.js';
import { getTimer, idleTimer, changeTimer, remainingTime, clockText, DURATION } from './core/timer.js';
import { el, icon, iconButton, button, empty } from './ui/dom.js';
import { confirmAction } from './ui/dialogs.js';
import { renderDashboard } from './features/dashboard.js';
import { renderTasks } from './features/tasks.js';
import { renderHabits } from './features/habits.js';
import { renderNotes } from './features/notes.js';
import { renderExpenses } from './features/expenses.js';
import { renderFocus } from './features/focus.js';
import { renderSettings } from './features/settings.js';

const routes = {
  dashboard: { label: 'Overview', icon: 'grid', render: renderDashboard },
  tasks: { label: 'Tasks', icon: 'task', render: renderTasks },
  habits: { label: 'Habits', icon: 'habit', render: renderHabits },
  notes: { label: 'Notes', icon: 'note', render: renderNotes },
  expenses: { label: 'Expenses', icon: 'wallet', render: renderExpenses },
  focus: { label: 'Focus', icon: 'timer', render: renderFocus },
  settings: { label: 'Settings', icon: 'settings', render: renderSettings }
};
const main = document.getElementById('main');
const sidebar = document.getElementById('sidebar');
const backdrop = document.getElementById('drawer-backdrop');
const menu = document.getElementById('menu-toggle');
const themeToggle = document.getElementById('theme-toggle');
const toastNode = document.getElementById('toast');
const errorNode = document.getElementById('error-notice');
const timerChip = document.getElementById('timer-chip');
let currentRoute;
let beforeLeave = async () => {};
let cleanup = () => {};
let renderId = 0;
let toastTimeout;
let timerBusy = false;
let reconcileBusy = false;
let today = localDate();

const ctx = {
  state: {}, preferences: { ...defaults }, timer: idleTimer(), hasUnsaved: () => false,
  setBeforeLeave: callback => { beforeLeave = callback; },
  setCleanup: callback => { cleanup = callback; },
  toast: message => { clearTimeout(toastTimeout); toastNode.textContent = message; toastNode.hidden = false; toastTimeout = setTimeout(() => { toastNode.hidden = true; }, 4000); },
  error: error => {
    errorNode.replaceChildren(el('span', {}, error.message || 'Something went wrong. Please retry.'), iconButton('Dismiss error', 'close', () => { errorNode.hidden = true; })); errorNode.hidden = false;
  },
  run: async operation => { try { await operation(); } catch (error) { ctx.error(error); } },
  applyTheme: () => {
    const choice = ctx.preferences.theme;
    try { localStorage.setItem('lifeos.theme', choice); } catch { /* IndexedDB remains authoritative when localStorage is unavailable. */ }
    document.documentElement.dataset.theme = choice === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : choice;
    const dark = document.documentElement.dataset.theme === 'dark';
    themeToggle.replaceChildren(icon(dark ? 'sun' : 'moon'));
    themeToggle.setAttribute('aria-label', `Switch to ${dark ? 'light' : 'dark'} theme`);
    document.querySelector('meta[name="theme-color"]').content = dark ? '#17201b' : '#f7f8f5';
  },
  reconcileTimer: async () => {
    const stored = await getTimer();
    ctx.timer = stored.status === 'running' && remainingTime(stored) === 0 ? await changeTimer('tick') : stored;
  },
  timerAction: async action => {
    if (timerBusy) return;
    timerBusy = true;
    try {
      await ctx.reconcileTimer();
      if (['reset', 'focus', 'break'].includes(action) && ctx.timer.status !== 'idle' && remainingTime(ctx.timer) < DURATION[ctx.timer.mode]) {
        if (!await confirmAction('End this session?', 'Your current session will be reset. Unfinished focus sessions are not recorded.', 'Reset session')) return;
      }
      ctx.timer = await changeTimer(action);
      if (action === 'start') ctx.toast(ctx.timer.mode === 'focus' ? 'A little time for one thing.' : 'Take a well-earned break.');
      await ctx.refresh();
    } catch (error) { ctx.error(error); } finally { timerBusy = false; }
  },
  refresh: () => renderPage(false)
};

function routeFromHash() {
  const route = location.hash.slice(1);
  if (Object.hasOwn(routes, route)) return route;
  history.replaceState(null, '', '#dashboard'); return 'dashboard';
}
function updateTimerDisplay() {
  const remaining = clockText(remainingTime(ctx.timer));
  document.querySelectorAll('[data-timer-display]').forEach(node => { node.textContent = remaining; });
  timerChip.hidden = ctx.timer.status === 'idle';
  timerChip.textContent = `${ctx.timer.mode === 'focus' ? 'Focus' : 'Break'} ${remaining}${ctx.timer.status === 'paused' ? ' · paused' : ''}`;
  timerChip.setAttribute('aria-label', `${ctx.timer.mode} timer ${remaining}${ctx.timer.status === 'paused' ? ', paused' : ''}. Open focus timer.`);
}
async function renderPage(navigated = true) {
  const ticket = ++renderId;
  const target = routeFromHash();
  const previous = currentRoute;
  main.setAttribute('aria-busy', 'true');
  try {
    await beforeLeave();
    if (ticket !== renderId) return;
    await ctx.reconcileTimer();
    const data = await readAll();
    if (ticket !== renderId) return;
    cleanup(); beforeLeave = async () => {}; cleanup = () => {}; ctx.hasUnsaved = () => false;
    ctx.preferences = data.settings.find(s => s.id === 'preferences') || { ...defaults };
    ctx.timer = data.settings.find(s => s.id === 'timer') || idleTimer();
    ctx.applyTheme();
    main.replaceChildren(routes[target].render(ctx, data));
    currentRoute = target;
    document.title = `${routes[target].label} — LifeOS`;
    document.getElementById('current-section').textContent = routes[target].label;
    document.querySelectorAll('.nav-link').forEach(link => { if (link.hash === `#${target}`) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current'); });
    closeDrawer(); updateTimerDisplay();
    if (navigated && previous) main.focus({ preventScroll: true });
    if (navigated) window.scrollTo({ top: 0 });
  } catch (error) {
    ctx.error(error);
    if (previous) history.replaceState(null, '', `#${previous}`);
    else main.replaceChildren(empty('shield', 'Your space couldn’t open', 'LifeOS needs permission to use this browser’s local storage. Allow storage for this site, then retry.', button('Try again', 'reset', initialize, 'secondary')));
  } finally { if (ticket === renderId) main.setAttribute('aria-busy', 'false'); }
}
function closeDrawer() { sidebar.classList.remove('open'); sidebar.removeAttribute('role'); sidebar.removeAttribute('aria-modal'); document.querySelector('.workspace').inert = false; backdrop.hidden = true; menu.setAttribute('aria-expanded', 'false'); menu.setAttribute('aria-label', 'Open navigation'); if (matchMedia('(max-width: 900px)').matches) sidebar.inert = true; }
function openDrawer() { sidebar.inert = false; sidebar.classList.add('open'); sidebar.setAttribute('role', 'dialog'); sidebar.setAttribute('aria-modal', 'true'); document.querySelector('.workspace').inert = true; backdrop.hidden = false; menu.setAttribute('aria-expanded', 'true'); menu.setAttribute('aria-label', 'Close navigation'); sidebar.querySelector('a')?.focus(); }
menu.replaceChildren(icon('menu'));
menu.addEventListener('click', () => sidebar.classList.contains('open') ? closeDrawer() : openDrawer());
backdrop.addEventListener('click', () => { closeDrawer(); menu.focus(); });
sidebar.addEventListener('click', event => { if (event.target.closest('a')?.hash === `#${currentRoute}`) { closeDrawer(); if (matchMedia('(max-width: 900px)').matches) main.focus(); } });
document.addEventListener('keydown', event => {
  if (!sidebar.classList.contains('open')) return;
  if (event.key === 'Escape') { closeDrawer(); menu.focus(); }
  if (event.key === 'Tab') {
    const links = [...sidebar.querySelectorAll('a')];
    if (event.shiftKey && document.activeElement === links[0]) { event.preventDefault(); links.at(-1).focus(); }
    else if (!event.shiftKey && document.activeElement === links.at(-1)) { event.preventDefault(); links[0].focus(); }
  }
});
const mobile = matchMedia('(max-width: 900px)');
mobile.addEventListener('change', () => { closeDrawer(); sidebar.inert = mobile.matches; });
sidebar.inert = mobile.matches;
document.getElementById('navigation').append(...Object.entries(routes).filter(([key]) => key !== 'settings').map(([key, route]) => el('a', { href: `#${key}`, class: 'nav-link' }, icon(route.icon, 18), route.label)));
document.getElementById('settings-link').append(icon('settings', 18), 'Settings');
themeToggle.addEventListener('click', () => ctx.run(async () => { ctx.preferences = await savePreferences({ theme: document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark' }); ctx.applyTheme(); if (currentRoute === 'settings') await ctx.refresh(); }));
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (ctx.preferences.theme === 'system') ctx.applyTheme(); });
window.addEventListener('hashchange', () => { renderPage(); });
window.addEventListener('beforeunload', event => { if (ctx.hasUnsaved()) { beforeLeave().catch(() => {}); event.preventDefault(); event.returnValue = ''; } });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { beforeLeave().catch(ctx.error); return; }
  if (currentRoute === 'notes') ctx.run(async () => { await ctx.reconcileTimer(); updateTimerDisplay(); });
  else ctx.refresh();
});
onExternalChange(() => {
  if (document.hidden) return;
  if (currentRoute === 'notes') ctx.run(async () => { await ctx.reconcileTimer(); updateTimerDisplay(); });
  else ctx.refresh();
});
setInterval(async () => {
  updateTimerDisplay();
  if (ctx.timer.status === 'running' && remainingTime(ctx.timer) === 0 && !reconcileBusy) {
    reconcileBusy = true;
    try {
      const mode = ctx.timer.mode;
      await ctx.reconcileTimer(); ctx.toast(mode === 'focus' ? 'Focus complete. A little break is ready.' : 'Break complete. Ready when you are.');
      if (currentRoute !== 'notes') await ctx.refresh(); else updateTimerDisplay();
    } catch (error) { ctx.error(error); } finally { reconcileBusy = false; }
  }
  if (today !== localDate()) { today = localDate(); if (currentRoute !== 'notes') ctx.refresh(); }
}, 1000);
async function initialize() {
  try { await repository.update('settings', 'preferences', current => current || { ...defaults }); await renderPage(); }
  catch (error) { ctx.error(error); main.setAttribute('aria-busy', 'false'); main.replaceChildren(empty('shield', 'Your space couldn’t open', 'Allow local storage for this site, then try again. Your existing data will not be reset.', button('Try again', 'reset', initialize, 'secondary'))); }
}
initialize();
