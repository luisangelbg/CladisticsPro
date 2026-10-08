/* CladisticsPro — morphological cladistics in the browser.
   Copyright (C) 2026  Luis Ángel Barrera-Guzmán

   This program is free software: you can redistribute it and/or modify it under
   the terms of the GNU General Public License as published by the Free Software
   Foundation, either version 3 of the License, or (at your option) any later
   version. It is distributed in the hope that it will be useful, but WITHOUT ANY
   WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
   A PARTICULAR PURPOSE. See the GNU General Public License, in the file LICENSE
   at the root of this program, or <https://www.gnu.org/licenses/>. */

/* CladisticsPro — reading and writing character matrices.

   Three formats come in and go out:
     NEXUS (Maddison, Swofford and Maddison 1997): TAXA, CHARACTERS / DATA
       (standard, continuous, DNA, RNA and protein data, interleaved or not,
       MATCHCHAR, SYMBOLS, CHARSTATELABELS, CHARLABELS, STATELABELS),
       ASSUMPTIONS / SETS (TYPESET, WTSET, EXSET, USERTYPE step matrices,
       CHARSET, OPTIONS DEFTYPE) and TREES (with TRANSLATE). What the standard
       has no command for — the outgroup, which character depends on which,
       units, inactive taxa — goes in a block of its own, CLADISTICSPRO, which
       any other reader skips.
     xread, the matrix format of the classic parsimony programs: «xread», an
       optional title, the number of characters and of taxa, the rows (with
       [01] for polymorphisms), optional &[num] / &[cont] / &[dna] partitions,
       and after it the commands ccode (+ − [ ] /weight), cnames and smatrix.
     Tables separated by commas, semicolons or tabs (and what is pasted from a
       spreadsheet): a header with the characters, optionally a row of states.

   Every reader returns { matrix, trees: [{ name, newick }], notes: [] }, where
   notes are things the user should know about the reading (an unknown
   command skipped, a symbol read as missing). */
function MatIOCore(g) {
const IO = {};
const Mx = g.Mx;

/* ---------------- shared ---------------- */
const NUC = { A: 1, C: 2, G: 4, T: 8, U: 8, R: 5, Y: 10, S: 6, W: 9, K: 12, M: 3, B: 14, D: 13, H: 11, V: 7, N: 15 };
const AA = 'ARNDCQEGHILKMFPSTWYV';
IO.detect = function (text) {
  const s = String(text).replace(/^﻿/, '').trimStart();
  if (/^#nexus/i.test(s)) return 'nexus';
  if (/^(\[[\s\S]*?\]\s*)*(mxram\s+\d+\s*;\s*)?(nstates\s+[^;]*;\s*)?(taxname[^;]*;\s*)*xread\b/i.test(s) || /^\s*xread\b/im.test(s.slice(0, 2000))) return 'xread';
  if (/^\s*(begin\s+(data|characters)\s*;)/i.test(s)) return 'nexus';
  return 'table';
};
IO.read = function (text, name) {
  const fmt = IO.detect(text);
  const res = fmt === 'nexus' ? IO.readNexus(text) : fmt === 'xread' ? IO.readXread(text) : IO.readTable(text);
  res.format = fmt;
  if (!res.matrix.title && name) res.matrix.title = String(name).replace(/\.[^.]+$/, '');
  /* weights are whole numbers (the searches count steps in whole units) */
  const frac = res.matrix.chars.filter(c => c.weight != null && !(Number.isInteger(c.weight) && c.weight >= 0));
  if (frac.length) {
    frac.forEach(c => { c.weight = Math.max(0, Math.round(+c.weight || 0)); });
    res.notes.push({ es: `${frac.length} peso(s) con decimales o negativos se redondearon al entero más cercano (mínimo 0).`, en: `${frac.length} weight(s) with decimals or below zero were rounded to the nearest whole number (at least 0).` });
  }
  const errs = Mx.validate(res.matrix);
  if (errs.length) throw new Error(errs.join('; '));
  return res;
};
const unq = s => String(s).replace(/_/g, ' ');

/* parses a NEXUS character list: "1-5 7 9-. \2" (1-based), with CHARSET names */
function charList(tokens, n, sets) {
  const out = [];
  for (let t = 0; t < tokens.length; t++) {
    const tok = tokens[t];
    if (/^all$/i.test(tok)) { for (let j = 0; j < n; j++) out.push(j); continue; }
    if (sets && sets[tok.toLowerCase()]) { out.push(...sets[tok.toLowerCase()]); continue; }
    let m = tok.match(/^(\d+)(?:-(\d+|\.))?(?:\\(\d+))?$/);
    if (!m && tokens[t + 1] === '-' && tokens[t + 2]) { m = (tok + '-' + tokens[t + 2]).match(/^(\d+)-(\d+|\.)$/); t += 2; }
    if (!m) continue;
    const a = +m[1], b = m[2] == null ? a : m[2] === '.' ? n : +m[2], step = m[3] ? +m[3] : 1;
    let st = step;
    if (tokens[t + 1] && /^\\\d+$/.test(tokens[t + 1])) { st = +tokens[t + 1].slice(1); t++; }
    for (let j = a; j <= b; j += st) if (j >= 1 && j <= n) out.push(j - 1);
  }
  return out;
}

/* ================================================================
   NEXUS
   ================================================================ */
/* removes comments, keeping quoted text intact */
function stripComments(s) {
  let out = '', depth = 0, q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { out += c; if (c === "'") { if (s[i + 1] === "'") { out += "'"; i++; } else q = false; } continue; }
    if (depth) { if (c === '[') depth++; else if (c === ']') depth--; continue; }
    if (c === '[') { depth = 1; continue; }
    if (c === "'") q = true;
    out += c;
  }
  return out;
}
/* splits a text into commands (ending in ;), each a raw string */
function commands(s) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { cur += c; if (c === "'") { if (s[i + 1] === "'") { cur += "'"; i++; } else q = false; } continue; }
    if (c === "'") { q = true; cur += c; continue; }
    if (c === ';') { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim()) out.push(cur);
  return out;
}
/* tokens of a command: quoted strings, words, and the punctuation = , / ( ) { } : - */
function tokens(s) {
  const out = []; let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === "'") {
      let t = ''; i++;
      while (i < s.length) { if (s[i] === "'" && s[i + 1] === "'") { t += "'"; i += 2; continue; } if (s[i] === "'") { i++; break; } t += s[i++]; }
      out.push({ q: true, v: t });
      continue;
    }
    if (c === '"') {
      let t = ''; i++;
      while (i < s.length && s[i] !== '"') t += s[i++];
      i++; out.push({ q: true, v: t }); continue;
    }
    if ('=,/(){}:*'.includes(c)) { out.push({ p: true, v: c }); i++; continue; }
    let t = '';
    while (i < s.length && !/\s/.test(s[i]) && !"=,/(){}:*'\"".includes(s[i])) t += s[i++];
    out.push({ v: t });
  }
  return out;
}
const tv = t => (t.q ? t.v : unq(t.v));

