// Small DOM helpers and shared components. Everything is built with createElement and text nodes —
// never innerHTML — so neither content nor a learner's answer can inject markup.

import { paragraphs, parseInline } from '../core/text.js';
import { href } from '../core/router.js';

/**
 * Create an element. attrs: `class`, `on<Event>` handlers, `value`/`checked`/`disabled` (set as
 * properties), true for boolean attributes, null/false/undefined to omit. Children may be nodes,
 * strings, numbers, nested arrays, or null/false (skipped).
 */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value' || k === 'checked' || k === 'disabled') el[k] = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

/** Inline text with `code` spans, as an array of nodes. */
export function inline(text) {
  return parseInline(String(text ?? '')).map((t) => (t.type === 'code' ? h('code', {}, t.value) : t.value));
}

/** Prose with blank-line paragraphs and `code` spans. */
export function rich(text) {
  return paragraphs(text).map((p) => h('p', {}, inline(p)));
}

/** A code block. */
export function codeBlock(code, label) {
  return h('pre', { class: 'code', tabindex: '0', 'aria-label': label ?? 'Code' }, h('code', {}, code));
}

/** A labelled progress meter showing a 0..1 fraction as a percentage. */
export function meter(fraction, label, { size = '' } = {}) {
  const pct = Math.round(fraction * 100);
  return h('div', { class: `meter ${size}` },
    h('div', { class: 'meter-head' }, h('span', { class: 'meter-label' }, label), h('span', { class: 'meter-value' }, `${pct}%`)),
    h('progress', { max: '100', value: String(pct), 'aria-label': `${label}: ${pct}%` }),
  );
}

const STATUS = {
  complete: ['Complete', '✓'],
  'needs-review': ['Needs mentor review', '◐'],
  'in-progress': ['In progress', '…'],
  'not-started': ['Not started', '○'],
};

/** A status badge; the icon is decorative and the text carries the meaning. */
export function statusBadge(status) {
  const [text, icon] = STATUS[status];
  return h('span', { class: `badge badge-${status}` }, h('span', { 'aria-hidden': 'true' }, icon), ' ', text);
}

/** Breadcrumb trail: items are [label, href] pairs, the last one is the current page. */
export function breadcrumb(items) {
  return h('nav', { 'aria-label': 'Breadcrumb', class: 'breadcrumb' },
    h('ol', {}, items.map(([label, link], i) => h('li', {},
      i === items.length - 1 ? h('span', { 'aria-current': 'page' }, label) : h('a', { href: link }, label)))),
  );
}

/** Breadcrumb trail down to a mission. */
export function missionCrumbs(app, mission, ...rest) {
  const domain = app.content.domains.find((d) => d.id === mission.domain);
  return breadcrumb([
    ['Dashboard', href.dashboard()],
    [domain.title, href.domain(domain.id)],
    [`${mission.id.toUpperCase()} — ${mission.title}`, href.mission(mission.id)],
    ...rest,
  ]);
}

/** A notice box. kind: 'info' | 'warn' | 'success' | 'error'. */
export function notice(kind, ...children) {
  return h('div', { class: `notice notice-${kind}`, role: kind === 'error' ? 'alert' : null }, children);
}

/** Section with a heading whose level follows the page outline. */
export function section(title, level, ...children) {
  return h('section', { 'aria-label': title }, h(`h${level}`, {}, title), children);
}
