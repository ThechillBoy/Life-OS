import { repository } from '../core/storage.js';
import { record, touched } from '../core/models.js';
import { el, iconButton, button, heading, empty } from '../ui/dom.js';
import { confirmAction } from '../ui/dialogs.js';

export function renderNotes(ctx, data) {
  const notes = data.notes.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  let selected = notes.find(n => n.id === ctx.state.noteId) || notes[0];
  let draft = selected ? { ...selected } : null;
  let dirty = false;
  let timeout;
  let pending = Promise.resolve();
  let revision = 0;
  let alive = true;
  const list = el('div', { class: 'card note-list', 'aria-label': 'Notes' });
  const editor = el('div', { class: 'card note-editor' });
  const search = el('input', { type: 'search', class: 'search-input', placeholder: 'Search your notes…', 'aria-label': 'Search notes', value: ctx.state.noteSearch || '' });
  const status = el('span', { class: 'save-status', role: 'status', 'aria-live': 'polite' }, 'Saved on this device');
  const title = el('input', { class: 'note-title-input', type: 'text', maxlength: 120, placeholder: 'Untitled note', 'aria-label': 'Note title' });
  const body = el('textarea', { class: 'note-body-input', maxlength: 200000, placeholder: 'Give your thoughts a little space…', 'aria-label': 'Note content' });

  function drawList() {
    const query = search.value.trim().toLocaleLowerCase();
    const visible = notes.filter(n => `${n.title} ${n.body}`.toLocaleLowerCase().includes(query));
    list.replaceChildren(...(visible.length ? visible.map(note => el('button', { type: 'button', class: 'note-item', 'aria-pressed': selected?.id === note.id, onclick: () => ctx.run(async () => {
      await flush(); selected = note; draft = { ...note }; dirty = false; ctx.state.noteId = note.id; drawEditor(); drawList();
    }) }, el('strong', {}, note.title), el('span', {}, note.body.trim() || 'A little room to think'), el('small', {}, new Date(note.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })))) : [empty('note', query ? 'Nothing here yet' : 'Room for a thought', query ? 'Try another word or clear your search.' : 'Capture an idea, a list, or something to remember.')]));
  }
  async function saveDraft() {
    if (!dirty || !draft) return;
    const snapshot = touched({ ...draft, title: draft.title.trim() || 'Untitled note' });
    const savingRevision = revision;
    status.textContent = 'Saving…'; status.dataset.state = 'saving';
    try {
      await repository.update('notes', snapshot.id, current => { if (!current) throw new Error('This note was deleted in another tab. Copy your text before leaving this page.'); return snapshot; });
      const index = notes.findIndex(n => n.id === snapshot.id);
      if (index !== -1) notes[index] = snapshot;
      if (savingRevision === revision) {
        dirty = false; draft = { ...snapshot }; selected = snapshot;
        status.textContent = 'Saved on this device'; status.dataset.state = 'saved';
      }
      if (alive) drawList();
    } catch (error) { status.textContent = 'Could not save · try again'; status.dataset.state = 'error'; throw error; }
  }
  function flush() {
    clearTimeout(timeout);
    pending = pending.catch(() => {}).then(saveDraft);
    return pending;
  }
  function input() {
    if (!draft) return;
    draft = { ...draft, title: title.value, body: body.value }; dirty = true; revision++;
    status.textContent = 'Unsaved changes'; status.dataset.state = 'saving';
    clearTimeout(timeout);
    timeout = setTimeout(() => { flush().catch(ctx.error); }, 400);
  }
  title.addEventListener('input', input); body.addEventListener('input', input);
  title.addEventListener('blur', () => flush().catch(ctx.error)); body.addEventListener('blur', () => flush().catch(ctx.error));
  function drawEditor() {
    if (!draft) { editor.replaceChildren(empty('note', 'Your thoughts belong here', 'Create a note and make a little space for what’s on your mind.')); return; }
    title.value = draft.title === 'Untitled note' ? '' : draft.title; body.value = draft.body;
    status.textContent = 'Saved on this device'; status.dataset.state = 'saved';
    const remove = iconButton('Delete this note', 'trash', () => ctx.run(async () => {
      await flush();
      if (await confirmAction('Delete this note?', `“${draft.title || 'Untitled note'}” will be permanently removed.`)) {
        await repository.delete('notes', draft.id); dirty = false; ctx.state.noteId = null; ctx.toast('Note deleted'); await ctx.refresh();
      }
    }), true);
    editor.replaceChildren(el('div', { class: 'editor-top' }, status, el('div', { class: 'task-actions' }, iconButton('Save note now', 'check', () => ctx.run(async () => { await flush(); ctx.toast('Note saved'); })), remove)), title, body);
  }
  const add = button('New note', 'plus', () => ctx.run(async () => {
    await flush(); const note = record({ title: 'Untitled note', body: '' });
    await repository.save('notes', note); ctx.state.noteId = note.id; ctx.state.noteSearch = ''; ctx.toast('A fresh note'); await ctx.refresh();
    document.querySelector('.note-title-input')?.focus();
  }));
  search.addEventListener('input', () => { ctx.state.noteSearch = search.value; drawList(); });
  ctx.setBeforeLeave(flush);
  ctx.setCleanup(() => { alive = false; clearTimeout(timeout); });
  ctx.hasUnsaved = () => dirty;
  drawList(); drawEditor();
  return el('section', {}, heading('A little space to think.', 'Ideas, lists and everything on your mind.', add), el('div', { class: 'toolbar' }, search, el('span', { class: 'muted text-small' }, `${notes.length} ${notes.length === 1 ? 'note' : 'notes'} · plain text, always`)), el('div', { class: 'notes-layout' }, list, editor));
}