IO.readNexus = function (text) {
  const notes = [];
  const raw = String(text).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const clean = stripComments(raw);
  /* blocks */
  const blocks = [];
  const re = /begin\s+([A-Za-z_]+)\s*;([\s\S]*?)\bend(?:block)?\s*;/gi;
  let mm;
  while ((mm = re.exec(clean))) blocks.push({ name: mm[1].toLowerCase(), body: mm[2] });
  if (!blocks.length) throw new Error('el archivo NEXUS no tiene bloques BEGIN … END;');
  let taxa = null;
  const discrete = [], continuous = [];   // character blocks in order
  const trees = [];
  const assumptions = [], privateBlocks = [];
  blocks.forEach(b => {
    if (b.name === 'taxa') {
      commands(b.body).forEach(c => {
        const tk = tokens(c);
        if (tk[0] && /^taxlabels$/i.test(tk[0].v)) taxa = tk.slice(1).map(tv);
      });
    } else if (b.name === 'characters' || b.name === 'data') {
      const blk = readCharsBlock(b.body, taxa, notes);
      if (blk.continuous) continuous.push(blk); else discrete.push(blk);
      if (!taxa) taxa = blk.taxa;
    } else if (b.name === 'assumptions' || b.name === 'sets') assumptions.push(b.body);
    else if (b.name === 'trees') readTreesBlock(b.body, trees);
    else if (b.name === 'cladisticspro') privateBlocks.push(b.body);
    else if (!['notes', 'labels'].includes(b.name)) notes.push({ es: `Se omitió el bloque ${b.name.toUpperCase()}, que esta app no usa.`, en: `Block ${b.name.toUpperCase()} was skipped; this app does not use it.` });
  });
  if (!discrete.length && !continuous.length) throw new Error('el archivo NEXUS no tiene bloque de caracteres (CHARACTERS o DATA)');
  /* merge the character blocks: discrete first, then continuous, rows matched by name */
  const names = taxa || (discrete[0] || continuous[0]).taxa;
  const m = { title: '', taxa: names.map(n => Mx.newTaxon(n)), chars: [], cells: names.map(() => []) };
  const norm = s => String(s).trim().toLowerCase().replace(/[\s_]+/g, ' ');
  const idx = new Map(names.map((n, i) => [norm(n), i]));
  [...discrete, ...continuous].forEach(blk => {
    const base = m.chars.length;
    blk.chars.forEach(c => m.chars.push(c));
    m.cells.forEach(row => { for (let q = 0; q < blk.chars.length; q++) row.push(Mx.MISSING); });
    blk.taxa.forEach((n, r) => {
      const i = idx.get(norm(n));
      if (i == null) { notes.push({ es: `El taxón «${n}» del bloque de caracteres no está en TAXA; se omitió.`, en: `Taxon «${n}» of the character block is not in TAXA; skipped.` }); return; }
      blk.rows[r].forEach((v, q) => { m.cells[i][base + q] = v; });
    });
  });
  /* assumptions */
  const nChar = m.chars.length;
  const sets = {};
  const userTypes = {};
  assumptions.forEach(body => commands(body).forEach(c => {
    const tk = tokens(c);
    if (!tk.length) return;
    const cmd = tk[0].v.toLowerCase();
    const after = () => { const k = tk.findIndex(t => t.p && t.v === '='); return k < 0 ? [] : tk.slice(k + 1); };
    if (cmd === 'charset') {
      const nm = tv(tk[1]).toLowerCase();
      sets[nm] = charList(after().map(t => t.v), nChar, sets);
    } else if (cmd === 'usertype') {
      const nm = tk[1].v.toLowerCase();
      const body2 = after().map(t => t.v);
      const n = +body2[0];
      const syms = body2.slice(1, 1 + n);
      const vals = body2.slice(1 + n);
      const M = [];
      for (let a = 0; a < n; a++) {
        M.push([]);
        for (let b = 0; b < n; b++) {
          const v = vals[a * n + b];
          M[a].push(v === '.' ? 0 : /^i/i.test(v) ? 9999 : +v);
        }
      }
      userTypes[nm] = { syms, cost: M };
    } else if (cmd === 'typeset' || cmd === 'wtset' || cmd === 'exset') {
      /* «typeset [*] name = spec» ; spec is «value: list, value: list» (exset: a list) */
      const body2 = after();
      if (cmd === 'exset') {
        charList(body2.map(t => t.v), nChar, sets).forEach(j => { m.chars[j].active = false; });
        return;
      }
      let k = 0;
      while (k < body2.length) {
        const val = body2[k].v; k++;
        if (!(body2[k] && body2[k].v === ':')) break;
        k++;
        const list = [];
        while (k < body2.length && body2[k].v !== ',') list.push(body2[k++].v);
        k++;
        const js = charList(list, nChar, sets);
        if (cmd === 'wtset') js.forEach(j => { m.chars[j].weight = +val; });
        else {
          const ty = val.toLowerCase();
          js.forEach(j => {
            if (ty === 'unord') m.chars[j].type = Mx.isCont(m.chars[j]) ? 'cont' : 'unord';
            else if (ty === 'ord') m.chars[j].type = 'ord';
            else if (userTypes[ty] || userTypes[ty.replace(/ /g, '_')]) {
              m.chars[j].type = 'step';
              const ut = userTypes[ty] || userTypes[ty.replace(/ /g, '_')], k2 = ut.cost.length;
              m.chars[j].cost = ut.cost.map(r => r.slice());
              while (m.chars[j].states.length < k2) m.chars[j].states.push(String(m.chars[j].states.length));
            } else notes.push({ es: `Tipo de carácter desconocido «${val}»; se dejó sin ordenar.`, en: `Unknown character type «${val}»; left unordered.` });
          });
        }
      }
    } else if (cmd === 'options') {
      const k = tk.findIndex(t => /^deftype$/i.test(t.v));
      if (k >= 0 && tk[k + 2] && /^ord$/i.test(tk[k + 2].v)) m.chars.forEach(c => { if (c.type === 'unord') c.type = 'ord'; });
    }
  }));
  /* the private block */
  privateBlocks.forEach(body => commands(body).forEach(c => {
    const tk = tokens(c);
    if (!tk.length) return;
    const cmd = tk[0].v.toLowerCase();
    if (cmd === 'title' && tk[1]) m.title = tv(tk[1]);
    else if (cmd === 'outgroup') {
      m.taxa.forEach(t => { t.outgroup = false; });
      tk.slice(1).forEach(t => { const i = +t.v - 1; if (m.taxa[i]) m.taxa[i].outgroup = true; });
    } else if (cmd === 'inactivetaxa') tk.slice(1).forEach(t => { const i = +t.v - 1; if (m.taxa[i]) m.taxa[i].active = false; });
    else if (cmd === 'depends') {
      /* DEPENDS j ON c = s1 s2 */
      const j = +tk[1].v - 1, on = +tk[3].v - 1;
      const sts = tk.slice(5).map(t => +t.v);
      if (m.chars[j] && m.chars[on]) m.chars[j].depends = { on, states: sts };
    } else if (cmd === 'unit') {
      const j = +tk[1].v - 1;
      if (m.chars[j]) m.chars[j].unit = tv(tk[2]);
    } else if (cmd === 'charnote') {
      const j = +tk[1].v - 1;
      if (m.chars[j]) m.chars[j].note = tv(tk[2]);
    } else if (cmd === 'taxonnote') {
      const i = +tk[1].v - 1;
      if (m.taxa[i]) m.taxa[i].note = tv(tk[2]);
    }
  }));
  if (!m.taxa.some(t => t.outgroup) && m.taxa.length) m.taxa[0].outgroup = true;
  return { matrix: m, trees, notes };
};

