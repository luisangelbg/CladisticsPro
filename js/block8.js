/* CladisticsPro — morphological cladistics in the browser.
   Copyright (C) 2026  Luis Ángel Barrera-Guzmán

   This program is free software: you can redistribute it and/or modify it under
   the terms of the GNU General Public License as published by the Free Software
   Foundation, either version 3 of the License, or (at your option) any later
   version. It is distributed in the hope that it will be useful, but WITHOUT ANY
   WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
   A PARTICULAR PURPOSE. See the GNU General Public License, in the file LICENSE
   at the root of this program, or <https://www.gnu.org/licenses/>. */

/* CladisticsPro — Block 8: consensus trees and wildcard taxa.

   The trees of one source (Block 3, Block 4 or the matrix file) summarized by
   five consensus methods (tree.js), side by side; and the wildcards: taxa
   whose pruning gives clades back to the strict consensus, found one at a
   time (a reduced consensus), with where each one sits in the trees and the
   characters that pull it to each place.

   state.consensus = { src, method, threshold, tree, wild } */
(function () {
  const B8 = {};
  window.Block8 = B8;
  const $ = el;
  const METHODS = [
    { id: 'strict', es: 'Estricto', en: 'Strict', d: ['Sólo los clados de todos los árboles; en los programas de parsimonia, «de Nelsen»', 'Only the clades of every tree; in parsimony programs, «Nelsen»'] },
    { id: 'majority', es: 'Mayoría', en: 'Majority rule', d: ['Los clados de más de la mitad de los árboles, o del umbral elegido', 'The clades of more than half the trees, or of the chosen threshold'] },
    { id: 'extended', es: 'Mayoría extendida', en: 'Extended majority', d: ['La mayoría y luego, por frecuencia, todo lo que sea compatible', 'The majority, then, by frequency, everything compatible'] },
    { id: 'semistrict', es: 'Semiestricto', en: 'Semistrict', d: ['Los clados que algún árbol tiene y ninguno contradice (Bremer 1990)', 'The clades some tree has and none contradicts (Bremer 1990)'] },
    { id: 'adams', es: 'Adams', en: 'Adams', d: ['Conserva los anidamientos que todos comparten aunque ningún clado sea común (Adams 1972)', 'Keeps the nestings all share even when no clade is common (Adams 1972)'] },
  ];
  let method = 'strict';

  /* ---------------- the trees ---------------- */
  function sources() { return window.Block5 ? Block5.sources().filter(s => ['search', 'collapsed', 'weights', 'file'].includes(s.id)) : []; }
  function current() {
    const srcs = sources();
    const s = srcs.find(x => x.id === $('b8Src').value) || srcs.find(x => x.id === 'collapsed') || srcs[0];
    if (!s) return null;
    const names = state.matrix.taxa.filter(t => t.active !== false).map(t => t.name);
    return { src: s, roots: s.list().map(t => t.root), names, n: names.length };
  }
  /* clades of a tree, without the root and the tips (only the taxa it has count) */
  const cladeCount = (root, n) => { const m = Tree.tips(root).length; return [...Tree.clades(root, n).keys()].filter(k => { let c = 0; for (const ch of k) if (ch === '1') c++; return c >= 2 && c < m; }).length; };
  const presentCount = root => Tree.tips(root).length;
  B8.consensusOf = function (id, roots, n, names, th) {
    let r;
    if (id === 'majority') r = Tree.consensus(roots, n, names, Math.max(0.5, (th || 50) / 100));
    else if (id === 'extended') r = Tree.majorityExtended(roots, n, names);
    else if (id === 'semistrict') r = Tree.semistrict(roots, n, names);
    else if (id === 'adams') r = Tree.adams(roots, n, names);
    else r = Tree.consensus(roots, n, names, 1);
    return Tree.ladderize(r);
  };

  /* ---------------- consensus ---------------- */
  function paintCons() {
    const C = current();
    if (!C) return;
    const th = Math.max(50, Math.min(100, +$('b8Th').value || 50));
    const tree = B8.consensusOf(method, C.roots, C.n, C.names, th);
    const maxC = Math.max(1, C.n - 2);
    const cc = cladeCount(tree, C.n);
    state.consensus = Object.assign(state.consensus || {}, { src: C.src.id, method, threshold: th, tree });
    const m = METHODS.find(x => x.id === method);
    $('b8FigTitle').innerHTML = L2(m.es, m.en) + (method === 'majority' ? ` (${th} %)` : '');
    statTiles('b8Tiles', [
      [T('Árboles', 'Trees'), String(C.roots.length), esc(C.src.label)],
      [T('Clados', 'Clades'), String(cc), T(`de ${maxC} posibles con ${C.n} taxones`, `of ${maxC} possible with ${C.n} taxa`)],
      [T('Resolución', 'Resolution'), fmtPct(cc / maxC, 0), cc === maxC ? T('totalmente resuelto', 'fully resolved') : T('el resto son politomías', 'the rest are polytomies')],
    ]);
    const text = new Map();
    if (method !== 'adams') Tree.postorder(tree).forEach(v => { if (v.children.length && v !== tree && v.freq != null && (method !== 'strict')) text.set(v, String(Math.round(v.freq * 100))); });
    $('b8Tree').innerHTML = Clado.render(tree, { names: v => v.name, nodeText: text, legend: false, rowH: 22, fontSize: 12, minUnit: 30, maxUnit: 44, ariaLabel: T('Árbol de consenso', 'Consensus tree') });
    $('b8Note').innerHTML = method === 'adams' ? T('El consenso de Adams puede mostrar grupos que ningún árbol tiene: no se lee como una hipótesis de clados, sino de anidamientos.', 'The Adams consensus may show groups no tree has: it is not read as a hypothesis of clades but of nestings.')
      : method === 'strict' ? '' : T('Los números son el % de árboles que tienen cada clado.', 'The numbers are the % of trees with each clade.');
    /* every method side by side */
    const rows = METHODS.map(x => { const t = B8.consensusOf(x.id, C.roots, C.n, C.names, th); const k = cladeCount(t, C.n); return { _class: x.id === method ? 'b4-best' : '', m: T(x.es, x.en) + (x.id === 'majority' ? ` (${th} %)` : ''), k, r: fmtPct(k / maxC, 0) }; });
    buildTable('b8Compare', [{ key: 'm', label: T('Consenso', 'Consensus') }, { key: 'k', label: T('Clados', 'Clades'), num: true }, { key: 'r', label: T('Resolución', 'Resolution'), num: true }], rows);
    $('b8ThF').hidden = method !== 'majority';
    enableStep(8, true);
    refreshStepMarks();
  }

  /* ---------------- wildcards ---------------- */
  /* where a taxon sits in a tree: the taxa of its sister group */
  function sisterOf(root, tip) {
    const v = Tree.tips(root).find(t => t.tip === tip);
    if (!v || !v.parent) return [];
    return v.parent.children.filter(c => c !== v).flatMap(c => Tree.tips(c).map(t => t.tip)).sort((a, b) => a - b);
  }
  /* opts.collapse(root): when the trees are collapsed by rule 1, the search
     prunes the binary trees (roots) and collapses them again after each pruning:
     a branch the wildcard's «?» left at zero is no longer zero once it is gone,
     and the collapsed trees, pruned as they were, would never give it back */
  B8.findWildcards = async function (roots, n, names, maxWild, avoid, progress, opts) {
    opts = opts || {};
    const col = opts.collapse || (r => r);
    const strictOf = set => Tree.consensus(set.map(col), n, names, 1);
    const out = [];
    let cur = roots.slice();
    const removed = new Set();
    for (let step = 0; step < maxWild; step++) {
      /* the ranking, fast: on the trees as they are */
      const strict = Tree.consensus(cur, n, names, 1);
      let best = null;
      for (let x = 0; x < n; x++) {
        if (removed.has(x) || avoid.has(x)) continue;
        const pruned = cur.map(r => Tree.prune(r, [x]));
        const gain = cladeCount(Tree.consensus(pruned, n, names, 1), n) - cladeCount(Tree.prune(strict, [x]), n);
        if (!best || gain > best.gain) best = { taxon: x, gain, pruned };
        if (progress && x % 4 === 3) await progress((step + x / n) / maxWild);
      }
      if (!best || best.gain <= 0) break;
      /* what it gives back to the consensus that is shown (collapsed again after pruning) */
      const before = cladeCount(Tree.prune(strictOf(cur), [best.taxon]), n);
      const after = cladeCount(strictOf(best.pruned), n);
      if (opts.collapse && after - before <= 0) break;
      removed.add(best.taxon);
      out.push({ taxon: best.taxon, name: names[best.taxon], gain: opts.collapse ? after - before : best.gain, before, after });
      cur = best.pruned;
    }
    return { wild: out, reduced: Tree.ladderize(strictOf(cur)), removed: [...removed] };
  };
  /* the places of a wildcard in the original trees and the characters that
     pull it to the two most frequent ones */
  function placesOf(x, roots, names) {
    const by = new Map();
    roots.forEach((r, i) => { const s = sisterOf(r, x).join(','); if (!by.has(s)) by.set(s, []); by.get(s).push(i); });
    return [...by.entries()].map(([k, idx]) => ({ sister: k ? k.split(',').map(Number) : [], trees: idx })).sort((a, b) => b.trees.length - a.trees.length);
  }
  function pullOf(x, places, roots) {
    if (places.length < 2 || !state.search) return null;
    const M = Mapping.prepare(state.matrix, state.search.prep || {});
    /* two places, the most frequent possible, such that the tree with the
       first one also has the group of the second (so only the taxon moves) */
    const top = places.slice(0, 6);
    for (const A of top) for (const B of top) {
      if (A === B) continue;
      const tA = Tree.clone(roots[A.trees[0]]);
      const tB = Tree.clone(tA);
      const setB = new Set(B.sister);
      const xn = Tree.tips(tB).find(t => t.tip === x);
      if (!xn) continue;
      const target = Tree.postorder(tB).find(v => { const t = Tree.tips(v).map(q => q.tip).filter(q => q !== x); return t.length === setB.size && t.every(q => setB.has(q)) && !Tree.within(xn, v); });
      if (!target) continue;
      const mA = Mapping.map(M, tA);
      const mB = Mapping.map(M, Tree.moveClade(tB, xn, target));
      const forA = [], forB = [];
      mA.per.forEach((p, c) => {
        const d = mB.per[c].steps - p.steps;
        if (d > 1e-9) forA.push({ ch: p.ch, d }); else if (d < -1e-9) forB.push({ ch: p.ch, d: -d });
      });
      return { A, B, lenA: mA.length, lenB: mB.length, forA, forB };
    }
    return null;
  }
  async function runWild() {
    const C = current();
    if (!C) return;
    const maxWild = Math.max(1, Math.min(20, +$('b8MaxWild').value || 5));
    const a = Mx.toAnalysis(state.matrix);
    const avoid = new Set([a.outgroup.length ? a.outgroup[0] : 0]);
    /* the trees collapsed by rule 1 are searched through their binary trees (see findWildcards) */
    const bin = C.src.id === 'collapsed' && sources().find(x => x.id === 'search');
    const W0 = bin ? { roots: bin.list().map(t => t.root), opts: { collapse: r => Tree.ladderize(Opt.collapse(r, a)) } } : { roots: C.roots, opts: {} };
    const res = await LABG.work.run({ title: T('Buscando taxones comodín', 'Looking for wildcard taxa'), delay: 300 }, async w => B8.findWildcards(W0.roots, C.n, C.names, maxWild, avoid, async f => { w.update(f); await LABG.nextPaint(); }, W0.opts));
    if (!res) return;
    res.roots = W0.roots;
    state.consensus = Object.assign(state.consensus || {}, { wild: res });
    paintWild();
  }
  function paintWild() {
    const C = current(), W = state.consensus && state.consensus.wild;
    if (!C || !W) { $('b8WildOut').innerHTML = ''; return; }
    if (!W.wild.length) { $('b8WildOut').innerHTML = `<p class="hint">${T('Ningún taxón, al quitarlo, devuelve clados al consenso estricto: no hay comodines.', 'No taxon, once removed, gives clades back to the strict consensus: there are no wildcards.')}</p>`; return; }
    const m = state.matrix, a = Mx.toAnalysis(m);
    let h = `<div class="table-scroll"><table><thead><tr><th>${T('Orden', 'Order')}</th><th>${T('Taxón', 'Taxon')}</th><th class="num">${T('Clados que devuelve', 'Clades given back')}</th><th class="num">${T('«?» en la matriz', '«?» in the matrix')}</th><th>${T('Dónde se coloca', 'Where it sits')}</th></tr></thead><tbody>`;
    W.wild.forEach((x, k) => {
      const row = m.cells[a.rows[x.taxon]];
      const miss = row.filter(c => c === Mx.MISSING).length / row.length;
      const places = placesOf(x.taxon, W.roots || C.roots, C.names);
      const pl = places.slice(0, 3).map(p => `${T('junto a', 'next to')} <i>${esc(C.names[p.sister[0]] || '?')}</i>${p.sister.length > 1 ? T(` y ${p.sister.length - 1} más`, ` and ${p.sister.length - 1} more`) : ''} (${p.trees.length}/${(W.roots || C.roots).length})`).join('; ') + (places.length > 3 ? T(`; y ${places.length - 3} lugares más`, `; and ${places.length - 3} more places`) : '');
      h += `<tr><td class="num">${k + 1}</td><td><i>${esc(x.name)}</i></td><td class="num">+${x.gain}</td><td class="num">${fmtPct(miss, 0)}</td><td>${pl}</td></tr>`;
    });
    h += '</tbody></table></div>';
    /* the characters that pull the first wildcard */
    const x0 = W.wild[0];
    const places = placesOf(x0.taxon, W.roots || C.roots, C.names);
    const pull = pullOf(x0.taxon, places, W.roots || C.roots);
    if (pull) {
      const nm = p => `<i>${esc(C.names[p.sister[0]] || '?')}</i>${p.sister.length > 1 ? T(` y ${p.sister.length - 1} más`, ` and ${p.sister.length - 1} more`) : ''}`;
      const li = list => list.slice(0, 12).map(z => `<li><b>${z.ch.j + 1}.</b> ${esc(z.ch.name || '')} (${fmtNum(z.d, 3)})</li>`).join('') + (list.length > 12 ? `<li>${T(`y ${list.length - 12} más`, `and ${list.length - 12} more`)}</li>` : '');
      h += `<h3 class="b8-sub">${T('Por qué se mueve', 'Why it moves')} <i>${esc(x0.name)}</i></h3><p class="hint">${T(`Un árbol con <i>${esc(x0.name)}</i> junto a ${nm(pull.A)} y el mismo árbol con <i>${esc(x0.name)}</i> movido junto a ${nm(pull.B)}: ${fmtNum(pull.lenA, 3)} contra ${fmtNum(pull.lenB, 3)} pasos.${pull.forA.length || pull.forB.length ? ' Los caracteres que cambian de pasos al moverlo (entre paréntesis, los pasos de diferencia):' : ''}`, `A tree with <i>${esc(x0.name)}</i> next to ${nm(pull.A)} and the same tree with <i>${esc(x0.name)}</i> moved next to ${nm(pull.B)}: ${fmtNum(pull.lenA, 3)} against ${fmtNum(pull.lenB, 3)} steps.${pull.forA.length || pull.forB.length ? ' The characters whose steps change with the move (in brackets, the difference in steps):' : ''}`)}</p>` +
        (!pull.forA.length && !pull.forB.length ? `<p>${T(`Ningún carácter cambia de pasos al moverlo: con ${fmtPct(m.cells[a.rows[x0.taxon]].filter(c => c === Mx.MISSING).length / m.chars.length, 0)} de «?», nada en la matriz decide entre esos lugares.`, `No character changes its steps with the move: with ${fmtPct(m.cells[a.rows[x0.taxon]].filter(c => c === Mx.MISSING).length / m.chars.length, 0)} «?», nothing in the matrix decides between those places.`)}</p>` :
        `<div class="b8-pull"><div><p class="b5-sub">${T('Lo llevan junto a', 'They take it next to')} ${nm(pull.A)}</p><ul class="b5-changes">${li(pull.forA) || `<li>${T('ninguno', 'none')}</li>`}</ul></div>` +
        `<div><p class="b5-sub">${T('Lo llevan junto a', 'They take it next to')} ${nm(pull.B)}</p><ul class="b5-changes">${li(pull.forB) || `<li>${T('ninguno', 'none')}</li>`}</ul></div></div>`);
    }
    const red = W.reduced;
    h += `<div class="fig-block"><div class="fig-head"><h4>${T('Consenso estricto reducido', 'Reduced strict consensus')} (${T('sin', 'without')} ${W.wild.map(x => esc(x.name)).join(', ')})</h4></div><div class="fig-canvas fit" id="b8Reduced">${Clado.render(red, { names: v => v.name, legend: false, rowH: 22, fontSize: 12, minUnit: 30, maxUnit: 44, ariaLabel: T('Consenso estricto reducido', 'Reduced strict consensus') })}</div>` +
      `<p class="hint">${T(`${cladeCount(red, C.n)} clados, contra ${cladeCount(Tree.consensus(C.roots, C.n, C.names, 1), C.n)} del consenso estricto con todos los taxones.`, `${cladeCount(red, C.n)} clades, against ${cladeCount(Tree.consensus(C.roots, C.n, C.names, 1), C.n)} of the strict consensus with every taxon.`)}</p></div>`;
    $('b8WildOut').innerHTML = h;
  }

  /* ---------------- wiring ---------------- */
  function paintMethods() {
    $('b8Methods').innerHTML = METHODS.map(x => `<button type="button" class="design-tile${x.id === method ? ' on' : ''}" data-c="${x.id}" aria-pressed="${x.id === method}"><b>${L2(x.es, x.en)}</b><small>${L2(x.d[0], x.d[1])}</small></button>`).join('');
  }
  function onShow() {
    const srcs = state.matrix ? sources() : [];
    $('b8NoData').hidden = !!srcs.length; $('b8Work').hidden = !srcs.length;
    if (!srcs.length) return;
    const prev = $('b8Src').value;
    $('b8Src').innerHTML = srcs.map(s => `<option value="${s.id}">${esc(s.label)}</option>`).join('');
    /* by default the trees collapsed by rule 1, as Block 3 builds its strict consensus: a branch that
       can measure zero is not a group the data support */
    if (srcs.some(s => s.id === prev)) $('b8Src').value = prev;
    else if (srcs.some(s => s.id === 'collapsed')) $('b8Src').value = 'collapsed';
    const C = current();
    const distinct = new Set(C.roots.map(r => Tree.cladeKey(r, C.n))).size;
    statTiles('b8SrcTiles', [
      [T('Árboles', 'Trees'), String(C.roots.length), distinct < C.roots.length ? (distinct === 1 ? T('1 distinto', '1 distinct') : T(`${distinct} distintos`, `${distinct} distinct`)) : T('todos distintos', 'all distinct')],
      [T('Taxones', 'Taxa'), String(C.n), T('activos', 'active')],
    ]);
    paintMethods(); paintCons();
    if (state.consensus && state.consensus.wild && state.consensus.src === C.src.id) paintWild(); else $('b8WildOut').innerHTML = '';
  }
  B8.onShow = onShow;
  function wire() {
    if (!$('panel-8')) return;
    $('b8GoSearch').addEventListener('click', () => goStep(3));
    $('b8Src').addEventListener('change', () => { if (state.consensus) state.consensus.wild = null; onShow(); });
    $('b8Methods').addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (!b) return; method = b.dataset.c; paintMethods(); paintCons(); });
    $('b8Th').addEventListener('input', paintCons);
    $('b8WildRun').addEventListener('click', () => runWild().catch(e => { $('b8WildOut').innerHTML = `<div class="msg msg-error">${esc(e.message || String(e))}</div>`; }));
    $('b8ExpNwk').addEventListener('click', () => { const t = state.consensus && state.consensus.tree; if (t) download(Tree.toNewick(t) + '\n', slug(state.matrix.title || 'matriz') + '_consenso_' + method + '.nwk'); });
    document.addEventListener('stepchange', e => { if (e.detail.step === 8) onShow(); });
    document.addEventListener('matrixchange', () => { state.consensus = null; });
    document.addEventListener('searchdone', () => { state.consensus = null; });
    document.addEventListener('langchange', () => { if ($('panel-8').classList.contains('active')) onShow(); });
  }
  document.addEventListener('DOMContentLoaded', wire);
  Object.assign(B8, { METHODS, cladeCount, placesOf, pullOf, sisterOf });
})();
