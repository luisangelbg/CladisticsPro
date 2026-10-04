/* CladisticsPro — Copyright (C) 2026 Luis Ángel Barrera-Guzmán.
   Free software under the GNU General Public License, version 3 or later; see LICENSE. */

/* Unit tests for Blocks 3 and 4: the search engine (lengths, the TBR
   shortcut, branch and bound, constraints, inapplicables), the weighting
   (implied, extended, successive), zero-length branches, consensus, the
   threads and the parts of the blocks that do not need the page. */
const exM = id => MatIO.read(EXAMPLES[id].nexus).matrix;
const E = Engine;

sec('14 · El motor de búsqueda (engine.js)');
{
  const R = E.rng(11);
  ['bursera', 'dahlia'].forEach(id => {
    const m = exM(id);
    const P = E.prepare(m, { continuous: 'off' });
    const A = Mx.toAnalysis(m);
    let bad = 0, info = '';
    for (let rep = 0; rep < 12; rep++) {
      const T = E.wagner(P, R);
      /* rooted as the cladogram is (it matters for the asymmetric step matrix of Dahlia) */
      const an = Opt.analyse(Tree.rootOn(Tree.parseNewick(E.toNewick(P, T), A.taxa), P.outgroup).root, A);
      const len = E.evaluate(P, T).length;
      if (Math.abs(len - an.length) > 1e-9) { bad++; info = len + ' vs ' + an.length; }
    }
    t(`${id}: la longitud del motor es la de la optimización exacta del Bloque 1 (12 árboles)`, bad === 0, info);
  });
  /* the TBR shortcut must give the score of the rearranged tree, under every criterion */
  ['ew', 'iw', 'eiw'].forEach(crit => {
    const m = exM('dahlia');
    m.chars.forEach(c => { if (c.type === 'step') c.type = 'unord'; });
    const P = E.prepare(m, { continuous: 'scaled', criterion: crit, k: 3 });
    let n = 0, maxd = 0;
    const T = E.wagner(P, R);
    E.neighbourhood(P, T, {}, (cut, ea, eb, sc) => {
      if (R() > 0.08) return true;
      const d = Math.abs(E.score(P, E.applyTBR(T, cut, ea, eb)) - sc);
      n++; maxd = Math.max(maxd, d);
      return true;
    });
    t(`atajo de TBR exacto con ${crit.toUpperCase()} y continuos (${n} reordenamientos)`, n > 20 && maxd < 1e-7, 'máx. ' + maxd);
  });
  /* exact search against every tree of Bursera (8 taxa → 10 395 trees) */
  const m = exM('bursera');
  const P = E.prepare(m, {});
  const all = Tree.allTrees(P.n, P.names);
  let best = Infinity;
  const keys = new Set();
  const scores = all.map(root => { const T = E.fromNodeTree(P, root); const s = E.score(P, T); return { T, s }; });
  scores.forEach(x => { if (x.s < best - 1e-9) { best = x.s; keys.clear(); } if (Math.abs(x.s - best) < 1e-9) keys.add(E.treeKey(x.T)); });
  t('Bursera: 10 395 árboles sin raíz para 8 taxones', all.length === 10395);
  const bb = E.branchAndBound(P, {});
  const bbKeys = new Set(bb.trees.map(x => E.treeKey(x.T)));
  t(`rama y cota = enumeración completa (L = ${best}, ${keys.size} árbol)`, bb.score === best && bbKeys.size === keys.size && [...keys].every(k => bbKeys.has(k)), JSON.stringify([bb.score, bbKeys.size]));
  const ex = E.search(m, {}, { method: 'exact', seed: 1 });
  t('la búsqueda exacta completa lo dice y da los mismos árboles', ex.complete === true && ex.length === best && ex.trees.length === keys.size);
  const heu = E.search(m, {}, { method: 'heuristic', replicates: 8, seed: 3 });
  t('la heurística llega al óptimo y cuenta las réplicas que llegaron', heu.score === best && heu.hits >= 1 && heu.reps === 8 && heu.history.length === 8);
  const rat = E.search(m, {}, { method: 'ratchet', replicates: 2, ratchetIterations: 5, seed: 3 });
  const com = E.search(m, {}, { method: 'combined', replicates: 2, ratchetIterations: 5, seed: 3 });
  t('trinquete y combinada también llegan al óptimo', rat.score === best && com.score === best);
  t('la misma semilla da el mismo resultado', JSON.stringify(E.search(m, {}, { method: 'heuristic', replicates: 3, seed: 9 }).trees.map(x => x.newick)) === JSON.stringify(E.search(m, {}, { method: 'heuristic', replicates: 3, seed: 9 }).trees.map(x => x.newick)));
  /* weights with decimals cannot enter the whole-step counts: rounded on reading */
  const wr = MatIO.read('#NEXUS\nbegin data; dimensions ntax=4 nchar=3; format symbols="01"; matrix\nA 001\nB 011\nC 110\nD 100\n;\nend;\nbegin assumptions; wtset w = 0.4: 1, 2.6: 2; end;\n');
  t('los pesos con decimales se redondean al leer, con un aviso', wr.matrix.chars.map(c => c.weight).join() === '0,3,1' && wr.notes.length === 1);
  /* Newick and back */
  const T0 = E.wagner(P, R);
  t('Newick de ida y vuelta conserva el árbol', E.treeKey(E.fromNodeTree(P, Tree.parseNewick(E.toNewick(P, T0), P.names))) === E.treeKey(T0));
  t('el Newick se enraíza en el primer taxón del grupo externo', Tree.parseNewick(E.toNewick(P, T0), P.names).children[0].name === P.names[P.outgroup[0]]);
  /* each tree carries its steps by character of the matrix */
  const tr0 = ex.trees[0];
  t('cada árbol trae sus pasos por carácter de la matriz', Object.keys(tr0.byChar).length === P.nq && Math.abs(Object.values(tr0.byChar).reduce((a, b) => a + b, 0) - tr0.length) < 1e-9);
  /* constraints: the best tree among those that obey them */
  const optSplits = E.splits(bb.trees[0].T, 0).map(a => [...Array(P.n).keys()].filter(i => (a[i >>> 5] >>> (i & 31)) & 1));
  const inOpt = optSplits.find(s => s.length >= 2 && s.length <= P.n - 2);
  let notIn = null;
  for (let a = 1; a < P.n && !notIn; a++) for (let b = a + 1; b < P.n && !notIn; b++) if (!optSplits.some(s => s.length === 2 && s.includes(a) && s.includes(b))) notIn = [a, b];
  [[{ taxa: notIn, positive: true }, 'positiva (un par que no es clado del óptimo)'], [{ taxa: inOpt, positive: false }, 'negativa (un clado del óptimo)']].forEach(([c, label]) => {
    const Pc = E.prepare(m, { constraints: [c] });
    let bc = Infinity;
    scores.forEach(x => { if (E.satisfies(Pc, x.T) && x.s < bc) bc = x.s; });
    const r = E.search(m, { constraints: [c] }, { method: 'exact' });
    const rh = E.search(m, { constraints: [c] }, { method: 'heuristic', replicates: 6, seed: 2 });
    t(`restricción ${label}: exacta y heurística dan el mejor árbol que la cumple (L = ${bc})`, r.length === bc && rh.length === bc && r.trees.every(x => E.satisfies(Pc, E.fromNodeTree(Pc, Tree.parseNewick(x.newick, Pc.names)))), JSON.stringify([r.length, rh.length, bc]));
  });
}

