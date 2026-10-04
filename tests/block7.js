/* CladisticsPro — Copyright (C) 2026 Luis Ángel Barrera-Guzmán.
   Free software under the GNU General Public License, version 3 or later; see LICENSE. */

/* Unit tests for Blocks 7 and 8: the arithmetic of support (support.js), the
   resampling and suboptimal trees of the engine, searches without a group,
   the consensus methods and the wildcards. */
sec('25 · El apoyo, en cuentas (support.js)');
{
  t('un grupo con el primer taxón se escribe por su complemento', Support.keyOfClade('11000', 0) === '00111' && Support.keyOfClade('00110', 0) === '00110');
  t('compatibles: anidados o disjuntos; incompatibles: se traslapan', Support.compatible('0011', '0111') && Support.compatible('0011', '0100') && !Support.compatible('0110', '0011'));
  const counts = { '0110': 60, '0011': 30, '0111': 100 };
  const f = Support.freqGC(counts, 100, '0110');
  t('frecuencia y GC: 60 % del grupo, 30 % del que lo contradice → GC 30 %', Math.abs(f.freq - 0.6) < 1e-12 && Math.abs(f.gc - 0.3) < 1e-12);
  const f2 = Support.freqGC(counts, 100, '0011');
  t('GC negativo cuando lo contradicen más de lo que aparece', Math.abs(f2.gc + 0.3) < 1e-12);
  const trees = [{ score: 10, keys: ['0110', '0111'] }, { score: 12, keys: ['0011', '0111'] }, { score: 11, keys: ['0111'] }];
  t('Bremer desde un conjunto de árboles: el más corto sin el grupo, menos el mejor', Support.bremerFromTrees(trees, 10, '0110') === 1 && Support.bremerFromTrees(trees, 10, '0111') === null);
  t('Bremer relativo: F = 3 a favor, C = 1 en contra → (3 − 1)/3', Math.abs(Support.rfd({ 0: 1, 1: 2, 2: 1 }, { 0: 3, 1: 1, 2: 2 }) - 2 / 3) < 1e-12);
  t('Bremer relativo sin nada a favor es 0', Support.rfd({ 0: 1 }, { 0: 1 }) === 0);
  const nm = ['A', 'B', 'C', 'D', 'E'];
  const r = Tree.parseNewick('(A,(B,(C,(D,E))));', nm);
  const cl = Support.cladesOf(r, 5, 0);
  t('los grupos de un cladograma, sin los triviales', cl.map(x => x.key).sort().join() === '00011,00111');
}

sec('26 · Remuestreo y árboles subóptimos (engine.js)');
{
  const m = exM('bursera');
  const R = E.rng(3);
  const nAct = m.chars.filter(c => c.active !== false).length;
  const wb = E.resampleWeights(m, 'boot', null, R);
  t('bootstrap: tantos caracteres como hay, con reemplazo', wb.reduce((a, b) => a + b, 0) === nAct && wb.every(Number.isInteger));
  const wj = E.resampleWeights(m, 'jack', 0.36, R);
  t('jackknife: cada carácter queda o se borra', wj.every(w => w === 0 || w === 1));
  let n0 = 0, n2 = 0, tot = 0;
  for (let k = 0; k < 300; k++) E.resampleWeights(m, 'sym', 0.33, R).forEach(w => { tot++; if (w === 0) n0++; if (w === 2) n2++; });
  t('simétrico: tantos borrados como duplicados, cerca de 16.5 % cada uno', Math.abs(n0 / tot - 0.165) < 0.03 && Math.abs(n2 / tot - 0.165) < 0.03, `${n0 / tot} ${n2 / tot}`);
  const one = E.resample(m, {}, { method: 'jack', p: 0.36, reps: 10, seed: 5, search: { method: 'exact' } });
  const a = E.resample(m, {}, { method: 'jack', p: 0.36, reps: 4, first: 0, seed: 5, search: { method: 'exact' } });
  const b = E.resample(m, {}, { method: 'jack', p: 0.36, reps: 6, first: 4, seed: 5, search: { method: 'exact' } });
  const merged = {};
  [a, b].forEach(x => Object.keys(x.counts).forEach(k => { merged[k] = (merged[k] || 0) + x.counts[k]; }));
  t('el remuestreo da lo mismo en un hilo que repartido en dos', JSON.stringify(Object.entries(merged).sort()) === JSON.stringify(Object.entries(one.counts).sort()) && one.reps === 10);
  /* the suboptimal trees */
  const P = E.prepare(m, {});
  const ex = E.search(m, {}, { method: 'exact' });
  const start = ex.trees.map(x => { const T = E.fromNodeTree(P, Tree.parseNewick(x.newick, P.names)); return { T, score: x.score }; });
  const sub = E.suboptimal(P, start, { delta: 2, maxTrees: 5000 });
  const keys = new Set(sub.trees.map(x => E.treeKey(x.T)));
  let within = 0;
  Tree.allTrees(8, P.names).forEach(rt => { if (E.score(P, E.fromNodeTree(P, rt)) <= ex.score + 2 + 1e-9) within++; });
  t(`árboles subóptimos: hasta 2 pasos más, sin repetir (${sub.trees.length} de ${within} en la enumeración)`, sub.trees.every(x => x.score <= ex.score + 2 + 1e-9) && keys.size === sub.trees.length && sub.trees.length === within, sub.trees.length + ' / ' + within);
  /* a search without a group never returns it */
  const d = exM('dahlia'), Pd = E.prepare(d, {});
  const best = E.search(d, {}, { method: 'heuristic', replicates: 3, seed: 2 });
  const gk = best.trees[0].keys.find(k => [...k].filter(c => c === '1').length >= 3);
  const taxa = [...gk].map((c, i) => (c === '1' ? i : -1)).filter(i => i >= 0);
  const without = E.search(d, { constraints: [{ taxa, positive: false }] }, { method: 'heuristic', replicates: 3, seed: 2 });
  t('una búsqueda sin un grupo de Dahlia no lo devuelve y es más larga o igual', without.trees.every(x => !x.keys.includes(gk)) && without.score >= best.score - 1e-9);
  void Pd;
}

