/* CladisticsPro — morphological cladistics in the browser.
   Copyright (C) 2026  Luis Ángel Barrera-Guzmán

   This program is free software: you can redistribute it and/or modify it under
   the terms of the GNU General Public License as published by the Free Software
   Foundation, either version 3 of the License, or (at your option) any later
   version. It is distributed in the hope that it will be useful, but WITHOUT ANY
   WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
   A PARTICULAR PURPOSE. See the GNU General Public License, in the file LICENSE
   at the root of this program, or <https://www.gnu.org/licenses/>. */

/* CladisticsPro — the matrix grid: a spreadsheet of taxa × characters.

   Only what is on screen is drawn: the grid keeps a sizer as large as the whole
   matrix and, on every scroll, writes the visible cells (plus a margin) into
   it. The header of characters and the column of taxa stay in place with
   position: sticky. A 300 × 120 matrix scrolls as lightly as a 12 × 8 one.

   Keyboard (the grid has the focus):
     arrows, Home/End, Ctrl+Home/End, PageUp/PageDown move; with Shift they
     extend the selection;
     0–9, A–T set the state; ? missing; - inapplicable; Delete «?»;
     Ctrl + a digit adds or removes that state (a polymorphism);
     Enter or F2 opens the cell for free text: {01}, (012), 2.5-3.1;
     Ctrl+C / Ctrl+V copy and paste as tab-separated text (a spreadsheet's);
     Ctrl+Z / Ctrl+Y undo and redo (handled by the editor that owns the grid).
   Every edit is an operation handed to `opts.onEdit`, which applies it with
   undo; the grid itself never writes into the matrix. */
