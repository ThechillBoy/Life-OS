import { localDate, tasksForView } from '../core/dates.js';
import { monthlyExpenses, expenseTotal, formatMoney } from '../core/models.js';
import { clockText, remainingTime } from '../core/timer.js';
import { el, button, heading, empty, metric, cardHeading, textLink } from '../ui/dom.js';
import { taskForm, taskRow, quickTask } from './tasks.js';
import { habitRow, habitForm } from './habits.js';
import { categorySummary } from './expenses.js';

export function renderDashboard(ctx, data) {
  const today = localDate();
  const todayTasks = tasksForView(data.tasks, 'today', today);
  const doneHabits = data.habits.filter(h => data.checkins.some(c => c.habitId === h.id && c.date === today)).length;
  const expenses = monthlyExpenses(data.expenses, today.slice(0, 7));
  const focusMinutes = data.focusSessions.filter(s => localDate(s.completedAt) === today).reduce((total, s) => total + s.durationMinutes, 0);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning.' : hour < 18 ? 'Good afternoon.' : 'Good evening.';
  const day = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const timer = ctx.timer;
  return el('section', {}, heading(greeting, 'Your day, with a little more clarity.', button('New task', 'plus', () => taskForm(ctx)), day),
    el('div', { class: 'hero' }, el('div', { class: 'hero-copy' }, el('div', { class: 'eyebrow' }, 'MAKE ROOM FOR WHAT MATTERS'), el('h2', {}, 'A little structure. A lot more space.'), el('p', {}, 'You don’t have to do it all. Start small, find your rhythm, and make today your own.')), el('div', { class: 'hero-art', 'aria-hidden': 'true' }, el('div', { class: 'hero-orbit' }), el('div', { class: 'hero-sun' }), el('div', { class: 'hero-leaf' }), el('div', { class: 'hero-leaf second' }))),
    el('div', { class: 'metrics-grid' }, metric('Tasks for today', todayTasks.length, todayTasks.length ? 'One step at a time' : 'A little room to breathe', 'task'), metric('Habits checked in', `${doneHabits} / ${data.habits.length}`, 'Small actions, lasting change', 'habit'), metric('Spent this month', formatMoney(expenseTotal(expenses), ctx.preferences.currency), new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' }), 'wallet'), metric('Focused today', `${focusMinutes} min`, `${focusMinutes / 25} completed ${focusMinutes / 25 === 1 ? 'session' : 'sessions'}`, 'timer')),
    el('div', { class: 'dashboard-grid' }, el('div', { class: 'stack' }, el('div', { class: 'card' }, cardHeading('Today’s little plan', `${todayTasks.length} ${todayTasks.length === 1 ? 'task' : 'tasks'} to make room for`, textLink('View tasks', 'tasks')), todayTasks.length ? el('ul', {}, todayTasks.slice(0, 5).map(task => taskRow(ctx, task, true))) : empty('task', 'What would make today a good day?', 'Choose one small thing. Your next step can start here.'), quickTask(ctx)), el('div', { class: 'card card-pad' }, el('div', { class: 'card-heading' }, el('div', {}, el('h2', {}, 'A little perspective'), el('p', {}, 'Your spending this month')), textLink('View expenses', 'expenses')), categorySummary(expenses, ctx.preferences.currency))),
      el('div', { class: 'stack' }, el('div', { class: 'card' }, cardHeading('Daily rituals', 'Show up for yourself.', textLink('View habits', 'habits')), data.habits.length ? data.habits.slice(0, 2).map(habit => habitRow(ctx, habit, data.checkins, true)) : empty('habit', 'Small things add up', 'Build a ritual that fits your life.', button('Add a habit', 'plus', () => habitForm(ctx), 'secondary'))), el('div', { class: 'card' }, cardHeading('A moment of focus', timer.mode === 'focus' ? 'Less distraction. More intention.' : 'Rest is part of the rhythm.', textLink('Open timer', 'focus')), el('div', { class: 'timer-preview' }, el('div', { class: 'timer-small', 'data-timer-display': '', role: 'timer', 'aria-label': 'Time remaining', 'aria-live': 'off' }, clockText(remainingTime(timer))), el('p', {}, timer.status === 'running' ? 'Your session is in progress' : timer.status === 'paused' ? 'Paused. Pick up when ready.' : timer.mode === 'focus' ? '25 minutes, just for one thing' : '5 minutes to recharge'), button(timer.status === 'running' ? 'Pause session' : timer.status === 'paused' ? 'Resume session' : 'Start session', timer.status === 'running' ? 'pause' : 'play', () => ctx.timerAction(timer.status === 'running' ? 'pause' : 'start')))))));
}
