export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || (value === false && !key.startsWith('aria-'))) continue;
    if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'class') node.className = value;
    else if (['value', 'checked', 'disabled', 'hidden'].includes(key)) node[key] = value;
    else node.setAttribute(key, value === true && !key.startsWith('aria-') ? '' : String(value));
  }
  for (const child of children.flat(Infinity)) if (child !== null && child !== undefined && child !== false) node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  return node;
}
const paths = {
  grid: ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M3 14h7v7H3z', 'M14 14h7v7h-7z'],
  task: ['M9 5h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2', 'M9 3h6v4H9z', 'm8 13 2 2 5-5'],
  habit: ['M12 21V11', 'M12 15C3 15 3 8 3 5c6 0 9 3 9 10Z', 'M12 11c0-7 4-9 9-9 0 6-3 9-9 9Z'],
  note: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z', 'M14 2v6h6', 'M8 12h8', 'M8 16h6'],
  wallet: ['M20 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2H5', 'M21 12h-6v5h6', 'M17 14.5h.01'],
  timer: ['M9 2h6', 'M12 2v3', 'M12 10v5l3 2', 'M19 6l2-2'],
  settings: ['M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z', 'm10 2-1 3-3 1-3-1-2 3 2 3v3l-2 3 2 3 3-1 3 1 1 3h4l1-3 3-1 3 1 2-3-2-3v-3l2-3-2-3-3 1-3-1-1-3Z'],
  plus: ['M12 5v14', 'M5 12h14'], check: ['m5 12 4 4L19 6'],
  arrow: ['M5 12h14', 'm13 6 6 6-6 6'],
  edit: ['m16 3 5 5-12 12-6 1 1-6Z', 'm14 5 5 5'],
  trash: ['M3 6h18', 'M9 6V3h6v3', 'M5 6l1 15h12l1-15', 'M10 10v7', 'M14 10v7'],
  close: ['m6 6 12 12', 'M18 6 6 18'],
  menu: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
  moon: ['M21 13A9 9 0 0 1 11 3a9 9 0 1 0 10 10Z'],
  sun: ['M12 2v2', 'M12 20v2', 'M2 12h2', 'M20 12h2', 'm5 5 1.5 1.5', 'm17.5 17.5 1.5 1.5', 'm5 19 1.5-1.5', 'm17.5 6.5 1.5-1.5'],
  download: ['M12 3v12', 'm7 10 5 5 5-5', 'M4 16v5h16v-5'],
  upload: ['M12 16V3', 'm7 8 5-5 5 5', 'M4 16v5h16v-5'],
  play: ['m8 4 13 8-13 8Z'], pause: ['M8 4v16', 'M16 4v16'],
  reset: ['M3 10a9 9 0 1 1 2 8', 'M3 4v6h6'],
  fire: ['M13 2s2 6-3 9c-2-2-2-4-2-4s-7 8-2 13c4 4 13 1 13-6 0-5-6-12-6-12Z'],
  coffee: ['M3 8h13v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z', 'M16 8h2a3 3 0 1 1 0 6h-2', 'M6 2v3', 'M11 2v3'],
  calendar: ['M4 5h16v16H4z', 'M8 2v6', 'M16 2v6', 'M4 10h16'],
  shield: ['M12 2 3 6v6c0 6 9 10 9 10s9-4 9-10V6Z', 'm8 12 3 3 5-5']
};
export function icon(name, size = 18) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  for (const [key, value] of Object.entries({ width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' })) svg.setAttribute(key, value);
  if (['timer', 'sun'].includes(name)) { const circle = document.createElementNS(ns, 'circle'); circle.setAttribute('cx', 12); circle.setAttribute('cy', name === 'timer' ? 14 : 12); circle.setAttribute('r', name === 'timer' ? 8 : 4); svg.append(circle); }
  for (const d of paths[name] || paths.note) { const path = document.createElementNS(ns, 'path'); path.setAttribute('d', d); svg.append(path); }
  return svg;
}
export function button(label, iconName, onClick, variant = 'primary', attrs = {}) { return el('button', { type: 'button', class: `btn btn-${variant}`, onclick: onClick, ...attrs }, iconName ? icon(iconName, 16) : null, label); }
export function iconButton(label, name, onClick, danger = false) { return el('button', { type: 'button', class: `icon-button${danger ? ' danger' : ''}`, 'aria-label': label, title: label, onclick: onClick }, icon(name, 16)); }
export function heading(title, subtitle, action, eyebrow) { return el('div', { class: 'page-heading' }, el('div', {}, eyebrow ? el('div', { class: 'eyebrow' }, eyebrow) : null, el('h1', {}, title), el('p', {}, subtitle)), action); }
export function empty(name, title, description, action) { return el('div', { class: 'empty' }, el('span', { class: 'icon-tile' }, icon(name, 23)), el('h3', {}, title), el('p', {}, description), action); }
export function cardHeading(title, subtitle, link) { return el('div', { class: 'card-heading' }, el('div', {}, el('h2', {}, title), subtitle ? el('p', {}, subtitle) : null), link); }
export function textLink(label, route) { return el('a', { class: 'text-link', href: `#${route}` }, label, icon('arrow', 14)); }
export function metric(label, value, foot, name) { return el('div', { class: 'card metric' }, el('div', { class: 'metric-top' }, el('span', { class: 'metric-label' }, label), el('span', { class: 'icon-tile' }, icon(name, 16))), el('div', { class: 'metric-number' }, value), el('p', { class: 'metric-foot' }, foot)); }
