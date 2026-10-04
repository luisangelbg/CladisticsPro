/* CladisticsPro — morphological cladistics in the browser.
   Copyright (C) 2026  Luis Ángel Barrera-Guzmán

   This program is free software: you can redistribute it and/or modify it under
   the terms of the GNU General Public License as published by the Free Software
   Foundation, either version 3 of the License, or (at your option) any later
   version. It is distributed in the hope that it will be useful, but WITHOUT ANY
   WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
   A PARTICULAR PURPOSE. See the GNU General Public License, in the file LICENSE
   at the root of this program, or <https://www.gnu.org/licenses/>. */

/* CladisticsPro — the character matrix: the data every other block reads.

   A matrix is a plain object, so it can be saved as JSON and sent to a Web
   Worker as it is:
     title
     taxa:  [{ name, active, outgroup, note }]
     chars: [{ name, states: [names], type, weight, active, cost, unit,
               depends: { on: index, states: [indices] } | null, note }]
     cells: taxa × chars

   type is 'unord' (Fitch), 'ord' (Wagner, additive), 'step' (a cost matrix
   in `cost`, row = state in the ancestor, column = state in the descendant)
   or 'cont' (a measurement).

   A discrete cell is a number:
     ≥ 1     a bit mask of states: one bit is one state, several bits a
             polymorphism «(01)»; with the bit UNC set it is an uncertainty
             «{01}» (both are read the same way by the analysis — any of the
             states — but they are kept apart so a file goes out as it came in);
     -1      «?», missing;
     -2      «–», inapplicable: the character does not exist in that taxon.
   A continuous cell is [low, high] (a single value has low = high), -1 or -2.

   `depends` declares that a character only exists when another one is in
   some states (the type of trichome only exists if there are trichomes). The
   analysis of inapplicables does not need it — it reads the «–» — but the
   quality control uses it to check that «–» is exactly where it should be.

   Up to 30 states per character, written 0–9 and A–T. */
