/* CladisticsPro — Copyright (C) 2026 Luis Ángel Barrera-Guzmán.
   Free software under the GNU General Public License, version 3 or later; see LICENSE. */

/* Unit tests for Block 2: the matrix model, its operations with undo, the
   quality control, the readers and writers, the examples and the grid. */
sec('7 · Celdas (matrix.js)');
{
  const unord = { type: 'unord' }, cont = { type: 'cont' };
  t('«0» es el estado 0', Mx.parseCell('0', unord) === 1);
  t('«A» es el estado 10', Mx.parseCell('A', unord) === 1 << 10);
  t('«?» y vacío son desconocidos', Mx.parseCell('?', unord) === Mx.MISSING && Mx.parseCell('', unord) === Mx.MISSING);
  t('«-», «–» y «—» son inaplicables', ['-', '–', '—'].every(s => Mx.parseCell(s, unord) === Mx.GAP));
  t('polimorfismo (01), [01], 0/1, 0&1 y 0,1 dan lo mismo', ['(01)', '[01]', '0/1', '0&1', '0,1', '01'].every(s => Mx.parseCell(s, unord) === 3));
  t('{01} es incertidumbre y se distingue del polimorfismo', Mx.isUnc(Mx.parseCell('{01}', unord)) && !Mx.isUnc(Mx.parseCell('(01)', unord)));
  t('{0} con un solo estado no es incierto', Mx.parseCell('{0}', unord) === 1);
  let err = null; try { Mx.parseCell('X', unord); } catch (e) { err = e; }
  t('un símbolo que no es estado es un error con el símbolo', err && /X/.test(err.message));
  t('continuo: un valor', JSON.stringify(Mx.parseCell('2.5', cont)) === '[2.5,2.5]');
  t('continuo: intervalo con guion, raya o coma decimal', ['2.1-3.4', '2.1–3.4', '2,1-3,4'].every(s => JSON.stringify(Mx.parseCell(s, cont)) === '[2.1,3.4]'));
  let err2 = null; try { Mx.parseCell('5-2', cont); } catch (e) { err2 = e; }
  t('continuo: un intervalo al revés es un error', !!err2);
  t('texto de celdas', ['0', '?', '-', '(01)', '{01}', 'B'].every(s => Mx.cellText(Mx.parseCell(s, unord)) === s));
  t('texto de continuos', Mx.cellText([2.1, 3.4]) === '2.1-3.4' && Mx.cellText([5, 5]) === '5');
  /* a spreadsheet reads «(01)» as −1 and «1-3» as a date */
  t('texto para hoja de cálculo: polimorfismo entre corchetes, intervalo con raya, y se lee igual de vuelta',
    Mx.sheetText(Mx.parseCell('(01)', unord)) === '[01]' && Mx.sheetText(Mx.parseCell('{01}', unord)) === '{01}' && Mx.sheetText([1, 3]) === '1–3' && Mx.sheetText([5, 5]) === '5' &&
    ['0', '?', '-', 'B'].every(s => Mx.sheetText(Mx.parseCell(s, unord)) === s) && Mx.parseCell('[01]', unord) === Mx.parseCell('(01)', unord) && JSON.stringify(Mx.parseCell('1–3', cont)) === '[1,3]');
  t('máscara de análisis: «?» y «–» valen cualquier estado', Mx.analysisMask(Mx.MISSING, 3) === 7 && Mx.analysisMask(Mx.GAP, 2) === 3);
  t('máscara de análisis: la incertidumbre pierde su marca', Mx.analysisMask(Mx.parseCell('{12}', unord), 3) === 6);
}

