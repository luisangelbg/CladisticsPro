/* CladisticsPro — morphological cladistics in the browser.
   Copyright (C) 2026  Luis Ángel Barrera-Guzmán

   This program is free software: you can redistribute it and/or modify it under
   the terms of the GNU General Public License as published by the Free Software
   Foundation, either version 3 of the License, or (at your option) any later
   version. It is distributed in the hope that it will be useful, but WITHOUT ANY
   WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
   A PARTICULAR PURPOSE. See the GNU General Public License, in the file LICENSE
   at the root of this program, or <https://www.gnu.org/licenses/>. */

/* CladisticsPro — Block 5: the cladogram and the mapping of characters.

   A tree from the search (Block 3), the weighting (Block 4), the matrix file
   or pasted by hand, with every change drawn on its branch (mapping.js), or
   painted by one character. The tree can be edited with the mouse — move a
   clade, collapse, root, rotate — and its length, CI and RI follow at once.

   state.clado = { src, idx, list, base, root, undo, opts, M, map, baseLength,
   fingerprint } is what Block 6 reads. */
(function () {
  const B5 = {};
  window.Block5 = B5;
  const $ = el;
  let mode = 'marks', sel = null, moving = false, paintChar = 0;

  /* ---------------- where the trees come from ---------------- */
  const activeNames = () => state.matrix.taxa.filter(t => t.active !== false).map(t => t.name);
  function outgroupIdx() { const a = Mx.toAnalysis(state.matrix); return a.outgroup.length ? a.outgroup : [0]; }
  const hasGaps = () => state.matrix.cells.some(r => r.some(c => c === Mx.GAP));
  const hasCont = () => state.matrix.chars.some(c => c.type === 'cont' && c.active !== false);

  /* a Newick read against the active taxa: taxa not active leave the tree */
  function readTree(newick, label) {
    const names = activeNames();
    let root = Tree.parseNewick(newick);
    const known = new Set(names.map(Tree.normName));
    const drop = Tree.tips(root).filter(v => !known.has(Tree.normName(v.name)));
    drop.forEach(v => { const p = v.parent; if (p) p.children.splice(p.children.indexOf(v), 1); });
    /* internal nodes left empty go too, then single-child nodes */
    for (let again = true; again;) {
      again = false;
      Tree.postorder(root).forEach(v => { if (v !== root && v.tip < 0 && !v.children.length && v.name === '') { const p = v.parent; p.children.splice(p.children.indexOf(v), 1); again = true; } });
    }
    root = Tree.cleanUnary(root);
    Tree.attachTaxa(root, names);
    root = Tree.ladderize(Tree.rootOn(root, outgroupIdx()).root);
    return { root, label, dropped: drop.length, missing: names.length - Tree.tips(root).length };
  }
  function sources() {
    const out = [];
    const s = state.search;
    if (s && s.trees && s.trees.length) {
      const n = s.trees.length;
      out.push({ id: 'search', label: T(`Búsqueda (Bloque 3) · ${plural(n, 'árbol más corto', 'árboles más cortos')}`, `Search (Block 3) · ${n} shortest tree${n === 1 ? '' : 's'}`), prep: s.prep,
        list: () => s.trees.map((t, i) => ({ root: t.root, label: T('Árbol ', 'Tree ') + (i + 1) + ' · L ' + fmtNum(t.length, 3) })) });
      if (s.collapse && s.condensed && s.condensed.length) out.push({ id: 'collapsed', label: T(`Búsqueda, colapsados por la regla 1 · ${s.condensed.length}`, `Search, collapsed by rule 1 · ${s.condensed.length}`), prep: s.prep,
        list: () => s.condensed.map((r, i) => ({ root: r, label: T('Colapsado ', 'Collapsed ') + (i + 1) })) });
      if (s.strict) out.push({ id: 'strict', label: T('Búsqueda, consenso estricto', 'Search, strict consensus'), prep: s.prep, list: () => [{ root: s.strict, label: T('Consenso estricto', 'Strict consensus') }] });
    }
    const w = state.weights;
    if (w && w.result && w.result.trees && w.result.trees.length) {
      const nm = { iw: T('pesos implícitos', 'implied weights'), eiw: T('implícitos extendidos', 'extended implied'), sw: T('pesos sucesivos', 'successive weighting') }[w.scheme] || '';
      const n = w.result.trees.length;
      out.push({ id: 'weights', label: T(`Pesos (Bloque 4, ${nm}) · ${plural(n, 'árbol', 'árboles')}`, `Weighting (Block 4, ${nm}) · ${n} tree${n === 1 ? '' : 's'}`), prep: Object.assign({}, w.result.prep, w.scheme === 'sw' ? { weights: w.result.weights } : {}),
        list: () => w.result.trees.map((t, i) => ({ root: t.root, label: T('Árbol ', 'Tree ') + (i + 1) })) });
    }
    if (state.matrixTrees && state.matrixTrees.length) {
      const n = state.matrixTrees.length;
      out.push({ id: 'file', label: T(`Del archivo de la matriz · ${plural(n, 'árbol', 'árboles')}`, `From the matrix file · ${n} tree${n === 1 ? '' : 's'}`),
        list: () => state.matrixTrees.map((t, i) => { try { return readTree(t.newick, t.name || T('Árbol ', 'Tree ') + (i + 1)); } catch (e) { return null; } }).filter(Boolean) });
    }
    if (B5.pasted) out.push({ id: 'pasted', label: T('El árbol pegado', 'The pasted tree'), list: () => [B5.pasted] });
    return out;
  }

  /* ---------------- the working tree ---------------- */
  B5.ensure = function () {
    if (!state.matrix) return null;
    const C = state.clado;
    if (C && C.fingerprint === Mx.fingerprint(state.matrix) && sources().some(s => s.id === C.src)) return C;
    const srcs = sources();
    if (!srcs.length) { state.clado = null; return null; }
    return B5.setSource(srcs[0].id, 0);
  };
  B5.setSource = function (srcId, idx, keepOpts) {
    const srcs = sources();
    const s = srcs.find(x => x.id === srcId) || srcs[0];
    if (!s) return null;
    const list = s.list();
    if (!list.length) return null;
    idx = Math.max(0, Math.min(list.length - 1, idx || 0));
    const old = state.clado;
    const opts = keepOpts && old ? Object.assign({}, old.opts) : {
      optimization: (old && old.opts.optimization) || 'acctran',
      inapplicable: s.prep && s.prep.inapplicable ? s.prep.inapplicable : (hasGaps() ? 'algorithm' : 'missing'),
      continuous: s.prep && s.prep.continuous ? s.prep.continuous : 'scaled',
    };
    const base = Tree.clone(list[idx].root);
    const weights = s.prep && s.prep.weights;
    state.clado = { src: s.id, idx, list, base, root: Tree.clone(base), undo: [], opts, weights, fingerprint: Mx.fingerprint(state.matrix) };
    /* another tree of the same source, read the same way: the characters are already prepared */
    if (old && old.M && old.src === s.id && old.fingerprint === state.clado.fingerprint && old.opts.inapplicable === opts.inapplicable && old.opts.continuous === opts.continuous && old.weights === weights) { state.clado.M = old.M; remap(); }
    else prepare();
    state.clado.baseLength = state.clado.map.length;
    sel = null; moving = false;
    enableStep(5, true);
    refreshStepMarks();
    document.dispatchEvent(new CustomEvent('cladochange'));
    return state.clado;
  };
  function prepare() {
    const C = state.clado;
    C.M = Mapping.prepare(state.matrix, { inapplicable: C.opts.inapplicable, continuous: C.opts.continuous, weights: C.weights });
    remap();
  }
  function remap() {
    const C = state.clado;
    C.map = Mapping.map(C.M, C.root, { optimization: C.opts.optimization });
  }
  B5.remap = remap;
  function edit(fn) {
    const C = state.clado;
    C.undo.push({ root: Tree.clone(C.root) });
    if (C.undo.length > 100) C.undo.shift();
    C.root = fn(C.root) || C.root;
    remap();
    document.dispatchEvent(new CustomEvent('cladochange'));
    paint();
  }

  /* ---------------- labels ---------------- */
  const sym = s => Mx.SYMBOLS[s] || String(s);
  function stateName(c, s) {
    const ch = state.clado.M.chars[c];
    const nm = ch.states && ch.states[s];
    return nm && nm !== sym(s) ? nm : sym(s);
  }
  B5.stateName = stateName;
  B5.sym = sym;
  function nodeLabel(v) {
    if (!v.children.length) return v.name;
    const tips = Tree.tips(v);
    return T(`clado de ${tips.length} taxones (${tips[0].name} … ${tips[tips.length - 1].name})`, `clade of ${tips.length} taxa (${tips[0].name} … ${tips[tips.length - 1].name})`);
  }
  B5.nodeLabel = nodeLabel;
  function fmtVal(ch, x) { return fmtNum(x, 3) + (ch.unit ? ' ' + ch.unit : ''); }
  /* one change, in words */
  function changeText(chg) {
    const ch = state.clado.M.chars[chg.c];
    if (ch.kind === 'cont') return `${fmtVal(ch, chg.from)} → ${fmtVal(ch, chg.to)}`;
    return `${sym(chg.from)} ${esc(stateName(chg.c, chg.from) !== sym(chg.from) ? '(' + stateName(chg.c, chg.from) + ')' : '')} → ${sym(chg.to)} ${esc(stateName(chg.c, chg.to) !== sym(chg.to) ? '(' + stateName(chg.c, chg.to) + ')' : '')}`.replace(/\s+/g, ' ');
  }
  B5.changeText = changeText;

  /* ---------------- drawing ---------------- */
  function marksMap() {
    const C = state.clado, show = $('b5Show').value;
    const out = new Map();
    if (show === 'none') return out;
    C.map.byNode.forEach((list, v) => {
      const ok = list.filter(chg => chg.kind !== 'cont' && (show !== 'inf' || C.map.per[chg.c].informative) && (show !== 'unique' || !chg.homoplastic));
      if (ok.length) out.set(v, ok.slice().sort((a, b) => a.j - b.j));
    });
    return out;
  }
  function figure() {
    const C = state.clado, opt = C.opts.optimization;
    const base = { names: v => v.name, clickable: true, id: 'b5', selected: sel, rowH: mode === 'marks' && $('b5Show').value !== 'none' ? 32 : 24, fontSize: 12, fitMarks: true, minUnit: 16, markGap: 12.5, ariaLabel: T('Cladograma', 'Cladogram'),
      /* without marks there is nothing for the legend of the marks to explain */
      legend: !(mode === 'marks' && $('b5Show').value === 'none') };
    /* the pictures of the taxa, beside their names */
    if ($('b5Img').checked && window.TaxonImg) Object.assign(base, { tipImg: v => TaxonImg.url(v.name), imgSize: 38, imgShape: 'round' });
    if (mode === 'marks') {
      const nameLabels = $('b5Labels').value === 'name';
      return Clado.render(C.root, Object.assign(base, {
        marks: marksMap(),
        charLabel: c => String(C.M.chars[c].j + 1),
        stateLabel: (c, s) => { if (!nameLabels) return sym(s); const t = stateName(c, s); return t.length > 12 ? t.slice(0, 11) + '…' : t; },
        legendUnique: T('cambio único', 'unique change'), legendHomo: T('homoplásico', 'homoplastic'), legendAmbig: T('ambiguo', 'ambiguous'),
        showAmbig: opt !== 'unambiguous',
      }));
    }
    const p = C.map.per[paintChar];
    if (!p) return '';
    const ch = p.ch;
    const rec = opt === 'deltran' ? p.deltran : p.acctran;
    if (ch.kind === 'cont') {
      if (p.off) return `<p class="hint">${T('Este carácter continuo está fuera del análisis.', 'This continuous character is left out of the analysis.')}</p>`;
      const span = ch.hi > ch.lo ? ch.hi - ch.lo : 1;
      const colorOf = x => `color-mix(in srgb, var(--st1) ${Math.round(Math.max(0, Math.min(1, (x - ch.lo) / span)) * 100)}%, var(--st0))`;
      /* the interval of each node, only where it differs from its ancestor's (and at the root), in three significant figures */
      const sig = x => fmtNum(Number(x.toPrecision(3)), 3);
      const ivText = iv => (iv[0] === iv[1] ? sig(iv[0]) : sig(iv[0]) + '–' + sig(iv[1]));
      const text = new Map();
      Tree.postorder(C.root).forEach(v => {
        if (!v.children.length) return;
        const iv = p.mpr.get(v); if (!iv) return;
        const up = v.parent && p.mpr.get(v.parent);
        if (up && ivText(up) === ivText(iv)) return;
        text.set(v, ivText(iv));
      });
      return Clado.render(C.root, Object.assign(base, {
        paintColor: v => (rec.states.has(v) ? colorOf(rec.states.get(v)) : null), nodeText: text,
        paintLegend: [{ color: 'var(--st0)', label: fmtVal(ch, ch.lo) }, { color: 'color-mix(in srgb, var(--st1) 50%, var(--st0))', label: fmtVal(ch, (ch.lo + ch.hi) / 2) }, { color: 'var(--st1)', label: fmtVal(ch, ch.hi) }],
      }));
    }
    const dashed = new Set();
    if (p.kind === 'inap') p.applicable.forEach((a, v) => { if (!a) dashed.add(v); });
    const sets = new Map();
    p.mpr.forEach((m, v) => { if (v.children.length && m) sets.set(v, m); });
    const used = new Set([...rec.states.values()]);
    const legend = [...used].sort((a, b) => a - b).map(s => ({ color: Clado.stateColor(s), label: sym(s) + (stateName(paintChar, s) !== sym(s) ? ' ' + stateName(paintChar, s) : '') }));
    if (dashed.size) legend.push({ color: 'var(--text-muted)', dashed: true, label: T('no aplica', 'does not apply') });
    return Clado.render(C.root, Object.assign(base, { paint: rec.states, dashed, nodeSets: sets, paintLegend: legend }));
  }

  function paint() {
    const C = state.clado;
    if (!C) return;
    const r = C.map;
    const d = r.length - C.baseLength;
    const n = C.list.length;
    const nMarks = [...r.byNode.values()].reduce((a, l) => a + l.filter(x => x.kind !== 'cont').length, 0);
    statTiles('b5Tiles', [
      [T('Longitud', 'Length'), fmtNum(r.length, 3), C.undo.length ? (Math.abs(d) < 1e-9 ? T('igual que el árbol original', 'same as the original tree') : (d > 0 ? '+' : '−') + fmtNum(Math.abs(d), 3) + T(' frente al original', ' against the original')) : T('pasos (con los pesos de la matriz)', 'steps (with the matrix weights)'), C.undo.length && d > 1e-9 ? 'warn' : C.undo.length && d < -1e-9 ? 'ok' : null],
      ['CI', fmtIdx(r.ci), T('caracteres discretos', 'discrete characters')],
      ['RI', fmtIdx(r.ri), T('caracteres discretos', 'discrete characters')],
      [T('Árbol', 'Tree'), `${C.idx + 1} / ${n}`, C.undo.length ? T(`${plural(C.undo.length, 'edición', 'ediciones')}`, `${C.undo.length} edit${C.undo.length === 1 ? '' : 's'}`) : esc(C.list[C.idx].label)],
      [T('Cambios', 'Changes'), String(nMarks), C.opts.optimization === 'unambiguous' ? T('no ambiguos', 'unambiguous') : C.opts.optimization.toUpperCase()],
    ]);
    $('b5Tree').innerHTML = figure();
    $('b5Tree').classList.toggle('b5-moving', moving);
    /* a tree a little wider than its frame is scaled to fit; a much wider one
       keeps its size and scrolls (its marks would become unreadable) */
    const svg = $('b5Tree').querySelector('svg'), cw = $('b5Tree').clientWidth;
    if (svg && cw) { const w = +svg.getAttribute('width'); if (w > cw && cw / w > 0.75) { svg.style.width = cw + 'px'; svg.style.height = 'auto'; } }
    /* notes under the figure */
    const notes = [];
    if (r.fallback) notes.push(T(`Este árbol tiene politomías y el algoritmo de inaplicables pide árboles dicotómicos: en ${plural(r.fallback, 'carácter', 'caracteres')} con «–» se leyeron como «?».`, `This tree has polytomies and the inapplicable algorithm needs binary trees: in ${r.fallback} character${r.fallback === 1 ? '' : 's'} with «–» they were read as «?».`));
    const extra = r.per.filter(p => p.kind === 'inap' && p.regions > 1).length;
    if (mode === 'marks' && extra) notes.push(T(`Con «–», cada región aplicable después de la primera cuenta un paso sin una rama propia (${plural(extra, 'carácter', 'caracteres')}); el Bloque 6 las lista.`, `With «–», every applicable region after the first counts one step without a branch of its own (${extra} character${extra === 1 ? '' : 's'}); Block 6 lists them.`));
    if (mode === 'marks' && r.per.some(p => p.kind === 'cont' && !p.off)) notes.push(T('Los caracteres continuos no llevan marca: píntalos con «Pintar un carácter».', 'Continuous characters carry no mark: paint them with «Paint a character».'));
    const pc = mode === 'paint' && r.per[paintChar];
    if (pc && pc.kind === 'cont') notes.push(T('Cada rama lleva el color de su valor en la reconstrucción elegida, del más bajo de la matriz al más alto; junto a un nodo, el intervalo de valores igual de parsimoniosos, donde cambia respecto a su antepasado.', 'Each branch carries the colour of its value in the chosen reconstruction, from the lowest in the matrix to the highest; beside a node, the interval of equally parsimonious values, where it changes from its ancestor.'));
    else if (mode === 'paint') notes.push(T('Los círculos en los nodos son los estados posibles en alguna reconstrucción más parsimoniosa; la rama lleva el color de la reconstrucción elegida.', 'The circles on the nodes are the states possible in some most parsimonious reconstruction; the branch takes the colour of the chosen reconstruction.'));
    $('b5Note').innerHTML = notes.join(' ');
    paintSide();
  }
  B5.paint = paint;

  /* ---------------- the side panel ---------------- */
  function nodesList() {
    const C = state.clado;
    return Tree.postorder(C.root);
  }
  function paintSide() {
    const C = state.clado;
    const post = nodesList();
    const opts = post.map((v, i) => (v === C.root ? '' : `<option value="${i}"${v === sel ? ' selected' : ''}>${esc(nodeLabel(v))}</option>`)).join('');
    $('b5NodeSel').innerHTML = `<option value="">${T('— ninguno —', '— none —')}</option>` + opts;
    if (!sel) $('b5NodeSel').value = '';
    const isInt = sel && sel.children.length;
    els('#b5Side [data-ed]').forEach(b => {
      const a = b.dataset.ed;
      b.disabled = (a === 'move' && !sel) || (a === 'collapse' && !(isInt && sel !== C.root)) || (a === 'reroot' && !sel) || (a === 'rotate' && !isInt) || (a === 'undo' && !C.undo.length) || (a === 'reset' && !C.undo.length);
    });
    $('b5Help').innerHTML = moving ? T('<b>Elige la rama a donde irá el clado</b>: haz clic en ella o escógela abajo. Esc cancela.', '<b>Choose the branch the clade goes to</b>: click it or pick it below. Esc cancels.')
      : sel ? '' : T('Haz clic en una rama del cladograma (o elige un clado arriba) para ver sus cambios y editarlo.', 'Click a branch of the cladogram (or choose a clade above) to see its changes and edit it.');
    /* moving: a keyboard way to choose the destination */
    let res = '';
    if (moving && sel) {
      const targets = post.map((v, i) => (Tree.within(v, sel) || v === sel.parent && sel.parent.children.length === 2 ? '' : `<option value="${i}">${esc(v === C.root ? T('la raíz (fuera de todo)', 'the root (outside everything)') : nodeLabel(v))}</option>`)).join('');
      res = `<div class="field"><label for="b5Target">${T('A la rama de', 'Onto the branch of')}</label><select id="b5Target">${targets}</select></div>
        <div class="btn-row"><button type="button" class="btn btn-primary btn-sm" id="b5MoveGo">${T('Mover aquí', 'Move here')}</button><button type="button" class="btn btn-ghost btn-sm" id="b5MoveNo">${T('Cancelar', 'Cancel')}</button></div>`;
    } else if (isInt && sel.children.length >= 3) {
      res = `<p class="hint">${T('Una politomía: elige dos de sus ramas para unirlas en un clado.', 'A polytomy: choose two of its branches to join them in a clade.')}</p>` +
        sel.children.map((c, i) => `<label class="checkbox-label"><input type="checkbox" data-pair="${i}"> ${esc(nodeLabel(c))}</label>`).join('') +
        `<div class="btn-row"><button type="button" class="btn btn-secondary btn-sm" id="b5Pair">${T('Unir las dos elegidas', 'Join the two chosen')}</button></div>`;
    }
    $('b5Resolve').innerHTML = res;
    $('b5NodeInfo').innerHTML = sel ? nodeInfo(sel) : '';
  }
  function nodeInfo(v) {
    const C = state.clado;
    const list = (C.map.byNode.get(v) || []).slice().sort((a, b) => a.j - b.j);
    const tips = Tree.tips(v);
    let h = `<h4>${v.children.length ? T(`Clado de ${tips.length} taxones`, `Clade of ${tips.length} taxa`) : `<i>${esc(v.name)}</i>`}</h4>`;
    if (v.children.length) h += `<p class="b5-taxa">${tips.slice(0, 14).map(t => `<i>${esc(t.name)}</i>`).join(', ')}${tips.length > 14 ? T(` y ${tips.length - 14} más`, ` and ${tips.length - 14} more`) : ''}</p>`;
    if (v === C.root) h += `<p class="hint">${T('La raíz: sus estados son los ancestrales del árbol.', 'The root: its states are the ancestral ones of the tree.')}</p>`;
    else if (!list.length) h += `<p class="hint">${T('Ningún cambio en la rama que lleva a este clado con la optimización elegida.', 'No change on the branch leading to this clade under the chosen optimization.')}</p>`;
    else {
      h += `<p class="b5-sub">${T(`${plural(list.length, 'cambio', 'cambios')} en la rama que lleva a él:`, `${list.length} change${list.length === 1 ? '' : 's'} on the branch leading to it:`)}</p><ul class="b5-changes">`;
      list.forEach(chg => {
        const ch = C.M.chars[chg.c];
        const tag = ch.kind === 'cont' ? `<span class="badge">${T('continuo', 'continuous')}</span>` : chg.homoplastic ? `<span class="badge warn">${T('homoplásico', 'homoplastic')}</span>` : `<span class="badge ok">${T('único', 'unique')}</span>`;
        const amb = chg.unambiguous === false ? ` <span class="badge">${T('ambiguo', 'ambiguous')}</span>` : '';
        h += `<li><b>${ch.j + 1}.</b> ${esc(ch.name || '')}: ${changeText(chg)} ${tag}${amb}</li>`;
      });
      h += '</ul>';
    }
    /* where a character with «–» becomes applicable again */
    const regs = C.map.per.filter(p => p.kind === 'inap' && p.regions > 1 && p.regionRoots.includes(v) && p.regionRoots[0] !== v);
    if (regs.length) h += `<p class="b5-sub">${T('Aquí empieza una región aplicable más de:', 'Another applicable region starts here for:')}</p><ul class="b5-changes">` + regs.map(p => `<li><b>${p.ch.j + 1}.</b> ${esc(p.ch.name || '')}</li>`).join('') + '</ul>';
    return h;
  }

  /* ---------------- choices ---------------- */
  function paintSources() {
    const srcs = sources(), C = state.clado;
    $('b5Src').innerHTML = srcs.map(s => `<option value="${s.id}"${C && s.id === C.src ? ' selected' : ''}>${esc(s.label)}</option>`).join('');
    if (!C) return;
    $('b5TreeSel').innerHTML = C.list.map((t, i) => `<option value="${i}"${i === C.idx ? ' selected' : ''}>${esc(t.label)}</option>`).join('');
    $('b5Prev').disabled = C.idx <= 0; $('b5Next').disabled = C.idx >= C.list.length - 1;
    $('b5Opt').value = C.opts.optimization;
    $('b5Inap').value = C.opts.inapplicable;
    $('b5Cont').value = C.opts.continuous;
    $('b5InapF').hidden = !hasGaps();
    $('b5ContF').hidden = !hasCont();
    /* the characters to paint */
    $('b5Char').innerHTML = C.M.chars.map((ch, c) => `<option value="${c}"${c === paintChar ? ' selected' : ''}>${ch.j + 1}. ${esc(ch.name || '—')}${ch.kind === 'cont' ? T(' (continuo)', ' (continuous)') : ch.kind === 'inap' ? ' (–)' : ''}</option>`).join('');
  }
  function paintMode() {
    els('#b5Mode button').forEach(b => { const on = b.dataset.mode === mode; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    $('b5ShowL').hidden = mode !== 'marks';
    $('b5LabelsL').hidden = mode !== 'marks';
    $('b5CharL').hidden = mode !== 'paint';
  }
  function onShow() {
    const has = !!state.matrix;
    const C = has ? B5.ensure() : null;
    $('b5NoData').hidden = !!C;
    $('b5Work').hidden = !C;
    if (!C) {
      $('b5NoTitle').innerHTML = has ? T('Primero hace falta un árbol', 'A tree is needed first') : T('Primero hace falta una matriz', 'A matrix is needed first');
      $('b5NoText').innerHTML = has ? T('Busca árboles en el Bloque 3, carga una matriz que traiga árboles o pega uno en Newick aquí abajo.', 'Search for trees in Block 3, load a matrix that brings trees or paste one in Newick below.') : T('Carga un ejemplo o tu archivo en el Bloque 2.', 'Load an example or your file in Block 2.');
      $('b5GoMatrix').hidden = has; $('b5GoSearch').hidden = !has;
      return;
    }
    paintSources(); paintMode(); paint();
  }
  B5.onShow = onShow;

  /* ---------------- actions ---------------- */
  function nodeAt(i) { return i === '' || i == null ? null : nodesList()[+i] || null; }
  function act(a) {
    const C = state.clado;
    if (!C) return;
    if (a === 'undo') { const u = C.undo.pop(); if (u) { C.root = u.root; sel = null; remap(); document.dispatchEvent(new CustomEvent('cladochange')); paint(); } return; }
    if (a === 'reset') { C.undo.push({ root: Tree.clone(C.root) }); C.root = Tree.clone(C.base); sel = null; remap(); document.dispatchEvent(new CustomEvent('cladochange')); paint(); return; }
    if (a === 'ladder') { edit(r => Tree.ladderize(r)); return; }
    if (!sel) return;
    if (a === 'move') { moving = true; paint(); return; }
    if (a === 'collapse') { const p = sel.parent, v = sel; sel = p; edit(r => Tree.collapseNode(r, v)); return; }
    if (a === 'reroot') { const v = sel; edit(r => Tree.rerootAbove(r, v)); return; }
    if (a === 'rotate') { const v = sel; edit(r => Tree.rotate(r, v)); return; }
  }
  function moveTo(target) {
    const v = sel;
    if (!v || !target) return;
    if (Tree.within(target, v)) { if (window.LABG) LABG.toast(T('Un clado no puede ir dentro de sí mismo.', 'A clade cannot go inside itself.')); return; }
    moving = false;
    edit(r => Tree.moveClade(r, v, target));
  }
  function onTreeClick(e) {
    const hit = e.target.closest('.clado-hit');
    if (!hit || !state.clado) return;
    const v = Clado.nodeById(state.clado.root, hit.dataset.node, 'b5');
    if (!v) return;
    if (moving) { moveTo(v); return; }
    sel = v === sel ? null : v;
    paint();
  }
  function usePasted() {
    clearMessages('b5Msg');
    const txt = $('b5Paste').value.trim();
    if (!txt) return;
    try {
      const t = readTree(txt, T('Árbol pegado', 'Pasted tree'));
      B5.pasted = t;
      B5.setSource('pasted', 0);
      if (t.dropped) showMessage('b5Msg', 'warning', T(`${plural(t.dropped, 'taxón del árbol no está activo', 'taxones del árbol no están activos')} en la matriz y se quitaron.`, `${t.dropped} taxa of the tree are not active in the matrix and were removed.`));
      if (t.missing) showMessage('b5Msg', 'warning', T(`Al árbol le faltan ${plural(t.missing, 'taxón', 'taxones')} de la matriz.`, `The tree lacks ${t.missing} taxa of the matrix.`));
      onShow();
    } catch (err) { showMessage('b5Msg', 'error', T('No se pudo leer el árbol: ', 'The tree could not be read: ') + esc(err.message)); }
  }
  function exportChanges() {
    const C = state.clado;
    const rows = [[T('clado', 'clade'), T('taxones', 'taxa'), T('carácter', 'character'), T('nombre', 'name'), T('de', 'from'), T('a', 'to'), T('tipo', 'kind'), T('ambiguo', 'ambiguous')]];
    Tree.preorder(C.root).forEach(v => {
      (C.map.byNode.get(v) || []).slice().sort((a, b) => a.j - b.j).forEach(chg => {
        const ch = C.M.chars[chg.c];
        const fr = ch.kind === 'cont' ? fmtNum(chg.from, 4) : sym(chg.from) + ' ' + stateName(chg.c, chg.from);
        const to = ch.kind === 'cont' ? fmtNum(chg.to, 4) : sym(chg.to) + ' ' + stateName(chg.c, chg.to);
        rows.push([v.children.length ? nodeLabel(v) : v.name, Tree.tips(v).length, ch.j + 1, ch.name, fr.trim(), to.trim(), ch.kind === 'cont' ? T('continuo', 'continuous') : chg.homoplastic ? T('homoplásico', 'homoplastic') : T('único', 'unique'), chg.unambiguous === false ? T('sí', 'yes') : T('no', 'no')]);
      });
    });
    download(rows.map(r => r.map(csvEscape).join(',')).join('\n') + '\n', slug(state.matrix.title || 'matriz') + '_cambios.csv', 'text/csv;charset=utf-8');
  }

  /* ---------------- wiring ---------------- */
  function wire() {
    if (!$('panel-5')) return;
    $('b5GoMatrix').addEventListener('click', () => goStep(2));
    $('b5GoSearch').addEventListener('click', () => goStep(3));
    $('b5Src').addEventListener('change', e => { B5.setSource(e.target.value, 0); onShow(); });
    $('b5TreeSel').addEventListener('change', e => { B5.setSource(state.clado.src, +e.target.value, true); onShow(); });
    $('b5Prev').addEventListener('click', () => { B5.setSource(state.clado.src, state.clado.idx - 1, true); onShow(); });
    $('b5Next').addEventListener('click', () => { B5.setSource(state.clado.src, state.clado.idx + 1, true); onShow(); });
    $('b5Opt').addEventListener('change', e => { state.clado.opts.optimization = e.target.value; remap(); document.dispatchEvent(new CustomEvent('cladochange')); paint(); });
    ['b5Inap', 'b5Cont'].forEach(id => $(id).addEventListener('change', () => {
      const C = state.clado;
      C.opts.inapplicable = $('b5Inap').value; C.opts.continuous = $('b5Cont').value;
      prepare();
      /* the base length under the new reading */
      C.baseLength = Mapping.map(C.M, C.base, { optimization: C.opts.optimization }).length;
      document.dispatchEvent(new CustomEvent('cladochange'));
      paintSources(); paint();
    }));
    $('b5Mode').addEventListener('click', e => { const b = e.target.closest('[data-mode]'); if (!b) return; mode = b.dataset.mode; paintMode(); paint(); });
    ['b5Show', 'b5Labels', 'b5Img'].forEach(id => $(id).addEventListener('change', paint));
    $('b5ImgManage').addEventListener('click', () => { if (state.matrix && window.TaxonImg) TaxonImg.manage(); });
    /* a new picture: switch them on and redraw */
    document.addEventListener('taximgchange', () => {
      if (!window.TaxonImg) return;
      if (TaxonImg.count() && !$('b5Img').dataset.touched) $('b5Img').checked = true;
      if (state.clado && $('panel-5').classList.contains('active')) paint();
    });
    $('b5Img').addEventListener('change', e => { e.target.dataset.touched = '1'; });
    $('b5Char').addEventListener('change', e => { paintChar = +e.target.value; paint(); });
    $('b5Tree').addEventListener('click', onTreeClick);
    $('b5NodeSel').addEventListener('change', e => { sel = nodeAt(e.target.value); moving = false; paint(); });
    $('b5Side').addEventListener('click', e => {
      const b = e.target.closest('[data-ed]');
      if (b && !b.disabled) { act(b.dataset.ed); return; }
      if (e.target.closest('#b5MoveGo')) moveTo(nodeAt($('b5Target').value));
      else if (e.target.closest('#b5MoveNo')) { moving = false; paint(); }
      else if (e.target.closest('#b5Pair')) {
        const ch = els('#b5Resolve [data-pair]').filter(x => x.checked).map(x => sel.children[+x.dataset.pair]);
        if (ch.length !== 2) { if (window.LABG) LABG.toast(T('Elige exactamente dos ramas.', 'Choose exactly two branches.')); return; }
        const v = sel;
        edit(r => Tree.resolvePair(r, v, ch[0], ch[1]));
      }
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && moving) { moving = false; paint(); } });
    $('b5PasteUse').addEventListener('click', usePasted);
    $('b5ExpNwk').addEventListener('click', () => download(Tree.toNewick(state.clado.root) + '\n', slug(state.matrix.title || 'matriz') + '_arbol.nwk'));
    $('b5ExpChanges').addEventListener('click', exportChanges);
    document.addEventListener('matrixchange', () => { state.clado = null; if ($('panel-5').classList.contains('active')) onShow(); });
    document.addEventListener('searchdone', () => { state.clado = null; });
    document.addEventListener('stepchange', e => { if (e.detail.step === 5) onShow(); });
    document.addEventListener('langchange', () => { if (state.clado && state.matrix) { paintSources(); paint(); } });
  }
  document.addEventListener('DOMContentLoaded', wire);
  Object.assign(B5, { sources, readTree, marksMap });
})();