sec('15 · Inaplicables (Brazeau, Guillerme y Smith 2019)');
{
  /* the smallest case where an applicable node with an inapplicable child adds a region */
  const m = Mx.create(5, 1);
  m.taxa.forEach((x, i) => { x.name = 't' + (i + 1); x.outgroup = i === 0; });
  m.chars[0].states = ['0', '1'];
  m.cells = [[2], [2], [Mx.GAP], [Mx.GAP], [Mx.GAP]];
  const nw = '((((t4,t2),t5),t3),t1);';
  const Pa = E.prepare(m, { inapplicable: 'algorithm' });
  const Pm = E.prepare(m, { inapplicable: 'missing' });
  const len = P => E.evaluate(P, E.fromNodeTree(P, Tree.parseNewick(nw, P.names))).length;
  t('«1 1 – – –» en ((((t4,t2),t5),t3),t1): una región aplicable de más', len(Pa) === 1, len(Pa));
  t('el mismo carácter leído como «?» no cuesta nada', len(Pm) === 0, len(Pm));
  /* two applicable states separated: a transformation, not a region */
  m.cells = [[1], [2], [Mx.GAP], [Mx.GAP], [Mx.GAP]];
  const Pb = E.prepare(m, { inapplicable: 'algorithm' });
  t('«0 1 – – –» en el mismo árbol también cuesta 1, como en TreeSearch', len(Pb) === 1, len(Pb));
  const ord = E.prepare(exM('dahlia'), { inapplicable: 'algorithm' });
  t('Dahlia: los caracteres con «–» van por el camino lento del algoritmo', ord.slow.some(s => s.kind === 'inap'));
  /* the shadow («–» read as «?») keeps the shortcut a lower bound of the true score */
  ['ew', 'iw'].forEach(crit => {
    const Pd = E.prepare(exM('dahlia'), { inapplicable: 'algorithm', criterion: crit, k: 3 });
    const R = E.rng(5), T = E.wagner(Pd, R);
    let n = 0, bad = 0, tight = 0;
    E.neighbourhood(Pd, T, {}, (cut, ea, eb, sc) => {
      if (R() > 0.1) return true;
      const s = E.score(Pd, E.applyTBR(T, cut, ea, eb));
      n++; if (sc > s + 1e-9) bad++; if (s - sc < 1 + 1e-9) tight++;
      return true;
    });
    t(`con inaplicables y ${crit.toUpperCase()}, el atajo es una cota inferior de la puntuación real (${n} reordenamientos, ${Math.round(tight / n * 100)} % a menos de un paso)`, n > 20 && bad === 0, bad);
  });
  const Pd = E.prepare(exM('dahlia'), { inapplicable: 'algorithm' });
  /* all the inapplicable characters at once, by bits, against one by one */
  {
    const R3 = E.rng(21);
    let n = 0, bad = 0;
    for (let rep = 0; rep < 25; rep++) {
      const T = E.wagner(Pd, R3), st = E.evaluate(Pd, T).steps;
      Pd.slow.filter(sc => sc.kind === 'inap').forEach(sc => { n++; if (E.inapLength(Pd, T, sc) !== st[sc.q]) bad++; });
    }
    t(`los pases por bits dan lo mismo que el algoritmo carácter por carácter (${n} casos)`, n > 50 && bad === 0, bad);
    /* the bounded climb ends where no TBR rearrangement is shorter */
    const c = E.climb(Pd, E.wagner(Pd, R3));
    let better = 0;
    E.neighbourhood(Pd, c.T, {}, (cut, ea, eb) => { if (E.score(Pd, E.applyTBR(c.T, cut, ea, eb)) < c.score - 1e-9) better++; return true; });
    t('con inaplicables, la subida termina en un óptimo local de TBR', better === 0, better);
  }
  /* branch and bound with «–»: the count can go down when a taxon is added, so
     partial trees are bounded by the shadow; every shortest tree must be found */
  {
    const R4 = E.rng(99);
    let ok = 0, tot = 0;
    for (let rep = 0; rep < 12; rep++) {
      const n = 6 + (rep % 2), nc = 8 + (rep % 5);
      const m = Mx.create(n, nc);
      m.taxa.forEach((x, i) => { x.name = 't' + i; x.outgroup = i === 0; });
      m.cells = m.cells.map(row => row.map(() => { const u = R4(); return u < 0.3 ? Mx.GAP : u < 0.38 ? Mx.MISSING : 1 << Math.floor(R4() * 3); }));
      m.chars.forEach(c => { c.states = ['0', '1', '2']; });
      const P = E.prepare(m, { inapplicable: 'algorithm' });
      let best = Infinity; const keys = new Set();
      Tree.allTrees(n, P.names).forEach(root => { const T = E.fromNodeTree(P, root); const s = E.score(P, T); if (s < best - 1e-9) { best = s; keys.clear(); } if (Math.abs(s - best) < 1e-9) keys.add(E.treeKey(T)); });
      const bk = new Set(E.branchAndBound(P, {}).trees.map(x => E.treeKey(x.T)));
      tot++; if (bk.size === keys.size && [...keys].every(k => bk.has(k))) ok++;
    }
    t(`rama y cota con inaplicables halla todos los árboles más cortos de la enumeración (${ok}/${tot} matrices)`, ok === tot);
    /* the matrix where the exact count on partial trees lost 10 of 29 trees */
    const rows = ['0--211-?', '112---00', '-121--0-', '?001100-', '220---1?', '-1-110-0'];
    const m = Mx.create(6, 8);
    m.taxa.forEach((x, i) => { x.name = 't' + i; x.outgroup = i === 0; });
    m.chars.forEach(c => { c.states = ['0', '1', '2']; });
    m.cells = rows.map(r => r.split('').map(ch => Mx.parseCell(ch, { type: 'unord' })));
    const P = E.prepare(m, { inapplicable: 'algorithm' });
    let best = Infinity; const keys = new Set();
    Tree.allTrees(6, P.names).forEach(root => { const T = E.fromNodeTree(P, root); const s = E.score(P, T); if (s < best - 1e-9) { best = s; keys.clear(); } if (Math.abs(s - best) < 1e-9) keys.add(E.treeKey(T)); });
    const bb = E.branchAndBound(P, {});
    t(`el contraejemplo de 6 × 8: rama y cota halla los ${keys.size} árboles de longitud ${best}`, bb.score === best && bb.trees.length === keys.size && keys.size === 29, bb.trees.length);
  }
  const R2 = E.rng(8), Ta = E.wagner(Pd, R2), Tb = E.wagner(Pd, R2);
  const la = E.length(Pd, Ta), lb = E.length(Pd, Tb);
  t('la evaluación reutiliza su memoria sin mezclar árboles', E.length(Pd, Ta) === la && E.length(Pd, Tb) === lb && JSON.stringify(Array.from(E.evaluate(Pd, Ta).steps)) === JSON.stringify(Array.from(E.evaluate(E.prepare(exM('dahlia'), { inapplicable: 'algorithm' }), Ta).steps)));
}