sec('8 · Operaciones con deshacer');
{
  const base = () => {
    const m = Mx.create(6, 5);
    const r = rng(5);
    m.cells = m.cells.map(row => row.map(() => { const u = r(); return u < 0.1 ? Mx.MISSING : u < 0.15 ? Mx.GAP : 1 << Math.floor(r() * 3); }));
    m.chars.forEach(c => { c.states = ['a', 'b', 'c']; });
    m.chars[3].depends = { on: 1, states: [1] };
    m.chars[4].type = 'step'; m.chars[4].cost = [[0, 1, 2], [1, 0, 1], [2, 1, 0]];
    m.chars[2].images = { 0: 'img_x', 2: 'img_y' };
    return m;
  };
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const ops = [
    { kind: 'cells', list: [[0, 0, 4], [1, 1, Mx.MISSING], [2, 2, [1, 2]]] },
    { kind: 'char', j: 1, patch: { name: 'nuevo', weight: 3 } },
    { kind: 'taxon', i: 2, patch: { name: 'X', outgroup: true } },
    { kind: 'meta', patch: { title: 'T' } },
    { kind: 'insertChars', at: 1, chars: [Mx.newChar('ins', 2)] },
    { kind: 'removeChars', at: 1, n: 1 },
    { kind: 'removeChars', at: 0, n: 2 },
    { kind: 'moveChar', from: 0, to: 4 },
    { kind: 'moveChar', from: 3, to: 0 },
    { kind: 'insertTaxa', at: 3, taxa: [Mx.newTaxon('nuevo')] },
    { kind: 'removeTaxa', at: 1, n: 2 },
    { kind: 'moveTaxon', from: 5, to: 0 },
    { kind: 'recode', j: 1, map: [2, 0, 1], states: ['b', 'c', 'a'] },
    { kind: 'recode', j: 4, map: [0, -1, 1], states: ['a', 'c'] },
    { kind: 'recode', j: 2, map: [1, 0, -1], states: ['b', 'a'] },
  ];
  ops.forEach((op, k) => {
    const m = base(), before = Mx.clone(m);
    const inv = Mx.apply(m, op);
    const after = Mx.clone(m);
    Mx.apply(m, inv);
    t(`deshacer «${op.kind}» (${k + 1}) regresa a la matriz original`, same(m, before));
    const again = Mx.apply(m, op);
    void again;
    t(`rehacer «${op.kind}» (${k + 1}) da el mismo resultado`, same(m, after));
  });
  /* a long random walk, undone step by step */
  const r = rng(77);
  let bad = 0;
  for (let rep = 0; rep < 30; rep++) {
    const m = base(), snaps = [Mx.clone(m)], invs = [];
    for (let s = 0; s < 25; s++) {
      const nT = m.taxa.length, nC = m.chars.length, u = r();
      let op;
      if (u < 0.25) op = { kind: 'cells', list: [[Math.floor(r() * nT), Math.floor(r() * nC), 1 << Math.floor(r() * 3)]] };
      else if (u < 0.35 && nC > 2) op = { kind: 'removeChars', at: Math.floor(r() * (nC - 1)), n: 1 };
      else if (u < 0.45) op = { kind: 'insertChars', at: Math.floor(r() * (nC + 1)), chars: [Mx.newChar('n' + s, 3)] };
      else if (u < 0.55) op = { kind: 'moveChar', from: Math.floor(r() * nC), to: Math.floor(r() * nC) };
      else if (u < 0.65 && nT > 4) op = { kind: 'removeTaxa', at: Math.floor(r() * (nT - 1)), n: 1 };
      else if (u < 0.75) op = { kind: 'insertTaxa', at: Math.floor(r() * (nT + 1)), taxa: [Mx.newTaxon('t' + s)] };
      else if (u < 0.85) op = { kind: 'moveTaxon', from: Math.floor(r() * nT), to: Math.floor(r() * nT) };
      else { const j = Math.floor(r() * nC); const k = Math.max(2, m.chars[j].states.length); const map = shuffle([...Array(k).keys()], r); op = { kind: 'recode', j, map, states: map.map((_, q) => 'e' + q) }; }
      invs.push(Mx.apply(m, op));
      snaps.push(Mx.clone(m));
      /* dependencies always point at an existing character, never at themselves */
      if (m.chars.some((c, j) => c.depends && (c.depends.on === j || !m.chars[c.depends.on]))) bad++;
    }
    for (let s = invs.length - 1; s >= 0; s--) { Mx.apply(m, invs[s]); if (!same(m, snaps[s])) { bad++; break; } }
  }
  t('30 caminatas de 25 operaciones al azar se deshacen paso a paso sin una sola diferencia', bad === 0, bad + ' fallas');
  const m = base();
  Mx.apply(m, { kind: 'moveChar', from: 1, to: 4 });
  t('mover el carácter controlador arrastra la dependencia', m.chars.findIndex(c => c.depends) >= 0 && m.chars[m.chars.findIndex(c => c.depends)].depends.on === 4);
  const m2 = base();
  Mx.apply(m2, { kind: 'removeChars', at: 1, n: 1 });
  t('borrar el carácter controlador suelta la dependencia', m2.chars.every(c => !c.depends));
  const m3 = base();
  Mx.apply(m3, { kind: 'recode', j: 1, map: [1, 0, 2], states: ['b', 'a', 'c'] });
  t('recodificar el controlador cambia los estados de la dependencia', m3.chars[3].depends.states[0] === 0);
  const m4 = base();
  Mx.apply(m4, { kind: 'recode', j: 2, map: [2, 1, 0], states: ['c', 'b', 'a'] });
  t('recodificar mueve las imágenes con sus estados', m4.chars[2].images[2] === 'img_x' && m4.chars[2].images[0] === 'img_y');
}

