import { transaction, repository } from './storage.js';

export const DURATION = { focus: 25 * 60 * 1000, break: 5 * 60 * 1000 };
export function idleTimer(mode = 'focus') { return { id: 'timer', mode, status: 'idle', remainingMs: DURATION[mode], endsAt: null, sessionId: null }; }
export function remainingTime(timer, now = Date.now()) { return timer.status === 'running' ? Math.max(0, timer.endsAt - now) : timer.remainingMs; }
export function clockText(ms) { const seconds = Math.ceil(Math.max(0, ms) / 1000); return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; }
export function transitionTimer(timer, action, now = Date.now(), sessionId = crypto.randomUUID()) {
  if (action === 'start' && timer.status !== 'running') return { ...timer, status: 'running', endsAt: now + timer.remainingMs, sessionId: timer.sessionId || sessionId };
  if (action === 'pause' && timer.status === 'running') return { ...timer, status: 'paused', remainingMs: remainingTime(timer, now), endsAt: null };
  if (action === 'reset') return idleTimer(timer.mode);
  if (action === 'focus' || action === 'break') return idleTimer(action);
  return timer;
}
export async function getTimer() { return (await repository.get('settings', 'timer')) || idleTimer(); }
export function changeTimer(action, now = Date.now()) {
  return transaction(['settings', 'focusSessions'], 'readwrite', (stores, result, abort) => {
    stores.settings.get('timer').onsuccess = event => {
      try {
        let timer = event.target.result || idleTimer();
        if (timer.status === 'running' && timer.endsAt <= now) {
          if (timer.mode === 'focus') stores.focusSessions.put({ id: timer.sessionId, completedAt: new Date(timer.endsAt).toISOString(), durationMinutes: 25 });
          timer = idleTimer(timer.mode === 'focus' ? 'break' : 'focus');
        }
        const updated = transitionTimer(timer, action, now);
        if (action !== 'tick' || JSON.stringify(timer) !== JSON.stringify(event.target.result)) stores.settings.put(updated);
        result(updated);
      } catch (error) { abort(error); }
    };
  });
}