sec('16 · Pesos implícitos (engine.js)');
{
  const m = exM('dahlia');
  const P = E.prepare(m, { criterion: 'iw', k: 3, continuous: 'off' });
  const q = P.chars.findIndex(c => c.type === 'unord');
  t('distorsión h/(h + k): un paso extra con k = 3 es 0.25', Math.abs(E.distortion(P, q, P.minSteps[q] + 1) - 0.25) < 1e-12);
  t('distorsión con 4 pasos extra y k = 3 es 4/7', Math.abs(E.distortion(P, q, P.minSteps[q] + 4) - 4 / 7) < 1e-12);
  t('sin pasos extra no hay distorsión', E.distortion(P, q, P.minSteps[q]) === 0);
  const steps = Float64Array.from(P.minSteps, (v, i) => v + (i % 3));
  const sum = [...steps].reduce((a, s, i) => a + (i % 3 ? (i % 3) / ((i % 3) + 3) : 0), 0);
  t('la puntuación es la suma de las distorsiones', Math.abs(E.scoreFromSteps(P, steps) - sum) < 1e-9);
  /* extended: a character with missing entries gets its own k and a rescaling */
  const m2 = Mx.create(10, 2);
  m2.taxa.forEach((x, i) => { x.name = 't' + i; });
  m2.chars.forEach(c => { c.states = ['0', '1']; });
  m2.cells = m2.cells.map((row, i) => [i < 4 ? Mx.MISSING : 1 << (i % 2), 1 << (i % 2)]);
  const Pe = E.prepare(m2, { criterion: 'eiw', k: 3 });
  const f = 1 + 0.5 * 4 / 6;
  t('EIW: f = 1 + r·(t − o)/o con r = 0.5 (4 de 10 faltantes)', Math.abs(Pe.chars[0].f - f) < 1e-12 && Pe.chars[1].f === 1);
  t('EIW: el carácter con faltantes usa k/f', Math.abs(Pe.iw.kc[0] - 3 / f) < 1e-12 && Pe.iw.kc[1] === 3);
  t('EIW: el primer paso extra cuesta lo mismo que con k de referencia', Math.abs(E.distortion(Pe, 0, Pe.minSteps[0] + 1) - 0.25) < 1e-12);
  t('EIW: los pasos siguientes pesan menos que sin faltantes', E.distortion(Pe, 0, Pe.minSteps[0] + 3) < E.distortion(Pe, 1, Pe.minSteps[1] + 3));
  const Pm = E.prepare(m2, { criterion: 'eiw', k: 3, eiwMax: 1.1 });
  t('EIW: f nunca pasa del máximo M', Math.abs(Pm.chars[0].f - 1.1) < 1e-12);
  const iw = E.search(exM('bursera'), { criterion: 'iw', k: 3 }, { method: 'exact' });
  const Pb = E.prepare(exM('bursera'), { criterion: 'iw', k: 3 });
  const names = Pb.names;
  let bestIW = Infinity;
  Tree.allTrees(8, names).forEach(root => { bestIW = Math.min(bestIW, E.score(Pb, E.fromNodeTree(Pb, root))); });
  t(`búsqueda exacta con pesos implícitos = enumeración (${bestIW.toFixed(4)})`, Math.abs(iw.score - bestIW) < 1e-9, iw.score);
}

