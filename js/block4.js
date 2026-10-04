/* CladisticsPro — morphological cladistics in the browser.
   Copyright (C) 2026  Luis Ángel Barrera-Guzmán

   This program is free software: you can redistribute it and/or modify it under
   the terms of the GNU General Public License as published by the Free Software
   Foundation, either version 3 of the License, or (at your option) any later
   version. It is distributed in the hope that it will be useful, but WITHOUT ANY
   WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
   A PARTICULAR PURPOSE. See the GNU General Public License, in the file LICENSE
   at the root of this program, or <https://www.gnu.org/licenses/>. */

/* CladisticsPro — Block 4, weighting characters.

   Implied weights (Goloboff 1993) and their extended version for missing
   entries (Goloboff 2014) change the criterion of the search; successive
   weighting (Farris 1969) repeats it with weights taken from the fit of every
   character; the sensitivity analysis runs implied weights over several
   values of k and measures which result agrees most with the others (Mirande
   2009). The searches use the method and parameters chosen in Block 3. */
(function () {
  const B4 = {};
  window.Block4 = B4;
  const $ = id => document.getElementById(id);
  const SCHEMES = [
    { id: 'iw', es: 'Pesos implícitos', en: 'Implied weights', d: ['Busca el árbol con menos homoplasia ponderada: Σ h/(h + k)', 'Searches for the tree with the least weighted homoplasy: Σ h/(h + k)'] },
    { id: 'eiw', es: 'Implícitos extendidos', en: 'Extended implied', d: ['Como los implícitos, sin premiar a los caracteres con muchos «?»', 'Like implied weights, without rewarding characters with many «?»'] },
    { id: 'sw', es: 'Pesos sucesivos', en: 'Successive weighting', d: ['Repite la búsqueda pesando cada carácter por su ajuste', 'Repeats the search weighting each character by its fit'] },
    { id: 'sens', es: 'Sensibilidad a k', en: 'Sensitivity to k', d: ['Pesos implícitos con varios k: qué clados resisten', 'Implied weights with several k: which clades hold'] },
  ];
  let scheme = 'iw';

  function paintSchemes() {
    $('b4Schemes').innerHTML = SCHEMES.map(x => `<button type="button" class="design-tile${x.id === scheme ? ' on' : ''}" data-s="${x.id}" aria-pressed="${x.id === scheme}"><b>${L2(x.es, x.en)}</b><small>${L2(x.d[0], x.d[1])}</small></button>`).join('');
    /* each field says for which schemes it is shown */
    document.querySelectorAll('#b4Scheme [data-show]').forEach(f => { f.hidden = !f.dataset.show.split(' ').includes(scheme); });
    paintCurve();
  }
  const kVal = () => Math.max(0.1, Math.min(1000, +$('b4K').value || 3));
  function prepFor(k, crit) {
    return Object.assign(Block3.prepOpts(), { criterion: crit, k, eiwRatio: Math.max(0.01, Math.min(1, +$('b4R').value || 0.5)), eiwMax: Math.max(1, +$('b4M').value || 5) });
  }

  /* the curve of weights: k/(k + h) for the chosen k, with the characters on it */
  function curveSVG(k, pts, opts) {
    opts = opts || {};
    const W = 460, H = 250, l = 54, r = 16, t = 18, b = 44, hMax = Math.max(8, ...(pts || []).map(p => p.h));
    const X = h => l + h / hMax * (W - l - r), Y = w => t + (1 - w) * (H - t - b);
    let s = `<svg viewBox="0 0 ${W} ${H}" class="b3-chart" role="img" data-plot="weights" aria-label="${esc(T('Peso implícito según la homoplasia', 'Implied weight by homoplasy'))}">`;
    [0, 0.25, 0.5, 0.75, 1].forEach(v => { s += `<line x1="${l}" x2="${W - r}" y1="${Y(v)}" y2="${Y(v)}" class="b3-grid" data-role="grid"/><text x="${l - 6}" y="${Y(v) + 3.5}" text-anchor="end" class="art-mut" font-size="12" data-role="ytick">${v}</text>`; });
    for (let h = 0; h <= hMax; h += Math.max(1, Math.round(hMax / 8))) s += `<text x="${X(h)}" y="${H - b + 16}" text-anchor="middle" class="art-mut" font-size="12" data-role="xtick">${h}</text>`;
    const ks = opts.ks || [k];
    ks.forEach((kk, i) => {
      const p = [];
      for (let h = 0; h <= hMax; h += hMax / 80) p.push(X(h).toFixed(1) + ',' + Y(kk / (kk + h)).toFixed(1));
      s += `<polyline points="${p.join(' ')}" fill="none" stroke="var(--c${(i % 8) + 1})" stroke-width="${ks.length > 1 ? 1.6 : 2.2}"/>`;
      if (ks.length > 1) s += `<text x="${W - r - 2}" y="${(Y(kk / (kk + hMax)) - 3).toFixed(1)}" text-anchor="end" class="art-mut" font-size="11">k=${kk}</text>`;
    });
    (pts || []).forEach(p => { s += `<circle cx="${X(p.h).toFixed(1)}" cy="${Y(p.w).toFixed(1)}" r="3.6" fill="var(--accent)" opacity=".8"><title>${esc(p.label)}</title></circle>`; });
    s += `<text x="${(l + W - r) / 2}" y="${H - 6}" text-anchor="middle" class="art-mut" font-size="13" data-role="xlab">${T('pasos extra (homoplasia, h)', 'extra steps (homoplasy, h)')}</text>`;
    s += `<text x="16" y="${(t + H - b) / 2}" text-anchor="middle" class="art-mut" font-size="13" transform="rotate(-90 16 ${(t + H - b) / 2})" data-role="ylab">${T('peso implícito', 'implied weight')}</text>`;
    return s + '</svg>';
  }
  function paintCurve() {
    if (!$('b4Curve')) return;
    const k = kVal();
    $('b4Curve').innerHTML = curveSVG(k, null, { ks: scheme === 'sens' ? parseKs() : [k] });
    $('b4CurveNote').innerHTML = scheme === 'sens' ? T('Las curvas de los k que se van a probar.', 'The curves of the k values to be tried.') :
      T(`Con k = ${fmtNum(k, 2)}, un carácter con 1 paso extra pesa ${fmtNum(k / (k + 1), 3)}, con 5 pesa ${fmtNum(k / (k + 5), 3)}. Un k pequeño castiga mucho la homoplasia; un k grande se parece a los pesos iguales.`,
        `With k = ${fmtNum(k, 2)}, a character with 1 extra step weighs ${fmtNum(k / (k + 1), 3)}, with 5 it weighs ${fmtNum(k / (k + 5), 3)}. A small k punishes homoplasy hard; a large k resembles equal weights.`);
  }
  const listKs = (ks, and) => (ks.length < 2 ? String(ks[0]) : ks.slice(0, -1).join(', ') + ' ' + and + ' ' + ks[ks.length - 1]);
  function parseKs() {
    const v = String($('b4Ks').value || '').split(/[\s,;]+/).map(Number).filter(x => x > 0 && x <= 1000);
    return [...new Set(v)].sort((a, b) => a - b).slice(0, 20);
  }

  /* per character: steps, homoplasy, implied weight and fit on the first tree */
  function charTable(res, prep) {
    const m = state.matrix;
    const P = Engine.prepare(m, prep);
    const t0 = res.trees[0];
    return P.chars.map(rec => {
      const s = t0.byChar[rec.j];
      const h = Math.max(0, s - P.minSteps[rec.q]);
      let w = null, d = null;
      if (P.iw) { const k = P.iw.kc[rec.q]; w = P.iw.phi[rec.q] * k / (k + h); d = Engine.distortion(P, rec.q, s); }
      return { j: rec.j, name: m.chars[rec.j].name || '—', steps: s, min: P.minSteps[rec.q], h, w, d, f: rec.f || 1, missing: rec.missing, ci: s > 0 ? P.minSteps[rec.q] / s : null };
    });
  }
  /* shared clades between two trees (rooted the same way) */
  function similarity(a, b, n) {
    const A = new Set(Tree.clades(a, n).keys()), B = new Set(Tree.clades(b, n).keys());
    A.delete('1'.repeat(n)); B.delete('1'.repeat(n));
    let s = 0; A.forEach(k => { if (B.has(k)) s++; });
    return A.size + B.size ? 2 * s / (A.size + B.size) : 1;
  }

  /* ---------------- running ---------------- */
  async function run() {
    if (!state.matrix) return;
    clearMessages('b4Msg');
    try {
      if (scheme === 'iw' || scheme === 'eiw') {
        const prep = prepFor(kVal(), scheme);
        const r = await Block3.run(prep, Block3.searchOpts(), scheme === 'iw' ? T('Búsqueda con pesos implícitos', 'Search under implied weights') : T('Búsqueda con pesos implícitos extendidos', 'Search under extended implied weights'));
        if (!r) return;
        r.table = charTable(r, prep);
        state.weights = { scheme, k: kVal(), result: r };
      } else if (scheme === 'sw') {
        const prep = Object.assign(Block3.prepOpts(), { criterion: 'ew' });
        const sw = { index: $('b4SwIndex').value, base: +$('b4SwBase').value || 10, how: $('b4SwHow').value, maxIter: 10 };
        let job = null;
        const r = await LABG.work.run({ title: T('Pesos sucesivos', 'Successive weighting'), cancel: () => job && job.cancel(), delay: 300 }, async w => {
          w.update(0.05, T('Buscando y reponderando…', 'Searching and reweighting…'));
          job = Pool.runOne({ task: 'successive', matrix: state.matrix, prep, opts: Block3.searchOpts(), sw, maxTime: Block3.maxTime() }, d => w.update(Math.max(0.05, Math.min(0.9, d.f || 0)), T('Buscando…', 'Searching…')));
          const res = await job;
          await LABG.nextPaint();
          return Block3.processAsync(res, Object.assign({}, prep, { weights: res.weights }), Block3.searchOpts(), (d, t) => w.update(0.9 + 0.09 * d / Math.max(1, t), T(`Colapsando ramas y calculando índices… (${d} de ${t} árboles)`, `Collapsing branches and computing indices… (${d} of ${t} trees)`)));
        });
        if (!r) return;
        r.table = charTable(r, Object.assign({}, prep, { weights: r.weights }));
        r.table.forEach(row => { row.sw = r.weights[row.j]; });
        /* the length of the first tree without weights, to compare with Block 3 */
        const P1 = Engine.prepare(state.matrix, prep);
        r.unweighted = Engine.length(P1, Engine.fromNodeTree(P1, Tree.parseNewick(r.trees[0].newick, P1.names)));
        state.weights = { scheme, result: r, sw };
      } else {
        const ks = parseKs();
        if (!ks.length) { showMessage('b4Msg', 'warning', T('Escribe al menos un valor de k.', 'Type at least one value of k.')); return; }
        const crit = $('b4SensEiw').checked ? 'eiw' : 'iw';
        let job = null;
        const runs = await LABG.work.run({ title: T('Sensibilidad a k', 'Sensitivity to k'), cancel: () => job && job.cancel(), delay: 300 }, async w => {
          const out = [];
          for (let i = 0; i < ks.length; i++) {
            const k = ks[i];
            w.update(i / ks.length, T(`k = ${k} (${i + 1} de ${ks.length})`, `k = ${k} (${i + 1} of ${ks.length})`));
            job = Pool.search({ matrix: state.matrix, prep: prepFor(k, crit), opts: Block3.searchOpts(), maxTime: Block3.maxTime() }, d => w.update((i + (d.f || 0)) / ks.length));
            const res = await job;
            out.push(Object.assign(await Block3.processAsync(res, prepFor(k, crit), Block3.searchOpts()), { k }));
            await LABG.nextPaint();
          }
          return out;
        });
        if (!runs) return;
        const n = runs[0].taxa.length;
        runs.forEach((a, i) => { a.sim = runs.reduce((s, b, j) => s + (i === j ? 0 : similarity(a.strict, b.strict, n)), 0) / Math.max(1, runs.length - 1); });
        const bestSim = Math.max(...runs.map(x => x.sim));
        /* several k can tie (identical results): all of them are reported, the first is shown */
        const tied = runs.filter(x => Math.abs(x.sim - bestSim) < 1e-9).map(x => x.k);
        state.weights = { scheme, runs, crit, recommended: tied[0], tied };
      }
      ['clado', 'diag', 'support', 'consensus', 'hypotheses'].forEach(k2 => { state[k2] = null; });
      enableStep(4, true);
      document.dispatchEvent(new CustomEvent('searchdone', { detail: { block: 4 } }));
      paintResults();
    } catch (e) {
      if (!/cancel/i.test(e.message || '')) showMessage('b4Msg', 'error', T('El análisis falló: ', 'The analysis failed: ') + esc(e.message || String(e)));
    }
  }

  /* ---------------- results ---------------- */
  let sel = 'strict';
  function paintResults() {
    const W = state.weights;
    $('b4Results').hidden = !W;
    if (!W) return;
    $('b4ResSingle').hidden = W.scheme === 'sens';
    $('b4ResSens').hidden = W.scheme !== 'sens';
    if (W.scheme === 'sens') { paintSens(W); return; }
    const r = W.result, t0 = r.trees[0];
    const ew = state.search;
    const comp = ew && ew.strict ? similarity(r.strict, ew.strict, r.taxa.length) : null;
    const tiles = [
      [T('Longitud', 'Length'), fmtNum(t0.length, 3), W.scheme === 'sw' ? T('pasos con los pesos finales', 'steps under the final weights') : T('pasos de estos árboles, sin pesos', 'steps of these trees, unweighted')],
      [T('Árboles', 'Trees'), String(r.trees.length), r.collapse ? (r.condensed.length === 1 ? T('1 distinto al colapsar', '1 distinct after collapsing') : T(`${r.condensed.length} distintos al colapsar`, `${r.condensed.length} distinct after collapsing`)) : ''],
    ];
    if (W.scheme !== 'sw') {
      tiles.unshift([T('Homoplasia ponderada', 'Weighted homoplasy'), fmtNum(r.score, 4), T('Σ h/(h + k): lo que se minimiza', 'Σ h/(h + k): what is minimized')]);
      tiles.push(['k', fmtNum(W.k, 3), W.scheme === 'eiw' ? T('de referencia; cada carácter con «?» lleva el suyo', 'reference; each character with «?» has its own') : T('constante de concavidad', 'concavity constant')]);
    } else {
      tiles.splice(1, 0, [T('Longitud sin pesos', 'Unweighted length'), r.unweighted == null ? '—' : fmtNum(r.unweighted, 3), T('del primer árbol, comparable con el Bloque 3', 'of the first tree, comparable with Block 3')]);
      tiles.push([T('Iteraciones', 'Iterations'), String(r.log.length), r.log.length && r.log[r.log.length - 1].changed === 0 ? T('los pesos se estabilizaron', 'the weights settled') : T('se detuvo sin estabilizarse', 'stopped without settling'), r.log.length && r.log[r.log.length - 1].changed === 0 ? 'ok' : 'warn']);
    }
    tiles.push([T('Frente a pesos iguales', 'Against equal weights'), comp == null ? '—' : fmtPct(comp, 0), comp == null ? T('corre el Bloque 3 para comparar', 'run Block 3 to compare') : T('clados compartidos entre los consensos estrictos', 'clades shared between the strict consensus trees')]);
    statTiles('b4Tiles', tiles);
    /* curve with the characters */
    if (W.scheme !== 'sw') {
      $('b4ResCurve').innerHTML = curveSVG(W.k, r.table.filter(x => x.w != null).map(x => ({ h: x.h, w: x.w, label: (x.j + 1) + '. ' + x.name })));
      $('b4ResCurveBox').hidden = false;
    } else $('b4ResCurveBox').hidden = true;
    /* without the curve, the tree takes the whole width */
    $('b4ResCurveBox').parentElement.classList.toggle('one', W.scheme === 'sw');
    /* table of characters */
    const rows = r.table.slice().sort((a, b) => (W.scheme === 'sw' ? a.sw - b.sw : (a.w == null ? 1 : a.w) - (b.w == null ? 1 : b.w)));
    const cols = [
      { key: 'n', label: '#', num: true, get: x => x.j + 1 },
      { key: 'name', label: T('Carácter', 'Character') },
      { key: 'steps', label: T('Pasos', 'Steps'), num: true, get: x => fmtNum(x.steps, 3) },
      { key: 'h', label: T('Extra (h)', 'Extra (h)'), num: true, get: x => fmtNum(x.h, 3) },
      { key: 'ci', label: 'CI', num: true, get: x => fmtIdx(x.ci) },
    ];
    if (W.scheme === 'sw') cols.push({ key: 'sw', label: T('Peso final', 'Final weight'), num: true });
    else {
      cols.push({ key: 'w', label: T('Peso implícito', 'Implied weight'), num: true, get: x => fmtIdx(x.w) });
      if (W.scheme === 'eiw') { cols.push({ key: 'missing', label: T('Faltantes', 'Missing'), num: true }); cols.push({ key: 'f', label: 'f', num: true, get: x => fmtNum(x.f, 3) }); }
    }
    buildTable('b4Table', cols, rows, { limit: 400 });
    /* successive weighting log */
    $('b4LogBox').hidden = W.scheme !== 'sw';
    if (W.scheme === 'sw') buildTable('b4Log', [
      { key: 'iteration', label: T('Iteración', 'Iteration'), num: true },
      { key: 'length', label: T('Longitud ponderada', 'Weighted length'), num: true, get: x => fmtNum(x.length, 3) },
      { key: 'trees', label: T('Árboles', 'Trees'), num: true },
      { key: 'changed', label: T('Pesos que cambiaron', 'Weights changed'), num: true },
    ], r.log);
    $('b4TreeSel').innerHTML = `<option value="strict">${T('Consenso estricto', 'Strict consensus')} (${r.condensed.length})</option>` + r.trees.slice(0, 300).map((t, i) => `<option value="${i}">${T('Árbol ', 'Tree ')}${i + 1}</option>`).join('');
    $('b4TreeSel').value = r.trees[+sel] || sel === 'strict' ? sel : 'strict';
    paintTree();
  }
  function paintTree() {
    const r = state.weights && state.weights.result; if (!r) return;
    const s = $('b4TreeSel').value;
    const root = s === 'strict' ? r.strict : r.trees[+s].root;
    $('b4Tree').innerHTML = Block3.treeSVG(root, { title: s === 'strict' ? T('Consenso estricto', 'Strict consensus') : T('Árbol ', 'Tree ') + (+s + 1) });
  }
  function paintSens(W) {
    const runs = W.runs, n = runs[0].taxa.length;
    buildTable('b4SensTable', [
      { key: 'k', label: 'k', num: true },
      { key: 'score', label: T('Homoplasia ponderada', 'Weighted homoplasy'), num: true, get: x => fmtNum(x.score, 4) },
      { key: 'len', label: T('Longitud', 'Length'), num: true, get: x => fmtNum(x.trees[0].length, 3) },
      { key: 'nt', label: T('Árboles', 'Trees'), num: true, get: x => x.condensed.length },
      { key: 'cl', label: T('Clados en el consenso', 'Clades in the consensus'), num: true, get: x => Math.max(0, Tree.clades(x.strict, n).size - 1) },
      { key: 'sim', label: T('Similitud media con los demás k', 'Mean similarity with the other k'), num: true, get: x => fmtPct(x.sim, 0) },
    ], runs.map(x => Object.assign({ _class: (W.tied || [W.recommended]).includes(x.k) ? 'b4-best' : '' }, x)));
    const tied = W.tied || [W.recommended];
    $('b4SensNote').innerHTML = tied.length > 1
      ? T(`Los resultados con <b>k = ${listKs(tied, 'y')}</b> son igual de parecidos a los demás (criterio de Mirande 2009): con ellos el consenso estricto es el mismo. Se muestra el de k = ${tied[0]}. Los clados que aparecen con todos los k no dependen de la elección de k.`,
        `The results with <b>k = ${listKs(tied, 'and')}</b> are equally similar to the others (Mirande 2009 criterion): their strict consensus is the same. The one with k = ${tied[0]} is shown. Clades present under every k do not depend on the choice of k.`)
      : T(`El resultado más parecido a los demás es el de <b>k = ${W.recommended}</b> (criterio de Mirande 2009). Los clados que aparecen con todos los k no dependen de la elección de k.`,
        `The result most similar to the others is that of <b>k = ${W.recommended}</b> (Mirande 2009 criterion). Clades present under every k do not depend on the choice of k.`);
    /* clades × k */
    const all = new Map();
    runs.forEach((x, i) => Tree.clades(x.strict, n).forEach((v, key) => { if (key.indexOf('0') < 0) return; if (!all.has(key)) all.set(key, new Set()); all.get(key).add(i); }));
    const clades = [...all.entries()].sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0])).slice(0, 60);
    const names = runs[0].taxa;
    const label = key => { const t = []; for (let i = 0; i < n; i++) if (key[i] === '1') t.push(names[i]); return t.length <= 3 ? t.join(', ') : t.slice(0, 2).join(', ') + T(` y ${t.length - 2} más`, ` and ${t.length - 2} more`); };
    let h = `<table class="b4-heat"><thead><tr><th scope="col">${T('Clado', 'Clade')}</th>${runs.map(x => `<th scope="col" class="num">k=${x.k}</th>`).join('')}<th scope="col" class="num">${T('Con todos', 'In all')}</th></tr></thead><tbody>`;
    clades.forEach(([key, set]) => {
      h += `<tr><td>${esc(label(key))}</td>${runs.map((x, i) => `<td class="c ${set.has(i) ? 'in' : 'out'}" aria-label="${set.has(i) ? T('presente', 'present') : T('ausente', 'absent')}">${set.has(i) ? '●' : '·'}</td>`).join('')}<td class="num">${set.size === runs.length ? '✓' : ''}</td></tr>`;
    });
    $('b4Heat').innerHTML = h + '</tbody></table>';
    const rec = runs.find(x => x.k === W.recommended);
    $('b4SensTree').innerHTML = Block3.treeSVG(rec.strict, { title: T(`Consenso estricto con k = ${rec.k}`, `Strict consensus with k = ${rec.k}`) });
  }
  function exportTrees() {
    const W = state.weights; if (!W) return;
    const base = slug(state.matrix.title || 'matriz');
    if (W.scheme === 'sens') download(W.runs.map(x => `[k=${x.k}] ` + Tree.toNewick(x.strict)).join('\n') + '\n', base + '_sensibilidad_k.nwk');
    else download(W.result.trees.map(t => t.newick).join('\n') + '\n', base + '_pesos_' + W.scheme + '.nwk');
  }

  /* ---------------- wiring ---------------- */
  function onMatrix() {
    const has = !!state.matrix;
    $('b4NoData').hidden = has; $('b4Work').hidden = !has;
    if (has) paintResults();
  }
  function wire() {
    if (!$('panel-4')) return;
    paintSchemes();
    $('b4Schemes').addEventListener('click', e => { const b = e.target.closest('[data-s]'); if (!b) return; scheme = b.dataset.s; paintSchemes(); });
    ['b4K', 'b4Ks'].forEach(id => $(id).addEventListener('input', paintCurve));
    $('b4Run').addEventListener('click', run);
    $('b4TreeSel').addEventListener('change', e => { sel = e.target.value; paintTree(); });
    $('b4Export').addEventListener('click', exportTrees);
    $('b4GoMatrix').addEventListener('click', () => goStep(2));
    document.addEventListener('matrixchange', onMatrix);
    document.addEventListener('stepchange', e => { if (e.detail.step === 4) onMatrix(); });
    document.addEventListener('langchange', () => { paintSchemes(); if (state.matrix) paintResults(); });
    onMatrix();
  }
  document.addEventListener('DOMContentLoaded', wire);
  Object.assign(B4, { paintResults, similarity, charTable, SCHEMES });
})();