function readCharsBlock(body, taxaKnown, notes) {
  const cmds = commands(body);
  let nchar = 0, ntax = 0, datatype = 'standard', symbols = null, missing = '?', gap = '-', match = null, interleave = false;
  let charNames = [], stateNames = [];
  let matrixText = null;
  cmds.forEach(c => {
    const head = c.trim().split(/\s+/)[0].toLowerCase();
    if (head === 'matrix') { matrixText = c.replace(/^\s*matrix/i, ''); return; }
    const tk = tokens(c);
    if (!tk.length) return;
    const cmd = tk[0].v.toLowerCase();
    const val = key => { const k = tk.findIndex(t => t.v && t.v.toLowerCase() === key); return k >= 0 && tk[k + 1] && tk[k + 1].v === '=' ? tk[k + 2] : null; };
    if (cmd === 'dimensions') {
      const nc = val('nchar'), nt = val('ntax');
      if (nc) nchar = +nc.v; if (nt) ntax = +nt.v;
    } else if (cmd === 'format') {
      const dt = val('datatype'); if (dt) datatype = dt.v.toLowerCase();
      const sy = val('symbols'); if (sy) symbols = sy.v.replace(/\s+/g, '').split('');
      const mi = val('missing'); if (mi) missing = mi.v;
      const ga = val('gap'); if (ga) gap = ga.v;
      const mc = val('matchchar'); if (mc) match = mc.v;
      if (tk.some(t => /^interleave$/i.test(t.v))) {
        const k = tk.findIndex(t => /^interleave$/i.test(t.v));
        interleave = !(tk[k + 1] && tk[k + 1].v === '=' && /^no$/i.test(tk[k + 2].v));
      }
    } else if (cmd === 'charstatelabels') {
      /* number name / state state, number name / …, */
      let k = 1;
      while (k < tk.length) {
        const num = +tk[k].v; k++;
        let name = '';
        if (k < tk.length && !(tk[k].p && (tk[k].v === '/' || tk[k].v === ','))) { name = tv(tk[k]); k++; }
        const sts = [];
        if (k < tk.length && tk[k].v === '/') { k++; while (k < tk.length && !(tk[k].p && tk[k].v === ',')) { sts.push(tv(tk[k])); k++; } }
        if (k < tk.length && tk[k].v === ',') k++;
        if (num >= 1) { charNames[num - 1] = name; if (sts.length) stateNames[num - 1] = sts; }
      }
    } else if (cmd === 'charlabels') {
      charNames = tk.slice(1).map(tv);
    } else if (cmd === 'statelabels') {
      let k = 1;
      while (k < tk.length) {
        const num = +tk[k].v; k++;
        const sts = [];
        while (k < tk.length && !(tk[k].p && tk[k].v === ',')) { sts.push(tv(tk[k])); k++; }
        k++;
        if (num >= 1) stateNames[num - 1] = sts;
      }
    }
  });
  if (matrixText == null) throw new Error('el bloque de caracteres no tiene MATRIX');
  const cont = datatype === 'continuous';
  const nuc = datatype === 'dna' || datatype === 'rna' || datatype === 'nucleotide';
  const prot = datatype === 'protein';
  if (!symbols) symbols = nuc ? 'ACGT'.split('') : prot ? AA.split('') : null;
  const symIdx = new Map();
  if (symbols) symbols.forEach((s, k) => symIdx.set(s.toUpperCase(), k));
  const symOf = ch => {
    const u = ch.toUpperCase();
    if (symIdx.has(u)) return symIdx.get(u);
    const k = Mx.SYMBOLS.indexOf(u);
    return k >= 0 && !nuc && !prot ? k : -1;
  };
  /* rows */
  const rows = new Map();   // name → array of cells
  const order = [];
  const lines = matrixText.split('\n');
  let firstName = null;
  const unknownSyms = new Set();
  const parseStates = (str, nm) => {
    const out = rows.get(nm);
    let i = 0;
    while (i < str.length) {
      const c = str[i];
      if (/\s/.test(c)) { i++; continue; }
      if (cont) {
        let t = '';
        while (i < str.length && !/\s/.test(str[i])) t += str[i++];
        if (t === missing || t === '?') out.push(Mx.MISSING);
        else if (t === gap || t === '-') out.push(Mx.GAP);
        else { try { out.push(Mx.parseCell(t, { type: 'cont' })); } catch (e) { out.push(Mx.MISSING); unknownSyms.add(t); } }
        continue;
      }
      if (c === '(' || c === '{') {
        const close = c === '(' ? ')' : '}';
        const j = str.indexOf(close, i);
        const inner = str.slice(i + 1, j < 0 ? str.length : j).replace(/[\s,&/]+/g, '');
        let mask = 0;
        for (const ch of inner) {
          if (nuc && NUC[ch.toUpperCase()]) { mask |= NUC[ch.toUpperCase()]; continue; }
          const k = symOf(ch); if (k >= 0) mask |= 1 << k; else unknownSyms.add(ch);
        }
        out.push(mask ? (c === '{' && Mx.popcount(mask) > 1 ? mask | Mx.UNC : mask) : Mx.MISSING);
        i = j < 0 ? str.length : j + 1;
        continue;
      }
      if (c === missing || c === '?') out.push(Mx.MISSING);
      else if (c === gap || c === '-') out.push(Mx.GAP);
      else if (match && c === match) {
        const ref = rows.get(firstName);
        out.push(ref && ref[out.length] != null ? ref[out.length] : Mx.MISSING);
      } else if (nuc) {
        const v = NUC[c.toUpperCase()];
        if (v === 15) out.push(Mx.MISSING); else if (v) out.push(Mx.popcount(v) > 1 ? v | Mx.UNC : v); else { out.push(Mx.MISSING); unknownSyms.add(c); }
      } else {
        const k = symOf(c);
        if (k >= 0) out.push(1 << k); else { out.push(Mx.MISSING); unknownSyms.add(c); }
      }
      i++;
    }
  };
  /* one row (or interleaved piece) per line: a name, then states */
  const nameRe = /^\s*('(?:[^']|'')*'|\S+)\s*(.*)$/;
  if (!interleave) {
    /* rows may break across lines: read names and keep adding states until nchar */
    const all = matrixText;
    let pos = 0;
    const take = () => {
      while (pos < all.length && /\s/.test(all[pos])) pos++;
      if (pos >= all.length) return null;
      let name;
      if (all[pos] === "'") {
        let t = ''; pos++;
        while (pos < all.length) { if (all[pos] === "'" && all[pos + 1] === "'") { t += "'"; pos += 2; continue; } if (all[pos] === "'") { pos++; break; } t += all[pos++]; }
        name = t;
      } else {
        let t = '';
        while (pos < all.length && !/\s/.test(all[pos])) t += all[pos++];
        name = unq(t);
      }
      return name;
    };
    for (;;) {
      const name = take();
      if (name == null) break;
      if (!rows.has(name)) { rows.set(name, []); order.push(name); if (firstName == null) firstName = name; }
      /* the states of this taxon: cell by cell until NCHAR (a row may run over
         several lines); without NCHAR, to the end of the line */
      const start = pos;
      let n = 0;
      while (pos < all.length && (!nchar || n < nchar)) {
        const c = all[pos];
        if (c === '\n' && !nchar) break;
        if (/\s/.test(c)) { pos++; continue; }
        if (cont) { while (pos < all.length && !/\s/.test(all[pos])) pos++; n++; continue; }
        if (c === '(' || c === '{') { const j = all.indexOf(c === '(' ? ')' : '}', pos); pos = j < 0 ? all.length : j + 1; n++; continue; }
        pos++; n++;
      }
      parseStates(all.slice(start, pos), name);
    }
  } else {
    lines.forEach(line => {
      if (!line.trim()) return;
      const mt = line.match(nameRe);
      if (!mt) return;
      let name = mt[1];
      name = name[0] === "'" ? name.slice(1, -1).replace(/''/g, "'") : unq(name);
      if (!rows.has(name)) { rows.set(name, []); order.push(name); if (firstName == null) firstName = name; }
      parseStates(mt[2], name);
    });
  }
  if (unknownSyms.size) notes.push({ es: `Símbolos que no son estados se leyeron como «?»: ${[...unknownSyms].join(' ')}`, en: `Symbols that are not states were read as «?»: ${[...unknownSyms].join(' ')}` });
  const n = nchar || Math.max(...order.map(nm => rows.get(nm).length));
  const taxa = order;
  if (ntax && taxa.length !== ntax) notes.push({ es: `DIMENSIONS dice ${ntax} taxones y la matriz trae ${taxa.length}.`, en: `DIMENSIONS says ${ntax} taxa and the matrix has ${taxa.length}.` });
  const rowsOut = taxa.map(nm => {
    const r = rows.get(nm);
    if (r.length !== n) notes.push({ es: `«${nm}» tiene ${r.length} celdas y se esperaban ${n}; se completó con «?» o se recortó.`, en: `«${nm}» has ${r.length} cells and ${n} were expected; padded with «?» or trimmed.` });
    const out = r.slice(0, n);
    while (out.length < n) out.push(Mx.MISSING);
    return out;
  });
  const chars = [];
  for (let j = 0; j < n; j++) {
    let k = 0;
    if (!cont) {
      rowsOut.forEach(r => { const c = r[j]; if (typeof c === 'number' && c > 0) { const b = Mx.bits(c & Mx.MASK); k = Math.max(k, b[b.length - 1] + 1); } });
      if (symbols && !nuc && !prot) k = Math.max(k, Math.min(symbols.length, 2));
    }
    const sn = stateNames[j] || [];
    k = Math.max(k, sn.length, cont ? 0 : 2);
    if (nuc) k = 4;
    if (prot) k = 20;
    const states = cont ? [] : Array.from({ length: k }, (_, s) => sn[s] != null && sn[s] !== '' ? sn[s] : nuc ? 'ACGT'[s] : prot ? AA[s] : String(symbols ? symbols[s] || Mx.SYMBOLS[s] : Mx.SYMBOLS[s]));
    const c = Mx.newChar(charNames[j] || '', 0, cont ? 'cont' : 'unord');
    c.states = states;
    chars.push(c);
  }
  return { taxa, rows: rowsOut, chars, continuous: cont };
}