sec('17 · Pesos sucesivos y ramas de longitud cero');
{
  const m = exM('bursera');
  const sw = E.successive(m, {}, { method: 'heuristic', replicates: 4, seed: 1 }, { base: 10 });
  const P1 = E.prepare(m, { weights: m.chars.map(() => 1) });
  t('pesos sucesivos: enteros de 0 a 10', sw.weights.every(w => Number.isInteger(w) && w >= 0 && w <= 10));
  t('pesos sucesivos: se detienen cuando los pesos dejan de cambiar', sw.log.length <= 10 && sw.log[sw.log.length - 1].changed === 0);
  t('pesos sucesivos: los caracteres no informativos pesan 0', P1.chars.every(r => P1.maxSteps[r.q] > P1.minSteps[r.q] || sw.weights[r.j] === 0));
  t('pesos sucesivos: un carácter sin homoplasia en el árbol pesa 10', P1.chars.some(r => sw.weights[r.j] === 10));
  /* rule 1: collapse a branch that some most parsimonious reconstruction leaves without change */
  const mz = Mx.create(5, 1);
  mz.taxa.forEach((x, i) => { x.name = 'ABCDE'[i]; });
  mz.chars[0].states = ['0', '1'];
  mz.cells = [[1], [1], [2], [2], [2]];
  const A = Mx.toAnalysis(mz);
  const root = Tree.parseNewick('(A,(B,(C,(D,E))));', A.taxa);
  const c = Opt.collapse(root, A);
  /* the branch from the root to (B,…) continues the terminal branch of A: it is not collapsed, so the ingroup stays a group */
  t('regla 1: (A,(B,(C,(D,E)))) con un solo carácter que une C, D y E queda (A,(B,(C,D,E)))', Tree.cladeKey(c, 5) === Tree.cladeKey(Tree.parseNewick('(A,(B,(C,D,E)));', A.taxa), 5), Tree.toNewick(c));
  const Ad = Mx.toAnalysis(exM('dahlia'));
  const rd = Tree.parseNewick(E.search(exM('dahlia'), { continuous: 'off' }, { method: 'heuristic', replicates: 2, seed: 4 }).trees[0].newick, Ad.taxa);
  t('regla 1 no cambia la longitud del árbol', Math.abs(Opt.analyse(Opt.collapse(rd, Ad), Ad).length - Opt.analyse(rd, Ad).length) < 1e-9);
  /* independent check: a branch can be zero exactly when contracting it leaves the length unchanged;
     on the tree rooted on the outgroup, the two branches of the root are one unrooted branch */
  {
    const rr = Tree.rootOn(rd, Ad.outgroup).root;
    const L0 = Opt.analyse(rr, Ad).length;
    const zero = Opt.zeroBranches(rr, Ad);
    let bad = 0, n = 0;
    Tree.preorder(rr).filter(v => v !== rr && v.children.length).forEach(v => {
      const cp = Tree.clone(rr);
      const path = []; for (let x = v; x !== rr; x = x.parent) path.unshift(x.parent.children.indexOf(x));
      const at = path.reduce((x, k) => x.children[k], cp);
      const rootChild = at.parent === cp;
      (rootChild ? cp.children.slice() : [at]).forEach(w => { if (!w.children.length) return; const p = w.parent, k = p.children.indexOf(w); p.children.splice(k, 1, ...w.children); w.children.forEach(x => { x.parent = p; }); });
      const free = !(rootChild && rr.children.some(x => !x.children.length)) && Math.abs(Opt.analyse(cp, Ad).length - L0) < 1e-9;
      n++; if (free !== zero.has(v)) bad++;
    });
    t(`regla 1 = contraer la rama no alarga el árbol, en las ${n} ramas internas de un árbol de Dahlia enraizado (las dos de la raíz, juntas)`, bad === 0, bad + ' distintas');
    const ingroup = rr.children.find(x => !Ad.outgroup.every(o => Tree.preorder(x).some(y => y.tip === o)));
    t('regla 1 conserva el grupo de todas las dalias (la rama de la raíz lleva cambios)', !zero.has(ingroup));
  }
}

