/* CladisticsPro — Copyright (C) 2026 Luis Ángel Barrera-Guzmán.
   Free software under the GNU General Public License, version 3 or later; see LICENSE. */

/* Unit tests for Blocks 5 and 6: editing trees by hand, characters mapped on
   a tree (mapping.js) with the same length as the search, the inapplicable
   algorithm by regions, continuous characters, the bounds of the indices, the
   drawing, and the parts of the two blocks that do not need the page. */
sec('20 · Editar un árbol a mano (tree.js)');
{
  const nm = ['A', 'B', 'C', 'D', 'E', 'F'];
  const key = r => Tree.cladeKey(r, 6);
  const P = s => Tree.parseNewick(s, nm);
  const find = (r, names) => Tree.postorder(r).find(v => Tree.tips(v).map(t => t.name).sort().join() === names);
  let r = P('(A,((B,C),(D,(E,F))));');
  r = Tree.moveClade(r, find(r, 'B,C'), find(r, 'E,F'));
  t('mover (B,C) a la rama de (E,F) da (A,(D,((E,F),(B,C))))', key(r) === key(P('(A,(D,((E,F),(B,C))));')), Tree.toNewick(r));
  t('al mover se conservan los seis taxones', Tree.tips(r).length === 6 && Tree.isBinary(r));
  const before = key(r);
  const r2 = Tree.moveClade(r, find(r, 'B,C,D,E,F'), find(r, 'E,F'));
  t('un clado no puede ir dentro de sí mismo', key(r2) === before);
  r = P('(A,((B,C),(D,(E,F))));');
  r = Tree.moveClade(r, find(r, 'A'), find(r, 'B,C'));
  t('mover un taxón junto a otro clado', key(r) === key(P('((A,(B,C)),(D,(E,F)));')), Tree.toNewick(r));
  r = P('(A,((B,C),(D,(E,F))));');
  Tree.collapseNode(r, find(r, 'D,E,F'));
  t('colapsar deja una politomía', find(r, 'B,C,D,E,F').children.length === 3 && !Tree.isBinary(r));
  const v = find(r, 'B,C,D,E,F');
  Tree.resolvePair(r, v, v.children.find(c => c.name === 'D'), v.children.find(c => c.tip < 0 && Tree.tips(c).length === 2 && Tree.tips(c)[0].name === 'B'));
  t('resolver la politomía uniendo dos de sus ramas', !!find(r, 'B,C,D') && Tree.isBinary(r));
  const w = find(r, 'B,C');
  const order = w.children.map(c => c.name).join();
  Tree.rotate(r, w);
  t('girar invierte el orden de las ramas', w.children.map(c => c.name).join() === order.split(',').reverse().join());
  t('«dentro de» reconoce el propio clado y sus descendientes', Tree.within(find(r, 'B,C'), find(r, 'B,C,D')) && !Tree.within(find(r, 'B,C,D'), find(r, 'B,C')));
  /* names that end in an underscore keep matching themselves */
  const tr = Tree.parseNewick('(Owenia_sp_,(Myriochele_sp_,X));', ['Owenia_sp_', 'Myriochele_sp_', 'X']);
  t('un nombre con guion bajo al final se reconoce al leer el árbol', Tree.tips(tr).every(x => x.tip >= 0));
}