function readTreesBlock(body, trees) {
  const translate = new Map();
  commands(body).forEach(c => {
    const s = c.trim();
    if (/^translate\b/i.test(s)) {
      const tk = tokens(s.replace(/^translate/i, ''));
      for (let k = 0; k + 1 < tk.length; k += 3) translate.set(tk[k].v, tv(tk[k + 1]));
    } else if (/^u?tree\b/i.test(s)) {
      const m = s.match(/^u?tree\s+\*?\s*('(?:[^']|'')*'|[^=\s]+)\s*=\s*([\s\S]*)$/i);
      if (!m) return;
      let nw = m[2].trim();
      if (translate.size) nw = nw.replace(/([(,])\s*([^(),:;\s]+)/g, (all, pre, lab) => pre + (translate.has(lab) ? "'" + translate.get(lab).replace(/'/g, "''") + "'" : lab));
      trees.push({ name: m[1].replace(/^'|'$/g, ''), newick: nw.endsWith(';') ? nw : nw + ';' });
    }
  });
}

/* ================================================================
   xread
   ================================================================ */
/* a tree of the xread format, «(0 (1 2))», as Newick with the names of the taxa */
function treadToNewick(str, names) {
  const tk = String(str).match(/\(|\)|[^\s()]+/g) || [];
  let out = '', prev = '', depth = 0;
  const q = nm => (/^[^\s(),:;'[\]]+$/.test(nm) ? nm : "'" + nm.replace(/'/g, "''") + "'");
  tk.forEach(t => {
    if (t === '(') { if (prev && prev !== '(') out += ','; out += '('; depth++; }
    else if (t === ')') { out += ')'; depth--; }
    else {
      if (prev && prev !== '(') out += ',';
      const nm = /^\d+$/.test(t) ? names[+t] : t;
      if (nm == null) throw new Error('taxón ' + t);
      out += q(nm);
    }
    prev = t;
  });
  if (depth !== 0) throw new Error('paréntesis');
  return out + ';';
}
IO.treadToNewick = treadToNewick;
IO.readXread = function (text) {
  const notes = [];
  let s = String(text).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const at = s.search(/\bxread\b/i);
  if (at < 0) throw new Error('no se encontró la palabra xread');
  const pre = s.slice(0, at);
  let i = at + 5;
  /* optional title between quotes */
  const skipWs = () => { while (i < s.length && /\s/.test(s[i])) i++; };
  const skipComment = () => { skipWs(); while (s[i] === '[' && !/^\[[0-9A-T?\-]/i.test(s.slice(i, i + 2))) { const j = s.indexOf(']', i); i = j < 0 ? s.length : j + 1; skipWs(); } };
  skipWs();
  let title = '';
  if (s[i] === "'") { const j = s.indexOf("'", i + 1); title = s.slice(i + 1, j).trim(); i = j + 1; }
  skipWs();
  const numRe = /^(\d+)\s+(\d+)/;
  const mm = s.slice(i).match(numRe);
  if (!mm) throw new Error('después de xread se esperaban el número de caracteres y el de taxones');
  const nchar = +mm[1], ntax = +mm[2];
  i += mm[0].length;
  const end = s.indexOf(';', i);
  const body = s.slice(i, end < 0 ? s.length : end);
  const after = end < 0 ? '' : s.slice(end + 1);
  /* partitions */
  const parts = [];
  if (/&\s*\[/.test(body)) {
    body.split(/&\s*\[/).forEach((p, k) => {
      if (k === 0) { if (p.trim()) parts.push({ type: 'num', text: p }); return; }
      const j = p.indexOf(']');
      const ty = p.slice(0, j).trim().toLowerCase().split(/\s+/)[0];
      parts.push({ type: ty.startsWith('cont') ? 'cont' : ty.startsWith('dna') ? 'dna' : ty.startsWith('prot') ? 'prot' : 'num', text: p.slice(j + 1) });
    });
  } else parts.push({ type: 'num', text: body });
  const names = [];
  const rowsAll = new Map();
  const chars = [];
  parts.forEach(part => {
    const rows = new Map(), order = [];
    let pos = 0;
    const t = part.text;
    const cont = part.type === 'cont', dna = part.type === 'dna', prot = part.type === 'prot';
    const wsSkip = () => { while (pos < t.length && /\s/.test(t[pos])) pos++; };
    while (pos < t.length) {
      wsSkip();
      if (pos >= t.length) break;
      let name = '';
      while (pos < t.length && !/\s/.test(t[pos])) name += t[pos++];
      name = unq(name);
      const row = rows.get(name) || [];
      if (!rows.has(name)) { rows.set(name, row); order.push(name); }
      /* states to the end of the line */
      while (pos < t.length && t[pos] !== '\n') {
        const c = t[pos];
        if (/\s/.test(c)) { pos++; continue; }
        if (cont) {
          let tok = '';
          while (pos < t.length && !/\s/.test(t[pos])) tok += t[pos++];
          if (tok === '?') row.push(Mx.MISSING); else if (tok === '-') row.push(Mx.GAP);
          else { try { row.push(Mx.parseCell(tok, { type: 'cont' })); } catch (e) { row.push(Mx.MISSING); } }
          continue;
        }
        if (c === '[') {
          const j = t.indexOf(']', pos);
          const inner = t.slice(pos + 1, j < 0 ? t.length : j).replace(/\s+/g, '');
          let mask = 0;
          for (const ch of inner) {
            if (dna) { mask |= NUC[ch.toUpperCase()] || 0; continue; }
            const k = prot ? AA.indexOf(ch.toUpperCase()) : (ch >= 'a' && ch <= 'z' ? -1 : Mx.SYMBOLS.indexOf(ch.toUpperCase()));
            if (k >= 0) mask |= 1 << k;
          }
          row.push(mask || Mx.MISSING);
          pos = j < 0 ? t.length : j + 1;
          continue;
        }
        if (c === '?') row.push(Mx.MISSING);
        else if (c === '-') row.push(Mx.GAP);
        else if (dna) { const v = NUC[c.toUpperCase()]; row.push(v === 15 || !v ? Mx.MISSING : Mx.popcount(v) > 1 ? v | Mx.UNC : v); }
        else if (prot) { const k = AA.indexOf(c.toUpperCase()); row.push(k >= 0 ? 1 << k : Mx.MISSING); }
        else { const k = Mx.SYMBOLS.indexOf(c.toUpperCase()); row.push(k >= 0 ? 1 << k : Mx.MISSING); }
        pos++;
      }
    }
    const width = Math.max(0, ...order.map(n => rows.get(n).length));
    const base = chars.length;
    for (let q = 0; q < width; q++) {
      let k = 2;
      order.forEach(n => { const c = rows.get(n)[q]; if (typeof c === 'number' && c > 0) { const b = Mx.bits(c & Mx.MASK); k = Math.max(k, b[b.length - 1] + 1); } });
      if (dna) k = 4; if (prot) k = 20;
      const ch = Mx.newChar('', cont ? 0 : k, cont ? 'cont' : 'unord');
      if (dna) ch.states = 'ACGT'.split('');
      if (prot) ch.states = AA.split('');
      chars.push(ch);
    }
    order.forEach(n => {
      if (!rowsAll.has(n)) { rowsAll.set(n, []); names.push(n); }
      const r = rowsAll.get(n);
      while (r.length < base) r.push(Mx.MISSING);
      const src = rows.get(n);
      for (let q = 0; q < width; q++) r.push(src[q] == null ? Mx.MISSING : src[q]);
    });
  });
  names.forEach(n => { const r = rowsAll.get(n); while (r.length < chars.length) r.push(Mx.MISSING); });
  if (chars.length !== nchar) notes.push({ es: `El encabezado dice ${nchar} caracteres y la matriz trae ${chars.length}.`, en: `The header says ${nchar} characters and the matrix has ${chars.length}.` });
  if (names.length !== ntax) notes.push({ es: `El encabezado dice ${ntax} taxones y la matriz trae ${names.length}.`, en: `The header says ${ntax} taxa and the matrix has ${names.length}.` });
  const m = { title, taxa: names.map(n => Mx.newTaxon(n)), chars, cells: names.map(n => rowsAll.get(n)) };
  /* commands after the matrix (and before it: some files declare nstates first).
     Square brackets are NOT comments in this format: in a row they are a
     polymorphism and in ccode they switch characters off. cnames is read
     apart: each of its entries ends with its own «;». */
  let cmdText = pre + ';' + after;
  const cnRe = /(^|[\s;])(cn|cna|cnam|cname|cnames)\s+((?:\{[^;]*;\s*)*)\s*;/i;
  let cnm;
  while ((cnm = cmdText.match(cnRe))) {
    readCnames(cnm[3], m);
    cmdText = cmdText.slice(0, cnm.index) + cnm[1] + cmdText.slice(cnm.index + cnm[0].length);
  }
  const smat = {};
  const trees = [];
  commands(cmdText).forEach(c => {
    const s2 = c.trim();
    if (!s2) return;
    const head = s2.split(/\s+/)[0].toLowerCase();
    const rest = s2.slice(head.length);
    if (/^(ccode|cc|cco|ccod)$/.test(head)) readCcode(rest, m);
    else if (/^(cnames|cn|cna|cnam|cname)$/.test(head)) readCnames(rest, m);
    else if (/^(smatrix|smat|sm|smatr|smatri)$/.test(head)) readSmatrix(rest, m, smat);
    else if (/^(outgroup|outg)$/.test(head)) {
      const v = rest.trim().split(/\s+/)[0];
      const k = /^\d+$/.test(v) ? +v : m.taxa.findIndex(t => t.name === unq(v));
      if (m.taxa[k]) { m.taxa.forEach(t => { t.outgroup = false; }); m.taxa[k].outgroup = true; }
    } else if (head === 'tread') {
      /* trees by the number (from 0) or the name of each taxon, several separated by «*» */
      rest.replace(/'[^']*'/g, ' ').split('*').forEach(part => {
        if (!/\(/.test(part)) return;
        try { trees.push({ name: 'tread_' + (trees.length + 1), newick: treadToNewick(part, m.taxa.map(t => t.name)) }); } catch (e) { notes.push('un árbol de tread no se pudo leer'); }
      });
    } else if (/^(xread|nstates|mxram|taxname|proc|hold|piwe|tread|mult|bb|ie|ienum|log|quit|zzz|rseed|keep|collapse|report|tsave|ttags|xmult|sect|drift|ratchet|majority|nelsen|resample|bsupport|naked|tchoose|cls|silent|echo|cnames|outgroup|lquote|macro|var|run|warn|xinact|xpiwe|condense|best|tplot|export|minmax|mxproc|ttag)/.test(head)) { /* not part of the matrix */ }
  });
  if (!m.taxa.some(t => t.outgroup) && m.taxa.length) m.taxa[0].outgroup = true;
  return { matrix: m, trees, notes };
};
/* ccode: + additive, - non-additive, [ inactive, ] active, /N weight N, ( step matrix on, ) off */
function readCcode(rest, m) {
  const n = m.chars.length;
  const tk = rest.replace(/([+\-\[\]()])/g, ' $1 ').replace(/\/\s*(\d+)/g, ' /$1 ').trim().split(/\s+/).filter(Boolean);
  let mode = null;
  for (const t of tk) {
    if (['+', '-', '[', ']', '(', ')'].includes(t) || /^\/\d+$/.test(t) || t === '*') { mode = t; continue; }
    let js = [];
    if (t === '.') js = m.chars.map((_, j) => j);
    else {
      const r = t.match(/^(\d*)\.(\d*)$/);
      if (r) { const a = r[1] === '' ? 0 : +r[1], b = r[2] === '' ? n - 1 : +r[2]; for (let j = a; j <= b; j++) js.push(j); }
      else if (/^\d+$/.test(t)) js = [+t];
    }
    js.forEach(j => {
      const c = m.chars[j]; if (!c || !mode) return;
      if (mode === '+') { if (!Mx.isCont(c)) c.type = 'ord'; }
      else if (mode === '-') { if (!Mx.isCont(c)) c.type = 'unord'; }
      else if (mode === '[') c.active = false;
      else if (mode === ']') c.active = true;
      else if (mode === '(') { if (c.cost) c.type = 'step'; }
      else if (mode === ')') { if (c.type === 'step') c.type = 'unord'; }
      else if (mode[0] === '/') c.weight = +mode.slice(1);
    });
  }
}
/* cnames: {N name state state ... ; */
function readCnames(rest, m) {
  rest.split('{').slice(1).forEach(entry => {
    const tk = entry.replace(/;\s*$/, '').trim().split(/\s+/);
    const j = +tk[0];
    if (!m.chars[j]) return;
    if (tk[1] != null) m.chars[j].name = unq(tk[1]).trim();
    const sts = tk.slice(2).map(unq);
    if (sts.length && !Mx.isCont(m.chars[j])) {
      const k = Math.max(sts.length, m.chars[j].states.length);
      m.chars[j].states = Array.from({ length: k }, (_, s) => (sts[s] != null && sts[s] !== '' ? sts[s] : m.chars[j].states[s] || Mx.SYMBOLS[s]));
    }
  });
}
/* smatrix =N (name) a>b cost a/b cost ;  and  smatrix +name chars ; */
function readSmatrix(rest, m, smat) {
  const s = rest.trim();
  let mm = s.match(/^=\s*(\d+)\s*(?:\(([^)]*)\))?([\s\S]*)$/);
  if (mm) {
    const id = mm[1], name = (mm[2] || '').trim();
    const pairs = [];
    const re = /([0-9A-T])\s*([>/])\s*([0-9A-T])\s+(\d+(?:\.\d+)?)/gi;
    let p;
    let k = 0;
    while ((p = re.exec(mm[3]))) { pairs.push([Mx.SYMBOLS.indexOf(p[1].toUpperCase()), p[2], Mx.SYMBOLS.indexOf(p[3].toUpperCase()), +p[4]]); k = Math.max(k, pairs[pairs.length - 1][0] + 1, pairs[pairs.length - 1][2] + 1); }
    const C = Array.from({ length: k }, (_, a) => Array.from({ length: k }, (_, b) => (a === b ? 0 : 1)));
    pairs.forEach(([a, op, b, v]) => { C[a][b] = v; if (op === '/') C[b][a] = v; });
    smat[id] = C; if (name) smat[name.toLowerCase()] = C;
    return;
  }
  mm = s.match(/^\+\s*(\S+)\s+([\s\S]*)$/);
  if (mm) {
    const C = smat[mm[1].toLowerCase()];
    if (!C) return;
    mm[2].trim().split(/\s+/).forEach(t => {
      const r = t.match(/^(\d*)\.(\d*)$/);
      const js = r ? (() => { const a = r[1] === '' ? 0 : +r[1], b = r[2] === '' ? m.chars.length - 1 : +r[2]; const o = []; for (let j = a; j <= b; j++) o.push(j); return o; })() : /^\d+$/.test(t) ? [+t] : [];
      js.forEach(j => {
        const c = m.chars[j]; if (!c || Mx.isCont(c)) return;
        const k = Math.max(C.length, c.states.length);
        c.cost = Array.from({ length: k }, (_, a) => Array.from({ length: k }, (_, b) => (C[a] && C[a][b] != null ? C[a][b] : a === b ? 0 : 1)));
        while (c.states.length < k) c.states.push(Mx.SYMBOLS[c.states.length]);
        c.type = 'step';
      });
    });
  }
}

/* ================================================================
   tables (CSV, TSV, semicolons, pasted from a spreadsheet)
   ================================================================ */
function splitTable(text) {
  const s = String(text).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const first = s.split('\n').find(l => l.trim()) || '';
  const delim = first.includes('\t') ? '\t' : (first.split(';').length > first.split(',').length ? ';' : ',');
  const rows = [];
  let row = [], cur = '', q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '"') { if (s[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; continue; }
    if (c === '"' && cur === '') { q = true; continue; }
    if (c === delim) { row.push(cur); cur = ''; continue; }
    if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; continue; }
    cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(x => String(x).trim() !== ''));
}
IO.readTable = function (text) {
  const notes = [];
  const rows = splitTable(text);
  if (rows.length < 2) throw new Error('la tabla necesita un encabezado y al menos una fila');
  const head = rows[0].map(x => x.trim());
  let body = rows.slice(1);
  /* optional rows that start with «#»: # estados / # states, # tipo / # type, # peso / # weight */
  const meta = {};
  body = body.filter(r => {
    const k = String(r[0]).trim().toLowerCase();
    if (/^#\s*(estados|states)$/.test(k)) { meta.states = r; return false; }
    if (/^#\s*(tipo|type)$/.test(k)) { meta.type = r; return false; }
    if (/^#\s*(peso|weight)$/.test(k)) { meta.weight = r; return false; }
    if (/^#\s*(depende|depends)$/.test(k)) { meta.depends = r; return false; }
    if (/^#\s*(activo|active)$/.test(k)) { meta.active = r; return false; }
    return true;
  });
  const nc = head.length - 1;
  if (nc < 1) throw new Error('la tabla no tiene columnas de caracteres');
  const m = { title: '', taxa: body.map(r => Mx.newTaxon(String(r[0]).trim())), chars: [], cells: body.map(() => []) };
  for (let j = 0; j < nc; j++) {
    const col = body.map(r => (r[j + 1] == null ? '' : String(r[j + 1]).trim()));
    let ty = meta.type && meta.type[j + 1] ? String(meta.type[j + 1]).trim().toLowerCase() : '';
    ty = /^(cont|continuo|continuous)/.test(ty) ? 'cont' : /^(ord|ordenado|ordered|aditivo|additive)/.test(ty) ? 'ord' : ty ? 'unord' : '';
    if (!ty) {
      /* a column with decimals, or with values beyond the symbols, is continuous */
      const known = col.filter(v => v && v !== '?' && v !== '-');
      const numeric = known.length && known.every(v => /^-?\d+([.,]\d+)?([-–]\d+([.,]\d+)?)?$/.test(v));
      ty = numeric && known.some(v => /[.,]/.test(v) || /\d[-–]\d/.test(v) || +v >= Mx.MAXSTATES) ? 'cont' : 'unord';
    }
    const ch = Mx.newChar(head[j + 1] || '', 0, ty);
    const cells = col.map((v, i) => {
      try { return Mx.parseCell(v, ch); } catch (e) { notes.push({ es: `«${v}» en ${m.taxa[i].name}, carácter ${j + 1}: ${e.message}; se leyó como «?».`, en: `«${v}» in ${m.taxa[i].name}, character ${j + 1}: ${e.message}; read as «?».` }); return Mx.MISSING; }
    });
    if (ty !== 'cont') {
      let k = 2;
      cells.forEach(c => { if (typeof c === 'number' && c > 0) { const b = Mx.bits(c & Mx.MASK); k = Math.max(k, b[b.length - 1] + 1); } });
      const names = meta.states && meta.states[j + 1] ? String(meta.states[j + 1]).split('|').map(x => x.trim()) : [];
      k = Math.max(k, names.length);
      ch.states = Array.from({ length: k }, (_, s) => (names[s] ? names[s] : Mx.SYMBOLS[s]));
    }
    if (meta.weight && meta.weight[j + 1] && +meta.weight[j + 1] >= 0) ch.weight = +meta.weight[j + 1];
    if (meta.active && /^(no|false|0|inactivo|inactive)$/i.test(String(meta.active[j + 1] || '').trim())) ch.active = false;
    m.chars.push(ch);
    cells.forEach((c, i) => m.cells[i].push(c));
  }
  if (meta.depends) meta.depends.slice(1).forEach((d, j) => {
    const mm = String(d).trim().match(/^(\d+)\s*[=:]\s*([0-9A-T ,]+)$/i);
    if (mm && m.chars[+mm[1] - 1]) m.chars[j].depends = { on: +mm[1] - 1, states: mm[2].replace(/[ ,]/g, '').split('').map(c => Mx.SYMBOLS.indexOf(c.toUpperCase())) };
  });
  if (m.taxa.length) m.taxa[0].outgroup = true;
  return { matrix: m, trees: [], notes };
};

/* ================================================================
   writers
   ================================================================ */
const nq = s => {
  const t = String(s == null ? '' : s);
  if (t !== '' && /^[A-Za-z0-9_.\-]+$/.test(t) && !/^\d+$/.test(t)) return t;
  return "'" + t.replace(/'/g, "''") + "'";
};
const xq = s => String(s == null ? '' : s).trim().replace(/\s+/g, '_').replace(/[;{}\[\]]/g, '') || '_';
function ranges(js) {
  /* 0-based indices → «1-3 5» (1-based) */
  const s = [...js].sort((a, b) => a - b), out = [];
  for (let i = 0; i < s.length;) {
    let j = i;
    while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++;
    out.push(j > i ? (s[i] + 1) + '-' + (s[j] + 1) : String(s[i] + 1));
    i = j + 1;
  }
  return out.join(' ');
}
IO.writeNexus = function (m, opts) {
  opts = opts || {};
  const L = [];
  const disc = m.chars.map((c, j) => j).filter(j => !Mx.isCont(m.chars[j]));
  const cont = m.chars.map((c, j) => j).filter(j => Mx.isCont(m.chars[j]));
  const pad = Math.max(...m.taxa.map(t => nq(t.name).length), 4) + 2;
  L.push('#NEXUS');
  L.push('[Escrito por CladisticsPro' + (m.title ? ' — ' + String(m.title).replace(/[\[\]]/g, '') : '') + ']');
  L.push('');
  L.push('BEGIN TAXA;');
  L.push('  DIMENSIONS NTAX=' + m.taxa.length + ';');
  L.push('  TAXLABELS ' + m.taxa.map(t => nq(t.name)).join(' ') + ';');
  L.push('END;');
  /* the original numbering of every character, for the assumptions */
  const num = new Map();
  if (disc.length) {
    disc.forEach((j, q) => num.set(j, q + 1));
    const maxK = Math.max(2, ...disc.map(j => Mx.k(m, j)));
    L.push('');
    L.push('BEGIN CHARACTERS;');
    if (cont.length) L.push("  TITLE 'Discretos';");
    L.push('  DIMENSIONS NCHAR=' + disc.length + ';');
    L.push('  FORMAT DATATYPE=STANDARD MISSING=? GAP=- SYMBOLS="' + Mx.SYMBOLS.slice(0, maxK).split('').join(' ') + '";');
    L.push('  CHARSTATELABELS');
    L.push(disc.map((j, q) => {
      const c = m.chars[j];
      return '    ' + (q + 1) + (c.name ? ' ' + nq(c.name) : '') + ' / ' + c.states.map(nq).join(' ');
    }).join(',\n') + ';');
    L.push('  MATRIX');
    m.taxa.forEach((t, i) => L.push('    ' + nq(t.name).padEnd(pad) + disc.map(j => Mx.cellText(m.cells[i][j], m.chars[j])).join('')));
    L.push('  ;');
    L.push('END;');
  }
  if (cont.length) {
    L.push('');
    L.push('BEGIN CHARACTERS;');
    L.push("  TITLE 'Continuos';");
    L.push('  DIMENSIONS NCHAR=' + cont.length + ';');
    L.push('  FORMAT DATATYPE=CONTINUOUS MISSING=? GAP=-;');
    L.push('  CHARLABELS ' + cont.map(j => nq(m.chars[j].name || ('car_' + (j + 1)))).join(' ') + ';');
    L.push('  MATRIX');
    m.taxa.forEach((t, i) => L.push('    ' + nq(t.name).padEnd(pad) + cont.map(j => {
      const c = m.cells[i][j];
      /* a range has no standard notation in a continuous block: its middle goes
         here and the range itself in the CLADISTICSPRO block */
      return Array.isArray(c) ? Mx.fmtNum((c[0] + c[1]) / 2) : c === Mx.GAP ? '-' : '?';
    }).join(' ')));
    L.push('  ;');
    L.push('END;');
  }
  /* assumptions of the discrete block */
  const ord = disc.filter(j => m.chars[j].type === 'ord');
  const step = disc.filter(j => m.chars[j].type === 'step' && m.chars[j].cost);
  const wts = new Map();
  disc.forEach(j => { const w = m.chars[j].weight == null ? 1 : m.chars[j].weight; if (w !== 1) { if (!wts.has(w)) wts.set(w, []); wts.get(w).push(num.get(j) - 1); } });
  const ex = disc.filter(j => m.chars[j].active === false);
  if (disc.length && (ord.length || step.length || wts.size || ex.length)) {
    L.push('');
    L.push('BEGIN ASSUMPTIONS;');
    step.forEach(j => {
      const C = m.chars[j].cost, k = C.length;
      L.push('  USERTYPE paso_' + num.get(j) + ' (STEPMATRIX) = ' + k);
      L.push('    ' + Mx.SYMBOLS.slice(0, k).split('').join(' '));
      C.forEach((r, a) => L.push('    ' + r.map((v, b) => (a === b ? '.' : v >= 9999 ? 'i' : String(v))).join(' ')));
      L.push('  ;');
    });
    const typeParts = [];
    const unord = disc.filter(j => m.chars[j].type === 'unord' || (m.chars[j].type === 'step' && !m.chars[j].cost));
    if (unord.length) typeParts.push('unord: ' + ranges(unord.map(j => num.get(j) - 1)));
    if (ord.length) typeParts.push('ord: ' + ranges(ord.map(j => num.get(j) - 1)));
    step.forEach(j => typeParts.push('paso_' + num.get(j) + ': ' + num.get(j)));
    L.push('  TYPESET * tipos = ' + typeParts.join(', ') + ';');
    if (wts.size) L.push('  WTSET * pesos = ' + [...wts.entries()].map(([w, js]) => w + ': ' + ranges(js)).join(', ') + ';');
    if (ex.length) L.push('  EXSET * inactivos = ' + ranges(ex.map(j => num.get(j) - 1)) + ';');
    L.push('END;');
  }
  /* trees */
  if (opts.trees && opts.trees.length) {
    L.push('');
    L.push('BEGIN TREES;');
    /* the taxa by number (TRANSLATE): the way every reader of the format takes
       names with spaces, accents or quotes without changing them */
    const T = g.Tree;
    const num = T ? new Map(m.taxa.map((t, i) => [T.normName(t.name), i + 1])) : null;
    const byNumber = nw => {
      if (!T) return null;
      try {
        let ok = true;
        const w = v => {
          if (!v.children.length) { const k = num.get(T.normName(v.name)); if (k == null) ok = false; return String(k); }
          return '(' + v.children.map(w).join(',') + ')' + (v.label != null && v.label !== '' ? nq(String(v.label)) : '') + (v.len != null ? ':' + v.len : '');
        };
        const s = w(T.parseNewick(nw)) + ';';
        return ok ? s : null;
      } catch (e) { return null; }
    };
    const written = opts.trees.map(t => byNumber(t.newick));
    if (written.every(Boolean)) {
      L.push('  TRANSLATE');
      m.taxa.forEach((t, i) => L.push('    ' + (i + 1) + ' ' + nq(t.name) + (i < m.taxa.length - 1 ? ',' : ';')));
    }
    opts.trees.forEach((t, k) => L.push('  TREE ' + nq(t.name || ('arbol_' + (k + 1))) + ' = [&R] ' + (written.every(Boolean) ? written[k] : t.newick)));
    L.push('END;');
  }
  /* what the standard has no command for */
  const priv = [];
  if (m.title) priv.push('  TITLE ' + nq(m.title) + ';');
  const og = m.taxa.map((t, i) => (t.outgroup ? i + 1 : 0)).filter(Boolean);
  if (og.length) priv.push('  OUTGROUP ' + og.join(' ') + ';');
  const inact = m.taxa.map((t, i) => (t.active === false ? i + 1 : 0)).filter(Boolean);
  if (inact.length) priv.push('  INACTIVETAXA ' + inact.join(' ') + ';');
  /* in this block characters keep their order in the app (discrete first, as written) */
  const order = [...disc, ...cont];
  const pos = new Map(order.map((j, q) => [j, q + 1]));
  order.forEach(j => {
    const c = m.chars[j];
    if (c.depends && pos.has(c.depends.on)) priv.push('  DEPENDS ' + pos.get(j) + ' ON ' + pos.get(c.depends.on) + ' = ' + c.depends.states.join(' ') + ';');
    if (c.unit) priv.push('  UNIT ' + pos.get(j) + ' ' + nq(c.unit) + ';');
    if (c.note) priv.push('  CHARNOTE ' + pos.get(j) + ' ' + nq(c.note) + ';');
  });
  m.taxa.forEach((t, i) => { if (t.note) priv.push('  TAXONNOTE ' + (i + 1) + ' ' + nq(t.note) + ';'); });
  cont.forEach(j => m.taxa.forEach((t, i) => {
    const c = m.cells[i][j];
    if (Array.isArray(c) && c[0] !== c[1]) priv.push('  RANGE ' + pos.get(j) + ' ' + (i + 1) + ' ' + Mx.fmtNum(c[0]) + ' ' + Mx.fmtNum(c[1]) + ';');
  }));
  if (priv.length) {
    L.push('');
    L.push('[Lo que el estándar no tiene cómo decir: grupo externo, dependencias de los inaplicables, unidades, notas e intervalos de los continuos]');
    L.push('BEGIN CLADISTICSPRO;');
    priv.forEach(p => L.push(p));
    L.push('END;');
  }
  return L.join('\n') + '\n';
};
/* the CLADISTICSPRO block also carries continuous ranges: read them back */
const _readNexus = IO.readNexus;
IO.readNexus = function (text) {
  const res = _readNexus(text);
  const clean = stripComments(String(text));
  const re = /begin\s+cladisticspro\s*;([\s\S]*?)\bend\s*;/gi;
  let mm;
  while ((mm = re.exec(clean))) commands(mm[1]).forEach(c => {
    const tk = tokens(c);
    if (tk[0] && /^range$/i.test(tk[0].v)) {
      const j = +tk[1].v - 1, i = +tk[2].v - 1, lo = +tk[3].v, hi = +tk[4].v;
      if (res.matrix.cells[i] && res.matrix.chars[j] && Mx.isCont(res.matrix.chars[j])) res.matrix.cells[i][j] = [lo, hi];
    }
  });
  return res;
};

IO.writeXread = function (m, opts) {
  opts = opts || {};
  /* continuous characters go first, as the format requires */
  const cont = m.chars.map((c, j) => j).filter(j => Mx.isCont(m.chars[j]));
  const disc = m.chars.map((c, j) => j).filter(j => !Mx.isCont(m.chars[j]));
  const order = [...cont, ...disc];
  const pos = new Map(order.map((j, q) => [j, q]));
  const L = [];
  const maxK = Math.max(2, ...disc.map(j => Mx.k(m, j)));
  if (maxK > 8) L.push('nstates 32;');
  L.push('xread');
  L.push("'" + String(m.title || 'CladisticsPro').replace(/'/g, '') + "'");
  L.push(order.length + ' ' + m.taxa.length);
  const pad = Math.max(...m.taxa.map(t => xq(t.name).length), 4) + 2;
  const cellX = (c, ch) => {
    if (Array.isArray(c)) return c[0] === c[1] ? Mx.fmtNum(c[0]) : Mx.fmtNum(c[0]) + '-' + Mx.fmtNum(c[1]);
    if (c === Mx.MISSING || c == null) return '?';
    if (c === Mx.GAP) return '-';
    const b = Mx.bits(c & Mx.MASK);
    return b.length === 1 ? Mx.SYMBOLS[b[0]] : '[' + b.map(s => Mx.SYMBOLS[s]).join('') + ']';
  };
  if (cont.length) {
    L.push('&[cont]');
    m.taxa.forEach((t, i) => L.push(xq(t.name).padEnd(pad) + cont.map(j => cellX(m.cells[i][j], m.chars[j])).join(' ')));
  }
  if (disc.length) {
    if (cont.length) L.push('&[num]');
    m.taxa.forEach((t, i) => L.push(xq(t.name).padEnd(pad) + disc.map(j => cellX(m.cells[i][j], m.chars[j])).join('')));
  }
  L.push(';');
  L.push('');
  /* ccode: types, weights, inactive */
  const add = disc.filter(j => m.chars[j].type === 'ord').map(j => pos.get(j));
  const cc = ['ccode - .'];
  if (add.length) cc.push('+ ' + add.join(' '));
  const wts = new Map();
  order.forEach(j => { const w = m.chars[j].weight == null ? 1 : m.chars[j].weight; if (w !== 1) { if (!wts.has(w)) wts.set(w, []); wts.get(w).push(pos.get(j)); } });
  wts.forEach((js, w) => cc.push('/' + w + ' ' + js.join(' ')));
  const ex = order.filter(j => m.chars[j].active === false).map(j => pos.get(j));
  if (ex.length) cc.push('[ ' + ex.join(' '));
  L.push(cc.join(' ') + ' ;');
  /* step matrices */
  const steps = disc.filter(j => m.chars[j].type === 'step' && m.chars[j].cost);
  steps.forEach((j, q) => {
    const C = m.chars[j].cost;
    const pairs = [];
    for (let a = 0; a < C.length; a++) for (let b = 0; b < C.length; b++) if (a !== b) pairs.push(Mx.SYMBOLS[a] + '>' + Mx.SYMBOLS[b] + ' ' + (C[a][b] >= 9999 ? 1000 : C[a][b]));
    L.push('smatrix =' + q + ' (paso' + pos.get(j) + ') ' + pairs.join(' ') + ' ;');
    L.push('smatrix +paso' + pos.get(j) + ' ' + pos.get(j) + ' ;');
  });
  if (steps.length) L.push('ccode ( ' + steps.map(j => pos.get(j)).join(' ') + ' ;');
  /* names */
  L.push('cnames');
  order.forEach(j => {
    const c = m.chars[j];
    L.push('{' + pos.get(j) + ' ' + xq(c.name) + (Mx.isCont(c) ? '' : ' ' + c.states.map(xq).join(' ')) + ' ;');
  });
  L.push(';');
  /* no bracket comments here: in this format a bracket means something */
  const og = m.taxa.findIndex(t => t.outgroup);
  if (og > 0) L.push('outgroup ' + og + ' ;');
  /* trees, by the number of each taxon (from 0), several separated by «*» */
  if (opts.trees && opts.trees.length && g.Tree) {
    const idx = new Map(m.taxa.map((t, i) => [g.Tree.normName(t.name), i]));
    const out = [];
    opts.trees.forEach(t => {
      try {
        /* in each group the taxa first and then the subgroups: a number never follows «)», which some readers take for a label */
        const w = v => (v.children.length ? '(' + v.children.filter(c => !c.children.length).concat(v.children.filter(c => c.children.length)).map(w).join(' ') + ')' : String(idx.get(g.Tree.normName(v.name))));
        const txt = w(g.Tree.parseNewick(t.newick));
        if (txt.indexOf('undefined') < 0) out.push(txt);
      } catch (e) { /* a tree that does not parse is left out */ }
    });
    if (out.length) L.push('tread ' + out.join('*\n') + ' ;');
  }
  L.push('proc /;');
  return L.join('\n') + '\n';
};

IO.writeTable = function (m, delim) {
  delim = delim || ',';
  const esc = v => { const s = String(v == null ? '' : v); return s.includes(delim) || /["\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const L = [];
  L.push(['Taxón', ...m.chars.map(c => c.name)].map(esc).join(delim));
  L.push(['# estados', ...m.chars.map(c => (Mx.isCont(c) ? '' : c.states.join(' | ')))].map(esc).join(delim));
  L.push(['# tipo', ...m.chars.map(c => c.type)].map(esc).join(delim));
  if (m.chars.some(c => (c.weight == null ? 1 : c.weight) !== 1)) L.push(['# peso', ...m.chars.map(c => (c.weight == null ? 1 : c.weight))].map(esc).join(delim));
  if (m.chars.some(c => c.active === false)) L.push(['# activo', ...m.chars.map(c => (c.active === false ? 'no' : 'sí'))].map(esc).join(delim));
  if (m.chars.some(c => c.depends)) L.push(['# depende', ...m.chars.map(c => (c.depends ? (c.depends.on + 1) + '=' + c.depends.states.map(s => Mx.SYMBOLS[s]).join('') : ''))].map(esc).join(delim));
  m.taxa.forEach((t, i) => L.push([t.name, ...m.chars.map((c, j) => Mx.sheetText(m.cells[i][j], c))].map(esc).join(delim)));
  return '﻿' + L.join('\r\n') + '\r\n';
};

/* The character list, as it goes in a paper:
   «1. Hoja: (0) simple; (1) compuesta. [no ordenado]» */
IO.characterList = function (m, lang, opts) {
  opts = opts || {};
  const es = lang !== 'en';
  const TYPE = es ? { unord: 'no ordenado', ord: 'ordenado', step: 'matriz de pasos', cont: 'continuo' } : { unord: 'unordered', ord: 'ordered', step: 'step matrix', cont: 'continuous' };
  const base = opts.base == null ? 1 : opts.base;
  return m.chars.map((c, j) => {
    const n = j + base;
    let s = n + '. ' + (c.name || (es ? 'Carácter sin enunciado' : 'Unnamed character'));
    if (Mx.isCont(c)) s += (c.unit ? ' (' + c.unit + ')' : '') + '.';
    else s += ': ' + c.states.map((st, k) => '(' + Mx.SYMBOLS[k] + ') ' + st).join('; ') + '.';
    const tags = [TYPE[c.type]];
    if ((c.weight == null ? 1 : c.weight) !== 1) tags.push((es ? 'peso ' : 'weight ') + c.weight);
    if (c.active === false) tags.push(es ? 'inactivo' : 'inactive');
    if (c.depends) {
      const ctl = m.chars[c.depends.on];
      tags.push((es ? 'aplicable sólo si ' : 'applicable only if ') + (c.depends.on + base) + ' = ' + c.depends.states.map(k => (ctl && ctl.states[k] ? ctl.states[k] : Mx.SYMBOLS[k])).join(es ? ' o ' : ' or '));
    }
    return { n, text: s, tags, note: c.note || '' };
  });
};
IO.characterListText = function (m, lang, opts) {
  return IO.characterList(m, lang, opts).map(r => r.text + ' [' + r.tags.join('; ') + ']' + (r.note ? ' ' + r.note : '')).join('\n') + '\n';
};

/* the native project file: the matrix as it is, with trees and images */
IO.writeProject = function (m, extra) {
  return JSON.stringify(Object.assign({ app: 'CladisticsPro', version: 1, saved: new Date().toISOString(), matrix: m }, extra || {}), null, 1);
};
IO.readProject = function (text) {
  const o = JSON.parse(text);
  if (!o || o.app !== 'CladisticsPro' || !o.matrix) throw new Error('no es un proyecto de CladisticsPro');
  const m = Mx.normalize(o.matrix);
  const errs = Mx.validate(m);
  if (errs.length) throw new Error(errs.join('; '));
  return { matrix: m, trees: o.trees || [], images: o.images || null, notes: [] };
};

g.MatIO = IO;
return IO;
}
if (typeof window !== 'undefined') MatIOCore(window);