sec('18 · Consensos (tree.js)');
{
  const nm = ['A', 'B', 'C', 'D', 'E'];
  const tr = ['(A,(B,(C,(D,E))));', '(A,(B,((C,D),E)));', '(A,((B,C),(D,E)));'].map(s => Tree.parseNewick(s, nm));
  const strict = Tree.consensus(tr, 5, nm, 1);
  const maj = Tree.consensus(tr, 5, nm, 0.5);
  const key = s => Tree.cladeKey(Tree.parseNewick(s, nm), 5);
  t('estricto: sólo (B,C,D,E)', Tree.cladeKey(strict, 5) === key('(A,(B,C,D,E));'));
  t('mayoría: (B,C,D,E), (C,D,E) y (D,E)', Tree.cladeKey(maj, 5) === key('(A,(B,(C,(D,E))));'));
  const de = Tree.postorder(maj).find(v => v.children.length === 2 && v.children.every(x => !x.children.length) && v.children.map(x => x.name).sort().join() === 'D,E');
  t('mayoría: cada clado lleva su frecuencia (D,E = 2/3)', de && Math.abs(de.freq - 2 / 3) < 1e-12);
  t('un solo árbol es su propio consenso', Tree.cladeKey(Tree.consensus([tr[0]], 5, nm, 1), 5) === key('(A,(B,(C,(D,E))));'));
}

