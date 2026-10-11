import { el, iconButton, button } from './dom.js';

function mount(dialog) {
  const previous = document.activeElement;
  document.body.append(dialog);
  dialog.addEventListener('close', () => { dialog.remove(); if (previous?.isConnected) previous.focus(); }, { once: true });
  dialog.showModal();
}
export function confirmAction(title, description, label = 'Delete') {
  return new Promise(resolve => {
    let accepted = false;
    const dialog = el('dialog', { 'aria-labelledby': 'confirm-title', 'aria-describedby': 'confirm-description' });
    const cancel = button('Cancel', null, () => dialog.close(), 'secondary', { autofocus: true });
    const accept = button(label, null, () => { accepted = true; dialog.close(); }, 'danger');
    dialog.append(el('div', { class: 'dialog-header' }, el('h2', { id: 'confirm-title' }, title), iconButton('Close dialog', 'close', () => dialog.close())), el('div', { class: 'dialog-body' }, el('p', { id: 'confirm-description' }, description), el('div', { class: 'dialog-actions' }, cancel, accept)));
    dialog.addEventListener('close', () => resolve(accepted), { once: true });
    mount(dialog);
  });
}
export function openForm({ title, description, fields, submitLabel = 'Save', onSave }) {
  const dialog = el('dialog', { 'aria-labelledby': 'form-title' });
  const form = el('form', { class: 'dialog-body' });
  const controls = {};
  let busy = false;
  for (const field of fields) {
    const attrs = { id: `field-${field.name}`, name: field.name, required: field.required, maxlength: field.maxlength, placeholder: field.placeholder, type: field.type || 'text', value: field.value ?? '', autocomplete: 'off', inputmode: field.inputmode };
    const control = field.options ? el('select', attrs, field.options.map(value => el('option', { value }, value))) : el('input', attrs);
    if (field.options) control.value = field.value || field.options[0];
    controls[field.name] = control;
    form.append(el('div', { class: 'field' }, el('label', { for: attrs.id }, field.label), control, field.help ? el('p', { class: 'muted text-small' }, field.help) : null));
  }
  const error = el('p', { class: 'form-error', role: 'alert', hidden: true });
  const cancel = button('Cancel', null, () => dialog.close(), 'secondary');
  const submit = el('button', { type: 'submit', class: 'btn btn-primary' }, submitLabel);
  const close = iconButton('Close dialog', 'close', () => dialog.close());
  form.prepend(description ? el('p', {}, description) : el('span'));
  form.append(error, el('div', { class: 'dialog-actions' }, cancel, submit));
  dialog.append(el('div', { class: 'dialog-header' }, el('h2', { id: 'form-title' }, title), close), form);
  dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (busy) return;
    const values = Object.fromEntries(Object.entries(controls).map(([key, control]) => [key, control.value.trim()]));
    busy = true; error.hidden = true;
    for (const control of [...Object.values(controls), cancel, submit, close]) control.disabled = true;
    submit.textContent = 'Saving…';
    try { await onSave(values); dialog.close(); }
    catch (failure) { error.textContent = failure.message; error.hidden = false; }
    finally { busy = false; for (const control of [...Object.values(controls), cancel, submit, close]) control.disabled = false; submit.textContent = submitLabel; }
  });
  mount(dialog);
  Object.values(controls)[0]?.focus();
  return dialog;
}