function MatrixCore(g) {
const Mx = {};
Mx.SYMBOLS = '0123456789ABCDEFGHIJKLMNOPQRST';
Mx.MAXSTATES = 30;
Mx.MISSING = -1;
Mx.GAP = -2;
Mx.UNC = 1 << 30;
Mx.MASK = Mx.UNC - 1;
Mx.TYPES = ['unord', 'ord', 'step', 'cont'];

/* ---------------- construction ---------------- */
Mx.newTaxon = (name) => ({ name: name || '', active: true, outgroup: false, note: '' });
Mx.newChar = (name, nStates, type) => ({
  name: name || '', states: Array.from({ length: nStates == null ? 2 : nStates }, (_, s) => String(s)),
  type: type || 'unord', weight: 1, active: true, cost: null, unit: '', depends: null, note: '', images: null,
});
Mx.create = function (nTaxa, nChars, opts) {
  opts = opts || {};
  const m = { title: opts.title || '', taxa: [], chars: [], cells: [] };
  for (let i = 0; i < nTaxa; i++) m.taxa.push(Mx.newTaxon((opts.taxonPrefix || 'Taxón ') + (i + 1)));
  for (let j = 0; j < nChars; j++) m.chars.push(Mx.newChar((opts.charPrefix || 'Carácter ') + (j + 1), 2));
  for (let i = 0; i < nTaxa; i++) m.cells.push(new Array(nChars).fill(Mx.MISSING));
  if (m.taxa.length) m.taxa[0].outgroup = true;
  return m;
};
Mx.clone = m => JSON.parse(JSON.stringify(m));
Mx.nTaxa = m => m.taxa.length;
Mx.nChars = m => m.chars.length;

/* ---------------- cells ---------------- */
Mx.isCont = ch => ch.type === 'cont';
Mx.bits = function (mask) { const out = []; for (let s = 0; mask; s++, mask >>>= 1) if (mask & 1) out.push(s); return out; };
Mx.popcount = function (m) { let c = 0; while (m) { m &= m - 1; c++; } return c; };
Mx.single = s => 1 << s;
/* the states of a discrete cell, or null for «?» and «–» */
Mx.cellStates = cell => (typeof cell === 'number' && cell > 0 ? Mx.bits(cell & Mx.MASK) : null);
Mx.isUnc = cell => typeof cell === 'number' && cell > 0 && (cell & Mx.UNC) !== 0;
/* the number of states of a character: its named states, or more if the cells use more */
Mx.k = function (m, j) {
  const ch = m.chars[j];
  if (Mx.isCont(ch)) return 0;
  let hi = ch.states.length;
  for (let i = 0; i < m.taxa.length; i++) {
    const c = m.cells[i][j];
    if (typeof c === 'number' && c > 0) { const b = Mx.bits(c & Mx.MASK); if (b.length) hi = Math.max(hi, b[b.length - 1] + 1); }
  }
  return Math.max(1, Math.min(Mx.MAXSTATES, hi));
};
/* bit mask for the analysis: «?» and «–» are any state until the
   inapplicable algorithm (Block 3) reads the «–» on its own */
Mx.analysisMask = function (cell, k) {
  const full = k >= 31 ? Mx.MASK : (1 << k) - 1;
  if (typeof cell !== 'number' || cell <= 0) return full;
  return (cell & Mx.MASK) & full || full;
};

/* text of a cell, as it is written in a matrix */
Mx.fmtNum = function (x) {
  if (!isFinite(x)) return '?';
  const s = String(+(+x).toPrecision(8));
  return s;
};
Mx.cellText = function (cell, ch) {
  if (cell === Mx.MISSING || cell == null) return '?';
  if (cell === Mx.GAP) return '-';
  if (Array.isArray(cell)) return cell[0] === cell[1] ? Mx.fmtNum(cell[0]) : Mx.fmtNum(cell[0]) + '-' + Mx.fmtNum(cell[1]);
  const st = Mx.bits(cell & Mx.MASK);
  if (st.length === 1) return Mx.SYMBOLS[st[0]];
  const inner = st.map(s => Mx.SYMBOLS[s]).join('');
  return (cell & Mx.UNC) ? '{' + inner + '}' : '(' + inner + ')';
};
/* Reads what someone types into a cell. Accepts 0–9 and A–T, «?», «-» or «–»,
   polymorphisms written (01), [01], 0/1, 0&1 or 0,1, uncertainties {01}, and
   for continuous characters a value or a range 2.1-3.4 (also 2.1–3.4).
   Returns the cell or throws an Error whose message says what is wrong. */
Mx.parseCell = function (text, ch) {
  let s = String(text == null ? '' : text).trim();
  if (s === '' || s === '?') return Mx.MISSING;
  if (s === '-' || s === '–' || s === '—') return Mx.GAP;
  if (ch && Mx.isCont(ch)) {
    s = s.replace(/,/g, '.').replace(/\s+/g, '');
    const m = s.match(/^(-?\d*\.?\d+(?:e[-+]?\d+)?)(?:[-–—~](-?\d*\.?\d+(?:e[-+]?\d+)?))?$/i);
    if (!m) throw new Error('valor continuo no válido: «' + text + '»');
    const lo = parseFloat(m[1]), hi = m[2] != null ? parseFloat(m[2]) : lo;
    if (hi < lo) throw new Error('el intervalo va de mayor a menor: «' + text + '»');
    return [lo, hi];
  }
  let unc = false;
  if (/^\{.*\}$/.test(s)) { unc = true; s = s.slice(1, -1); }
  else if (/^[(\[].*[)\]]$/.test(s)) s = s.slice(1, -1);
  s = s.replace(/[\s/&,|+]+/g, '').toUpperCase();
  if (!s) throw new Error('celda vacía entre paréntesis');
  let mask = 0;
  for (const c of s) {
    const k = Mx.SYMBOLS.indexOf(c);
    if (k < 0) throw new Error('símbolo no válido: «' + c + '»');
    mask |= 1 << k;
  }
  if (unc && Mx.popcount(mask) > 1) mask |= Mx.UNC;
  return mask;
};

/* ---------------- structure, with undo ----------------
   Every change goes through `Mx.apply(m, op)`, which returns the inverse
   operation. The editor keeps the inverses in its undo stack, so undo is
   unlimited and costs only what changed. */
Mx.apply = function (m, op) {
  switch (op.kind) {
    case 'cells': {
      /* op.list: [[i, j, value]] */
      const inv = [];
      op.list.forEach(([i, j, v]) => { inv.push([i, j, m.cells[i][j]]); m.cells[i][j] = v; });
      return { kind: 'cells', list: inv.reverse() };
    }
    case 'char': {
      /* op.j, op.patch: properties of the character to set */
      const ch = m.chars[op.j], old = {};
      Object.keys(op.patch).forEach(k => { old[k] = ch[k] === undefined ? null : JSON.parse(JSON.stringify(ch[k])); ch[k] = op.patch[k]; });
      return { kind: 'char', j: op.j, patch: old };
    }
    case 'taxon': {
      const tx = m.taxa[op.i], old = {};
      Object.keys(op.patch).forEach(k => { old[k] = tx[k] === undefined ? null : tx[k]; tx[k] = op.patch[k]; });
      return { kind: 'taxon', i: op.i, patch: old };
    }
    case 'meta': {
      const old = {};
      Object.keys(op.patch).forEach(k => { old[k] = m[k] === undefined ? null : m[k]; m[k] = op.patch[k]; });
      return { kind: 'meta', patch: old };
    }
    case 'insertChars': {
      /* op.at, op.chars: [char], op.columns: [[cells by taxon]] (optional).
         The dependencies of the inserted characters are written in the
         numbering AFTER the insertion; those of the characters already there
         are shifted first, so the inserted ones are not shifted twice. */
      const n = op.chars.length;
      shiftDepends(m, op.at, n);
      m.chars.splice(op.at, 0, ...op.chars.map(c => JSON.parse(JSON.stringify(c))));
      m.cells.forEach((row, i) => row.splice(op.at, 0, ...op.chars.map((_, q) => (op.columns ? op.columns[q][i] : Mx.MISSING))));
      return { kind: 'removeChars', at: op.at, n };
    }
    case 'removeChars': {
      const chars = m.chars.splice(op.at, op.n);
      const columns = chars.map(() => []);
      m.cells.forEach(row => { const cut = row.splice(op.at, op.n); cut.forEach((v, q) => columns[q].push(v)); });
      /* dependencies on a removed character are dropped (and restored by the inverse) */
      const lost = [];
      m.chars.forEach((c, j) => { if (c.depends && c.depends.on >= op.at && c.depends.on < op.at + op.n) { lost.push([j, c.depends]); c.depends = null; } });
      shiftDepends(m, op.at + op.n, -op.n);
      return { kind: 'insertChars', at: op.at, chars, columns, restoreDepends: lost };
    }
    case 'moveChar': {
      /* moves character op.from to position op.to */
      const { from, to } = op;
      if (from === to) return { kind: 'moveChar', from: to, to: from };
      const perm = m.chars.map((_, j) => j);
      perm.splice(to, 0, perm.splice(from, 1)[0]);
      reorderChars(m, perm);
      return { kind: 'moveChar', from: to, to: from };
    }
    case 'insertTaxa': {
      m.taxa.splice(op.at, 0, ...op.taxa.map(t => Object.assign({}, t)));
      m.cells.splice(op.at, 0, ...op.taxa.map((_, q) => (op.rows ? op.rows[q].slice() : new Array(m.chars.length).fill(Mx.MISSING))));
      return { kind: 'removeTaxa', at: op.at, n: op.taxa.length };
    }
    case 'removeTaxa': {
      const taxa = m.taxa.splice(op.at, op.n);
      const rows = m.cells.splice(op.at, op.n);
      return { kind: 'insertTaxa', at: op.at, taxa, rows };
    }
    case 'moveTaxon': {
      const { from, to } = op;
      m.taxa.splice(to, 0, m.taxa.splice(from, 1)[0]);
      m.cells.splice(to, 0, m.cells.splice(from, 1)[0]);
      return { kind: 'moveTaxon', from: to, to: from };
    }
    case 'recode': {
      /* op.j, op.map: old state → new state (−1 drops it to «?»), op.states: new names */
      const inv = { kind: 'batch', ops: [] };
      const ch = m.chars[op.j];
      const cellOps = [];
      m.cells.forEach((row, i) => {
        const c = row[op.j];
        if (typeof c !== 'number' || c <= 0) return;
        let nm = 0;
        Mx.bits(c & Mx.MASK).forEach(s => { const t = op.map[s]; if (t != null && t >= 0) nm |= 1 << t; });
        let v = nm ? nm | (c & Mx.UNC && Mx.popcount(nm) > 1 ? Mx.UNC : 0) : Mx.MISSING;
        if (v !== c) cellOps.push([i, op.j, v]);
      });
      const patch = { states: op.states.slice() };
      if (ch.images) {
        const im = {};
        Object.keys(ch.images).forEach(s => { const t = op.map[+s]; if (t != null && t >= 0) im[t] = ch.images[s]; });
        patch.images = im;
      }
      if (ch.type === 'step' && ch.cost) {
        const k = op.states.length;
        const back = [];
        op.map.forEach((t, s) => { if (t != null && t >= 0) back[t] = s; });
        patch.cost = Array.from({ length: k }, (_, a) => Array.from({ length: k }, (_, b) =>
          a === b ? 0 : back[a] != null && back[b] != null && ch.cost[back[a]] && ch.cost[back[a]][back[b]] != null ? ch.cost[back[a]][back[b]] : 1));
      }
      /* dependants that name states of this character follow the recoding */
      const depOps = [];
      m.chars.forEach((c2, j2) => {
        if (c2.depends && c2.depends.on === op.j) {
          const ns = c2.depends.states.map(s => op.map[s]).filter(t => t != null && t >= 0);
          depOps.push({ kind: 'char', j: j2, patch: { depends: ns.length ? { on: op.j, states: ns } : null } });
        }
      });
      inv.ops.push(Mx.apply(m, { kind: 'cells', list: cellOps }));
      inv.ops.push(Mx.apply(m, { kind: 'char', j: op.j, patch }));
      depOps.forEach(o => inv.ops.push(Mx.apply(m, o)));
      inv.ops.reverse();
      return inv;
    }
    case 'batch': {
      const inv = { kind: 'batch', ops: op.ops.map(o => Mx.apply(m, o)).reverse() };
      return inv;
    }
    case 'replace': {
      /* the whole matrix (sorting, importing into the same session) */
      const old = Mx.clone(m);
      Object.keys(m).forEach(k => delete m[k]);
      Object.assign(m, Mx.clone(op.matrix));
      return { kind: 'replace', matrix: old };
    }
    default: throw new Error('operación desconocida: ' + op.kind);
  }
};
/* the inverse of removeChars carries the dependencies it dropped */
const _apply = Mx.apply;
Mx.apply = function (m, op) {
  const inv = _apply(m, op);
  if (op.kind === 'insertChars' && op.restoreDepends) op.restoreDepends.forEach(([j, d]) => {
    const jj = j >= op.at ? j + op.chars.length : j;
    if (m.chars[jj]) m.chars[jj].depends = d;
  });
  return inv;
};
function shiftDepends(m, from, by) {
  m.chars.forEach(c => { if (c.depends && c.depends.on >= from) c.depends = { on: c.depends.on + by, states: c.depends.states }; });
}
function reorderChars(m, perm) {
  /* perm[newIndex] = oldIndex */
  const inv = []; perm.forEach((o, nIdx) => { inv[o] = nIdx; });
  m.chars = perm.map(o => m.chars[o]);
  m.cells = m.cells.map(row => perm.map(o => row[o]));
  m.chars.forEach(c => { if (c.depends) c.depends = { on: inv[c.depends.on], states: c.depends.states }; });
}

/* ---------------- checks of a whole matrix (import, JSON) ---------------- */
Mx.validate = function (m) {
  const errs = [];
  if (!m || !Array.isArray(m.taxa) || !Array.isArray(m.chars) || !Array.isArray(m.cells)) return ['la matriz no tiene taxones, caracteres y celdas'];
  if (m.cells.length !== m.taxa.length) errs.push('hay ' + m.taxa.length + ' taxones y ' + m.cells.length + ' filas');
  m.cells.forEach((row, i) => { if (row.length !== m.chars.length) errs.push('la fila ' + (i + 1) + ' tiene ' + row.length + ' celdas y hay ' + m.chars.length + ' caracteres'); });
  m.chars.forEach((c, j) => {
    if (!Mx.TYPES.includes(c.type)) errs.push('el carácter ' + (j + 1) + ' tiene un tipo desconocido: ' + c.type);
    if (c.depends && (c.depends.on < 0 || c.depends.on >= m.chars.length || c.depends.on === j)) errs.push('el carácter ' + (j + 1) + ' depende de un carácter que no existe');
  });
  return errs;
};
/* fills the fields a hand-made or older object may lack */
Mx.normalize = function (m) {
  m.title = m.title || '';
  m.taxa = m.taxa.map(t => Object.assign(Mx.newTaxon(), typeof t === 'string' ? { name: t } : t));
  m.chars = m.chars.map(c => Object.assign(Mx.newChar('', 0), c, { states: (c.states || []).map(String) }));
  return m;
};

/* ---------------- statistics ---------------- */
Mx.observed = function (m, j) {
  let mask = 0;
  m.cells.forEach((row, i) => { if (m.taxa[i].active === false) return; const c = row[j]; if (typeof c === 'number' && c > 0) mask |= c & Mx.MASK; });
  return mask;
};
/* informative for parsimony: its length can differ among trees, i.e. the
   fewest steps it can take is less than the steps on the bush. Uses the
   bounds of optimize.js (exact with polymorphisms and step matrices). */
Mx.informative = function (m, j) {
  const ch = m.chars[j];
  if (Mx.isCont(ch)) {
    const vals = m.cells.filter((r, i) => m.taxa[i].active !== false && Array.isArray(r[j]));
    if (vals.length < 4) return false;
    return new Set(vals.map(r => r[j].join('_'))).size > 1;
  }
  const k = Mx.k(m, j);
  const masks = m.cells.filter((r, i) => m.taxa[i].active !== false).map(r => (typeof r[j] === 'number' && r[j] > 0 ? r[j] & Mx.MASK : 0)).filter(x => x);
  if (!g.Opt) {
    const counts = new Array(k).fill(0);
    masks.forEach(x => { const b = Mx.bits(x); if (b.length === 1) counts[b[0]]++; });
    return counts.filter(c => c >= 2).length >= 2;
  }
  const cost = g.Opt.costMatrix(ch.type, k, ch.cost);
  const mn = g.Opt.minSteps(masks, k, ch.type, cost), mxs = g.Opt.maxSteps(masks, k, cost);
  return mn != null && mxs > mn;
};
Mx.stats = function (m) {
  const act = m.taxa.map((t, i) => i).filter(i => m.taxa[i].active !== false);
  const chars = m.chars.map((c, j) => j).filter(j => m.chars[j].active !== false);
  let cells = 0, miss = 0, gap = 0, poly = 0;
  act.forEach(i => chars.forEach(j => {
    const c = m.cells[i][j];
    cells++;
    if (c === Mx.MISSING) miss++;
    else if (c === Mx.GAP) gap++;
    else if (typeof c === 'number' && Mx.popcount(c & Mx.MASK) > 1) poly++;
  }));
  const byType = { unord: 0, ord: 0, step: 0, cont: 0 };
  chars.forEach(j => { byType[m.chars[j].type] = (byType[m.chars[j].type] || 0) + 1; });
  const informative = chars.filter(j => Mx.informative(m, j)).length;
  return {
    taxa: m.taxa.length, activeTaxa: act.length, chars: m.chars.length, activeChars: chars.length,
    outgroup: m.taxa.filter(t => t.outgroup).length, byType, informative,
    cells, missing: miss, gaps: gap, poly,
    pMissing: cells ? miss / cells : 0, pGaps: cells ? gap / cells : 0,
    dependent: m.chars.filter(c => c.depends).length,
  };
};

/* ---------------- quality control ----------------
   Each issue: { level: 'error'|'warn'|'info', code, es, en, i?, j? }.
   'error' is something the analysis cannot read as meant; 'warn' something it
   reads but that probably is not what was intended; 'info' something worth
   knowing. */
Mx.qc = function (m) {
  const out = [];
  const add = (level, code, es, en, at) => out.push(Object.assign({ level, code, es, en }, at || {}));
  const cn = j => (j + 1) + (m.chars[j].name ? ' «' + m.chars[j].name + '»' : '');
  const tn = i => '«' + m.taxa[i].name + '»';
  const n = m.taxa.length;
  /* names */
  const seen = new Map();
  m.taxa.forEach((t, i) => {
    if (!t.name.trim()) add('error', 'taxon-empty', `El taxón ${i + 1} no tiene nombre.`, `Taxon ${i + 1} has no name.`, { i });
    const key = t.name.trim().toLowerCase().replace(/[\s_]+/g, ' ');
    if (key && seen.has(key)) add('error', 'taxon-dup', `Los taxones ${seen.get(key) + 1} y ${i + 1} se llaman igual (${tn(i)}): un árbol no podría distinguirlos.`, `Taxa ${seen.get(key) + 1} and ${i + 1} share a name (${tn(i)}): a tree could not tell them apart.`, { i });
    else seen.set(key, i);
  });
  const cnames = new Map();
  m.chars.forEach((c, j) => {
    if (!c.name.trim()) add('info', 'char-noname', `El carácter ${j + 1} no tiene enunciado.`, `Character ${j + 1} has no statement.`, { j });
    const key = c.name.trim().toLowerCase();
    if (key && cnames.has(key)) add('warn', 'char-dup', `Los caracteres ${cnames.get(key) + 1} y ${j + 1} tienen el mismo enunciado: ¿es el mismo carácter dos veces?`, `Characters ${cnames.get(key) + 1} and ${j + 1} share a statement: is it the same character twice?`, { j });
    else if (key) cnames.set(key, j);
  });
  if (!m.taxa.some(t => t.outgroup)) add('warn', 'no-outgroup', 'No hay grupo externo: los árboles se enraizarán en el primer taxón.', 'There is no outgroup: trees will be rooted on the first taxon.');
  if (m.taxa.length && m.taxa.every(t => t.outgroup)) add('error', 'all-outgroup', 'Todos los taxones están marcados como grupo externo.', 'Every taxon is marked as outgroup.');
  /* characters */
  m.chars.forEach((ch, j) => {
    if (ch.active === false) return;
    const col = m.cells.map(r => r[j]);
    const known = col.filter((c, i) => m.taxa[i].active !== false && c !== Mx.MISSING && c !== Mx.GAP);
    if (Mx.isCont(ch)) {
      col.forEach((c, i) => { if (Array.isArray(c) && c[1] < c[0]) add('error', 'cont-range', `Carácter ${cn(j)}, ${tn(i)}: el intervalo va de mayor a menor.`, `Character ${cn(j)}, ${tn(i)}: the range runs from high to low.`, { i, j }); });
      if (col.some(c => typeof c === 'number' && c > 0)) add('error', 'cont-discrete', `El carácter ${cn(j)} es continuo pero tiene celdas con estados.`, `Character ${cn(j)} is continuous but has cells with states.`, { j });
    } else {
      if (col.some(c => Array.isArray(c))) add('error', 'disc-cont', `El carácter ${cn(j)} es discreto pero tiene valores numéricos.`, `Character ${cn(j)} is discrete but has numeric values.`, { j });
      const k = ch.states.length;
      const obs = Mx.observed(m, j);
      const used = Mx.bits(obs);
      if (used.length && used[used.length - 1] >= k) add('error', 'state-unnamed', `El carácter ${cn(j)} usa el estado ${Mx.SYMBOLS[used[used.length - 1]]}, que no tiene nombre.`, `Character ${cn(j)} uses state ${Mx.SYMBOLS[used[used.length - 1]]}, which has no name.`, { j });
      for (let s = 0; s < k; s++) if (!((obs >>> s) & 1) && known.length) add('info', 'state-unused', `El estado ${Mx.SYMBOLS[s]} («${ch.states[s]}») del carácter ${cn(j)} no aparece en ningún taxón.`, `State ${Mx.SYMBOLS[s]} («${ch.states[s]}») of character ${cn(j)} appears in no taxon.`, { j });
      if (known.length && Mx.popcount(obs) <= 1) add('warn', 'invariant', `El carácter ${cn(j)} es invariable: todos los taxones tienen el mismo estado.`, `Character ${cn(j)} is invariant: every taxon has the same state.`, { j });
      else if (known.length && !Mx.informative(m, j)) add('info', 'uninformative', `El carácter ${cn(j)} no es informativo para la parsimonia (sólo describe autapomorfías): suma pasos pero no elige árbol, y sube el CI de la matriz sin decir nada del árbol.`, `Character ${cn(j)} is not parsimony-informative (it only describes autapomorphies): it adds steps but chooses no tree, and raises the CI of the matrix without saying anything about the tree.`, { j });
      if (ch.type === 'ord') col.forEach((c, i) => {
        if (typeof c !== 'number' || c <= 0) return;
        const b = Mx.bits(c & Mx.MASK);
        if (b.length > 1 && b[b.length - 1] - b[0] + 1 !== b.length) add('warn', 'ord-gap', `Carácter ordenado ${cn(j)}, ${tn(i)}: el polimorfismo ${Mx.cellText(c)} no es contiguo; se leerá como todo el intervalo.`, `Ordered character ${cn(j)}, ${tn(i)}: polymorphism ${Mx.cellText(c)} is not contiguous; it will be read as the whole range.`, { i, j });
      });
      if (ch.type === 'step') {
        const C = ch.cost;
        if (!C || C.length < k) add('error', 'step-missing', `El carácter ${cn(j)} es una matriz de pasos pero le faltan costos.`, `Character ${cn(j)} is a step matrix but lacks costs.`, { j });
        else {
          let asym = false, tri = false;
          for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) {
            if (C[a][b] !== C[b][a]) asym = true;
            for (let c2 = 0; c2 < k; c2++) if (C[a][c2] + C[c2][b] < C[a][b] - 1e-12) tri = true;
          }
          if (tri) add('info', 'step-triangle', `En la matriz de pasos del carácter ${cn(j)} un cambio directo cuesta más que pasar por otro estado: el análisis tomará siempre el camino barato.`, `In the step matrix of character ${cn(j)} a direct change costs more than going through another state: the analysis will always take the cheap path.`, { j });
          if (asym) add('info', 'step-asym', `La matriz de pasos del carácter ${cn(j)} es asimétrica: la raíz importa (el grupo externo decide el sentido).`, `The step matrix of character ${cn(j)} is asymmetric: the root matters (the outgroup sets the direction).`, { j });
        }
      }
    }
    const miss = col.filter((c, i) => m.taxa[i].active !== false && c === Mx.MISSING).length;
    if (n && miss / n > 0.5) add('warn', 'char-missing', `El carácter ${cn(j)} falta en ${miss} de ${n} taxones.`, `Character ${cn(j)} is missing in ${miss} of ${n} taxa.`, { j });
    /* inapplicables */
    const gaps = col.filter(c => c === Mx.GAP).length;
    if (gaps && !ch.depends) add('info', 'gap-nodep', `El carácter ${cn(j)} tiene «–» pero no dice de qué carácter depende: decláralo para que la app revise que cada «–» esté donde debe.`, `Character ${cn(j)} has «–» but does not say which character it depends on: declare it so the app can check that every «–» is where it should be.`, { j });
    if (ch.depends) {
      const d = ch.depends, ctl = m.chars[d.on];
      if (!ctl) return;
      m.cells.forEach((row, i) => {
        if (m.taxa[i].active === false) return;
        const cc = row[d.on], c = row[j];
        if (typeof cc !== 'number' || cc <= 0) return;   // controlling unknown or inapplicable itself
        const ctlStates = Mx.bits(cc & Mx.MASK);
        const applies = ctlStates.every(s => d.states.includes(s)), absent = ctlStates.every(s => !d.states.includes(s));
        if (applies && c === Mx.GAP) add('error', 'gap-wrong', `${tn(i)}: el carácter ${cn(j)} es «–», pero el carácter ${d.on + 1} dice que la estructura existe.`, `${tn(i)}: character ${cn(j)} is «–», but character ${d.on + 1} says the structure exists.`, { i, j });
        if (absent && c !== Mx.GAP && c !== Mx.MISSING) add('error', 'gap-missing', `${tn(i)}: el carácter ${cn(j)} tiene un estado, pero el carácter ${d.on + 1} dice que la estructura no existe; debería ser «–».`, `${tn(i)}: character ${cn(j)} has a state, but character ${d.on + 1} says the structure does not exist; it should be «–».`, { i, j });
        if (absent && c === Mx.MISSING) add('info', 'gap-q', `${tn(i)}: el carácter ${cn(j)} es «?» donde la estructura no existe; «–» es más exacto.`, `${tn(i)}: character ${cn(j)} is «?» where the structure does not exist; «–» is more exact.`, { i, j });
      });
    }
  });
  /* taxa */
  const act = m.chars.map((c, j) => j).filter(j => m.chars[j].active !== false);
  const rowKey = new Map();
  m.taxa.forEach((t, i) => {
    if (t.active === false) return;
    const row = m.cells[i];
    const miss = act.filter(j => row[j] === Mx.MISSING).length;
    if (act.length && miss === act.length) add('error', 'taxon-allmissing', `${tn(i)} no tiene ningún dato: no se puede colocar en el árbol.`, `${tn(i)} has no data at all: it cannot be placed on the tree.`, { i });
    else if (act.length && miss / act.length > 0.5) add('warn', 'taxon-missing', `A ${tn(i)} le falta el ${Math.round(100 * miss / act.length)} % de los datos: puede ser un comodín que colapse el consenso (Bloque 8).`, `${tn(i)} lacks ${Math.round(100 * miss / act.length)} % of the data: it may be a wildcard that collapses the consensus (Block 8).`, { i });
    const key = act.map(j => JSON.stringify(row[j])).join(',');
    if (rowKey.has(key)) add('info', 'taxon-identical', `${tn(rowKey.get(key))} y ${tn(i)} tienen exactamente los mismos datos: ningún árbol puede separarlos.`, `${tn(rowKey.get(key))} and ${tn(i)} have exactly the same data: no tree can separate them.`, { i });
    else rowKey.set(key, i);
  });
  return out;
};

