/* CladisticsPro — Copyright (C) 2026 Luis Ángel Barrera-Guzmán.
   Free software under the GNU General Public License, version 3 or later; see LICENSE. */

/* Unit tests for Block 1: trees, optimization of characters, the cladogram
   and the labs of the home page.

   The references are independent of the code under test:
     · answers worked out by hand (the four-taxon character, the ordered
       character, the hero of the home page);
     · brute force written here, inside the test: every assignment of states
       to the nodes of small trees, which yields the MPR sets by definition;
     · identities that must hold whatever the implementation (Sankoff with a
       0/1 matrix = Fitch; an ordered character = its additive binary coding;
       ACCTRAN and DELTRAN as long as the down pass);
     · R (phangorn, TreeSearch) in validation/block1. */

/* ---------------- helpers of the tests ---------------- */
const nw = (s, taxa) => Tree.parseNewick(s, taxa);
const tipsOf = r => Tree.tips(r).map(v => v.name);
const cladeKeys = (r, n) => [...Tree.clades(r, n).keys()].sort().join('|');
/* brute force: every assignment of states to the internal nodes and of a
   state of its set to every tip; returns the length and the MPR sets */
function bruteMPR(root, masks, k, cost) {
  const nodes = Tree.preorder(root);
  const choices = nodes.map(v => v.children.length ? [...Array(k).keys()] : Opt.bits(masks[v.tip]));
  let best = Infinity;
  const sets = nodes.map(() => 0);
  const st = new Array(nodes.length);
  const idx = new Map(nodes.map((v, i) => [v, i]));
  (function rec(i) {
    if (i === nodes.length) {
      let c = 0;
      for (let j = 1; j < nodes.length; j++) c += cost[st[idx.get(nodes[j].parent)]][st[j]];
      if (c < best - 1e-12) { best = c; sets.fill(0); }
      if (Math.abs(c - best) < 1e-12) for (let j = 0; j < nodes.length; j++) sets[j] |= 1 << st[j];
      return;
    }
    for (const s of choices[i]) { st[i] = s; rec(i + 1); }
  })(0);
  return { best, sets: new Map(nodes.map((v, i) => [v, sets[i]])) };
}
/* a random rooted binary tree with taxa 0..n-1 (root on taxon 0) */
function randomRooted(n, r) {
  const all = Tree.allTrees(Math.min(n, 7));
  return all[Math.floor(r() * all.length)];
}

/* ================================================================
   1 · utilities
   ================================================================ */
sec('1 · Utilidades (core.js)');
t('fmtIdx escribe «—» cuando el índice no está definido', fmtIdx(null) === '—' && fmtIdx(NaN) === '—');
t('fmtIdx da tres decimales', fmtIdx(0.5) === '0.500');
t('el generador con la misma semilla repite la secuencia', (() => { const a = rng(9), b = rng(9); for (let i = 0; i < 40; i++) if (a() !== b()) return false; return true; })());
t('semillas distintas dan secuencias distintas', rng(1)() !== rng(2)());
t('slug quita acentos y signos', slug('Matriz de Cactáceas (v2).nex') === 'Matriz_de_Cactaceas_v2');
t('fmtNum usa el signo menos tipográfico', fmtNum(-3.25) === '−3.25');

/* ================================================================
   2 · trees
   ================================================================ */
