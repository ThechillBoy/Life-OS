export function localDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(12, 0, 0, 0);
  return year >= 2000 && year <= 2199 && localDate(date) === value;
}
export function dateObject(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}
export function shiftDay(value, offset) {
  const date = dateObject(value);
  date.setDate(date.getDate() + offset);
  return localDate(date);
}
export function dateLabel(value, today = localDate()) {
  if (value === today) return 'Today';
  if (value === shiftDay(today, 1)) return 'Tomorrow';
  if (value === shiftDay(today, -1)) return 'Yesterday';
  return dateObject(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(value.slice(0, 4) !== today.slice(0, 4) ? { year: 'numeric' } : {}) });
}
export function weekDays(today = localDate()) {
  return Array.from({ length: 7 }, (_, i) => shiftDay(today, i - 6));
}
export function habitStreak(habitId, checkins, today = localDate()) {
  const checked = new Set(checkins.filter(c => c.habitId === habitId).map(c => c.date));
  let cursor = checked.has(today) ? today : shiftDay(today, -1);
  let streak = 0;
  while (checked.has(cursor)) { streak++; cursor = shiftDay(cursor, -1); }
  return streak;
}
export function tasksForView(tasks, view, today = localDate()) {
  return tasks.filter(task => view === 'completed' ? task.completed : !task.completed && (view === 'upcoming' ? task.dueDate > today : !task.dueDate || task.dueDate <= today))
    .sort((a, b) => (a.dueDate || today).localeCompare(b.dueDate || today) || b.createdAt.localeCompare(a.createdAt));
}