sec('21 · Caracteres mapeados en un árbol (mapping.js)');
{
  const R = E.rng(31);
  const check = (id, prep, reps) => {
    const m = exM(id);
    const P = E.prepare(m, prep), M = Mapping.prepare(m, prep);
    let ok = 0;
    for (let i = 0; i < reps; i++) {
      const T = E.wagner(P, R);
      const root = Tree.rootOn(Tree.parseNewick(E.toNewick(P, T), M.names), P.outgroup).root;
      if (Math.abs(Mapping.map(M, root).length - E.evaluate(P, T).length) < 1e-7) ok++;
    }
    return ok === reps;
  };
  t('Bursera: la longitud del mapeo es la de la búsqueda (8 árboles)', check('bursera', {}, 8));
  t('Dahlia con «–» como «?» y continuos escalados: misma longitud', check('dahlia', { inapplicable: 'missing', continuous: 'scaled' }, 8));
  t('Dahlia con el algoritmo de inaplicables: misma longitud', check('dahlia', { inapplicable: 'algorithm', continuous: 'scaled' }, 8));
  t('Dahlia con continuos en sus unidades: misma longitud', check('dahlia', { inapplicable: 'algorithm', continuous: 'raw' }, 8));
  /* the regions: «1 1 – – –» */
  const m = Mx.create(5, 1);
  m.taxa.forEach((x, i) => { x.name = 't' + (i + 1); x.outgroup = i === 0; });
  m.chars[0].states = ['0', '1'];
  m.cells = [[2], [2], [Mx.GAP], [Mx.GAP], [Mx.GAP]];
  const M = Mapping.prepare(m, { inapplicable: 'algorithm' });
  const root = Tree.parseNewick('((((t4,t2),t5),t3),t1);', M.names);
  const p = Mapping.map(M, root).per[0];
  t('«1 1 – – –»: dos regiones aplicables, ningún cambio dentro, longitud 1', p.kind === 'inap' && p.regions === 2 && p.inside === 0 && p.steps === 1);
  t('los nodos entre las dos regiones no son aplicables', Tree.postorder(root).filter(v => v.children.length && !p.applicable.get(v)).length === 3);
  const poly = Tree.parseNewick('((t4,t2,t5),t3,t1);', M.names);
  const pp = Mapping.map(M, poly);
  t('en un árbol con politomías «–» se lee como «?» y se dice', pp.fallback === 1 && pp.per[0].fallback === true);
  /* bounds with «–», as the reference implementation */
  const b = Mapping.inapBounds([2, 2, 'gap', 'gap', 'gap'], 3);
  t('cotas con «–» de «1 1 – – –»: mínimo 0 y máximo 1 (una región posible de más)', b.min === 0 && b.max === 1, JSON.stringify(b));
  const b2 = Mapping.inapBounds([1, 2, 1, 2, 'gap', 'gap', 'gap', 'any'], 3);
  t('cotas con «–» de «0 1 0 1 – – – ?»: mínimo 1 y máximo 2 + 1 región', b2.min === 1 && b2.max === 3, JSON.stringify(b2));
  /* ACCTRAN and DELTRAN of every character are shortest reconstructions */
  const d = exM('dahlia'), Md = Mapping.prepare(d, { inapplicable: 'algorithm' });
  const Pd = E.prepare(d, { inapplicable: 'algorithm' });
  const rd = Tree.rootOn(Tree.parseNewick(E.toNewick(Pd, E.wagner(Pd, R)), Md.names), Pd.outgroup).root;
  const res = Mapping.map(Md, rd);
  let okR = 0, nR = 0;
  res.per.forEach(q => {
    if (q.kind !== 'disc') return;
    nR++;
    const cost = (rec) => rec.changes.reduce((a, c) => a + q.ch.cost[c.from][c.to], 0);
    if (Math.abs(cost(q.acctran) - q.steps) < 1e-9 && Math.abs(cost(q.deltran) - q.steps) < 1e-9) okR++;
  });
  t(`ACCTRAN y DELTRAN cuestan lo mismo que la optimización (${nR} caracteres de Dahlia)`, okR === nR, okR + '/' + nR);
  /* continuous: the reconstructions stay inside the intervals of most parsimonious values */
  let okC = 0, nC = 0;
  res.per.forEach(q => {
    if (q.kind !== 'cont') return;
    Tree.postorder(rd).forEach(v => {
      const iv = q.mpr.get(v);
      [q.acctran, q.deltran].forEach(rec => { nC++; const x = rec.states.get(v); if (x >= iv[0] - 1e-9 && x <= iv[1] + 1e-9) okC++; });
    });
    const len = rec => rec.changes.reduce((a, c) => a + Math.abs(c.delta), 0);
    nC++; if (Math.abs(len(q.acctran) - q.raw) < 1e-9 && Math.abs(len(q.deltran) - q.raw) < 1e-9) okC++;
  });
  t('continuos: las reconstrucciones caen en sus intervalos y miden lo que la optimización', okC === nC, okC + '/' + nC);
  /* the changes of the inapplicable characters stay inside the applicable regions */
  let inReg = true;
  res.per.forEach(q => { if (q.kind === 'inap') q.acctran.changes.forEach(c => { if (!q.applicable.get(c.node) || !q.applicable.get(c.node.parent)) inReg = false; }); });
  t('con «–», ningún cambio cae en una rama donde el carácter no aplica', inReg);
  t('CI y RI del conjunto entre 0 y 1', res.ci > 0 && res.ci <= 1 && res.ri >= 0 && res.ri <= 1);
}

sec('22 · Asimetría y raíz');
{
  /* an asymmetric step matrix depends on the root: the search measures it
     with the root between outgroup and ingroup, as the cladogram is drawn */
  const d = exM('dahlia');
  const P = E.prepare(d, {}), M = Mapping.prepare(d, {});
  t('Dahlia trae una matriz de pasos asimétrica y dos taxones de grupo externo', P.slow.some(s => s.asym) && P.outgroup.length === 2);
  const R = E.rng(4);
  let ok = 0;
  for (let i = 0; i < 6; i++) {
    const T = E.wagner(P, R);
    const root = Tree.rootOn(Tree.parseNewick(E.toNewick(P, T), M.names), P.outgroup).root;
    const q = P.chars.find(c => c.slow && c.slow.asym);
    const mq = Mapping.map(M, root).per.find(x => x.ch.j === q.j);
    if (Math.abs(mq.steps - E.evaluate(P, T).steps[q.q]) < 1e-9) ok++;
  }
  t('la búsqueda y el cladograma miden igual la matriz asimétrica (6 árboles)', ok === 6, ok);
  /* branch and bound with an asymmetric matrix finds every shortest tree */
  const m = Mx.create(7, 5);
  const R2 = E.rng(17);
  m.taxa.forEach((x, i) => { x.name = 't' + i; x.outgroup = i < 2; });
  m.cells = m.cells.map(row => row.map(() => 1 << Math.floor(R2() * 3)));
  m.chars.forEach((c, j) => { c.states = ['0', '1', '2']; if (j < 2) { c.type = 'step'; c.cost = [[0, 1, 3], [2, 0, 1], [1, 3, 0]]; } });
  const Pa = E.prepare(m, {});
  let best = Infinity; const keys = new Set();
  Tree.allTrees(7, Pa.names).forEach(r => { const T = E.fromNodeTree(Pa, r); const s = E.score(Pa, T); if (s < best - 1e-9) { best = s; keys.clear(); } if (Math.abs(s - best) < 1e-9) keys.add(E.treeKey(T)); });
  const bk = new Set(E.branchAndBound(Pa, {}).trees.map(x => E.treeKey(x.T)));
  t(`rama y cota con matriz asimétrica = enumeración (${keys.size} árboles)`, bk.size === keys.size && [...keys].every(k => bk.has(k)));
}