sec('2 · Árboles (tree.js)');
{
  const r = nw("(A,(B,('C d',E_f)));");
  t('Newick: lee nombres entre comillas y guiones bajos como espacios', tipsOf(r).join(',') === 'A,B,C d,E f');
  t('Newick: ida y vuelta conserva la topología', Tree.toNewick(nw(Tree.toNewick(r))) === Tree.toNewick(r));
  const r2 = nw('((A:0.1,B:0.2)[&x=1]:0.3,C:0.4);');
  t('Newick: conserva longitudes y comentarios', r2.children[0].len === 0.3 && r2.children[0].comment === '&x=1' && r2.children[1].len === 0.4);
  const r3 = nw('(a,(B,c));', ['A', 'b', 'C']);
  t('Newick: une las puntas con los taxones sin importar mayúsculas', Tree.tips(r3).map(v => v.tip).join(',') === '0,1,2');
  let err = null;
  try { nw('(A,(B,X));', ['A', 'B', 'C']); } catch (e) { err = e; }
  t('Newick: un taxón que no está en la matriz es un error con su nombre', err && /X/.test(err.message));
  let err2 = null;
  try { nw('(A,(B,C);'); } catch (e) { err2 = e; }
  t('Newick: un paréntesis sin cerrar es un error', !!err2);
}
for (let n = 3; n <= 8; n++) {
  const all = Tree.allTrees(n);
  const keys = new Set(all.map(r => cladeKeys(r, n)));
  t(`hay (2n−5)!! = ${Tree.countUnrooted(n)} árboles sin raíz de ${n} taxones, todos distintos`, all.length === Tree.countUnrooted(n) && keys.size === all.length);
}
t('cada árbol enumerado es binario y tiene todas las puntas', Tree.allTrees(6).every(r => Tree.postorder(r).every(v => v.children.length === 0 || v.children.length === 2) && Tree.tips(r).length === 6));
{
  const taxa = ['A', 'B', 'C', 'D', 'E'];
  const r = nw('(A,(B,(C,(D,E))));', taxa);
  const before = cladeKeys(r, 5);
  const c1 = Tree.clone(r);
  const rr = Tree.rerootAbove(c1, Tree.tips(c1).find(v => v.name === 'D'));
  t('reenraizar conserva las puntas', tipsOf(rr).sort().join('') === 'ABCDE');
  t('reenraizar deja una raíz con dos hijos y sin nodos de grado dos', rr.children.length === 2 && Tree.postorder(rr).every(v => v.children.length !== 1));
  const back = Tree.rootOn(rr, [0]);
  t('enraizar sobre el grupo externo regresa al árbol original', back.ok && cladeKeys(back.root, 5) === before);
  const og2 = Tree.rootOn(nw('((A,B),(C,(D,E)));', taxa), [0, 1]);
  t('enraizar sobre un grupo externo de dos taxones lo pone primero', og2.ok && Tree.tips(og2.root.children[0]).map(v => v.name).sort().join('') === 'AB');
  const bad = Tree.rootOn(nw('((A,C),(B,(D,E)));', taxa), [0, 1]);
  t('un grupo externo no monofilético se informa (ok = false)', bad.ok === false);
  const lad = Tree.ladderize(nw('((D,E),(A,(B,C)));', taxa));
  t('escalonar pone primero el clado menor', lad.children[0].children.length === 2 && Tree.tips(lad.children[0]).length === 2);
  const un = nw('((A),(B,C));', ['A', 'B', 'C']);
  Tree.cleanUnary(un);
  t('cleanUnary quita los nodos con un solo hijo', Tree.postorder(un).every(v => v.children.length !== 1));
  const cl = Tree.clades(nw('(A,(B,(C,(D,E))));', taxa), 5);
  t('clados de un árbol de 5 taxones: 4 (incluida la raíz)', cl.size === 4 && cl.has('00011') && cl.has('11111'));
}

/* ================================================================
   3 · optimization
   ================================================================ */
