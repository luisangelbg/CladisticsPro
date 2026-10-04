/* CladisticsPro — morphological cladistics in the browser.
   Copyright (C) 2026  Luis Ángel Barrera-Guzmán

   This program is free software: you can redistribute it and/or modify it under
   the terms of the GNU General Public License as published by the Free Software
   Foundation, either version 3 of the License, or (at your option) any later
   version. It is distributed in the hope that it will be useful, but WITHOUT ANY
   WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
   A PARTICULAR PURPOSE. See the GNU General Public License, in the file LICENSE
   at the root of this program, or <https://www.gnu.org/licenses/>. */

/* CladisticsPro — global state and shared utilities.
   No ES modules: everything hangs from window so the app also works when
   index.html is opened with a double click (file://). */

const state = {
  /* --- Block 2: the matrix --- */
  fileName: null,
  matrix: null,      // taxa, characters with their statements and states, cells
  /* --- results, one slot per block --- */
  search: null,      // Block 3: the shortest trees found and how
  weights: null,     // Block 4: successive or implied weighting
  clado: null,       // Block 5: the tree being read or edited, its optimization
  diag: null,        // Block 6: per-character statistics and diagnoses
  support: null,     // Block 7: Bremer, resampling
  consensus: null,   // Block 8: consensus trees, wildcards
  hypotheses: null,  // Block 9: constrained searches and topology tests
  figures: {},       // every figure registered for the report and the ZIP
};
window.state = state;

/* the ten blocks of the app, in navigation order */
/* the version of the program, written in the report and the package */
const APP_VERSION = '1.0.0';

const STEPS = [
  { n: 1, es: 'Inicio', en: 'Home', ready: true },
  { n: 2, es: 'Matriz', en: 'Matrix', ready: true },
  { n: 3, es: 'Búsqueda', en: 'Search', ready: true },
  { n: 4, es: 'Pesos', en: 'Weighting', ready: true },
  { n: 5, es: 'Cladograma', en: 'Cladogram', ready: true },
  { n: 6, es: 'Diagnóstico', en: 'Diagnosis', ready: true },
  { n: 7, es: 'Apoyo', en: 'Support', ready: true },
  { n: 8, es: 'Consensos', en: 'Consensus', ready: true },
  { n: 9, es: 'Hipótesis', en: 'Hypotheses', ready: true },
  { n: 10, es: 'Informe', en: 'Report', ready: true },
];