sec('23 · El cladograma con marcas y pintado');
{
  const nm = ['A', 'B', 'C', 'D'];
  const r = Tree.parseNewick('(A,(B,(C,D)));', nm);
  const cd = Tree.postorder(r).find(v => v.children.length && Tree.tips(v).length === 2);
  const marks = new Map([[cd, [{ c: 0, to: 1 }, { c: 1, to: 2, homoplastic: true }, { c: 2, to: 0, unambiguous: false }]]]);
  const svg = Clado.render(r, { marks, fitMarks: true, minUnit: 20 });
  t('tres marcas: llena, vacía y ambigua', (svg.match(/class="clado-mark"/g) || []).length >= 1 && /clado-mark open/.test(svg) && /clado-mark ambig/.test(svg));
  const plain = Clado.render(r, { fitMarks: true, minUnit: 20, legend: false });
  const width = s => +s.match(/viewBox="0 0 ([\d.]+)/)[1];
  t('cada rama tan larga como sus marcas: con marcas el árbol es más ancho', width(svg) > width(plain));
  const dashed = new Set([cd]);
  const painted = Clado.render(r, { paint: new Map([[cd, 1]]), dashed, nodeText: new Map([[cd, '2.1–3.4']]), paintLegend: [{ color: 'var(--st0)', label: '0' }, { color: 'var(--text-muted)', dashed: true, label: 'no aplica' }] });
  t('pintado: rama punteada donde no aplica, texto en el nodo y leyenda de estados', /stroke-dasharray/.test(painted) && /2\.1–3\.4/.test(painted) && /no aplica/.test(painted) && /data-role="legend"/.test(painted));
  t('con clics, cada rama tiene su blanco', (Clado.render(r, { clickable: true, id: 'x' }).match(/clado-hit/g) || []).length === 7);
}

sec('24 · Bloques 5 y 6');
{
  t('los Bloques 5 y 6 están listos', STEPS[4].ready === true && STEPS[5].ready === true);
  const keepM = state.matrix, keepS = state.search, keepC = state.clado, keepT = state.matrixTrees;
  state.matrix = exM('bursera');
  state.matrixTrees = [];
  state.search = Block3.process(E.search(state.matrix, {}, { method: 'exact' }), {}, { seed: 1 });
  state.clado = null;
  const C = Block5.ensure();
  t('el Bloque 5 toma los árboles de la búsqueda', C && C.src === 'search' && Math.abs(C.map.length - state.search.length) < 1e-9);
  t('fuentes: los árboles, el consenso estricto', Block5.sources().map(s => s.id).join() .includes('search') && Block5.sources().some(s => s.id === 'strict'));
  /* a pasted tree with a taxon that is not in the matrix */
  const names = state.matrix.taxa.map(x => x.name);
  const nw = '(' + names.map(x => "'" + x + "'").join(',') + ",'Bursera inexistente');";
  const rt = Block5.readTree(nw, 'x');
  t('un árbol pegado: los taxones que no están en la matriz se quitan', rt.dropped === 1 && Tree.tips(rt.root).length === names.length);
  const len0 = C.map.length;
  const tip = Tree.tips(C.root)[3], target = Tree.tips(C.root)[6];
  C.root = Tree.moveClade(C.root, tip, target);
  Block5.remap();
  t('al editar el árbol se recalcula la longitud', C.map.length >= len0 - 1e-9);
  /* Block 6 */
  later(Block6.compute().then(D => {
    t('el diagnóstico tiene una fila por carácter con sus cotas', D.per.length === state.clado.M.chars.length && D.per.every(r => r.min <= r.steps + 1e-9 && r.steps <= r.max + 1e-9 || r.max == null));
    t('con un solo árbol, nada cambia entre árboles', D.nTrees === state.clado.list.length && D.per.every(r => !r.moves || D.nTrees > 1));
    const txt = Block6.diagnosisText();
    t('la diagnosis en texto nombra los clados y los terminales', /Clado 1|Clade 1/.test(txt) && txt.includes(state.matrix.taxa[0].name));
    t('los clados se numeran en preorden desde la raíz (0)', [...Block6.numbered(state.clado.root).values()][0] === 0);
    state.matrix = keepM; state.search = keepS; state.clado = keepC; state.matrixTrees = keepT;
  }));
}