sec('9 · Control de calidad');
{
  /* a row is a string of one-symbol cells, or an array of cells */
  const mk2 = rows => {
    const cells = rows.map(r => (Array.isArray(r) ? r : [...r]));
    const m = Mx.create(rows.length, cells[0].length);
    m.cells = cells.map(r => r.map(c => Mx.parseCell(c, { type: 'unord' })));
    m.taxa.forEach((tx, i) => { tx.name = 'T' + i; });
    m.chars.forEach(c => { c.states = ['0', '1', '2']; c.name = ''; });
    return m;
  };
  const codes = m => Mx.qc(m).map(q => q.code);
  const m = mk2(['000', '011', '011', '120', '120']);
  t('matriz limpia: sin errores', !Mx.qc(m).some(q => q.level === 'error'));
  t('detecta un carácter invariable', codes(mk2(['000', '011', '012', '010'])).includes('invariant'));
  t('detecta un carácter que sólo tiene una autapomorfía', codes(mk2(['001', '011', '010', '010'])).includes('uninformative'));
  t('detecta estados con nombre que no aparecen', codes(m).includes('state-unused'));
  const m2 = mk2(['000', '011', '011', '120', '120']); m2.chars[0].states = ['0'];
  t('detecta un estado usado sin nombre', codes(m2).includes('state-unnamed'));
  const m3 = mk2(['000', '011', '011', '120', '120']); m3.taxa[2].name = 'T1';
  t('detecta taxones con el mismo nombre', codes(m3).includes('taxon-dup'));
  const m4 = mk2(['000', '011', '011', '120', '???']);
  t('detecta un taxón sin datos', codes(m4).includes('taxon-allmissing'));
  t('detecta taxones idénticos', codes(mk2(['000', '011', '011', '120', '121'])).includes('taxon-identical'));
  const m5 = mk2(['0-0', '11-', '110', '01-', '000']);
  m5.chars[2].depends = { on: 1, states: [1] };
  const c5 = Mx.qc(m5);
  t('dependencia: «–» donde la estructura existe es un error', c5.some(q => q.code === 'gap-wrong' && q.i === 1));
  t('dependencia: un estado donde la estructura no existe es un error', c5.some(q => q.code === 'gap-missing' && q.i === 4));
  t('dependencia: con el controlador «–» no se juzga', !c5.some(q => q.i === 0 && q.j === 2));
  t('un «–» sin dependencia declarada se señala', codes(mk2(['0-0', '110', '110', '010', '000'])).includes('gap-nodep'));
  const m6 = mk2(['000', '011', '011', '120', '120']); m6.chars[1].type = 'ord'; m6.cells[0][1] = Mx.parseCell('(02)', { type: 'unord' });
  t('un polimorfismo no contiguo en un ordenado se señala', codes(m6).includes('ord-gap'));
  const m7 = mk2(['000', '011', '011', '120', '120']); m7.chars[0].type = 'step'; m7.chars[0].cost = [[0, 1, 5], [1, 0, 1], [5, 1, 0]];
  t('una matriz de pasos que viola la desigualdad del triángulo se señala', codes(m7).includes('step-triangle'));
  const m8 = mk2(['000', '011', '011', '120', '120']); m8.taxa.forEach(tx => { tx.outgroup = false; });
  t('sin grupo externo hay aviso', codes(m8).includes('no-outgroup'));
  const st = Mx.stats(mk2(['0?0', '0-1', ['(01)', '1', '1'], '120', '120']));
  t('estadísticas: faltantes, inaplicables y polimorfismos', st.missing === 1 && st.gaps === 1 && st.poly === 1);
}

