import { repository, removeHabit, setHabitCheckin } from '../core/storage.js';
import { record, touched } from '../core/models.js';
import { localDate, weekDays, dateObject, habitStreak } from '../core/dates.js';
import { el, icon, iconButton, button, heading, empty, metric } from '../ui/dom.js';
import { openForm, confirmAction } from '../ui/dialogs.js';

export function habitForm(ctx, habit) {
  openForm({ title: habit ? 'Edit habit' : 'Start a small ritual', description: 'Make it simple enough to repeat every day.', submitLabel: habit ? 'Save changes' : 'Add habit', fields: [{ name: 'title', label: 'Daily habit', placeholder: 'Read for ten minutes', required: true, maxlength: 120, value: habit?.title }], onSave: async values => {
    if (!values.title) throw new Error('Give your habit a name.');
    await repository.save('habits', habit ? touched({ ...habit, title: values.title }) : record({ title: values.title })); ctx.toast(habit ? 'Habit updated' : 'A small ritual, added'); await ctx.refresh();
  } });
}
export function habitRow(ctx, habit, checkins, compact = false) {
  const today = localDate();
  const checked = checkins.some(c => c.habitId === habit.id && c.date === today);
  const streak = habitStreak(habit.id, checkins, today);
  const toggle = button(checked ? 'Done today' : 'Check in', checked ? 'check' : 'plus', async () => {
    toggle.disabled = true;
    try { await setHabitCheckin(habit.id, today, !checked); ctx.toast(checked ? 'Check-in removed' : 'Showing up counts. Well done.'); await ctx.refresh(); }
    catch (error) { ctx.error(error); toggle.disabled = false; }
  }, checked ? 'soft' : 'secondary', { class: `btn btn-${checked ? 'soft' : 'secondary'} habit-check`, 'aria-pressed': checked, 'aria-label': `${checked ? 'Undo' : 'Check in'} ${habit.title} today` });
  const days = weekDays(today);
  return el('div', { class: 'habit-row' }, el('div', { class: 'habit-top' }, el('span', { class: 'icon-tile' }, icon('habit', 17)), el('div', { class: 'habit-name' }, el('h3', {}, habit.title), el('p', {}, `${streak ? `${streak}-day streak` : 'A fresh start, every day'}`)), toggle), el('div', { class: 'habit-week', 'aria-label': 'Last seven days' }, days.map(date => {
    const done = checkins.some(c => c.habitId === habit.id && c.date === date);
    return el('div', { class: 'habit-day', 'aria-label': `${date}: ${done ? 'completed' : 'not completed'}` }, dateObject(date).toLocaleDateString(undefined, { weekday: 'narrow' }), el('span', { class: `day-marker${done ? ' checked' : ''}${date === today ? ' today' : ''}`, 'aria-hidden': 'true' }, done ? icon('check', 12) : dateObject(date).getDate()));
  })), compact ? null : el('div', { class: 'task-actions' }, iconButton(`Edit ${habit.title}`, 'edit', () => habitForm(ctx, habit)), iconButton(`Delete ${habit.title}`, 'trash', async () => {
    if (await confirmAction('Delete this habit?', `“${habit.title}” and its check-in history will be removed.`)) await ctx.run(async () => { await removeHabit(habit.id); ctx.toast('Habit deleted'); await ctx.refresh(); });
  }, true)));
}
export function renderHabits(ctx, data) {
  const today = localDate();
  const done = data.habits.filter(h => data.checkins.some(c => c.habitId === h.id && c.date === today)).length;
  const best = Math.max(0, ...data.habits.map(h => habitStreak(h.id, data.checkins, today)));
  return el('section', {}, heading('Small rituals. Lasting change.', 'Consistency grows one day at a time.', button('New habit', 'plus', () => habitForm(ctx))), el('div', { class: 'metrics-grid' }, metric('Daily habits', data.habits.length, 'Keep your list realistic', 'habit'), metric('Done today', `${done} / ${data.habits.length}`, 'Every check-in counts', 'check'), metric('Longest current streak', `${best} days`, 'Yesterday keeps a streak alive', 'fire'), metric('Your rhythm', 'Daily', 'One check-in per local day', 'calendar')), data.habits.length ? el('div', { class: 'habits-grid' }, data.habits.map(h => el('article', { class: 'card' }, habitRow(ctx, h, data.checkins)))) : el('div', { class: 'card' }, empty('habit', 'Plant a small seed', 'A little reading, a short walk, a glass of water. Start with something that feels possible.', button('Add your first habit', 'plus', () => habitForm(ctx)))));
}