/* ---------------- what the analysis reads ----------------
   Active taxa and active discrete characters, as the optimization module wants
   them. Continuous characters go apart (they have their own optimization). */
Mx.toAnalysis = function (m) {
  const taxa = [], rows = [];
  m.taxa.forEach((t, i) => { if (t.active !== false) { taxa.push(t.name); rows.push(i); } });
  const cols = [];
  m.chars.forEach((c, j) => { if (c.active !== false && !Mx.isCont(c)) cols.push(j); });
  const chars = cols.map(j => {
    const c = m.chars[j], k = Math.max(2, Mx.k(m, j));
    return { name: c.name, states: Array.from({ length: k }, (_, s) => c.states[s] != null ? c.states[s] : Mx.SYMBOLS[s]),
      type: c.type, weight: c.weight == null ? 1 : c.weight, active: true, cost: c.cost, src: j };
  });
  const cells = rows.map(i => cols.map((j, q) => Mx.analysisMask(m.cells[i][j], chars[q].states.length)));
  const outgroup = rows.map((i, q) => (m.taxa[i].outgroup ? q : -1)).filter(q => q >= 0);
  return { taxa, chars, cells, rows, cols, outgroup };
};

/* a short fingerprint, so results computed on another version of the matrix can be recognised */
Mx.fingerprint = function (m) {
  const s = JSON.stringify([m.taxa.map(t => [t.name, t.active, t.outgroup]), m.chars.map(c => [c.type, c.weight, c.active, c.states.length, c.cost]), m.cells]);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16);
};

g.Mx = Mx;
return Mx;
}
if (typeof window !== 'undefined') MatrixCore(window);
