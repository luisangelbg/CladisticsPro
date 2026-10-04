/* CladisticsPro — morphological cladistics in the browser.
   Copyright (C) 2026  Luis Ángel Barrera-Guzmán

   This program is free software: you can redistribute it and/or modify it under
   the terms of the GNU General Public License as published by the Free Software
   Foundation, either version 3 of the License, or (at your option) any later
   version. It is distributed in the hope that it will be useful, but WITHOUT ANY
   WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
   A PARTICULAR PURPOSE. See the GNU General Public License, in the file LICENSE
   at the root of this program, or <https://www.gnu.org/licenses/>. */

/* CladisticsPro — Block 9: hypotheses.

   A hypothesis is a set of groups that must (or must not) be monophyletic, or
   a whole tree. With groups, the search of Block 3 is repeated under them as
   constraints; the cost is the difference with the shortest length. Either
   way the tree of the hypothesis and the shortest tree are compared character
   by character with the tests of hypo.js.

   state.hypotheses = { fingerprint, list: [{ id, name, kind, groups, best,
   length, extra, cmp, newick, root, improved }] } */
(function () {
  const B9 = {};
  window.Block9 = B9;
  const $ = el;
  const MODES = [
    { id: 'groups', es: 'Grupos propuestos', en: 'Proposed groups', d: ['Uno o varios grupos que deben (o no deben) ser monofiléticos: se busca el mejor árbol que los cumple', 'One or more groups that must (or must not) be monophyletic: the best tree that keeps them is searched for'] },
    { id: 'tree', es: 'Un árbol completo', en: 'A whole tree', d: ['Un árbol propuesto tal cual: el del Bloque 5, uno del archivo o uno pegado', 'A proposed tree as it is: that of Block 5, one from the file or one pasted'] },
  ];
  let mode = 'groups';
  B9.groups = [];

  const ready = () => !!(state.matrix && state.search && state.search.trees && state.search.trees.length && state.search.fingerprint === Mx.fingerprint(state.matrix));
  function store() {
    const fp = Mx.fingerprint(state.matrix);
    if (!state.hypotheses || state.hypotheses.fingerprint !== fp) state.hypotheses = { fingerprint: fp, list: [] };
    return state.hypotheses;
  }
  /* taxon of the matrix → its number among the active taxa */
  function activeIndex(i) { let q = -1; for (let t = 0; t <= i; t++) if (state.matrix.taxa[t].active !== false) q++; return state.matrix.taxa[i].active === false ? -1 : q; }
  const weightsOf = () => { const w = {}; state.matrix.chars.forEach((c, j) => { w[j] = c.weight == null ? 1 : c.weight; }); return w; };

  /* ---------------- the groups ---------------- */
  function paintGroups() {
    const m = state.matrix;
    $('b9Groups').innerHTML = B9.groups.length ? B9.groups.map((c, k) => `<div class="b3-cons"><b>${esc(c.name)}</b>
      <span class="badge ${c.positive ? 'ok' : 'warn'}">${c.positive ? T('debe ser monofilético', 'must be monophyletic') : T('no debe ser monofilético', 'must not be monophyletic')}</span>
      <span class="hint">${c.taxa.map(i => `<i>${esc(m.taxa[i] ? m.taxa[i].name : '?')}</i>`).join(', ')}</span>
      <button type="button" class="btn btn-ghost btn-sm" data-del="${k}">${T('Quitar', 'Remove')}</button></div>`).join('')
      : `<p class="hint">${T('Todavía no hay grupos: elige los taxones de uno abajo.', 'No groups yet: choose the taxa of one below.')}</p>`;
    $('b9GTaxa').innerHTML = m.taxa.map((t, i) => (t.active === false ? '' : `<label class="checkbox-label"><input type="checkbox" value="${i}"> ${esc(t.name)}</label>`)).join('');
  }
  function addGroup() {
    const sel = els('#b9GTaxa input:checked').map(x => +x.value);
    const n = state.matrix.taxa.filter(t => t.active !== false).length;
    if (sel.length < 2 || sel.length > n - 2) { if (window.LABG) LABG.toast(T('Un grupo necesita al menos 2 taxones y dejar fuera al menos 2.', 'A group needs at least 2 taxa and must leave at least 2 out.')); return; }
    B9.groups.push({ name: $('b9GName').value.trim() || T('Grupo ', 'Group ') + (B9.groups.length + 1), positive: $('b9GType').value === 'pos', taxa: sel });
    $('b9GName').value = '';
    paintGroups(); paintHint();
  }

  /* ---------------- the trees of the hypothesis ---------------- */
  function treeSources() {
    const out = [];
    if (window.Block5) {
      const C = Block5.ensure();
      if (C) out.push({ id: 'clado', label: T('El árbol a la vista en el Bloque 5', 'The tree on screen in Block 5') + (C.undo.length ? T(' (editado)', ' (edited)') : ''), root: () => C.root });
    }
    (state.matrixTrees || []).forEach((t, i) => out.push({ id: 'file' + i, label: T('Del archivo: ', 'From the file: ') + (t.name || T('árbol ', 'tree ') + (i + 1)), root: () => Block5.readTree(t.newick, t.name).root }));
    out.push({ id: 'paste', label: T('Pegar un árbol en Newick', 'Paste a tree in Newick'), root: () => Block5.readTree($('b9Paste').value.trim(), 'paste').root });
    return out;
  }
  function paintTreeSources() {
    const prev = $('b9TreeSrc').value;
    const list = treeSources();
    $('b9TreeSrc').innerHTML = list.map(s => `<option value="${s.id}">${esc(s.label)}</option>`).join('');
    if (list.some(s => s.id === prev)) $('b9TreeSrc').value = prev;
    $('b9PasteF').hidden = $('b9TreeSrc').value !== 'paste';
  }

  /* ---------------- running ---------------- */
  async function run() {
    if (!ready()) return;
    clearMessages('b9Msg');
    const s = state.search, m = state.matrix;
    const best = s.trees[0];
    let rec;
    if (mode === 'groups') {
      if (!B9.groups.length) { showMessage('b9Msg', 'warning', T('Añade al menos un grupo.', 'Add at least one group.')); return; }
      const constraints = B9.groups.map(c => ({ taxa: c.taxa.map(activeIndex).filter(q => q >= 0), positive: c.positive }));
      const prep = Object.assign({}, s.prep || {}, { constraints: ((s.prep && s.prep.constraints) || []).concat(constraints) });
      const opts = Object.assign(Block3.searchOpts(), { replicates: Math.max(1, +$('b9Reps').value || 10) });
      let job = null;
      const r = await LABG.work.run({ title: T('Buscando el mejor árbol con la hipótesis', 'Searching for the best tree with the hypothesis'), cancel: () => job && job.cancel(), delay: 300 }, async w => {
        w.update(0.03, T('Buscando…', 'Searching…'));
        job = Pool.search({ matrix: m, prep, opts, maxTime: Block3.maxTime() }, d => w.update(Math.max(0.03, d.f || 0)));
        return job;
      });
      if (!r) return;
      if (!r.trees.length || !isFinite(r.length)) { showMessage('b9Msg', 'error', T('Ningún árbol cumple a la vez todos los grupos: son incompatibles entre sí.', 'No tree keeps all the groups at once: they are incompatible with each other.')); return; }
      const A = Mx.toAnalysis(m);
      const root = Tree.ladderize(Tree.rootOn(Tree.parseNewick(r.trees[0].newick, A.taxa), A.outgroup.length ? A.outgroup : [0]).root);
      rec = { kind: 'groups', name: B9.groups.map(c => (c.positive ? '' : '¬') + c.name).join(' + '), groups: B9.groups.map(c => Object.assign({}, c, { taxa: c.taxa.slice() })),
        best: s.length, length: r.length, nTrees: r.trees.length, newick: r.trees[0].newick, root, cmp: Hypo.compare(best.byChar, r.trees[0].byChar, weightsOf()), search: { method: opts.method, replicates: opts.replicates } };
    } else {
      const src = treeSources().find(x => x.id === $('b9TreeSrc').value);
      let root;
      try { root = src.root(); } catch (e) { showMessage('b9Msg', 'error', T('No se pudo leer el árbol: ', 'The tree could not be read: ') + esc(e.message)); return; }
      const nAct = state.matrix.taxa.filter(t => t.active !== false).length, nTip = Tree.tips(root).length;
      if (nTip !== nAct) { showMessage('b9Msg', 'error', T(`El árbol tiene ${nTip} de los ${nAct} taxones activos: para compararlo hacen falta todos.`, `The tree has ${nTip} of the ${nAct} active taxa: all of them are needed to compare it.`)); return; }
      const binary = Tree.isBinary(root);
      const prep = Object.assign({}, s.prep || {});
      /* a tree with polytomies cannot carry the inapplicable algorithm: both trees are read alike */
      if (!binary && prep.inapplicable === 'algorithm') { prep.inapplicable = 'missing'; showMessage('b9Msg', 'warning', T('El árbol tiene politomías: para compararlo, en los dos árboles «–» se lee como «?».', 'The tree has polytomies: to compare it, «–» is read as «?» in both trees.')); }
      const M = Mapping.prepare(m, prep);
      const mA = Mapping.map(M, best.root), mB = Mapping.map(M, root);
      const by = res => { const o = {}; res.per.forEach(p => { if (!(p.ch.kind === 'cont' && p.off) && p.ch.w > 0) o[p.ch.j] = p.steps; }); return o; };
      rec = { kind: 'tree', name: src.label, best: mA.length, length: mB.length, nTrees: 1, newick: Tree.toNewick(root), root: Tree.ladderize(Tree.clone(root)), cmp: Hypo.compare(by(mA), by(mB), weightsOf()) };
    }
    const S = store();
    rec.extra = rec.length - rec.best;
    rec.improved = rec.extra < -1e-9;
    rec.id = S.list.length + 1;
    rec.date = new Date().toISOString();
    S.list.push(rec);
    if (rec.improved) showMessage('b9Msg', 'warning', T('La hipótesis dio un árbol MÁS CORTO que los del Bloque 3: aquella búsqueda no llegó al óptimo. Conviene repetirla con más réplicas.', 'The hypothesis gave a SHORTER tree than those of Block 3: that search did not reach the optimum. It should be repeated with more replicates.'));
    enableStep(9, true);
    refreshStepMarks();
    paintResults(S.list.length - 1);
  }

  /* ---------------- results ---------------- */
  const pfmt = p => (p == null || !isFinite(p) ? '—' : p < 0.0001 ? '< 0.0001' : p.toFixed(4));
  function paintResults(k) {
    const S = state.hypotheses;
    const has = S && S.list.length;
    $('b9Results').hidden = !has;
    if (!has) return;
    if (k == null) k = Math.min(S.list.length - 1, Math.max(0, +$('b9Which').value || 0));
    $('b9Which').innerHTML = S.list.map((h, i) => `<option value="${i}"${i === k ? ' selected' : ''}>${h.id}. ${esc(h.name)}</option>`).join('');
    const h = S.list[k], c = h.cmp;
    statTiles('b9Tiles', [
      [T('Sin la hipótesis', 'Without the hypothesis'), fmtNum(h.best, 3), T('el árbol más corto', 'the shortest tree')],
      [T('Con la hipótesis', 'With the hypothesis'), fmtNum(h.length, 3), h.kind === 'groups' ? T(`el mejor que la cumple (${plural(h.nTrees, 'árbol', 'árboles')})`, `the best that keeps it (${h.nTrees} tree${h.nTrees === 1 ? '' : 's'})`) : T('el árbol propuesto', 'the proposed tree')],
      [T('Pasos de más', 'Extra steps'), (h.extra > 0 ? '+' : '') + fmtNum(h.extra, 3), h.extra > 1e-9 ? T('lo que cuesta aceptarla', 'what accepting it costs') : T('no cuesta nada', 'it costs nothing'), h.extra > 1e-9 ? 'warn' : 'ok'],
      [T('Caracteres', 'Characters'), `${c.favourHyp} / ${c.favourBest}`, T('a favor / en contra de la hipótesis', 'for / against the hypothesis')],
    ]);
    /* worse > 0: the test leans against the hypothesis (more steps on its tree) */
    const verdict = (p, worse) => (p < 0.05 ? (worse > 0 ? `<span class="badge warn">${T('rechazada (p < 0.05)', 'rejected (p < 0.05)')}</span>` : `<span class="badge ok">${T('preferida (p < 0.05)', 'preferred (p < 0.05)')}</span>`) : `<span class="badge">${T('no se rechaza', 'not rejected')}</span>`);
    buildTable('b9Tests', [
      { key: 't', label: T('Prueba', 'Test'), html: true },
      { key: 's', label: T('Estadístico', 'Statistic'), num: true },
      { key: 'n', label: T('Caracteres', 'Characters'), num: true },
      { key: 'p', label: 'p', num: true },
      { key: 'v', label: T('Lectura', 'Reading'), html: true },
    ], [
      { t: T('Templeton (rangos con signo de Wilcoxon)', 'Templeton (Wilcoxon signed ranks)'), s: 'V = ' + fmtNum(c.templeton.V, 3), n: c.templeton.n, p: pfmt(c.templeton.p) + (c.templeton.method === 'exact' ? ' ' + T('(exacta)', '(exact)') : ''), v: verdict(c.templeton.p, c.templeton.V - c.templeton.n * (c.templeton.n + 1) / 4) },
      { t: T('Sitios ganadores (binomial)', 'Winning sites (binomial)'), s: `${c.favourHyp} : ${c.favourBest}`, n: c.winning.n, p: pfmt(c.winning.p), v: verdict(c.winning.p, c.favourBest - c.favourHyp) },
      { t: T('Kishino–Hasegawa (t de la diferencia media)', 'Kishino–Hasegawa (t of the mean difference)'), s: 't = ' + fmtNum(c.kh.t, 3), n: c.kh.n, p: pfmt(c.kh.p), v: verdict(c.kh.p, c.kh.t) },
    ]);
    $('b9Caveat').innerHTML = T('Las tres pruebas comparan el árbol de la hipótesis con el árbol más corto, carácter por carácter. Son válidas para una hipótesis planteada de antemano (de la literatura, de otros datos); si el árbol de la hipótesis se eligió mirando estos mismos datos, tienden a rechazar de más (Goldman, Anderson y Rodrigo 2000). Templeton y los sitios ganadores sólo cuentan los caracteres que cambian; Kishino–Hasegawa los usa todos.',
      'The three tests compare the tree of the hypothesis with the shortest tree, character by character. They are valid for a hypothesis set beforehand (from the literature, from other data); if the tree of the hypothesis was chosen by looking at these same data, they tend to reject too often (Goldman, Anderson and Rodrigo 2000). Templeton and winning sites only count the characters that change; Kishino–Hasegawa uses them all.');
    /* the tree, with the groups of the hypothesis coloured */
    const A = Mx.toAnalysis(state.matrix);
    const n = A.taxa.length;
    const groupSets = (h.groups || []).filter(gp => gp.positive).map(gp => new Set(gp.taxa.map(activeIndex)));
    const inGroup = new Set();
    Tree.postorder(h.root).forEach(v => {
      const tips = Tree.tips(v).map(t => t.tip);
      if (groupSets.some(gs => tips.every(t => gs.has(t)))) inGroup.add(v);
    });
    void n;
    $('b9Tree').innerHTML = Clado.render(h.root, { names: v => v.name, paintColor: v => (inGroup.has(v) ? 'var(--st1)' : null), legend: groupSets.length > 0, paintLegend: groupSets.length ? [{ color: 'var(--st1)', label: T('grupo que la hipótesis exige', 'group the hypothesis requires') }] : null, rowH: 22, fontSize: 12, minUnit: 30, maxUnit: 44, ariaLabel: T('Árbol de la hipótesis', 'Tree of the hypothesis') });
    $('b9TreeNote').innerHTML = groupSets.length ? T('En color, los grupos que la hipótesis exige.', 'In colour, the groups the hypothesis requires.') : (h.kind === 'groups' ? T('El mejor árbol en el que los grupos prohibidos no existen.', 'The best tree in which the forbidden groups do not exist.') : '');
    /* character by character */
    const rows = c.rows.filter(r => Math.abs(r.d) > 1e-12).sort((a, b) => Math.abs(b.d) - Math.abs(a.d) || a.j - b.j);
    buildTable('b9Chars', [
      { key: 'j', label: '#', num: true, get: r => r.j + 1 },
      { key: 'name', label: T('Carácter', 'Character'), get: r => state.matrix.chars[r.j].name || '—' },
      { key: 'b', label: T('Más corto', 'Shortest'), num: true, get: r => fmtNum(r.best, 3) },
      { key: 'h', label: T('Hipótesis', 'Hypothesis'), num: true, get: r => fmtNum(r.hyp, 3) },
      { key: 'd', label: T('Diferencia', 'Difference'), num: true, get: r => (r.d > 0 ? '+' : '') + fmtNum(r.d, 3) },
      { key: 'f', label: T('Prefiere', 'Prefers'), get: r => (r.d > 0 ? T('el árbol más corto', 'the shortest tree') : T('la hipótesis', 'the hypothesis')) },
    ], rows, { limit: 400 });
    if (!rows.length) $('b9Chars').innerHTML = `<p class="hint" style="padding:8px 12px">${T('Ningún carácter cambia de pasos entre los dos árboles.', 'No character changes its steps between the two trees.')}</p>`;
    /* all the hypotheses */
    buildTable('b9All', [
      { key: 'id', label: '#', num: true },
      { key: 'name', label: T('Hipótesis', 'Hypothesis') },
      { key: 'extra', label: T('Pasos de más', 'Extra steps'), num: true, get: r => (r.extra > 0 ? '+' : '') + fmtNum(r.extra, 3) },
      { key: 'pt', label: 'Templeton p', num: true, get: r => pfmt(r.cmp.templeton.p) },
      { key: 'pw', label: T('Sitios ganadores p', 'Winning sites p'), num: true, get: r => pfmt(r.cmp.winning.p) },
      { key: 'pk', label: 'KH p', num: true, get: r => pfmt(r.cmp.kh.p) },
    ], S.list.map((r, i) => Object.assign({ _class: i === k ? 'b4-best' : '' }, r)));
  }
  function paintHint() {
    if (!state.search) return;
    $('b9GroupBox').hidden = mode !== 'groups';
    $('b9TreeBox').hidden = mode !== 'tree';
    $('b9SearchF').hidden = mode !== 'groups';
    /* the method of Block 3 by its name, not its internal id */
    const mid = Block3.searchOpts().method, mm = (Block3.METHODS || []).find(x => x.id === mid);
    const mname = mm ? T(mm.es, mm.en).toLowerCase() : mid;
    $('b9Hint').innerHTML = mode === 'groups'
      ? T(`Se repite la búsqueda del Bloque 3 (${mname}) con los grupos como restricciones y se compara con el árbol más corto (longitud ${fmtNum(state.search.length, 3)}).`, `The search of Block 3 (${mname}) is repeated with the groups as constraints and compared with the shortest tree (length ${fmtNum(state.search.length, 3)}).`)
      : T('El árbol se compara tal cual con el primer árbol más corto del Bloque 3, carácter por carácter.', 'The tree is compared as it is with the first shortest tree of Block 3, character by character.');
  }
  function paintModes() {
    $('b9Modes').innerHTML = MODES.map(x => `<button type="button" class="design-tile${x.id === mode ? ' on' : ''}" data-mode="${x.id}" aria-pressed="${x.id === mode}"><b>${L2(x.es, x.en)}</b><small>${L2(x.d[0], x.d[1])}</small></button>`).join('');
  }
  function onShow() {
    const ok = ready();
    $('b9NoData').hidden = ok; $('b9Work').hidden = !ok;
    if (!ok) return;
    B9.groups = B9.groups.filter(c => c.taxa.every(i => state.matrix.taxa[i]));
    if (!$('b9Reps').dataset.touched) $('b9Reps').value = Block3.searchOpts().replicates;
    paintModes(); paintGroups(); paintTreeSources(); paintHint();
    paintResults();
  }
  B9.onShow = onShow;
  function exportCsv() {
    const S = state.hypotheses; if (!S || !S.list.length) return;
    const h = S.list[+$('b9Which').value || 0];
    const head = ['#', T('carácter', 'character'), T('pasos_mas_corto', 'steps_shortest'), T('pasos_hipotesis', 'steps_hypothesis'), T('diferencia', 'difference')];
    const rows = h.cmp.rows.map(r => [r.j + 1, state.matrix.chars[r.j].name, r.best, r.hyp, r.d]);
    download([head].concat(rows).map(r => r.map(csvEscape).join(',')).join('\n') + '\n', slug(state.matrix.title || 'matriz') + '_hipotesis_' + h.id + '.csv', 'text/csv;charset=utf-8');
  }
  function wire() {
    if (!$('panel-9')) return;
    $('b9GoSearch').addEventListener('click', () => goStep(3));
    $('b9Modes').addEventListener('click', e => { const b = e.target.closest('[data-mode]'); if (!b) return; mode = b.dataset.mode; paintModes(); paintTreeSources(); paintHint(); });
    $('b9GAdd').addEventListener('click', addGroup);
    $('b9GFilter').addEventListener('input', e => { const q = e.target.value.trim().toLowerCase(); els('#b9GTaxa label').forEach(l => { l.hidden = q && !l.textContent.toLowerCase().includes(q); }); });
    $('b9Groups').addEventListener('click', e => { const b = e.target.closest('[data-del]'); if (b) { B9.groups.splice(+b.dataset.del, 1); paintGroups(); } });
    $('b9TreeSrc').addEventListener('change', () => { $('b9PasteF').hidden = $('b9TreeSrc').value !== 'paste'; });
    $('b9Reps').addEventListener('input', e => { e.target.dataset.touched = '1'; });
    $('b9Run').addEventListener('click', () => run().catch(e => showMessage('b9Msg', 'error', T('La prueba falló: ', 'The test failed: ') + esc(e.message || String(e)))));
    $('b9Which').addEventListener('change', e => paintResults(+e.target.value));
    $('b9ExpCsv').addEventListener('click', exportCsv);
    $('b9ExpNwk').addEventListener('click', () => { const S = state.hypotheses; if (!S || !S.list.length) return; const h = S.list[+$('b9Which').value || 0]; download(Tree.toNewick(h.root) + '\n', slug(state.matrix.title || 'matriz') + '_hipotesis_' + h.id + '.nwk'); });
    document.addEventListener('stepchange', e => { if (e.detail.step === 9) onShow(); });
    document.addEventListener('matrixchange', () => { state.hypotheses = null; B9.groups = []; });
    document.addEventListener('searchdone', e => { if (e.detail && e.detail.block === 3) state.hypotheses = null; });
    document.addEventListener('langchange', () => { if ($('panel-9').classList.contains('active')) onShow(); });
  }
  document.addEventListener('DOMContentLoaded', wire);
  Object.assign(B9, { MODES, run, paintResults });
})();