(function () {
  const Mx = window.Mx;
  const f1 = v => (+v).toFixed(1);
  const ESC = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function create(host, opts) {
    const G = { opts, sel: null, sizes: null, hover: null, editing: null };
    host.innerHTML = '';
    host.classList.add('mx-host');
    const wrap = mk('div', { class: 'mx-wrap', tabindex: '0', role: 'grid' });
    const sizer = mk('div', { class: 'mx-sizer' });
    const head = mk('div', { class: 'mx-head' });
    const corner = mk('div', { class: 'mx-corner' });
    const headCells = mk('div', { class: 'mx-hcells' });
    const names = mk('div', { class: 'mx-names' });
    const body = mk('div', { class: 'mx-body' });
    const selBox = mk('div', { class: 'mx-selbox', hidden: '' });
    const focusBox = mk('div', { class: 'mx-focus', hidden: '' });
    head.appendChild(corner); head.appendChild(headCells);
    sizer.appendChild(head); sizer.appendChild(names); sizer.appendChild(body); sizer.appendChild(selBox); sizer.appendChild(focusBox);
    wrap.appendChild(sizer);
    const status = mk('div', { class: 'mx-status', 'aria-hidden': 'true' });
    const live = mk('div', { class: 'sr-only', 'aria-live': 'polite' });
    host.appendChild(wrap); host.appendChild(status); host.appendChild(live);
    G.wrap = wrap;

    const M = () => opts.getMatrix();
    /* ---------------- geometry ---------------- */
    function measure() {
      const m = M();
      const z = G.zoom || 1;
      const rowH = Math.round(24 * z), headH = Math.round(42 * z);
      const cw = Math.round(26 * z), contW = Math.round(78 * z);
      const longest = Math.max(6, ...m.taxa.map(t => t.name.length));
      /* on a narrow screen the names may not take more than 42 % of the grid */
      const nameW = Math.max(96, Math.min(280, Math.round(longest * 7.2 * z) + 34, Math.round((wrap.clientWidth || 800) * 0.42)));
      const colX = [0];
      m.chars.forEach((c, j) => colX.push(colX[j] + (Mx.isCont(c) ? contW : cw)));
      G.sizes = { rowH, headH, cw, contW, nameW, colX, W: nameW + colX[m.chars.length] + 2, H: headH + m.taxa.length * rowH + 2 };
      sizer.style.width = G.sizes.W + 'px';
      sizer.style.height = G.sizes.H + 'px';
      /* no taller than the matrix itself (plus room for a horizontal scroll bar) */
      wrap.style.height = Math.max(200, Math.min(Math.round(window.innerHeight * 0.62), 640, G.sizes.H + 18)) + 'px';
      head.style.height = headH + 'px';
      corner.style.width = nameW + 'px';
      names.style.width = nameW + 'px';
      names.style.height = (G.sizes.H - headH) + 'px';
      wrap.style.setProperty('--mx-row', rowH + 'px');
      wrap.style.setProperty('--mx-fs', Math.round(13 * z) + 'px');
      wrap.setAttribute('aria-rowcount', m.taxa.length + 1);
      wrap.setAttribute('aria-colcount', m.chars.length + 1);
    }
    function colAt(x) {
      const X = G.sizes.colX;
      let lo = 0, hi = X.length - 2;
      if (x < 0) return 0;
      while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (X[mid] <= x) lo = mid; else hi = mid - 1; }
      return lo;
    }
    /* ---------------- drawing ---------------- */
    function cellHTML(m, i, j) {
      const c = m.cells[i][j], ch = m.chars[j], S = G.sizes;
      const x = S.nameW + S.colX[j], y = S.headH + i * S.rowH, w = S.colX[j + 1] - S.colX[j];
      let cls = 'mx-c', txt = '';
      if (c === Mx.MISSING) { cls += ' q'; txt = '?'; }
      else if (c === Mx.GAP) { cls += ' g'; txt = '–'; }
      else if (Array.isArray(c)) { cls += ' n'; txt = shortRange(c); }
      else {
        const b = Mx.bits(c & Mx.MASK);
        if (b.length === 1) { cls += ' s s' + (b[0] % 8); txt = Mx.SYMBOLS[b[0]]; }
        else { cls += ' p'; txt = b.map(s => Mx.SYMBOLS[s]).join(''); if (c & Mx.UNC) cls += ' u'; }
      }
      if (ch.active === false || m.taxa[i].active === false) cls += ' off';
      if (G.showNames && !Array.isArray(c) && typeof c === 'number' && c > 0) {
        const b = Mx.bits(c & Mx.MASK);
        if (b.length === 1 && ch.states[b[0]]) { txt = ch.states[b[0]].slice(0, 3); cls += ' nm'; }
      }
      return `<div class="${cls}" role="gridcell" aria-rowindex="${i + 2}" aria-colindex="${j + 2}" data-i="${i}" data-j="${j}" style="left:${x}px;top:${y}px;width:${w}px">${ESC(txt)}</div>`;
    }
    function shortRange(c) {
      const r = v => (Math.abs(v) >= 100 ? Math.round(v) : +v.toPrecision(3));
      return c[0] === c[1] ? String(r(c[0])) : r(c[0]) + '–' + r(c[1]);
    }
    function draw() {
      const m = M();
      if (!m) return;
      const S = G.sizes;
      const sx = wrap.scrollLeft, sy = wrap.scrollTop, vw = wrap.clientWidth, vh = wrap.clientHeight;
      const r0 = Math.max(0, Math.floor((sy) / S.rowH) - 4), r1 = Math.min(m.taxa.length - 1, Math.ceil((sy + vh) / S.rowH) + 4);
      const c0 = Math.max(0, colAt(sx - 60) - 2), c1 = Math.min(m.chars.length - 1, colAt(sx + vw) + 3);
      let h = '';
      for (let i = r0; i <= r1; i++) for (let j = c0; j <= c1; j++) h += cellHTML(m, i, j);
      body.innerHTML = h;
      let hc = '';
      for (let j = c0; j <= c1; j++) {
        const ch = m.chars[j];
        const x = S.colX[j], w = S.colX[j + 1] - S.colX[j];
        const badge = ch.type === 'ord' ? '≤' : ch.type === 'step' ? '▦' : ch.type === 'cont' ? '∼' : '';
        const cls = 'mx-hc' + (ch.active === false ? ' off' : '') + (ch.depends ? ' dep' : '') + (G.sel && j >= Math.min(G.sel.c0, G.sel.c1) && j <= Math.max(G.sel.c0, G.sel.c1) ? ' on' : '');
        hc += `<div class="${cls}" role="columnheader" aria-colindex="${j + 2}" data-j="${j}" style="left:${x}px;width:${w}px" title="${ESC((j + 1) + '. ' + (ch.name || ''))}"><span class="mx-hn">${j + 1}</span><span class="mx-hb">${badge}${ch.depends ? '↳' : ''}${(ch.weight == null ? 1 : ch.weight) !== 1 ? '×' + ch.weight : ''}</span></div>`;
      }
      headCells.innerHTML = hc;
      headCells.style.left = S.nameW + 'px';
      let nm = '';
      for (let i = r0; i <= r1; i++) {
        const t = m.taxa[i];
        const cls = 'mx-rn' + (t.active === false ? ' off' : '') + (t.outgroup ? ' og' : '') + (G.sel && i >= Math.min(G.sel.r0, G.sel.r1) && i <= Math.max(G.sel.r0, G.sel.r1) ? ' on' : '');
        nm += `<div class="${cls}" role="rowheader" aria-rowindex="${i + 2}" data-i="${i}" style="top:${i * S.rowH}px" title="${ESC(t.name)}"><span class="mx-ri">${i + 1}</span><span class="mx-rt">${ESC(t.name)}</span>${t.outgroup ? `<span class="mx-og">${T('GE', 'OG')}</span>` : ''}</div>`;
      }
      names.innerHTML = nm;
      drawSel();
    }
    function drawSel() {
      const S = G.sizes, s = G.sel;
      if (!s) { selBox.hidden = true; focusBox.hidden = true; return; }
      const ra = Math.min(s.r0, s.r1), rb = Math.max(s.r0, s.r1), ca = Math.min(s.c0, s.c1), cb = Math.max(s.c0, s.c1);
      selBox.hidden = ra === rb && ca === cb;
      Object.assign(selBox.style, { left: (S.nameW + S.colX[ca]) + 'px', top: (S.headH + ra * S.rowH) + 'px', width: (S.colX[cb + 1] - S.colX[ca]) + 'px', height: ((rb - ra + 1) * S.rowH) + 'px' });
      focusBox.hidden = false;
      Object.assign(focusBox.style, { left: (S.nameW + S.colX[s.c1]) + 'px', top: (S.headH + s.r1 * S.rowH) + 'px', width: (S.colX[s.c1 + 1] - S.colX[s.c1]) + 'px', height: S.rowH + 'px' });
    }
    let raf = 0;
    const schedule = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; draw(); }); };
    wrap.addEventListener('scroll', schedule, { passive: true });

    /* ---------------- selection ---------------- */
    function clampSel(s) {
      const m = M();
      const n = m.taxa.length - 1, k = m.chars.length - 1;
      ['r0', 'r1'].forEach(p => { s[p] = Math.max(0, Math.min(n, s[p])); });
      ['c0', 'c1'].forEach(p => { s[p] = Math.max(0, Math.min(k, s[p])); });
      return s;
    }
    function setSel(s, scroll) {
      const m = M();
      if (!m || !m.taxa.length || !m.chars.length) { G.sel = null; drawSel(); return; }
      G.sel = clampSel(s);
      if (scroll !== false) scrollToCell(G.sel.r1, G.sel.c1);
      draw();
      describe();
      if (opts.onSelect) opts.onSelect(G.sel);
    }
    function scrollToCell(i, j) {
      const S = G.sizes;
      const x = S.colX[j], w = S.colX[j + 1] - x, y = i * S.rowH;
      const vw = wrap.clientWidth - S.nameW, vh = wrap.clientHeight - S.headH;
      if (x < wrap.scrollLeft) wrap.scrollLeft = x;
      else if (x + w > wrap.scrollLeft + vw) wrap.scrollLeft = x + w - vw;
      if (y < wrap.scrollTop) wrap.scrollTop = y;
      else if (y + S.rowH > wrap.scrollTop + vh) wrap.scrollTop = y + S.rowH - vh;
    }
    function cellInfo(i, j) {
      const m = M(), t = m.taxa[i], ch = m.chars[j], c = m.cells[i][j];
      let val;
      if (c === Mx.MISSING) val = T('? desconocido', '? unknown');
      else if (c === Mx.GAP) val = T('– inaplicable', '– inapplicable');
      else if (Array.isArray(c)) val = Mx.cellText(c, ch) + (ch.unit ? ' ' + ch.unit : '');
      else {
        const b = Mx.bits(c & Mx.MASK);
        val = b.map(s => Mx.SYMBOLS[s] + ' ' + (ch.states[s] || T('(sin nombre)', '(unnamed)'))).join(b.length > 1 ? ((c & Mx.UNC) ? T(' o ', ' or ') : ' + ') : '');
        if (b.length > 1) val = ((c & Mx.UNC) ? T('incierto: ', 'uncertain: ') : T('polimórfico: ', 'polymorphic: ')) + val;
      }
      return { taxon: t.name, char: (j + 1) + '. ' + (ch.name || T('sin enunciado', 'no statement')), val };
    }
    function describe() {
      if (!G.sel) { status.textContent = ''; return; }
      const s = G.sel;
      const inf = cellInfo(s.r1, s.c1);
      const n = (Math.abs(s.r1 - s.r0) + 1) * (Math.abs(s.c1 - s.c0) + 1);
      status.innerHTML = `<b>${ESC(inf.taxon)}</b> · ${ESC(inf.char)} · <span class="mx-val">${ESC(inf.val)}</span>` + (n > 1 ? ` · ${T(n + ' celdas seleccionadas', n + ' cells selected')}` : '');
      live.textContent = inf.taxon + ', ' + inf.char + ': ' + inf.val;
    }
    G.select = (i, j, extend) => {
      if (extend && G.sel) setSel({ r0: G.sel.r0, c0: G.sel.c0, r1: i, c1: j });
      else setSel({ r0: i, c0: j, r1: i, c1: j });
    };
    G.selectChars = (a, b) => { const n = M().taxa.length; setSel({ r0: 0, r1: n - 1, c0: a, c1: b == null ? a : b }, false); scrollToCell(G.sel ? G.sel.r1 : 0, b == null ? a : b); };
    G.selectTaxa = (a, b) => { const k = M().chars.length; setSel({ c0: 0, c1: k - 1, r0: a, r1: b == null ? a : b }, false); scrollToCell(b == null ? a : b, 0); };
    G.range = () => {
      const s = G.sel; if (!s) return null;
      return { ra: Math.min(s.r0, s.r1), rb: Math.max(s.r0, s.r1), ca: Math.min(s.c0, s.c1), cb: Math.max(s.c0, s.c1), i: s.r1, j: s.c1 };
    };
    /* whole columns or whole rows are selected */
    G.wholeCols = () => { const r = G.range(); return r && r.ra === 0 && r.rb === M().taxa.length - 1; };
    G.wholeRows = () => { const r = G.range(); return r && r.ca === 0 && r.cb === M().chars.length - 1; };

    /* ---------------- edits ---------------- */
    function editRange(fn) {
      const r = G.range(); if (!r) return;
      const m = M(), list = [];
      for (let i = r.ra; i <= r.rb; i++) for (let j = r.ca; j <= r.cb; j++) {
        const v = fn(m.cells[i][j], m.chars[j], i, j);
        if (v !== undefined && JSON.stringify(v) !== JSON.stringify(m.cells[i][j])) list.push([i, j, v]);
      }
      if (list.length) opts.onEdit({ kind: 'cells', list }, T('Editar celdas', 'Edit cells'));
    }
    function setState(sym) {
      const k = Mx.SYMBOLS.indexOf(sym.toUpperCase());
      if (k < 0) return;
      let skipped = 0;
      editRange((c, ch) => { if (Mx.isCont(ch)) { skipped++; return undefined; } return 1 << k; });
      if (skipped && window.LABG) LABG.toast(T('Las columnas continuas no reciben estados: escribe un valor con Intro.', 'Continuous columns take no states: type a value with Enter.'));
    }
    function toggleState(sym) {
      const k = Mx.SYMBOLS.indexOf(sym.toUpperCase());
      if (k < 0) return;
      editRange((c, ch) => {
        if (Mx.isCont(ch)) return undefined;
        const base = typeof c === 'number' && c > 0 ? c : 0;
        let mask = (base & Mx.MASK) ^ (1 << k);
        if (!mask) return Mx.MISSING;
        return mask | (base & Mx.UNC && Mx.popcount(mask) > 1 ? Mx.UNC : 0);
      });
    }
    function openEditor() {
      const r = G.range(); if (!r) return;
      const m = M(), S = G.sizes, i = r.i, j = r.j;
      const inp = mk('input', { type: 'text', class: 'mx-edit', 'aria-label': T('Valor de la celda', 'Cell value'), autocomplete: 'off', spellcheck: 'false' });
      inp.value = Mx.cellText(m.cells[i][j], m.chars[j]);
      Object.assign(inp.style, { left: (S.nameW + S.colX[j]) + 'px', top: (S.headH + i * S.rowH) + 'px', minWidth: Math.max(90, S.colX[j + 1] - S.colX[j]) + 'px', height: S.rowH + 'px' });
      sizer.appendChild(inp);
      G.editing = inp;
      inp.focus(); inp.select();
      const done = commit => {
        if (G.editing !== inp) return;
        G.editing = null;
        if (commit) {
          try {
            const v = Mx.parseCell(inp.value, m.chars[j]);
            editRange((c, ch) => (Mx.isCont(ch) === Mx.isCont(m.chars[j]) ? v : undefined));
          } catch (e) { if (window.LABG) LABG.toast(T('No se pudo leer: ', 'Could not read: ') + e.message); }
        }
        inp.remove();
        wrap.focus();
      };
      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); done(true); move(1, 0); }
        else if (e.key === 'Escape') { e.preventDefault(); done(false); }
        else if (e.key === 'Tab') { e.preventDefault(); done(true); move(0, e.shiftKey ? -1 : 1); }
        e.stopPropagation();
      });
      inp.addEventListener('blur', () => done(true));
    }
    function move(di, dj, extend) {
      const s = G.sel || { r0: 0, c0: 0, r1: 0, c1: 0 };
      const ni = s.r1 + di, nj = s.c1 + dj;
      if (extend) setSel({ r0: s.r0, c0: s.c0, r1: ni, c1: nj });
      else setSel({ r0: ni, c0: nj, r1: ni, c1: nj });
    }
    /* clipboard: tab-separated, one line per taxon */
    function copyText() {
      const r = G.range(); if (!r) return '';
      const m = M(), lines = [];
      for (let i = r.ra; i <= r.rb; i++) {
        const row = [];
        for (let j = r.ca; j <= r.cb; j++) row.push(Mx.sheetText(m.cells[i][j], m.chars[j]));
        lines.push(row.join('\t'));
      }
      return lines.join('\n');
    }
    function pasteText(text) {
      const r = G.range(); if (!r) return;
      const m = M();
      const rows = String(text).replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n').map(l => l.split('\t'));
      /* a single row without tabs that is a run of symbols: one cell per symbol */
      if (rows.length === 1 && rows[0].length === 1 && /^[0-9A-T?\-]{2,}$/i.test(rows[0][0].trim())) rows[0] = rows[0][0].trim().split('');
      const list = [];
      let bad = 0;
      const one = rows.length === 1 && rows[0].length === 1;
      const ri = one ? r.rb - r.ra + 1 : rows.length, rj = one ? r.cb - r.ca + 1 : Math.max(...rows.map(x => x.length));
      for (let a = 0; a < ri; a++) for (let b = 0; b < rj; b++) {
        const i = r.ra + a, j = r.ca + b;
        if (i >= m.taxa.length || j >= m.chars.length) continue;
        const raw = one ? rows[0][0] : rows[a] ? rows[a][b] : undefined;
        if (raw === undefined) continue;
        try { list.push([i, j, Mx.parseCell(raw, m.chars[j])]); } catch (e) { bad++; }
      }
      if (list.length) opts.onEdit({ kind: 'cells', list }, T('Pegar', 'Paste'));
      if (bad && window.LABG) LABG.toast(T(bad + ' celdas no se pudieron leer y se dejaron como estaban.', bad + ' cells could not be read and were left as they were.'));
    }

    /* ---------------- events ---------------- */
    let drag = null;
    sizer.addEventListener('mousedown', e => {
      if (e.button !== 0 || e.target === G.editing) return;
      const cell = e.target.closest('.mx-c'), hc = e.target.closest('.mx-hc'), rn = e.target.closest('.mx-rn');
      if (cell) {
        const i = +cell.dataset.i, j = +cell.dataset.j;
        G.select(i, j, e.shiftKey);
        drag = 'cells';
      } else if (hc) {
        const j = +hc.dataset.j;
        if (e.shiftKey && G.sel) G.selectChars(Math.min(G.sel.c0, G.sel.c1), j); else G.selectChars(j);
        drag = 'cols';
      } else if (rn) {
        const i = +rn.dataset.i;
        if (e.shiftKey && G.sel) G.selectTaxa(Math.min(G.sel.r0, G.sel.r1), i); else G.selectTaxa(i);
        drag = 'rows';
      } else return;
      wrap.focus({ preventScroll: true });
      e.preventDefault();
    });
    sizer.addEventListener('mouseover', e => {
      const cell = e.target.closest('.mx-c');
      if (drag && e.buttons === 1) {
        if (drag === 'cells' && cell) setSel({ r0: G.sel.r0, c0: G.sel.c0, r1: +cell.dataset.i, c1: +cell.dataset.j }, false);
        const hc = e.target.closest('.mx-hc');
        if (drag === 'cols' && hc) setSel({ r0: G.sel.r0, c0: G.sel.c0, r1: G.sel.r1, c1: +hc.dataset.j }, false);
        const rn = e.target.closest('.mx-rn');
        if (drag === 'rows' && rn) setSel({ r0: G.sel.r0, c0: G.sel.c0, r1: +rn.dataset.i, c1: G.sel.c1 }, false);
      }
      if (cell && !drag) {
        const inf = cellInfo(+cell.dataset.i, +cell.dataset.j);
        cell.title = inf.taxon + '\n' + inf.char + '\n' + inf.val;
      }
    });
    window.addEventListener('mouseup', () => { drag = null; });
    sizer.addEventListener('dblclick', e => { if (e.target.closest('.mx-c')) openEditor(); });
    wrap.addEventListener('keydown', e => {
      if (G.editing) return;
      const m = M(); if (!m) return;
      const k = e.key, ctrl = e.ctrlKey || e.metaKey;
      const page = Math.max(1, Math.floor((wrap.clientHeight - G.sizes.headH) / G.sizes.rowH) - 1);
      if (k === 'ArrowDown') { move(1, 0, e.shiftKey); e.preventDefault(); }
      else if (k === 'ArrowUp') { move(-1, 0, e.shiftKey); e.preventDefault(); }
      else if (k === 'ArrowRight') { move(0, 1, e.shiftKey); e.preventDefault(); }
      else if (k === 'ArrowLeft') { move(0, -1, e.shiftKey); e.preventDefault(); }
      else if (k === 'PageDown') { move(page, 0, e.shiftKey); e.preventDefault(); }
      else if (k === 'PageUp') { move(-page, 0, e.shiftKey); e.preventDefault(); }
      else if (k === 'Home') { const s = G.sel || { r1: 0, c1: 0 }; ctrl ? G.select(0, 0, e.shiftKey) : G.select(s.r1, 0, e.shiftKey); e.preventDefault(); }
      else if (k === 'End') { const s = G.sel || { r1: 0, c1: 0 }; ctrl ? G.select(m.taxa.length - 1, m.chars.length - 1, e.shiftKey) : G.select(s.r1, m.chars.length - 1, e.shiftKey); e.preventDefault(); }
      else if (k === 'Enter' || k === 'F2') { openEditor(); e.preventDefault(); }
      else if (k === 'Delete' || k === 'Backspace') { editRange(() => Mx.MISSING); e.preventDefault(); }
      else if (!ctrl && k === '?') { editRange(() => Mx.MISSING); e.preventDefault(); }
      else if (!ctrl && (k === '-' || k === '–')) { editRange(() => Mx.GAP); e.preventDefault(); }
      else if (ctrl && /^[0-9]$/.test(k)) { toggleState(k); e.preventDefault(); }
      else if (!ctrl && !e.altKey && /^[0-9a-tA-T]$/.test(k)) { setState(k); e.preventDefault(); }
      else if (ctrl && (k === 'c' || k === 'C' || k === 'x' || k === 'X')) {
        const txt = copyText();
        if (navigator.clipboard) navigator.clipboard.writeText(txt).catch(() => {});
        G.clip = txt;
        if (k.toLowerCase() === 'x') editRange(() => Mx.MISSING);
        e.preventDefault();
      } else if (ctrl && (k === 'v' || k === 'V')) {
        /* the paste event brings the text; this is the fallback inside the app */
        if (!navigator.clipboard || !navigator.clipboard.readText) { if (G.clip != null) pasteText(G.clip); e.preventDefault(); }
      } else if (ctrl && (k === 'a' || k === 'A')) { setSel({ r0: 0, c0: 0, r1: m.taxa.length - 1, c1: m.chars.length - 1 }, false); e.preventDefault(); }
    });
    wrap.addEventListener('paste', e => {
      if (G.editing) return;
      const txt = e.clipboardData && e.clipboardData.getData('text/plain');
      if (txt != null) { pasteText(txt); e.preventDefault(); }
    });
    wrap.addEventListener('focus', () => { if (!G.sel && M() && M().taxa.length && M().chars.length) setSel({ r0: 0, c0: 0, r1: 0, c1: 0 }, false); });

    /* ---------------- API ---------------- */
    G.refresh = () => { if (!M()) { body.innerHTML = headCells.innerHTML = names.innerHTML = ''; return; } measure(); if (G.sel) clampSel(G.sel); draw(); describe(); };
    G.setZoom = z => { G.zoom = z; G.refresh(); };
    G.setShowNames = v => { G.showNames = v; draw(); };
    G.paste = pasteText;
    G.copy = copyText;
    G.setLabel = s => wrap.setAttribute('aria-label', s);
    G.setLabel(T('Matriz de caracteres: flechas para moverse, un número para escribir el estado, Intro para editar', 'Character matrix: arrows to move, a digit to set the state, Enter to edit'));
    corner.innerHTML = `<span>${T('Taxón', 'Taxon')}</span><span>${T('Carácter', 'Character')} →</span>`;
    document.addEventListener('langchange', () => {
      corner.innerHTML = `<span>${T('Taxón', 'Taxon')}</span><span>${T('Carácter', 'Character')} →</span>`;
      G.setLabel(T('Matriz de caracteres: flechas para moverse, un número para escribir el estado, Intro para editar', 'Character matrix: arrows to move, a digit to set the state, Enter to edit'));
      draw(); describe();
    });
    if (window.ResizeObserver) new ResizeObserver(schedule).observe(wrap);
    G.refresh();
    return G;
  }

  window.MatrixGrid = { create };
})();