sec('3 · Optimización (optimize.js)');
{
  const taxa = ['A', 'B', 'C', 'D'];
  const m = [1, 1, 2, 2];   // 0 0 1 1
  const L = s => Opt.character(nw(s, taxa), i => m[i], 2, Opt.costMatrix('unord', 2)).length;
  t('carácter 0011: ((A,B),(C,D)) mide 1', L('((A,B),(C,D));') === 1);
  t('carácter 0011: ((A,C),(B,D)) mide 2', L('((A,C),(B,D));') === 2);
  t('carácter 0011: ((A,D),(B,C)) mide 2', L('((A,D),(B,C));') === 2);
  const r3 = nw('(A,(B,C));', ['A', 'B', 'C']);
  const m3 = [1, 4, 4];   // 0, 2, 2
  t('ordenado 0–2–2 mide 2 bajo Wagner', Opt.character(r3, i => m3[i], 3, Opt.costMatrix('ord', 3)).length === 2);
  t('el mismo carácter mide 1 sin orden', Opt.character(r3, i => m3[i], 3, Opt.costMatrix('unord', 3)).length === 1);
}
/* Sankoff with a 0/1 matrix must reproduce Fitch, including polymorphisms and «?» */
{
  const r = rng(101);
  let bad = 0, n = 0;
  const trees = Tree.allTrees(7);
  for (let rep = 0; rep < 400; rep++) {
    const tr = trees[Math.floor(r() * trees.length)];
    const k = 2 + Math.floor(r() * 3), full = (1 << k) - 1;
    const masks = Array.from({ length: 7 }, () => { const u = r(); if (u < 0.1) return full; let m = 1 << Math.floor(r() * k); if (u < 0.18) m |= 1 << Math.floor(r() * k); return m; });
    const a = Opt.character(tr, i => masks[i], k, Opt.costMatrix('unord', k)).length;
    const b = Opt.fitch(tr, i => masks[i]);
    n++; if (a !== b) bad++;
  }
  t(`matriz de costos 0/1 = Fitch en ${n} caracteres al azar (2–4 estados, «?» y polimorfismos)`, bad === 0, bad + ' desacuerdos');
}
/* MPR sets against brute force */
{
  const r = rng(202);
  let bad = 0, badLen = 0, n = 0;
  const trees = Tree.allTrees(6);
  for (let rep = 0; rep < 120; rep++) {
    const tr = trees[Math.floor(r() * trees.length)];
    const type = ['unord', 'ord', 'step'][rep % 3];
    const k = type === 'unord' ? 2 + (rep % 2) : 3;
    const custom = type === 'step' ? [[0, 1, 4], [2, 0, 1], [3, 1, 0]] : null;
    const cost = Opt.costMatrix(type, k, custom);
    const full = (1 << k) - 1;
    const masks = Array.from({ length: 6 }, () => { const u = r(); if (u < 0.08) return full; let m = 1 << Math.floor(r() * k); if (u < 0.15) m |= 1 << Math.floor(r() * k); return m; });
    const res = Opt.character(tr, i => masks[i], k, cost);
    const bf = bruteMPR(tr, masks, k, cost);
    n++;
    if (Math.abs(res.length - bf.best) > 1e-9) badLen++;
    for (const v of Tree.postorder(tr)) if (v.children.length && res.mpr.get(v) !== bf.sets.get(v)) { bad++; break; }
  }
  t(`longitud igual a la fuerza bruta en ${n} caracteres (no ordenados, ordenados y matrices de pasos asimétricas)`, badLen === 0, badLen + ' desacuerdos');
  t(`conjuntos MPR de cada nodo interno iguales a los de la fuerza bruta en ${n} caracteres`, bad === 0, bad + ' desacuerdos');
}
/* ACCTRAN and DELTRAN are shortest reconstructions */
{
  const r = rng(303);
  let bad = 0, n = 0, badSet = 0;
  const trees = Tree.allTrees(7);
  for (let rep = 0; rep < 300; rep++) {
    const tr = trees[Math.floor(r() * trees.length)];
    const type = rep % 2 ? 'ord' : 'unord', k = 3;
    const cost = Opt.costMatrix(type, k);
    const masks = Array.from({ length: 7 }, () => (r() < 0.1 ? 7 : 1 << Math.floor(r() * k)));
    const res = Opt.character(tr, i => masks[i], k, cost);
    n++;
    if (res.acctran.steps !== res.length || res.deltran.steps !== res.length) bad++;
    for (const v of Tree.postorder(tr)) {
      const a = res.acctran.states.get(v), d = res.deltran.states.get(v);
      if (!((res.mpr.get(v) >>> a) & 1) || !((res.mpr.get(v) >>> d) & 1)) { badSet++; break; }
    }
  }
  t(`ACCTRAN y DELTRAN miden lo mismo que la pasada descendente (${n} caracteres)`, bad === 0, bad + ' fallas');
  t('cada estado que eligen ACCTRAN y DELTRAN está en el conjunto MPR de su nodo', badSet === 0, badSet + ' fallas');
}
/* The textbook case: a gain and a reversal against two gains */
{
  const root = nw('(GE,(A,(B,(C,(D,(E,F))))));', ['GE', 'A', 'B', 'C', 'D', 'E', 'F']);
  const m = [1, 1, 2, 1, 2, 2, 2];
  const res = Opt.character(root, i => m[i], 2, Opt.costMatrix('unord', 2));
  const gains = rec => rec.changes.filter(c => c.to === 1).length;
  t('caso de libro: mide 2 pasos', res.length === 2);
  t('ACCTRAN: una ganancia y una reversión', gains(res.acctran) === 1 && res.acctran.changes.filter(c => c.to === 0).length === 1);
  t('DELTRAN: dos ganancias independientes', gains(res.deltran) === 2 && res.deltran.changes.length === 2);
  t('ningún cambio es no ambiguo', res.acctran.changes.every(c => !c.unambiguous) && res.deltran.changes.every(c => !c.unambiguous));
  t('la reversión de ACCTRAN es homoplásica y su ganancia no', res.acctran.changes.find(c => c.to === 0).homoplastic && !res.acctran.changes.find(c => c.to === 1).homoplastic);
  t('las dos ganancias de DELTRAN son homoplásicas', res.deltran.changes.every(c => c.homoplastic));

}
/* a tied root: both root states give shortest reconstructions, and either can be fixed */
{
  const root = nw('((A,B),(C,D));', ['A', 'B', 'C', 'D']);
  const m = [1, 1, 2, 2];
  const res = Opt.character(root, i => m[i], 2, Opt.costMatrix('unord', 2));
  t('raíz empatada: los dos estados son candidatos', res.rootCandidates.join(',') === '0,1');
  const r0 = res.reconstruct('acctran', 0), r1 = res.reconstruct('acctran', 1);
  t('fijar la raíz en 0 o en 1 mueve el cambio de un lado al otro de la raíz sin cambiar la longitud',
    r0.steps === 1 && r1.steps === 1 && r0.changes[0].node !== r1.changes[0].node && r0.rootState === 0 && r1.rootState === 1);
  const forced = Opt.character(root, i => m[i], 2, Opt.costMatrix('unord', 2), { rootState: 1 });
  t('opts.rootState fija la raíz en las dos reconstrucciones', forced.acctran.rootState === 1 && forced.deltran.rootState === 1);
  const r3 = Opt.character(nw('(A,(B,C));', ['A', 'B', 'C']), i => [1, 1, 2][i], 2, Opt.costMatrix('unord', 2), { rootState: 1 });
  t('un estado de raíz que no es óptimo se ignora', r3.acctran.rootState === 0 && r3.acctran.steps === r3.length);
}
/* Additive binary coding: an ordered character equals its k−1 thresholds */
{
  const r = rng(404);
  let bad = 0, n = 0;
  const trees = Tree.allTrees(6);
  for (let rep = 0; rep < 60; rep++) {
    const k = 3 + (rep % 3);
    const st = Array.from({ length: 6 }, () => Math.floor(r() * k));
    const ordL = trees.map(tr => Opt.character(tr, i => 1 << st[i], k, Opt.costMatrix('ord', k)).length);
    const binL = trees.map(tr => { let L = 0; for (let j = 1; j < k; j++) L += Opt.fitch(tr, i => (st[i] >= j ? 2 : 1)); return L; });
    n += trees.length;
    for (let i = 0; i < trees.length; i++) if (ordL[i] !== binL[i]) bad++;
  }
  t(`codificación binaria aditiva = carácter ordenado en ${n} árboles × carácter (los 105 árboles de 6 taxones)`, bad === 0, bad + ' desacuerdos');
}
/* bounds and indices */
{
  t('pasos mínimos, no ordenado: {0,1,2} observados → 2', Opt.minSteps([1, 2, 4, 1], 3, 'unord') === 2);
  t('pasos mínimos con polimorfismo: {0} {01} {1} → 1', Opt.minSteps([1, 3, 2], 2, 'unord') === 1);
  t('pasos mínimos: un polimorfismo que cubre a todos → 0', Opt.minSteps([1, 3, 1, 3], 2, 'unord') === 0);
  t('pasos mínimos: «?» no cuenta', Opt.minSteps([1, 1, 3, 3], 2, 'unord') === 0);
  t('pasos mínimos, ordenado: 0 y 3 observados → 3', Opt.minSteps([1, 8, 1], 4, 'ord') === 3);
  t('pasos mínimos, ordenado con {12}: la ventana más estrecha', Opt.minSteps([1, 6, 8], 4, 'ord') === 3 && Opt.minSteps([2, 6, 4], 4, 'ord') === 1);
  const sm = Opt.costMatrix('step', 3, [[0, 1, 5], [1, 0, 1], [5, 1, 0]]);
  t('matriz de pasos: 0 y 2 observados con 0→2 = 5 y 0→1→2 = 2 → mínimo 2 (Steiner por el estado 1)', Opt.minSteps([1, 4], 3, 'step', sm) === 2);
  const sa = Opt.costMatrix('step', 3, [[0, 1, 1], [9, 0, 9], [9, 9, 0]]);
  t('matriz de pasos asimétrica: 1 y 2 observados, ir desde 0 es lo barato → 2', Opt.minSteps([2, 4], 3, 'step', sa) === 2);
  t('pasos máximos (árbol estrella), no ordenado: 3 de un estado y 2 de otro → 2', Opt.maxSteps([1, 1, 1, 2, 2], 2, Opt.costMatrix('unord', 2)) === 2);
  t('pasos máximos, ordenado: 0,0,2,2 → 4', Opt.maxSteps([1, 1, 4, 4], 3, Opt.costMatrix('ord', 3)) === 4);
  const taxa = ['G', 'A', 'B', 'C', 'D'];
  const mat = {
    taxa, chars: [0, 1, 2, 3].map(c => ({ name: 'c' + c, states: ['0', '1'], type: 'unord' })),
    cells: ['0000', '1100', '1100', '1011', '1011'].map(r => [...r].map(ch => (ch === '0' ? 1 : 2))),
  };
  const A = Opt.analyse(nw('(G,((A,B),(C,D)));', taxa), mat);
  t('matriz perfectamente jerárquica: CI = 1 y RI = 1', A.ci === 1 && A.ri === 1);
  t('el carácter no informativo (sólo el grupo externo distinto) no tiene RI', A.per[0].ri === null && A.per[0].informative === false);
  const B = Opt.analyse(nw('(G,((A,C),(B,D)));', taxa), mat);
  /* by hand: s = 1 + 2 + 2 + 2 = 7, m = 4, g = 1 + 2 + 2 + 2 = 7 */
  near('árbol equivocado: CI = Σm/Σs = 4/7', B.ci, 4 / 7, 1e-12);
  near('árbol equivocado: RI = (Σg − Σs)/(Σg − Σm) = (7 − 7)/(7 − 4) = 0', B.ri, 0, 1e-12);
}
/* the hero of the home page draws a true optimization */
{
  const taxa = ['G', 'A', 'B', 'C', 'D', 'E'];
  const root = nw(Art.HERO_TREE, taxa);
  const mat = { taxa, chars: Array.from({ length: 8 }, (_, c) => ({ name: 'c' + c, states: ['0', '1'], type: 'unord' })), cells: Art.HERO_MATRIX.map(r => [...r].map(ch => (ch === '0' ? 1 : 2))) };
  const A = Opt.analyse(root, mat, { optimization: 'acctran' });
  const got = {};
  A.byNode.forEach((list, v) => {
    const key = Tree.tips(v).map(x => x.tip).sort().join('');
    got[key] = list.map(c => c.c + '>' + c.to + (c.homoplastic ? 'h' : '')).sort().join(',');
  });
  const want = {};
  Object.keys(Art.HERO_CHANGES).forEach(k => { want[k] = Art.HERO_CHANGES[k].map(c => c.c + '>' + c.to + (c.open ? 'h' : '')).sort().join(','); });
  t('las marcas del héroe de la portada son la optimización ACCTRAN real de su matriz', JSON.stringify(got, Object.keys(got).sort()) === JSON.stringify(want, Object.keys(want).sort()), JSON.stringify(got));
}

