/* CladisticsPro — morphological cladistics in the browser.
   Copyright (C) 2026  Luis Ángel Barrera-Guzmán

   This program is free software: you can redistribute it and/or modify it under
   the terms of the GNU General Public License as published by the Free Software
   Foundation, either version 3 of the License, or (at your option) any later
   version. It is distributed in the hope that it will be useful, but WITHOUT ANY
   WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
   A PARTICULAR PURPOSE. See the GNU General Public License, in the file LICENSE
   at the root of this program, or <https://www.gnu.org/licenses/>. */

/* CladisticsPro — Block 3, the search for the shortest trees.

   Says what the search will read (and how it reads «–» and continuous
   characters), offers the methods with their parameters and the constraints,
   runs the search in background threads, and reports the trees: their
   length and indices, how many replicates reached the best length, the trees
   with the branches that can be zero collapsed, their strict consensus, and
   the files. Block 4 reuses this machinery with other criteria. */
(function () {
  const B3 = { constraints: [] };
  window.Block3 = B3;
  const $ = id => document.getElementById(id);
  const METHODS = [
    { id: 'auto', es: 'Automático', en: 'Automatic', d: ['Exacta hasta 12 taxones; si no, ratchet o la combinada', 'Exact up to 12 taxa; otherwise ratchet or combined'] },
    { id: 'exact', es: 'Exacta', en: 'Exact', d: ['Rama y cota: garantiza todos los árboles más cortos', 'Branch and bound: guarantees every shortest tree'] },
    { id: 'heuristic', es: 'Heurística', en: 'Heuristic', d: ['Adición de Wagner al azar + TBR, varias réplicas', 'Random Wagner addition + TBR, several replicates'] },
    { id: 'ratchet', es: 'Ratchet', en: 'Ratchet', d: ['Cada réplica sigue con ciclos de reponderación', 'Each replicate continues with reweighting cycles'] },
    { id: 'combined', es: 'Combinada', en: 'Combined', d: ['Ratchet + búsqueda sectorial + deriva + fusión de árboles', 'Ratchet + sectorial search + drift + tree fusing'] },
  ];
  let method = 'auto';

  /* ---------------- what is analysed ---------------- */
  function hasGaps(m) { return m.cells.some(r => r.some(c => c === Mx.GAP)); }
  function hasCont(m) { return m.chars.some(c => c.type === 'cont' && c.active !== false); }
  B3.prepOpts = function () {
    const m = state.matrix;
    return {
      inapplicable: hasGaps(m) && $('b3Inap') && $('b3Inap').value === 'algorithm' ? 'algorithm' : 'missing',
      continuous: hasCont(m) ? ($('b3Cont') ? $('b3Cont').value : 'scaled') : 'off',
      constraints: B3.constraints.filter(c => c.on !== false).map(c => ({ taxa: c.taxa.map(i => activeIndex(i)).filter(q => q >= 0), positive: c.positive })),
    };
  };
  function activeIndex(i) { let q = -1; for (let t = 0; t <= i; t++) if (state.matrix.taxa[t].active !== false) q++; return state.matrix.taxa[i].active === false ? -1 : q; }
  function paintData() {
    const m = state.matrix;
    if (!m) return;
    let P;
    try { P = Engine.prepare(m, B3.prepOpts()); } catch (e) { $('b3DataTiles').innerHTML = ''; showMessage('b3Msg', 'error', esc(e.message)); return; }
    const fast = P.chars.filter(c => c.path === 'fast').length, cont = P.chars.filter(c => c.path === 'cont').length, slow = P.chars.filter(c => c.path === 'slow').length;
    const inform = m.chars.filter((c, j) => c.active !== false && Mx.informative(m, j)).length;
    statTiles('b3DataTiles', [
      [T('Taxones', 'Taxa'), String(P.n), P.n < m.taxa.length ? T(`${m.taxa.length - P.n} inactivos fuera`, `${m.taxa.length - P.n} inactive left out`) : T('todos activos', 'all active')],
      [T('Caracteres', 'Characters'), String(P.nq), T(`${fast} rápidos · ${cont} continuos · ${slow} uno por uno`, `${fast} fast · ${cont} continuous · ${slow} one by one`)],
      [T('Informativos', 'Informative'), String(inform), T('los que pueden elegir árbol', 'those that can choose a tree'), inform ? null : 'bad'],
      [T('Árboles posibles', 'Possible trees'), treesPossible(P.n), T('sin raíz, (2n − 5)!!', 'unrooted, (2n − 5)!!')],
      [T('Grupo externo', 'Outgroup'), P.outgroup.map(q => esc(P.names[q])).slice(0, 2).join(', '), T('enraíza los árboles', 'roots the trees')],
    ]);
    $('b3InapRow').hidden = !hasGaps(m);
    $('b3ContRow').hidden = !hasCont(m);
    paintHint();
  }
  function treesPossible(n) {
    let lg = 0; for (let k = 3; k <= 2 * n - 5; k += 2) lg += Math.log10(k);
    return lg < 7 ? Math.round(Math.pow(10, lg)).toLocaleString('en-US') : '10^' + lg.toFixed(1);
  }
  function chosenMethod() {
    if (method !== 'auto') return method;
    const n = state.matrix.taxa.filter(t => t.active !== false).length;
    return n <= 12 ? 'exact' : n <= 60 ? 'ratchet' : 'combined';
  }
  function paintHint() {
    const n = state.matrix.taxa.filter(t => t.active !== false).length;
    const mm = chosenMethod();
    let h = '';
    if (mm === 'exact') h = n > 14 ? T(`Con ${n} taxones la búsqueda exacta puede tardar horas o no terminar: conviene la heurística.`, `With ${n} taxa the exact search may take hours or not finish: the heuristic is advisable.`) : T(`Con ${n} taxones la búsqueda exacta es viable y garantiza el resultado.`, `With ${n} taxa the exact search is feasible and guarantees the result.`);
    else h = T('Una búsqueda heurística no garantiza el óptimo: lo que da confianza es que muchas réplicas lleguen a la misma longitud (columna «réplicas que llegaron»).', 'A heuristic search does not guarantee the optimum: what gives confidence is that many replicates reach the same length (the «replicates that reached it» figure).');
    $('b3Hint').innerHTML = (method === 'auto' ? `<b>${T('Elegido: ', 'Chosen: ')}${esc(T(METHODS.find(x => x.id === mm).es, METHODS.find(x => x.id === mm).en))}.</b> ` : '') + h;
    ['b3RepsF', 'b3RatchF', 'b3FracF'].forEach(id => { $(id).hidden = mm === 'exact'; });
    $('b3RatchF').hidden = $('b3FracF').hidden = !(mm === 'ratchet' || mm === 'combined');
  }
  function paintMethods() {
    $('b3Methods').innerHTML = METHODS.map(x => `<button type="button" class="design-tile${x.id === method ? ' on' : ''}" data-m="${x.id}" aria-pressed="${x.id === method}"><b>${L2(x.es, x.en)}</b><small>${L2(x.d[0], x.d[1])}</small></button>`).join('');
  }

  /* ---------------- constraints ---------------- */
  function paintConstraints() {
    const m = state.matrix;
    const list = $('b3ConsList');
    if (!B3.constraints.length) list.innerHTML = `<p class="hint">${T('Sin restricciones: la búsqueda explora todos los árboles.', 'No constraints: the search explores every tree.')}</p>`;
    else list.innerHTML = B3.constraints.map((c, k) => `<div class="b3-cons"><label class="checkbox-label"><input type="checkbox" data-on="${k}"${c.on !== false ? ' checked' : ''}> <b>${esc(c.name)}</b></label>
      <span class="badge ${c.positive ? 'ok' : 'warn'}">${c.positive ? T('debe ser monofilético', 'must be monophyletic') : T('no debe ser monofilético', 'must not be monophyletic')}</span>
      <span class="hint">${c.taxa.map(i => esc(m.taxa[i] ? m.taxa[i].name : '?')).join(', ')}</span>
      <button type="button" class="btn btn-ghost btn-sm" data-del="${k}">${T('Quitar', 'Remove')}</button></div>`).join('');
    $('b3ConsTaxa').innerHTML = m.taxa.map((t, i) => (t.active === false ? '' : `<label class="checkbox-label b3-tx"><input type="checkbox" value="${i}"> ${esc(t.name)}</label>`)).join('');
  }
  function addConstraint() {
    const sel = [...$('b3ConsTaxa').querySelectorAll('input:checked')].map(x => +x.value);
    const n = state.matrix.taxa.filter(t => t.active !== false).length;
    if (sel.length < 2 || sel.length > n - 2) { LABG && LABG.toast(T('Un grupo necesita al menos 2 taxones y dejar fuera al menos 2.', 'A group needs at least 2 taxa and must leave at least 2 out.')); return; }
    B3.constraints.push({ name: $('b3ConsName').value.trim() || T('Grupo ', 'Group ') + (B3.constraints.length + 1), positive: $('b3ConsType').value === 'pos', taxa: sel, on: true });
    $('b3ConsName').value = '';
    paintConstraints(); paintData();
  }

  /* ---------------- running ---------------- */
  B3.searchOpts = function () {
    const mm = chosenMethod();
    return {
      method: mm,
      replicates: Math.max(1, Math.min(1000, +$('b3Reps').value || 10)),
      ratchetIterations: Math.max(1, Math.min(2000, +$('b3Ratch').value || 30)),
      ratchetFraction: Math.max(0.05, Math.min(0.6, (+$('b3Frac').value || 25) / 100)),
      maxTrees: Math.max(1, Math.min(10000, +$('b3MaxTrees').value || 100)),
      seed: Math.max(1, Math.round(+$('b3Seed').value || 1)),
    };
  };
  B3.maxTime = () => Math.max(5, +$('b3MaxTime').value || 600) * 1000;
  /* runs a search (Block 3 or 4) with the waiting window; resolves to the processed result */
  B3.run = function (prep, opts, title) {
    const m = state.matrix;
    const payload = { matrix: m, prep, opts, maxTime: B3.maxTime() };
    let job = null;
    return LABG.work.run({ title, cancel: () => job && job.cancel(), delay: 300 }, async w => {
      w.update(0.02, T('Preparando…', 'Preparing…'));
      job = Pool.search(payload, d => w.update(Math.max(0.03, (d.f || 0) * 0.85), d.best != null && isFinite(d.best) ? T('Mejor hasta ahora: ', 'Best so far: ') + fmtNum(d.best, 3) : T('Buscando…', 'Searching…')));
      w.update(0.03, T('Buscando…', 'Searching…'));
      const res = await job;
      return B3.processAsync(res, prep, opts, (done, total) => w.update(0.85 + 0.14 * done / Math.max(1, total),
        T(`Colapsando ramas y calculando índices… (${done} de ${total} árboles)`, `Collapsing branches and computing indices… (${done} of ${total} trees)`)));
    });
  };
  /* trees rooted on the outgroup, indices, collapsed trees and consensus. The
     same work, all at once (process) or by batches that let the waiting window
     show how far it is (processAsync, with tick(done, total)) */
  function procStart(res, prep) {
    const m = state.matrix;
    const A = Mx.toAnalysis(m);
    /* the indices with the same reading of «–» and continuous characters as the search (the cladogram of Block 5 gives the same) */
    return { m, A, MP: Mapping.prepare(m, prep || {}), n: A.taxa.length, collapse: $('b3Collapse') ? $('b3Collapse').value === 'rule1' : true, trees: [], seen: new Map() };
  }
  function procTree(S, t) {
    let root = Tree.parseNewick(t.newick, S.A.taxa);
    root = Tree.ladderize(Tree.rootOn(root, S.A.outgroup.length ? S.A.outgroup : [0]).root);
    const an = Mapping.map(S.MP, root, { indicesOnly: true });
    const tr = Object.assign({}, t, { root, ci: an.ci, ri: an.ri, rc: an.rc });
    S.trees.push(tr);
    if (S.collapse) { const c = Tree.ladderize(Opt.collapse(root, S.A)); const k = Tree.cladeKey(c, S.n); if (!S.seen.has(k)) S.seen.set(k, c); }
  }
  function procEnd(S, res, prep, opts) {
    const condensed = S.collapse ? [...S.seen.values()] : S.trees.map(t => t.root);
    const strict = Tree.ladderize(Tree.consensus(condensed, S.n, S.A.taxa, 1));
    return Object.assign({}, res, { trees: S.trees, condensed, strict, prep, opts, collapse: S.collapse, taxa: S.A.taxa, outgroup: S.A.outgroup, fingerprint: Mx.fingerprint(S.m), date: new Date().toISOString() });
  }
  B3.process = function (res, prep, opts) {
    const S = procStart(res, prep);
    res.trees.forEach(t => procTree(S, t));
    return procEnd(S, res, prep, opts);
  };
  const paint = () => (window.LABG && LABG.nextPaint ? LABG.nextPaint() : new Promise(r => setTimeout(r, 0)));
  B3.processAsync = async function (res, prep, opts, tick) {
    const S = procStart(res, prep), N = res.trees.length;
    let last = 0;
    if (tick) tick(0, N);
    await paint();
    for (let i = 0; i < N; i++) {
      procTree(S, res.trees[i]);
      /* a paint about every 120 ms */
      if (performance.now() - last > 120 && i < N - 1) { if (tick) tick(i + 1, N); await paint(); last = performance.now(); }
    }
    if (tick) tick(N, N);
    return procEnd(S, res, prep, opts);
  };
  async function runSearch() {
    if (!state.matrix) return;
    clearMessages('b3Msg');
    const prep = Object.assign(B3.prepOpts(), { criterion: 'ew' });
    const opts = B3.searchOpts();
    try {
      const r = await B3.run(prep, opts, T('Buscando los árboles más cortos', 'Searching for the shortest trees'));
      if (!r) return;
      state.search = r;
      ['clado', 'diag', 'support', 'consensus', 'hypotheses'].forEach(k => { state[k] = null; });
      enableStep(3, true);
      document.dispatchEvent(new CustomEvent('searchdone', { detail: { block: 3 } }));
      paintResults();
    } catch (e) {
      if (!/cancel/i.test(e.message || '')) showMessage('b3Msg', 'error', T('La búsqueda falló: ', 'The search failed: ') + esc(e.message || String(e)));
    }
  }

  /* ---------------- results ---------------- */
  B3.historyChart = function (hist, opts) {
    opts = opts || {};
    if (!hist || !hist.length) return '';
    const W = 440, H = 250, l = 58, r = 14, t = 34, b = 42;
    const ys = hist.map(h => h.found).concat(hist.map(h => h.best)).filter(v => v != null && isFinite(v));
    let y0 = Math.min(...ys), y1 = Math.max(...ys);
    if (y1 - y0 < 1e-9) { y0 -= 0.5; y1 += 0.5; }
    const pad = (y1 - y0) * 0.12; y0 -= pad; y1 += pad;
    const X = i => l + (hist.length === 1 ? (W - l - r) / 2 : (i / (hist.length - 1)) * (W - l - r));
    const Y = v => t + (1 - (v - y0) / (y1 - y0)) * (H - t - b);
    let s = `<svg viewBox="0 0 ${W} ${H}" class="b3-chart" role="img" data-plot="convergence" aria-label="${esc(T('Longitud por réplica', 'Length by replicate'))}">`;
    const ticks = 4;
    for (let k = 0; k <= ticks; k++) {
      const v = y0 + (y1 - y0) * k / ticks;
      s += `<line x1="${l}" x2="${W - r}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" class="b3-grid" data-role="grid"/><text x="${l - 6}" y="${(Y(v) + 3.5).toFixed(1)}" text-anchor="end" class="art-mut" font-size="12" data-role="ytick">${fmtNum(v, 2)}</text>`;
    }
    s += `<polyline points="${hist.map((h, i) => X(i).toFixed(1) + ',' + Y(h.best).toFixed(1)).join(' ')}" fill="none" stroke="var(--primary)" stroke-width="2"/>`;
    hist.forEach((h, i) => { if (h.found != null) s += `<circle cx="${X(i).toFixed(1)}" cy="${Y(h.found).toFixed(1)}" r="3.4" fill="${Math.abs(h.found - h.best) < 1e-9 ? 'var(--primary)' : 'var(--accent)'}" opacity=".85"/>`; });
    s += `<text x="${(l + W - r) / 2}" y="${H - 8}" text-anchor="middle" class="art-mut" font-size="13" data-role="xlab">${esc(opts.xlab || T('réplica', 'replicate'))}</text>`;
    s += `<text x="16" y="${(t + H - b) / 2}" text-anchor="middle" class="art-mut" font-size="13" transform="rotate(-90 16 ${(t + H - b) / 2})" data-role="ylab">${esc(opts.ylab || T('longitud', 'length'))}</text>`;
    s += `<g data-role="legend"><g data-li="0"><line x1="${l + 6}" x2="${l + 24}" y1="${t - 18}" y2="${t - 18}" stroke="var(--primary)" stroke-width="2"/><text x="${l + 28}" y="${t - 14}" class="art-mut" font-size="12">${esc(T('mejor hasta ese punto', 'best so far'))}</text></g>`;
    s += `<g data-li="1"><circle cx="${l + 190}" cy="${t - 18}" r="3.6" fill="var(--accent)"/><text x="${l + 198}" y="${t - 14}" class="art-mut" font-size="12">${esc(T('lo que halló cada réplica', 'what each replicate found'))}</text></g></g>`;
    return s + '</svg>';
  };
  B3.treeSVG = function (root, opts) {
    return Clado.render(root, Object.assign({ legend: false, rowH: 22, fontSize: 12, minUnit: 18, maxUnit: 26, ariaLabel: T('Cladograma', 'Cladogram') }, opts || {}));
  };
  let sel = 'strict';
  function paintResults() {
    const r = state.search;
    $('b3Results').hidden = !r;
    if (!r) return;
    const stale = state.matrix && r.fingerprint !== Mx.fingerprint(state.matrix);
    $('b3Stale').hidden = !stale;
    const best = r.trees[0];
    const tileHits = r.hits == null ? [T('Exacta', 'Exact'), r.complete === false ? T('incompleta', 'incomplete') : '✓', r.complete === false ? T('se agotó el tiempo: el resultado no está garantizado', 'time ran out: the result is not guaranteed') : T('rama y cota: no hay árboles más cortos', 'branch and bound: no shorter trees exist'), r.complete === false ? 'warn' : 'ok']
      : [T('Réplicas que llegaron', 'Replicates that reached it'), r.hits + ' / ' + r.reps, r.hits / Math.max(1, r.reps) >= 0.3 ? T('el óptimo se repite: buena señal', 'the optimum repeats: a good sign') : T('pocas réplicas llegaron: conviene buscar más', 'few replicates reached it: search more'), r.hits / Math.max(1, r.reps) >= 0.3 ? 'ok' : 'warn'];
    statTiles('b3Tiles', [
      [T('Longitud', 'Length'), fmtNum(best.length, 3), r.criterion === 'ew' ? T('pasos (ponderados)', 'steps (weighted)') : ''],
      [T('Árboles más cortos', 'Shortest trees'), String(r.trees.length), r.overflow ? T('se llegó al máximo guardado: puede haber más', 'the maximum kept was reached: there may be more') : (r.collapse ? (r.condensed.length === 1 ? T('1 distinto al colapsar ramas de longitud cero', '1 distinct after collapsing zero-length branches') : T(`${r.condensed.length} distintos al colapsar ramas de longitud cero`, `${r.condensed.length} distinct after collapsing zero-length branches`)) : ''), r.overflow ? 'warn' : null],
      ['CI', fmtIdx(best.ci), T('caracteres discretos', 'discrete characters')],
      ['RI', fmtIdx(best.ri), T('caracteres discretos', 'discrete characters')],
      tileHits,
      [T('Tiempo', 'Time'), (r.time / 1000).toFixed(1) + ' s', ((r.threads || 1) === 1 ? T(`1 hilo · semilla ${r.opts.seed}`, `1 thread · seed ${r.opts.seed}`) : T(`${r.threads} hilos · semilla ${r.opts.seed}`, `${r.threads} threads · seed ${r.opts.seed}`))],
    ]);
    $('b3Chart').innerHTML = r.history && r.history.length > 1 ? B3.historyChart(r.history) : `<p class="hint">${T('Una sola corrida: no hay curva que mostrar.', 'A single run: no curve to show.')}</p>`;
    /* the tree list */
    const rows = r.trees.map((t, i) => ({ i: i + 1, len: fmtNum(t.length, 3), ci: fmtIdx(t.ci), ri: fmtIdx(t.ri) }));
    $('b3TreeSel').innerHTML = `<option value="strict">${T('Consenso estricto', 'Strict consensus')} (${r.condensed.length})</option>` + r.trees.slice(0, 500).map((t, i) => `<option value="${i}"${String(i) === sel ? ' selected' : ''}>${T('Árbol ', 'Tree ')}${i + 1} · L ${fmtNum(t.length, 3)}</option>`).join('');
    if (sel !== 'strict' && !r.trees[+sel]) sel = 'strict';
    $('b3TreeSel').value = sel;
    buildTable('b3TreeTable', [
      { key: 'i', label: '#', num: true }, { key: 'len', label: T('Longitud', 'Length'), num: true }, { key: 'ci', label: 'CI', num: true }, { key: 'ri', label: 'RI', num: true },
    ], rows, { limit: 200 });
    paintTree();
  }
  function paintTree() {
    const r = state.search;
    if (!r) return;
    const root = sel === 'strict' ? r.strict : r.trees[+sel].root;
    $('b3Tree').innerHTML = B3.treeSVG(root, { title: sel === 'strict' ? T('Consenso estricto de los árboles más cortos', 'Strict consensus of the shortest trees') : T('Árbol ', 'Tree ') + (+sel + 1) });
  }
  function exportTrees(kind) {
    const r = state.search; if (!r) return;
    const base = slug(state.matrix.title || 'matriz');
    if (kind === 'nwk') download(r.trees.map(t => t.newick).join('\n') + '\n', base + '_arboles.nwk');
    else if (kind === 'collapsed') download(r.condensed.map(t => Tree.toNewick(t)).join('\n') + '\n', base + '_colapsados.nwk');
    else if (kind === 'strict') download(Tree.toNewick(r.strict) + '\n', base + '_estricto.nwk');
    else if (kind === 'nexus') download(MatIO.writeNexus(state.matrix, { trees: r.trees.map((t, i) => ({ name: 'mpt_' + (i + 1), newick: t.newick })).concat([{ name: 'consenso_estricto', newick: Tree.toNewick(r.strict) }]) }), base + '_busqueda.nex');
  }

  /* ---------------- wiring ---------------- */
  function onMatrix() {
    const has = !!state.matrix;
    $('b3NoData').hidden = has; $('b3Work').hidden = !has;
    if (!has) return;
    /* constraints refer to taxa by index: drop those that no longer exist */
    B3.constraints = B3.constraints.filter(c => c.taxa.every(i => state.matrix.taxa[i]));
    paintData(); paintConstraints(); paintResults();
  }
  function paintThreads() {
    const k = Pool.threads();
    $('b3Threads').innerHTML = k === 1 ? T('Las réplicas corren en <b>1</b> hilo de esta computadora. La misma semilla repite el mismo resultado.', 'Replicates run on <b>1</b> thread of this computer. The same seed repeats the same result.')
      : T(`Las réplicas se reparten en <b>${k}</b> hilos de esta computadora. La misma semilla repite el mismo resultado.`, `Replicates are shared among <b>${k}</b> threads of this computer. The same seed repeats the same result.`);
  }
  function wire() {
    if (!$('panel-3')) return;
    paintMethods();
    $('b3Methods').addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (!b) return; method = b.dataset.m; paintMethods(); paintHint(); });
    ['b3Inap', 'b3Cont'].forEach(id => $(id).addEventListener('change', paintData));
    $('b3ConsAdd').addEventListener('click', addConstraint);
    $('b3ConsFilter').addEventListener('input', e => { const q = e.target.value.trim().toLowerCase(); $('b3ConsTaxa').querySelectorAll('label').forEach(l => { l.hidden = q && !l.textContent.toLowerCase().includes(q); }); });
    $('b3ConsList').addEventListener('click', e => { const b = e.target.closest('[data-del]'); if (b) { B3.constraints.splice(+b.dataset.del, 1); paintConstraints(); } });
    $('b3ConsList').addEventListener('change', e => { const c = e.target.closest('[data-on]'); if (c) B3.constraints[+c.dataset.on].on = c.checked; });
    $('b3Run').addEventListener('click', runSearch);
    $('b3TreeSel').addEventListener('change', e => { sel = e.target.value; paintTree(); });
    document.querySelectorAll('#panel-3 [data-exp]').forEach(b => b.addEventListener('click', () => exportTrees(b.dataset.exp)));
    $('b3GoMatrix').addEventListener('click', () => goStep(2));
    paintThreads();
    document.addEventListener('matrixchange', onMatrix);
    document.addEventListener('stepchange', e => { if (e.detail.step === 3) onMatrix(); });
    document.addEventListener('langchange', () => { paintMethods(); paintThreads(); if (state.matrix) { paintData(); paintConstraints(); paintResults(); } });
    onMatrix();
  }
  document.addEventListener('DOMContentLoaded', wire);
  Object.assign(B3, { paintResults, onMatrix, METHODS });
})();