sec('10 · Lectores y escritores (matio.js)');
{
  const nexInter = `#NEXUS
[comentario con 'comillas' y ; punto y coma]
BEGIN DATA;
  DIMENSIONS NTAX=3 NCHAR=6;
  FORMAT DATATYPE=STANDARD SYMBOLS="0 1 2 A" MISSING=? GAP=- MATCHCHAR=. INTERLEAVE;
  CHARLABELS hoja flor fruto c4 c5 c6;
  STATELABELS 1 simple compuesta, 2 roja azul;
  MATRIX
  'Bursera simaruba' 012
  B_fagaroides      .1(12)
  C                 1{01}?
  'Bursera simaruba' A01
  B_fagaroides      0-.
  C                 210
  ;
END;
BEGIN ASSUMPTIONS;
  CHARSET pareja = 2-3;
  TYPESET * t = ord: pareja;
  WTSET * w = 4: 1;
  EXSET * x = 6;
END;
BEGIN TREES;
  TRANSLATE 1 'Bursera simaruba', 2 B_fagaroides, 3 C;
  TREE uno = (1,(2,3));
END;`;
  const r = MatIO.read(nexInter);
  const m = r.matrix;
  t('NEXUS intercalado: 3 taxones × 6 caracteres', m.taxa.length === 3 && m.chars.length === 6);
  t('NEXUS: nombres entre comillas y con guion bajo', m.taxa[0].name === 'Bursera simaruba' && m.taxa[1].name === 'B fagaroides');
  t('NEXUS: MATCHCHAR copia el estado del primer taxón', Mx.cellText(m.cells[1][0]) === '0' && Mx.cellText(m.cells[1][5]) === '1');
  t('NEXUS: polimorfismo e incertidumbre', Mx.cellText(m.cells[1][2]) === '(12)' && Mx.cellText(m.cells[2][1]) === '{01}');
  t('NEXUS: el símbolo A de SYMBOLS es el estado 3', Mx.cellText(m.cells[0][3]) === '3');
  t('NEXUS: CHARLABELS y STATELABELS', m.chars[0].name === 'hoja' && m.chars[1].states[1] === 'azul' && m.chars[0].states[0] === 'simple');
  t('NEXUS: TYPESET con CHARSET, WTSET y EXSET', m.chars[1].type === 'ord' && m.chars[2].type === 'ord' && m.chars[0].weight === 4 && m.chars[5].active === false);
  t('NEXUS: árbol con TRANSLATE', r.trees.length === 1 && /Bursera simaruba/.test(r.trees[0].newick));
  t('NEXUS: el árbol se une a la matriz', (() => { try { const tr = Tree.parseNewick(r.trees[0].newick, m.taxa.map(x => x.name)); return Tree.tips(tr).every(v => v.tip >= 0); } catch (e) { return false; } })());
  const dna = MatIO.read(`#NEXUS
BEGIN DATA; DIMENSIONS NTAX=2 NCHAR=5; FORMAT DATATYPE=DNA MISSING=? GAP=-;
MATRIX
a ACGTR
b -NAAC
;
END;`).matrix;
  t('NEXUS de ADN: A C G T y R = {AG}', dna.chars[0].states.join('') === 'ACGT' && Mx.cellText(dna.cells[0][4]) === '{02}');
  t('NEXUS de ADN: N es desconocido y - inaplicable', dna.cells[1][1] === Mx.MISSING && dna.cells[1][0] === Mx.GAP);
  const xr = MatIO.read(`xread
'dos particiones'
4 3
&[cont]
a 1.5 2-3
b ? 4
c 0.5 1
&[num]
a 0[12]
b 1-
c 00
;
ccode - . + 3 /2 2 ;
cnames
{0 largo ;
{2 color blanco rojo morado ;
;
outgroup 2 ;`).matrix;
  t('xread con continuos y discretos', xr.chars.length === 4 && xr.chars[0].type === 'cont' && xr.chars[1].type === 'cont' && JSON.stringify(xr.cells[0][1]) === '[2,3]');
  t('xread: polimorfismo entre corchetes', Mx.cellText(xr.cells[0][3]) === '(12)');
  t('xread: ccode (aditivo y peso) y cnames', xr.chars[3].type === 'ord' && xr.chars[2].weight === 2 && xr.chars[2].states.join('|') === 'blanco|rojo|morado' && xr.chars[0].name === 'largo');
  t('xread: outgroup', xr.taxa[2].outgroup && !xr.taxa[0].outgroup);
  const tab = MatIO.read('Taxón;hoja;largo\n# estados;simple | compuesta;\nA;0;2,5\nB;1;3,1-4\nC;0/1;?\n').matrix;
  t('tabla con punto y coma, fila de estados y continuos con coma decimal', tab.chars[0].states[1] === 'compuesta' && tab.chars[1].type === 'cont' && JSON.stringify(tab.cells[1][1]) === '[3.1,4]' && Mx.cellText(tab.cells[2][0]) === '(01)');
  const tsv = MatIO.read('t\tc1\tc2\nA\t0\t1\nB\t1\t-\nC\t?\t2\n').matrix;
  t('tabla separada por tabuladores (lo que pega una hoja de cálculo)', tsv.taxa.length === 3 && tsv.cells[1][1] === Mx.GAP && tsv.chars[1].states.length === 3);
  let err = null; try { MatIO.read('#NEXUS\nBEGIN TAXA; TAXLABELS a b; END;'); } catch (e) { err = e; }
  t('NEXUS sin bloque de caracteres: error con su motivo', err && /caracteres/.test(err.message));
}

