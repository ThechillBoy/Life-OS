import { repository } from '../core/storage.js';
import { record, touched } from '../core/models.js';
import { localDate, dateLabel, tasksForView, validDate } from '../core/dates.js';
import { el, icon, iconButton, button, heading, empty } from '../ui/dom.js';
import { openForm, confirmAction } from '../ui/dialogs.js';

export function taskForm(ctx, task) {
  openForm({ title: task ? 'Edit task' : 'Make a little plan', description: 'One clear next step is a good place to start.', submitLabel: task ? 'Save changes' : 'Add task', fields: [
    { name: 'title', label: 'Task', placeholder: 'What would you like to get done?', required: true, maxlength: 120, value: task?.title },
    { name: 'dueDate', label: 'Due date (optional)', type: 'date', value: task?.dueDate || '', help: 'Tasks without a date appear in Today.' }
  ], onSave: async values => {
    if (!values.title) throw new Error('Give your task a title.');
    if (values.dueDate && !validDate(values.dueDate)) throw new Error('Choose a date between 2000 and 2199.');
    const updated = task ? touched({ ...task, title: values.title, dueDate: values.dueDate || null }) : record({ title: values.title, dueDate: values.dueDate || null, completed: false });
    await repository.save('tasks', updated); ctx.toast(task ? 'Task updated' : 'A new step, added'); await ctx.refresh();
  } });
}
export function taskRow(ctx, task, compact = false) {
  const checkbox = el('input', { type: 'checkbox', checked: task.completed, 'aria-label': `Complete ${task.title}` });
  checkbox.addEventListener('change', async () => {
    checkbox.disabled = true;
    try {
      await repository.update('tasks', task.id, current => { if (!current) throw new Error('Task was deleted in another tab.'); return touched({ ...current, completed: checkbox.checked }); });
      ctx.toast(checkbox.checked ? 'A little progress. Nicely done.' : 'Task reopened'); await ctx.refresh();
    } catch (error) { checkbox.checked = task.completed; ctx.error(error); } finally { checkbox.disabled = false; }
  });
  const today = localDate();
  const overdue = !task.completed && task.dueDate && task.dueDate < today;
  return el('li', { class: `task-row${task.completed ? ' completed' : ''}` }, el('label', { class: 'task-check' }, checkbox), el('div', { class: 'task-content' }, el('div', { class: 'task-title' }, task.title), el('div', { class: `task-meta${overdue ? ' overdue' : ''}` }, icon('calendar', 12), task.dueDate ? `${overdue ? 'Overdue · ' : ''}${dateLabel(task.dueDate)}` : 'No due date')),
    compact ? null : el('div', { class: 'task-actions' }, iconButton(`Edit ${task.title}`, 'edit', () => taskForm(ctx, task)), iconButton(`Delete ${task.title}`, 'trash', async () => {
      if (await confirmAction('Delete this task?', `“${task.title}” will be removed from this browser.`)) await ctx.run(async () => { await repository.delete('tasks', task.id); ctx.toast('Task deleted'); await ctx.refresh(); });
    }, true)));
}
export function quickTask(ctx) {
  const input = el('input', { type: 'text', 'aria-label': 'Quick task', placeholder: 'Add a small next step…', required: true, maxlength: 120 });
  const submit = el('button', { type: 'submit', class: 'btn btn-soft', 'aria-label': 'Add quick task' }, icon('plus', 17));
  return el('form', { class: 'quick-form', onsubmit: async event => {
    event.preventDefault(); const title = input.value.trim(); if (!title) { input.focus(); return; }
    submit.disabled = true;
    try { await repository.save('tasks', record({ title, dueDate: null, completed: false })); ctx.toast('Task added'); await ctx.refresh(); }
    catch (error) { ctx.error(error); submit.disabled = false; }
  } }, input, submit);
}
export function renderTasks(ctx, data) {
  const view = ctx.state.taskView || 'today';
  const tasks = tasksForView(data.tasks, view);
  const filters = el('div', { class: 'filter-tabs', 'aria-label': 'Task filters' }, ['today', 'upcoming', 'completed'].map(key => button(key[0].toUpperCase() + key.slice(1), null, () => { ctx.state.taskView = key; ctx.refresh(); }, 'quiet', { class: 'filter-tab', 'aria-pressed': key === view })));
  return el('section', {}, heading('A little plan goes a long way.', 'Clear your head. Choose your next step.', button('New task', 'plus', () => taskForm(ctx))), el('div', { class: 'toolbar' }, filters, el('span', { class: 'muted text-small' }, `${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'}`)), el('div', { class: 'card' }, tasks.length ? el('ul', {}, tasks.map(task => taskRow(ctx, task))) : empty('task', view === 'completed' ? 'Progress starts here' : view === 'upcoming' ? 'Room on the horizon' : 'A fresh page for today', view === 'completed' ? 'Completed tasks will appear here.' : view === 'upcoming' ? 'Add a future due date to plan ahead.' : 'Add one thing that will make today feel worthwhile.'), view !== 'completed' ? quickTask(ctx) : null));
}