/* ================================================================
   4 · the cladogram
   ================================================================ */
sec('4 · El cladograma (cladogram.js)');
{
  const taxa = ['G', 'A', 'B', 'C', 'D'];
  const root = nw('(G,((A,B),(C,D)));', taxa);
  const mat = { taxa, chars: [0, 1, 2].map(c => ({ name: 'c' + c, states: ['0', '1'], type: 'unord' })), cells: ['000', '110', '111', '101', '100'].map(r => [...r].map(ch => (ch === '0' ? 1 : 2))) };
  const A = Opt.analyse(root, mat);
  let nCh = 0, nHom = 0;
  A.byNode.forEach(l => { nCh += l.length; nHom += l.filter(c => c.homoplastic).length; });
  const svg = Clado.render(root, { marks: A.byNode });
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const marks = doc.querySelectorAll('.clado-mark[data-char]');
  t('dibuja una marca por cambio', marks.length === nCh, marks.length + ' vs ' + nCh);
  t('las marcas homoplásicas son vacías', doc.querySelectorAll('.clado-mark.open[data-char]').length === nHom);
  t('el SVG trae la marca de figura y una leyenda marcada para el editor', doc.documentElement.getAttribute('data-plot') === 'cladogram' && !!doc.querySelector('[data-role="legend"] [data-li]'));
  const vb = doc.documentElement.getAttribute('viewBox').split(' ').map(Number);
  t('el lienzo tiene medidas finitas y positivas', vb.every(Number.isFinite) && vb[2] > 0 && vb[3] > 0);
  const w = s => Number(new DOMParser().parseFromString(s, 'image/svg+xml').documentElement.getAttribute('width'));
  const t1 = Clado.render(nw('(G,(A,(B,(C,D))));', taxa), { treeWidth: 60, legend: false });
  const t2 = Clado.render(nw('(G,((A,B),(C,D)));', taxa), { treeWidth: 60, legend: false });
  t('con treeWidth, árboles de distinta profundidad salen del mismo ancho', w(t1) === w(t2));
  const many = new Map([[root.children[1], Array.from({ length: 6 }, (_, c) => ({ c, to: 1 }))]]);
  const sv = Clado.render(root, { marks: many, legend: false });
  const xs = [...new DOMParser().parseFromString(sv, 'image/svg+xml').querySelectorAll('.clado-mark circle')].map(c => +c.getAttribute('cx')).sort((a, b) => a - b);
  t('seis marcas en una rama no se enciman (al menos 12 px entre centros)', xs.every((x, i) => i === 0 || x - xs[i - 1] >= 12));
}