sec('27 · Consensos y comodines');
{
  const nm = ['A', 'B', 'C', 'D', 'E', 'F'];
  const P = s => Tree.parseNewick(s, nm);
  const key = r => Tree.cladeKey(r, 6);
  const trees = [P('(A,(B,(C,(D,(E,F)))));'), P('(A,(B,(D,(C,(E,F)))));'), P('(A,((B,C),(D,(E,F))));')];
  t('estricto: (B,C,D,E,F) y (E,F)', key(Tree.consensus(trees, 6, nm, 1)) === key(P('(A,(B,C,D,(E,F)));')));
  t('semiestricto: además lo que ningún árbol contradice', key(Tree.semistrict(trees, 6, nm)) === key(P('(A,(B,C,D,(E,F)));')));
  t('mayoría extendida: resuelve con lo más frecuente que sea compatible', Tree.majorityExtended(trees, 6, nm) && Tree.isBinary(Tree.majorityExtended(trees, 6, nm)));
  t('Adams de árboles iguales es el mismo árbol', key(Tree.adams([trees[0], Tree.clone(trees[0])], 6, nm)) === key(trees[0]));
  /* a wildcard: X wanders, the rest is fixed */
  const nw = ['A', 'B', 'C', 'D', 'E', 'X'];
  const Q = s => Tree.parseNewick(s, nw);
  const set = [Q('(A,(B,(C,(X,(D,E)))));'), Q('(A,(B,(X,(C,(D,E)))));'), Q('(A,((B,X),(C,(D,E))));'), Q('(A,(B,(C,(D,(E,X)))));')];
  const pruned = Tree.prune(set[0], [5]);
  t('podar un taxón deja un árbol sin él y sin nodos de un hijo', Tree.tips(pruned).length === 5 && Tree.postorder(pruned).every(v => v.children.length !== 1));
  later(Block8.findWildcards(set, 6, nw, 3, new Set([0])).then(res => {
    t('el comodín es X y su poda devuelve clados al consenso estricto', res.wild.length >= 1 && res.wild[0].name === 'X' && res.wild[0].gain >= 2, JSON.stringify(res.wild));
    t('el consenso reducido ya no tiene a X', !Tree.tips(res.reduced).some(v => v.name === 'X') && Block8.cladeCount(res.reduced, 6) === 3);
  }));
  /* a wildcard with almost no data in trees collapsed by rule 1: the collapse was made with it present,
     so it is looked for in the binary trees and the pruned trees are collapsed again */
  {
    const keepM = state.matrix;
    const md = MatIO.read(EXAMPLES.dahlia.nexus).matrix;
    const iw = md.taxa.findIndex(x => x.name === 'Dahlia moorei');
    md.chars.forEach((c, j) => { if (j > 1) md.cells[iw][j] = Mx.MISSING; });
    state.matrix = md;
    const prep = { continuous: 'scaled', inapplicable: 'algorithm' };
    const res = Block3.process(Engine.search(md, prep, { method: 'heuristic', replicates: 4, seed: 1, maxTrees: 40 }), prep, { seed: 1 });
    const A2 = Mx.toAnalysis(md), names2 = A2.taxa;
    const bins = res.trees.map(x => x.root);
    later(Block8.findWildcards(res.condensed, names2.length, names2, 3, new Set([0])).then(old => Block8.findWildcards(bins, names2.length, names2, 3, new Set([0]), null, { collapse: r => Tree.ladderize(Opt.collapse(r, A2)) }).then(neu => {
      t('comodín con casi todo en «?»: podando los árboles colapsados no se ve; con los binarios, recolapsados, sí', neu.wild.length >= 1 && neu.wild[0].name === 'Dahlia moorei' && neu.wild[0].gain > 0 && Block8.cladeCount(neu.reduced, names2.length) > Block8.cladeCount(Tree.consensus(res.condensed, names2.length, names2, 1), names2.length), JSON.stringify([old.wild.map(w => w.name + w.gain), neu.wild.map(w => w.name + w.gain)]));
    })));
    state.matrix = keepM;
  }
  const places = Block8.placesOf(5, set, nw);
  t('los lugares del comodín: 4 distintos, uno por árbol', places.length === 4 && places.every(p => p.trees.length === 1));
  t('los Bloques 7 y 8 están listos', STEPS[6].ready === true && STEPS[7].ready === true);
}