sec('19 · Hilos, Bloque 3 y Bloque 4');
{
  t('hay al menos un hilo y no más de 16', Pool.threads() >= 1 && Pool.threads() <= 16);
  let compiles = true; try { new Function(Pool.source()); } catch (e) { compiles = false; }
  t('el código del hilo se arma con el motor y compila', compiles && /EngineCore\(g\)/.test(Pool.source()));
  t('los Bloques 3 y 4 están listos', STEPS[2].ready === true && STEPS[3].ready === true);
  t('cinco métodos de búsqueda y cuatro esquemas de pesos', Block3.METHODS.length === 5 && Block4.SCHEMES.length === 4);
  const svg = Block3.historyChart([{ step: 1, best: 20, found: 20 }, { step: 2, best: 18, found: 18 }, { step: 3, best: 18, found: 19 }]);
  t('la curva de convergencia es una figura marcada para el estudio', /data-plot="convergence"/.test(svg) && /data-role="legend"/.test(svg) && (svg.match(/<circle/g) || []).length === 4);
  const nm = ['A', 'B', 'C', 'D', 'E'];
  const a = Tree.parseNewick('(A,(B,(C,(D,E))));', nm), b = Tree.parseNewick('(A,(B,((C,D),E)));', nm);
  t('similitud entre consensos: 1 consigo mismo', Block4.similarity(a, a, 5) === 1);
  t('similitud entre consensos: 2 de 3 clados en común → 2/3', Math.abs(Block4.similarity(a, b, 5) - 2 / 3) < 1e-12);
  /* processing a result as the page does: rooted, indices, collapsed, consensus */
  const keep = state.matrix;
  state.matrix = exM('bursera');
  const res = Block3.process(E.search(state.matrix, {}, { method: 'exact' }), {}, { seed: 1 });
  t('el resultado procesado trae árboles enraizados, CI, RI y consenso', res.trees.every(x => x.root && x.ci > 0 && x.ri >= 0) && res.strict && res.condensed.length >= 1 && res.fingerprint === Mx.fingerprint(state.matrix));
  state.matrix = keep;
  /* the same search in background threads (or on the page if the browser refuses them) */
  later(Pool.search({ matrix: exM('bursera'), prep: {}, opts: { method: 'heuristic', replicates: 4, seed: 1 } }).then(r => {
    t(`búsqueda en ${r.threads} hilo(s): llega a L = 17 con un árbol`, r.length === 17 && r.trees.length === 1 && r.reps === 4, JSON.stringify([r.length, r.trees.length, r.reps]));
  }));
  /* the light indices (no reconstructions) give the same length, CI and RI as the full mapping */
  {
    const md = exM('dahlia'), Ad2 = Mx.toAnalysis(md);
    let bad = 0, info = '';
    ['algorithm', 'missing'].forEach(inap => {
      const prep = { inapplicable: inap, continuous: 'scaled' };
      const MP = Mapping.prepare(md, prep);
      E.search(md, prep, { method: 'heuristic', replicates: 3, seed: 2, maxTrees: 6 }).trees.forEach(tr => {
        const root = Tree.rootOn(Tree.parseNewick(tr.newick, Ad2.taxa), Ad2.outgroup).root;
        const a = Mapping.map(MP, root), b = Mapping.map(MP, root, { indicesOnly: true });
        if (Math.abs(a.length - b.length) > 1e-9 || Math.abs(a.ci - b.ci) > 1e-12 || Math.abs(a.ri - b.ri) > 1e-12) { bad++; info = [a.length, b.length, a.ci, b.ci].join(' '); }
      });
    });
    t('índices ligeros = mapeo completo (longitud, CI, RI) en Dahlia, con «–» por el algoritmo y como «?»', bad === 0, info);
    /* trees gathered from several threads never exceed the maximum kept */
    const many = [];
    for (let s = 1; s <= 6; s++) E.search(md, { continuous: 'off' }, { method: 'heuristic', replicates: 2, seed: s, maxTrees: 40 }).trees.forEach(x => many.push(x.newick));
    const col = E.collectNewicks(md, { continuous: 'off' }, many, { maxTrees: 10 });
    t(`al juntar ${many.length} árboles de varios hilos se guardan como máximo 10 y se avisa que puede haber más`, col.trees.length <= 10 && col.overflow === true, col.trees.length + ' ' + col.overflow);
    /* the batched processing gives the same result as all at once */
    const keep2 = state.matrix;
    state.matrix = md;
    const raw = E.search(md, { continuous: 'scaled', inapplicable: 'algorithm' }, { method: 'heuristic', replicates: 2, seed: 3, maxTrees: 8 });
    const p1 = Block3.process(raw, { continuous: 'scaled', inapplicable: 'algorithm' }, { seed: 3 });
    later(Block3.processAsync(raw, { continuous: 'scaled', inapplicable: 'algorithm' }, { seed: 3 }).then(p2 => {
      t('el procesamiento por tandas da lo mismo que de una vez (árboles, CI, colapsados y estricto)', p2.trees.length === p1.trees.length && p2.trees.every((x, i) => Math.abs(x.ci - p1.trees[i].ci) < 1e-12 && Math.abs(x.ri - p1.trees[i].ri) < 1e-12) && p2.condensed.length === p1.condensed.length && Tree.cladeKey(p2.strict, md.taxa.length) === Tree.cladeKey(p1.strict, md.taxa.length));
    }));
    state.matrix = keep2;
  }
  /* an exact search has no replicates: the block must say «Exacta», not «0 / 1 réplicas» */
  later(Pool.search({ matrix: exM('bursera'), prep: {}, opts: { method: 'exact', seed: 1 } }).then(r => {
    t('búsqueda exacta en hilo: L = 17, sin contar réplicas (hits = null) y completa', r.length === 17 && r.hits === null && r.complete === true && r.threads === 1, JSON.stringify([r.length, r.hits, r.complete, r.threads]));
  }));
  later(Pool.runOne({ task: 'successive', matrix: exM('bursera'), prep: {}, opts: { method: 'heuristic', replicates: 2, seed: 1 }, sw: { base: 10 } }).then(r => {
    t('pesos sucesivos en un hilo', Array.isArray(r.weights) && r.log.length >= 1);
  }));
}