/* ================================================================
   5 · the labs
   ================================================================ */
sec('5 · Los laboratorios (labs.js)');
{
  const ranked = Labs.lab1Trees();
  t('el laboratorio 1 evalúa los 15 árboles', ranked.length === 15);
  t('con la matriz de partida, un solo árbol es el más corto, con 7 pasos', ranked[0].L === 7 && ranked[1].L > 7);
  const M = Labs.lab1Matrix();
  const indep = ranked.map(rk => { let L = 0; for (let c = 0; c < 6; c++) L += Opt.character(rk.t, i => M.cells[i][c], 2, Opt.costMatrix('unord', 2)).length; return L; });
  t('las 15 longitudes coinciden con la optimización general', ranked.every((rk, i) => rk.L === indep[i]));
  const best = ranked[0].t;
  t('el más corto es (GE,((A,B),(C,D)))', cladeKeys(best, 5).includes('01100') && cladeKeys(best, 5).includes('00011'));
}

/* ================================================================
   6 · the map of the app
   ================================================================ */
sec('6 · El mapa de la app');
t('hay diez bloques declarados', STEPS.length === 10);
t('el Bloque 1 está listo', STEPS[0].ready === true);
t('cada bloque tiene nombre en los dos idiomas', STEPS.every(s => s.es && s.en));
t('los números de bloque van del 1 al 10 sin huecos', STEPS.every((s, i) => s.n === i + 1));
t('la portada describe los diez bloques', Home.BLOCKS.length === 10 && Home.BLOCKS.every(b => b.d[0] && b.d[1]));
{
  /* every source cited by a method is in the reference list */
  const missing = [];
  Home.METHODS.forEach(m => {
    m[3].split(/;\s*/).forEach(c => {
      const mm = c.match(/^([A-Za-zÀ-ÿ'\- ]+?)\s(?:y|e|et al\.)?.*?(\d{4})/);
      if (!mm) { missing.push(c); return; }
      const first = mm[1].trim().split(' ')[0], years = c.match(/\d{4}/g);
      years.forEach(y => { if (!Home.REFS.some(r => r[0].includes(first) && r[0].includes(y + '.'))) missing.push(c + ' (' + y + ')'); });
    });
  });
  t(`las ${Home.METHODS.length} citas de la galería de métodos están en las referencias`, missing.length === 0, missing.join('; '));
  /* by the surname of the first author (works of the same author follow by year) */
  const sur = Home.REFS.map(r => r[0].split(/[ ,.]/)[0]);
  t('las referencias están en orden alfabético del primer autor', sur.every((r, i) => i === 0 || sur[i - 1].localeCompare(r, 'es', { sensitivity: 'base' }) <= 0), sur.join(' '));
}
/* the names go encoded, so that not even the tests spell a commercial program */
const forbiddenNames = new RegExp('\\b(' + atob('UEFVUHxUTlR8Tk9OQXxNZXNxdWl0ZXxNYWNDbGFkZXxXaW5DbGFkYXxXaW5jbGFkYXxIZW5uaWc4Ng==') + ')\\b');
t('ninguna referencia ni método nombra un programa comercial', !forbiddenNames.test(JSON.stringify([Home.METHODS, Home.REFS, Home.THEORY])));