/* ---------------- DOM ---------------- */
function el(id) { return document.getElementById(id); }
function els(sel, root) { return [...(root || document).querySelectorAll(sel)]; }
function mk(tag, attrs, html) {
  const n = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    if (k === 'class') n.className = attrs[k];
    else if (k === 'style') n.setAttribute('style', attrs[k]);
    else if (k.startsWith('on') && typeof attrs[k] === 'function') n.addEventListener(k.slice(2), attrs[k]);
    else if (attrs[k] != null) n.setAttribute(k, attrs[k]);
  }
  if (html != null) n.innerHTML = html;
  return n;
}
function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
/* bilingual inline HTML: both spans are written, CSS shows the active one */
function L2(es, en) { return `<span data-l="es">${es}</span><span data-l="en">${en}</span>`; }
function svgEl(tag, attrs, text) {
  const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
  if (attrs) for (const k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
  if (text != null) n.textContent = text;
  return n;
}
function showMessage(container, type, text) {
  if (typeof container === 'string') container = el(container);
  if (!container) return null;
  const div = mk('div', { class: 'msg msg-' + type }, text);
  if (window.LABG) LABG.messageRole(div, type);
  container.appendChild(div);
  return div;
}
function clearMessages(container) {
  if (typeof container === 'string') container = el(container);
  if (container) container.innerHTML = '';
}

/* ---------------- shared result components ----------------
   Every block reports with the same two pieces: a row of tiles for the handful
   of numbers that matter, and a table for the rest. */
function statTiles(container, tiles) {
  if (typeof container === 'string') container = el(container);
  if (!container) return;
  container.innerHTML = '';
  container.classList.add('results-summary');
  tiles.forEach(t => {
    const [label, value, sub, level] = Array.isArray(t) ? t : [t.label, t.value, t.sub, t.level];
    const d = mk('div', { class: 'stat-tile' + (level ? ' ' + level : '') });
    d.innerHTML = `<div class="stat-label">${label}</div><div class="stat-value">${value}</div>` +
      (sub ? `<div class="stat-sub">${sub}</div>` : '');
    container.appendChild(d);
  });
}
/* columns: [{key, label, get?, fmt?, num?, html?}] */
function buildTable(container, columns, rows, opts) {
  opts = opts || {};
  if (typeof container === 'string') container = el(container);
  if (!container) return null;
  container.innerHTML = '';
  const table = mk('table');
  if (opts.className) table.className = opts.className;
  if (opts.caption) table.appendChild(mk('caption', null, opts.caption));
  const thead = mk('thead'), trh = mk('tr');
  columns.forEach(c => {
    const th = mk('th', { class: c.num ? 'num' : null });
    th.innerHTML = c.label != null ? c.label : c.key;
    trh.appendChild(th);
  });
  thead.appendChild(trh); table.appendChild(thead);
  const tbody = mk('tbody');
  const shown = opts.limit ? rows.slice(0, opts.limit) : rows;
  shown.forEach(r => {
    const tr = mk('tr');
    if (r && r._class) tr.className = r._class;
    columns.forEach(c => {
      const td = mk('td', { class: c.num ? 'num' : null });
      let v = c.get ? c.get(r) : r[c.key];
      if (c.html) { td.innerHTML = v == null ? '—' : v; tr.appendChild(td); return; }
      if (c.fmt && v != null && v !== '') v = c.fmt(v);
      td.textContent = (v === null || v === undefined || v === '' ||
        (typeof v === 'number' && !isFinite(v))) ? '—' : v;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  container.appendChild(table);
  if (opts.limit && rows.length > opts.limit) {
    const p = mk('p', { class: 'hint', style: 'padding:6px 12px;margin:0' });
    p.innerHTML = L2(`Se muestran ${opts.limit} de ${rows.length} filas.`, `Showing ${opts.limit} of ${rows.length} rows.`);
    container.appendChild(p);
  }
  return table;
}

/* ---------------- numbers ----------------
   Numbers use the decimal point in both languages (the convention of the
   scientific literature in Mexico and in English) and a true minus sign. */
function fmtNum(v, d) {
  if (v === null || v === undefined || v === '' || (typeof v === 'number' && !isFinite(v))) return '—';
  const n = Number(v);
  if (!isFinite(n)) return String(v);
  if (n === 0) return '0';
  const abs = Math.abs(n);
  if (abs < 1e-4 || abs >= 1e7) { const e = n.toExponential(d != null ? d : 2); return e.startsWith('-') ? '−' + e.slice(1) : e; }
  const s = n.toLocaleString('en-US', { maximumFractionDigits: d != null ? d : 3 });
  if (/^-0(\.0*)?$/.test(s)) return s.slice(1);
  return s.startsWith('-') ? '−' + s.slice(1) : s;
}
function fmtFixed(v, d) {
  if (v == null || !isFinite(v)) return '—';
  const s = Number(v).toFixed(d == null ? 3 : d);
  if (/^-0(\.0*)?$/.test(s)) return s.slice(1);
  return s.startsWith('-') ? '−' + s.slice(1) : s;
}
/* an index (CI, RI…) that may be undefined: an uninformative character has
   no RI (0/0), and that is said, not printed as zero */
function fmtIdx(v) { return v == null || !isFinite(v) ? '—' : Number(v).toFixed(3); }
function fmtPct(x, d) {
  if (x == null || !isFinite(x)) return '—';
  return (x * 100).toLocaleString('en-US', { maximumFractionDigits: d == null ? 1 : d }) + '%';
}
function plural(n, one, many) { return `${n} ${n === 1 ? one : many}`; }

/* ---------------- CSV / downloads ---------------- */
function csvEscape(v) {
  const s = String(v ?? '');
  return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function download(content, filename, mime) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = mk('a', { href: url, download: filename });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function slug(s) {
  return String(s || 'cladisticspro').replace(/\.[^.]+$/, '')
    .normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .replace(/[^\w\-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'cladisticspro';
}

/* ---------------- step navigation ---------------- */
function goStep(n) {
  n = String(n);
  els('.step-panel').forEach(p => p.classList.toggle('active', p.id === 'panel-' + n));
  els('.step-btn').forEach(b => b.classList.toggle('active', b.dataset.step === n));
  document.body.classList.toggle('on-home', n === '1');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  const btn = stepBtn(n);
  if (window.LABG) {
    LABG.setCurrentStep(n);
    if (btn) LABG.announce(T('Bloque ', 'Block ') + stepName(n));
  } else if (btn && btn.scrollIntoView) btn.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  refreshStepMarks();
  refreshStepFooters();
  document.dispatchEvent(new CustomEvent('stepchange', { detail: { step: Number(n) } }));
}
function enableStep(n, on) {
  const b = stepBtn(n);
  if (b) b.disabled = (on === false);
  refreshStepMarks();
  refreshStepFooters();
}

/* ---------------- common bar of the LABG Suite ----------------
   Every call to labg-core.js is guarded: the test page loads this file
   without it. */
const stepBtn = n => document.querySelector('.step-btn[data-step="' + n + '"]');
const stepOn = n => { const b = stepBtn(n); return !!b && !b.disabled; };
function stepName(n) {
  const s = STEPS.find(x => String(x.n) === String(n));
  return s ? s.n + ' · ' + T(s.es, s.en) : String(n);
}

/* A block counts as done when the result it hands on to the others is in
   `state` (Blocks 1 and 10 hand nothing on). Recomputed on every enableStep
   and every change of block, so loading a new matrix clears the marks that
   no longer hold. */
const STEP_RESULT = {
  2: 'matrix', 3: 'search', 4: 'weights', 5: 'clado', 6: 'diag', 7: 'support', 8: 'consensus', 9: 'hypotheses',
};
function refreshStepMarks() {
  if (!window.LABG) return;
  STEPS.forEach(s => {
    const key = STEP_RESULT[s.n];
    if (!key) return;
    LABG.markStep(s.n, stepOn(s.n) && state[key] ? 'done' : null);
  });
}

/* Footer of every block: Previous / Next, with the name of the block. */
function refreshStepFooters() {
  if (!window.LABG) return;
  els('.step-panel').forEach(p => {
    const n = Number(p.id.replace('panel-', ''));
    const i = STEPS.findIndex(s => s.n === n);
    if (i < 0) return;
    let f = p.querySelector(':scope > .step-footer');
    if (!f) {
      f = mk('nav', { class: 'step-footer no-print' });
      f.innerHTML = '<button type="button" class="btn btn-secondary prev"></button><button type="button" class="btn btn-primary next"></button>';
      f.addEventListener('click', e => { const b = e.target.closest('button[data-go]'); if (b && !b.disabled) goStep(b.dataset.go); });
      p.appendChild(f);
    }
    f.setAttribute('aria-label', T('Bloques', 'Blocks'));
    const prev = STEPS.slice(0, i).reverse().find(s => stepOn(s.n));
    const next = STEPS.slice(i + 1).find(s => stepBtn(s.n));
    const label = s => L2(s.n + ' · ' + s.es, s.n + ' · ' + s.en);
    const bp = f.querySelector('.prev'), bn = f.querySelector('.next');
    bp.hidden = !prev;
    if (prev) { bp.dataset.go = prev.n; bp.innerHTML = `← <span><small>${L2('Anterior', 'Previous')}</small>${label(prev)}</span>`; }
    bn.hidden = !next;
    if (next) {
      bn.dataset.go = next.n; bn.disabled = !stepOn(next.n);
      bn.innerHTML = `<span><small>${L2('Siguiente', 'Next')}</small>${label(next)}</span> →`;
    }
  });
}

function paintCommonBar() {
  if (!window.LABG) return;
  LABG.theme.key = 'cladisticspro:theme';
  LABG.theme.paint();
  const nav = el('stepper');
  if (nav) nav.setAttribute('aria-label', T('Bloques', 'Blocks'));
}

/* Wired after every DOMContentLoaded handler has run: home.js builds the
   block bar in its own. */
document.addEventListener('DOMContentLoaded', () => setTimeout(() => {
  if (!window.LABG) return;
  if (LABG.work) {
    LABG.work.scene = 'tree';
    LABG.work.tips = [
      ['Una marca llena es un cambio a un estado que aparece una sola vez en el árbol; una vacía, un estado que aparece más de una vez.',
        'A filled mark is a change into a state that arises only once in the tree; an open one, a state that arises more than once.'],
      ['Dos reconstrucciones igual de cortas pueden contar historias distintas: ACCTRAN prefiere reversiones, DELTRAN paralelismos.',
        'Two equally short reconstructions can tell different stories: ACCTRAN prefers reversals, DELTRAN parallelisms.'],
      ['Un carácter sin información para la parsimonia no tiene índice de retención: la app escribe «—», no cero.',
        'A character without parsimony information has no retention index: the app writes «—», not zero.'],
    ];
  }
  const hb = el('helpBtn');
  if (hb) hb.addEventListener('click', () => LABG.showShortcuts());
  LABG.shortcuts([]);
  LABG.bindStepKeys(goStep);
  LABG.guardUnload(() => !!state.matrix);
  LABG.setCurrentStep((document.querySelector('.step-btn.active') || {}).dataset?.step || '1');
  document.addEventListener('themechange', paintCommonBar);
  document.addEventListener('langchange', () => { paintCommonBar(); refreshStepFooters(); });
  paintCommonBar();
  refreshStepMarks();
  refreshStepFooters();
}, 0));

/* Runs a long synchronous computation once the browser has painted, so the
   waiting window (LABG.work) is on screen before the page is taken over. */
function cpAfterPaint(f, w) {
  return (window.LABG ? LABG.nextPaint() : new Promise(r => setTimeout(r, 30)))
    .then(f)
    .then(() => { if (w && !w.ended) w.close(); },
      e => {
        if (w && !w.ended) w.fail(e && e.message ? e.message : String(e));
        console.error(e);
      });
}

/* Persisted preferences */
const Prefs = {
  get(k, d) { try { const v = localStorage.getItem('cladisticspro:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('cladisticspro:' + k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
};

/* ---------------- random numbers ----------------
   Everything stochastic (random addition sequences, the ratchet, resampling)
   draws from a seeded generator, so a run is reproducible and its seed can be
   reported in the methods. sfc32 (a small fast counter generator) passes the
   usual statistical batteries. */
function rng(seed) {
  let a = 0x9e3779b9, b = 0x243f6a88, c = 0xb7e15162, d = (seed >>> 0) ^ 0xdeadbeef;
  const next = () => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
  for (let i = 0; i < 15; i++) next();
  return next;
}
function shuffle(arr, r) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}
function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback || '#9a3b26';
}

Object.assign(window, {
  STEPS, el, els, mk, esc, L2, svgEl, showMessage, clearMessages, statTiles, buildTable,
  fmtNum, fmtFixed, fmtIdx, fmtPct, plural, csvEscape, download, slug,
  goStep, enableStep, cpAfterPaint, Prefs, rng, shuffle, cssVar,
});