sec('11 · Los ejemplos, de ida y vuelta');
{
  const nm = m => JSON.stringify({ t: m.title, taxa: m.taxa, chars: m.chars.map(c => Object.assign({}, c, { images: c.images || null })), cells: m.cells });
  Object.keys(EXAMPLES).forEach(id => {
    const ex = EXAMPLES[id];
    const r = MatIO.read(ex.nexus, ex.file);
    const m = r.matrix;
    t(`${id}: se lee sin notas ni errores de control de calidad`, r.notes.length === 0 && !Mx.qc(m).some(q => q.level === 'error'), JSON.stringify(r.notes) + JSON.stringify(Mx.qc(m).filter(q => q.level === 'error').slice(0, 2)));
    t(`${id}: trae su árbol verdadero y se une a la matriz`, r.trees.length === 1 && Tree.tips(Tree.parseNewick(r.trees[0].newick, m.taxa.map(x => x.name))).length === m.taxa.length);
    const back = MatIO.read(MatIO.writeNexus(m, { trees: r.trees })).matrix;
    t(`${id}: NEXUS escrito y vuelto a leer es idéntico`, nm(back) === nm(m));
    const xb = MatIO.read(MatIO.writeXread(m)).matrix;
    /* xread puts continuous characters first: compare by name */
    const byName = mm => Object.fromEntries(mm.chars.map((c, j) => [c.name, [c.type, c.weight, c.active, c.states.join('|'), JSON.stringify(c.cost || null), mm.cells.map(row => JSON.stringify(row[j])).join(',')]])
      .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)));
    t(`${id}: xread escrito y vuelto a leer conserva cada carácter y cada celda`, JSON.stringify(byName(xb)) === JSON.stringify(byName(m)));
    const tb = MatIO.read(MatIO.writeTable(m)).matrix;
    const strip = mm => JSON.stringify(mm.chars.map((c, j) => [c.name, c.type === 'step' ? 'unord' : c.type, c.weight, c.active, c.states.join('|'), c.depends, mm.cells.map(row => JSON.stringify(row[j])).join(',')]));
    t(`${id}: la tabla conserva todo menos los costos de las matrices de pasos`, strip(tb) === strip(m));
    const pj = MatIO.readProject(MatIO.writeProject(m)).matrix;
    t(`${id}: el proyecto .json es idéntico`, nm(pj) === nm(m));
  });
  const d = MatIO.read(EXAMPLES.dahlia.nexus).matrix;
  {
    const cellsOf = txt => txt.split('\r\n').filter(l => l && !/^.?#|^.?Tax/.test(l)).flatMap(l => l.split(',').slice(1));
    const cs = cellsOf(MatIO.writeTable(d));
    t('tabla de Dahlia: sin «(01)» ni «a-b» que una hoja de cálculo convierta en número o fecha (15 polimorfismos entre corchetes)',
      !cs.some(c => /^\(.+\)$/.test(c) || /\d-\d/.test(c)) && cs.filter(c => /^\[.+\]$/.test(c)).length === 15, cs.filter(c => /[(\[]/.test(c)).length);
  }
  const s = Mx.stats(d);
  t('Dahlia: 20 × 45, 3 continuos, 3 ordenados, 1 matriz de pasos, 5 dependencias', s.taxa === 20 && s.chars === 45 && s.byType.cont === 3 && s.byType.ord === 3 && s.byType.step === 1 && s.dependent === 5);
  t('Dahlia: dos taxones de grupo externo', d.taxa.filter(x => x.outgroup).length === 2);
  t('Dahlia: los continuos traen unidad e intervalo', d.chars[42].unit === 'cm' && Array.isArray(d.cells[2][42]) && d.cells[2][42][0] < d.cells[2][42][1]);
  const A = Mx.toAnalysis(d);
  t('lo que lee el análisis: sólo discretos activos, y el grupo externo', A.chars.length === 42 && A.outgroup.join(',') === '0,1' && A.cells.length === 20);
  const g = MatIO.read(EXAMPLES.grande.nexus).matrix;
  t('matriz grande: 120 × 300', g.taxa.length === 120 && g.chars.length === 300);
  const list = MatIO.characterListText(d, 'es');
  t('lista de caracteres: «1. Hábito: (0) herbáceo; …» con su tipo', /^1\. Hábito: \(0\) herbáceo; \(1\) sufrútice; \(2\) arborescente; \(3\) epífito\. \[no ordenado\]/.test(list));
  t('lista de caracteres: dice cuándo es aplicable un dependiente', /aplicable sólo si 5 = presentes/.test(list));
  t('lista de caracteres en inglés', /\[unordered\]/.test(MatIO.characterListText(d, 'en')));
}

sec('12 · La cuadrícula (grid.js)');
{
  const host = mk('div', { style: 'position:absolute;left:-9999px;top:0;width:700px' });
  document.body.appendChild(host);
  const m = MatIO.read(EXAMPLES.bursera.nexus).matrix;
  const edits = [];
  const G = MatrixGrid.create(host, { getMatrix: () => m, onEdit: op => { edits.push(op); Mx.apply(m, op); G.refresh(); } });
  const key = (k, o) => G.wrap.dispatchEvent(new KeyboardEvent('keydown', Object.assign({ key: k, bubbles: true, cancelable: true }, o || {})));
  G.select(0, 0);
  key('1');
  t('escribir «1» pone el estado 1', m.cells[0][0] === 2);
  key('ArrowRight'); key('?');
  t('flecha a la derecha y «?»', m.cells[0][1] === Mx.MISSING);
  key('0', { ctrlKey: true }); key('1', { ctrlKey: true });
  t('Ctrl+0 y Ctrl+1 hacen un polimorfismo', Mx.cellText(m.cells[0][1]) === '(01)');
  t('Ctrl+C lo copia entre corchetes, para que una hoja de cálculo no lo vuelva −1', G.copy() === '[01]', G.copy());
  key('ArrowDown', { shiftKey: true }); key('ArrowDown', { shiftKey: true }); key('-');
  t('Mayús+flechas selecciona un rango y «-» lo llena', [0, 1, 2].every(i => m.cells[i][1] === Mx.GAP));
  G.select(3, 2);
  G.paste('1\t0\n0\t1');
  t('pegar un bloque tabulado de 2 × 2', Mx.cellText(m.cells[3][2]) + Mx.cellText(m.cells[3][3]) + Mx.cellText(m.cells[4][2]) + Mx.cellText(m.cells[4][3]) === '1001');
  G.select(5, 0);
  G.paste('0101');
  t('pegar una tira de símbolos sin tabuladores la reparte en celdas', [0, 1, 2, 3].map(j => Mx.cellText(m.cells[5][j])).join('') === '0101');
  G.selectChars(2, 3);
  t('clic en los números selecciona columnas enteras', G.wholeCols() && G.range().ca === 2 && G.range().cb === 3);
  t('todas las ediciones pasan como operaciones (para poder deshacerlas)', edits.length >= 5 && edits.every(o => o.kind === 'cells'));
  t('sólo se dibuja lo visible', host.querySelectorAll('.mx-c').length <= m.taxa.length * m.chars.length);
  host.remove();
}

sec('13 · El mapa de la app, Bloque 2');
t('el Bloque 2 está listo', STEPS[1].ready === true);
t('las imágenes por estado se pueden guardar y recuperar (API)', typeof StateImg.put === 'function' && typeof StateImg.collect === 'function');
