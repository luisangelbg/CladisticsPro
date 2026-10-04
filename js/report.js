/* CladisticsPro — morphological cladistics in the browser.
   Copyright (C) 2026  Luis Ángel Barrera-Guzmán

   This program is free software: you can redistribute it and/or modify it under
   the terms of the GNU General Public License as published by the Free Software
   Foundation, either version 3 of the License, or (at your option) any later
   version. It is distributed in the hope that it will be useful, but WITHOUT ANY
   WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
   A PARTICULAR PURPOSE. See the GNU General Public License, in the file LICENSE
   at the root of this program, or <https://www.gnu.org/licenses/>. */

/* CladisticsPro — the report, the figures as files and the package (Block 10).

   · Report.methods(state, lang): the methods section written from what was
     run, block by block. A block that holds no result leaves no paragraph,
     and only the works cited in the paragraphs go to the references.
   · Report.svgText(svg, {light}): a figure of the page as a standalone SVG,
     its computed colours and fonts written inside (with light, those of the
     light theme even when the app is dark).
   · Report.zipBytes(files) and Report.zip(files): a ZIP written byte by byte,
     with its own CRC-32; zip() deflates when the browser offers a stream for
     it, zipBytes() stores. Either is read by any unpacker.

   The methods text does not touch the DOM: the tests and the validation run it
   outside the browser. */
function ReportCore(g) {
const R = {};

/* ---------------- numbers and words ---------------- */
function num(v, d) {
  if (v == null || !isFinite(v)) return '—';
  if (d == null) d = 3;
  let s = Number(v).toFixed(d);
  if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return s.replace(/^-/, '−');
}
R.num = num;
const pct = v => Math.round(v * 100) + ' %';
const pval = p => (p == null || !isFinite(p) ? '—' : p < 0.0001 ? '< 0.0001' : '= ' + p.toFixed(4));
function list(items, lang) {
  const and = lang === 'en' ? ' and ' : ' y ';
  if (items.length <= 1) return items.join('');
  return items.slice(0, -1).join(', ') + and + items[items.length - 1];
}
const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);

/* ---------------- the works that can be cited ----------------
   key as it appears in the text → the beginning of its entry in the list of
   references of the app (Home.REFS); the full entry is taken from there. */
const WORKS = {
  'Adams 1972': 'Adams EN. 1972', 'Agnarsson y Miller 2008': 'Agnarsson I, Miller JA. 2008',
  'Brazeau et al. 2019': 'Brazeau MD, Guillerme T, Smith MR. 2019', 'Bremer 1988': 'Bremer K. 1988', 'Bremer 1990': 'Bremer K. 1990', 'Bremer 1994': 'Bremer K. 1994',
  'Coddington y Scharff 1994': 'Coddington J, Scharff N. 1994', 'Farris 1969': 'Farris JS. 1969', 'Farris 1970': 'Farris JS. 1970', 'Farris 1989': 'Farris JS. 1989',
  'Farris et al. 1996': 'Farris JS, Albert VA', 'Felsenstein 1985': 'Felsenstein J. 1985', 'Fitch 1971': 'Fitch WM. 1971',
  'Goldman et al. 2000': 'Goldman N, Anderson JP, Rodrigo AG. 2000', 'Goloboff 1993': 'Goloboff PA. 1993', 'Goloboff 1999': 'Goloboff PA. 1999', 'Goloboff 2014': 'Goloboff PA. 2014',
  'Goloboff y Farris 2001': 'Goloboff PA, Farris JS. 2001', 'Goloboff et al. 2003': 'Goloboff PA, Farris JS, Källersjö M', 'Goloboff et al. 2006': 'Goloboff PA, Mattoni CI, Quinteros AS. 2006',
  'Hendy y Penny 1982': 'Hendy MD, Penny D. 1982', 'Kishino y Hasegawa 1989': 'Kishino H, Hasegawa M. 1989', 'Kluge y Farris 1969': 'Kluge AG, Farris JS. 1969',
  'Maddison 1993': 'Maddison WP. 1993', 'Margush y McMorris 1981': 'Margush T, McMorris FR. 1981', 'Mirande 2009': 'Mirande JM. 2009', 'Nixon 1999': 'Nixon KC. 1999',
  'Nixon y Carpenter 1993': 'Nixon KC, Carpenter JM. 1993', 'Nixon y Davis 1991': 'Nixon KC, Davis JI. 1991', 'Pol y Escapa 2009': 'Pol D, Escapa IH. 2009',
  'Prager y Wilson 1988': 'Prager EM, Wilson AC. 1988', 'Sankoff 1975': 'Sankoff D. 1975', 'Sokal y Rohlf 1981': 'Sokal RR, Rohlf FJ. 1981',
  'Strong y Lipscomb 1999': 'Strong EE, Lipscomb D. 1999', 'Swofford y Maddison 1987': 'Swofford DL, Maddison WP. 1987', 'Swofford y Olsen 1990': 'Swofford DL, Olsen GJ. 1990',
  'Templeton 1983': 'Templeton AR. 1983', 'Wilkinson 1994': 'Wilkinson M. 1994',
};
R.WORKS = WORKS;
/* a citation in the language of the text: «y» becomes «and» in English */
const citeText = (key, lang) => (lang === 'en' ? key.replace(' y ', ' and ') : key);

/* ---------------- the methods, block by block ---------------- */
R.methods = function (st, lang, opts) {
  opts = opts || {};
  const en = lang === 'en';
  const L = (es, eng) => (en ? eng : es);
  const used = new Set();
  /* «{Fitch 1971}» in the text → the citation, recorded */
  const C = (...keys) => { keys.forEach(k => used.add(k)); return keys.map(k => citeText(k, lang)).join('; '); };
  /* the same in the running text: «Templeton (1983)» */
  const N = key => C(key).replace(/ (\d{4})$/, ' ($1)');
  const sections = [];
  const add = (id, title, paras) => { const p = paras.filter(Boolean); if (p.length) sections.push({ id, title, paras: p }); };
  const m = st.matrix;
  if (!m) return { sections, cited: [], lang };

  /* 1 · the matrix */
  {
    const taxa = m.taxa.filter(t => t.active !== false), offT = m.taxa.length - taxa.length;
    const rows = m.taxa.map((t, i) => i).filter(i => m.taxa[i].active !== false);
    const chars = m.chars.map((c, j) => j).filter(j => m.chars[j].active !== false && !(m.chars[j].weight === 0));
    const offC = m.chars.length - chars.length;
    const type = j => m.chars[j].type || 'unord';
    const kOf = j => (g.Mx && g.Mx.k ? g.Mx.k(m, j) : (m.chars[j].states || []).length);
    const disc = chars.filter(j => type(j) !== 'cont');
    const bin = disc.filter(j => kOf(j) <= 2).length, multi = disc.length - bin;
    const ord = disc.filter(j => type(j) === 'ord').length, step = disc.filter(j => type(j) === 'step').length;
    const unord = disc.length - ord - step;
    const cont = chars.filter(j => type(j) === 'cont').length;
    const weighted = chars.filter(j => m.chars[j].weight != null && m.chars[j].weight !== 1).length;
    let cells = 0, miss = 0, gaps = 0, poly = 0;
    rows.forEach(i => chars.forEach(j => {
      const c = m.cells[i][j];
      cells++;
      if (c === -1) miss++;
      else if (c === -2) gaps++;
      else if (typeof c === 'number' && c > 0) { const x = c & 0x3fffffff; if (x & (x - 1)) poly++; }
    }));
    const og = m.taxa.filter(t => t.outgroup && t.active !== false).map(t => t.name);
    const title = m.title ? (en ? ` “${m.title}”` : ` «${m.title}»`) : '';
    const p1 = L(`La matriz${title} reunió ${plural(taxa.length, 'taxón', 'taxones')} y ${plural(chars.length, 'carácter', 'caracteres')}`, `The matrix${title} comprised ${plural(taxa.length, 'taxon', 'taxa')} and ${plural(chars.length, 'character', 'characters')}`) +
      (offT || offC ? L(` (${[offT ? plural(offT, 'taxón inactivo', 'taxones inactivos') : '', offC ? plural(offC, 'carácter desactivado', 'caracteres desactivados') : ''].filter(Boolean).join(' y ')} quedaron fuera)`, ` (${[offT ? plural(offT, 'inactive taxon', 'inactive taxa') : '', offC ? plural(offC, 'deactivated character', 'deactivated characters') : ''].filter(Boolean).join(' and ')} were left out)`) : '') +
      ': ' + list([bin ? L(`${bin} binarios`, `${bin} binary`) : '', multi ? L(`${multi} multiestado`, `${multi} multistate`) : '', cont ? L(`${cont} continuos`, `${cont} continuous`) : ''].filter(Boolean), lang) + '.';
    const kinds = [];
    if (unord) kinds.push(L(`${unord} no aditivos (${C('Fitch 1971')})`, `${unord} nonadditive (${C('Fitch 1971')})`));
    if (ord) kinds.push(L(`${ord} aditivos u ordenados (${C('Farris 1970')})`, `${ord} additive or ordered (${C('Farris 1970')})`));
    if (step) kinds.push(L(`${step} con una matriz de costos entre estados (${C('Sankoff 1975')})`, `${step} with a cost matrix between states (${C('Sankoff 1975')})`));
    const p2 = !disc.length ? '' : kinds.length === 1 && unord ? L(`Todos los discretos se trataron como no aditivos (${C('Fitch 1971')}).`, `All discrete characters were treated as nonadditive (${C('Fitch 1971')}).`)
      : L(`Entre los discretos, ${list(kinds, lang)}.`, `Among the discrete ones, ${list(kinds, lang)}.`);
    const s = st.search && st.search.prep ? st.search.prep : {};
    const p3 = cont ? (s.continuous === 'raw'
      ? L(`Los caracteres continuos se analizaron como tales, con su escala original (${C('Goloboff et al. 2006')}).`, `Continuous characters were analysed as such, on their original scale (${C('Goloboff et al. 2006')}).`)
      : s.continuous === 'off' ? L('Los caracteres continuos quedaron fuera de la búsqueda.', 'Continuous characters were left out of the search.')
        : L(`Los caracteres continuos se analizaron como tales, reescalados a un intervalo de 0 a 1 para que cada uno pese lo que un paso (${C('Goloboff et al. 2006')}).`, `Continuous characters were analysed as such, rescaled to a 0–1 interval so that each weighs as much as one step (${C('Goloboff et al. 2006')}).`)) : '';
    const p4 = (weighted ? L(`${plural(weighted, 'carácter llevó', 'caracteres llevaron')} un peso distinto de 1 asignado de antemano. `, `${plural(weighted, 'character carried', 'characters carried')} a weight other than 1 assigned beforehand. `) : '') +
      L(`De las ${cells} celdas, ${pct(miss / Math.max(1, cells))} fueron datos faltantes («?»)`, `Of the ${cells} cells, ${pct(miss / Math.max(1, cells))} were missing data (“?”)`) +
      (gaps ? L(`, ${pct(gaps / cells)} inaplicables («–»)`, `, ${pct(gaps / cells)} inapplicable (“–”)`) : '') +
      (poly ? L(` y ${plural(poly, 'celda', 'celdas')} polimórficas o inciertas, tratadas como el conjunto de sus estados (${C('Nixon y Davis 1991')})`, ` and ${plural(poly, 'cell was', 'cells were')} polymorphic or uncertain, treated as the set of their states (${C('Nixon y Davis 1991')})`) : '') + '.';
    const p5 = gaps ? (s.inapplicable === 'algorithm'
      ? L(`Los inaplicables se trataron con el algoritmo de ${N('Brazeau et al. 2019')}, que no cuenta pasos por un carácter en las ramas donde no se aplica.`, `Inapplicable entries were treated with the algorithm of ${N('Brazeau et al. 2019')}, which counts no steps for a character on the branches where it does not apply.`)
      : L(`Los inaplicables se trataron como datos faltantes, con las limitaciones conocidas de ese tratamiento (${C('Maddison 1993', 'Strong y Lipscomb 1999')}).`, `Inapplicable entries were treated as missing data, with the known limitations of that treatment (${C('Maddison 1993', 'Strong y Lipscomb 1999')}).`)) : '';
    const p6 = og.length ? L(`Los árboles se enraizaron con ${og.length === 1 ? 'el grupo externo' : 'los taxones del grupo externo'} ${list(og.map(x => '«' + x + '»'), lang)} (${C('Nixon y Carpenter 1993')}).`, `Trees were rooted on the outgroup ${list(og.map(x => '“' + x + '”'), lang)} (${C('Nixon y Carpenter 1993')}).`) : '';
    add('matrix', L('Matriz de caracteres', 'Character matrix'), [p1 + ' ' + p2 + ' ' + p3, p4 + ' ' + p5 + ' ' + p6]);
  }

  /* 3 · the search */
  const S = st.search;
  if (S && S.trees && S.trees.length) {
    const o = S.opts || {};
    let how;
    if (o.method === 'exact') how = L(`una búsqueda exacta por rama y cota (${C('Hendy y Penny 1982')}), que garantiza encontrar todos los árboles más cortos`, `an exact branch-and-bound search (${C('Hendy y Penny 1982')}), which guarantees finding every shortest tree`) +
      (S.complete === false ? L(', aunque se detuvo al agotarse el tiempo y su resultado no está garantizado', ', although it stopped when time ran out and its result is not guaranteed') : '');
    else {
      how = L(`${plural(o.replicates || 1, 'réplica', 'réplicas')} de adición de Wagner con orden al azar (${C('Farris 1970')}) seguidas de intercambio de ramas por bisección y reconexión (TBR; ${C('Swofford y Olsen 1990')})`, `${plural(o.replicates || 1, 'replicate', 'replicates')} of Wagner addition in random order (${C('Farris 1970')}) followed by tree bisection and reconnection branch swapping (TBR; ${C('Swofford y Olsen 1990')})`);
      if (o.method === 'ratchet' || o.method === 'combined') how += L(`; cada réplica siguió con ${o.ratchetIterations} iteraciones de ratchet (${C('Nixon 1999')}) que reponderan al azar el ${Math.round((o.ratchetFraction || 0.25) * 100)} % de los caracteres`, `; each replicate went on with ${o.ratchetIterations} ratchet iterations (${C('Nixon 1999')}) that randomly reweight ${Math.round((o.ratchetFraction || 0.25) * 100)} % of the characters`);
      if (o.method === 'combined') how += L(`, búsqueda sectorial, deriva y fusión de árboles (${C('Goloboff 1999')})`, `, sectorial search, tree drifting and tree fusing (${C('Goloboff 1999')})`);
      how += L(`, con la semilla ${o.seed} y hasta ${o.maxTrees} árboles guardados`, `, with seed ${o.seed} and up to ${o.maxTrees} trees kept`);
    }
    const cons = (S.prep && S.prep.constraints) || [];
    const p1 = L(`Los árboles más cortos con todos los caracteres de igual peso se buscaron con ${how}.`, `The shortest trees with all characters equally weighted were searched for with ${how}.`) +
      (cons.length ? L(` La búsqueda respetó ${plural(cons.length, 'restricción topológica', 'restricciones topológicas')} (${cons.filter(c => c.positive).length} grupos obligatorios, ${cons.filter(c => !c.positive).length} prohibidos).`, ` The search kept ${plural(cons.length, 'topological constraint', 'topological constraints')} (${cons.filter(c => c.positive).length} required groups, ${cons.filter(c => !c.positive).length} forbidden).`) : '');
    const t0 = S.trees[0];
    let p2 = L(`Se obtuvieron ${plural(S.trees.length, 'árbol más corto', 'árboles más cortos')} de ${num(S.length)} pasos`, `The search found ${plural(S.trees.length, 'shortest tree', 'shortest trees')} of ${num(S.length)} steps`) +
      (t0.ci != null ? L(` (índice de consistencia ${num(t0.ci)}, de retención ${num(t0.ri)}; ${C('Kluge y Farris 1969', 'Farris 1989')})`, ` (consistency index ${num(t0.ci)}, retention index ${num(t0.ri)}; ${C('Kluge y Farris 1969', 'Farris 1989')})`) : '') + '.';
    if (S.hits != null && o.method !== 'exact') p2 += L(` ${S.hits} de ${S.reps} réplicas llegaron a esa longitud.`, ` ${S.hits} of ${S.reps} replicates reached that length.`);
    if (S.overflow) p2 += L(' Se llegó al máximo de árboles guardados, así que puede haber más árboles igual de cortos.', ' The maximum number of trees kept was reached, so there may be more equally short trees.');
    if (S.collapse && S.condensed && S.condensed.length < S.trees.length) p2 += L(` Las ramas sin cambios no ambiguos se colapsaron (regla 1 de ${C('Coddington y Scharff 1994')}), lo que dejó ${plural(S.condensed.length, 'árbol distinto', 'árboles distintos')}.`, ` Branches without unambiguous changes were collapsed (rule 1 of ${C('Coddington y Scharff 1994')}), which left ${plural(S.condensed.length, 'distinct tree', 'distinct trees')}.`);
    if (S.strict && (S.condensed || S.trees).length > 1) {
      const n = (S.taxa || []).length, cl = opts.cladeCount ? opts.cladeCount(S.strict, n) : null;
      p2 += L(` Se resumieron en su consenso estricto (${C('Sokal y Rohlf 1981')})`, ` They were summarized in their strict consensus (${C('Sokal y Rohlf 1981')})`) + (cl != null ? L(`, con ${plural(cl, 'clado', 'clados')}`, `, with ${plural(cl, 'clade', 'clades')}`) : '') + '.';
    }
    add('search', L('Búsqueda de árboles', 'Tree search'), [p1, p2]);
  }

  /* 4 · weighting */
  const W = st.weights;
  if (W && (W.result || W.runs)) {
    let p;
    if (W.scheme === 'iw' || W.scheme === 'eiw') {
      const r = W.result;
      p = (W.scheme === 'iw' ? L(`La búsqueda se repitió con pesos implícitos (${C('Goloboff 1993')})`, `The search was repeated under implied weights (${C('Goloboff 1993')})`)
        : L(`La búsqueda se repitió con pesos implícitos extendidos (${C('Goloboff 2014')}), que no premian a los caracteres con muchos datos faltantes`, `The search was repeated under extended implied weights (${C('Goloboff 2014')}), which do not favour characters with much missing data`)) +
        L(`, con la constante de concavidad k = ${num(W.k)}, que minimiza la homoplasia ponderada Σ h/(h + k). Se obtuvieron ${plural(r.trees.length, 'árbol', 'árboles')} con homoplasia ponderada ${num(r.score, 4)} y longitud ${num(r.length)}.`, `, with concavity constant k = ${num(W.k)}, which minimizes the weighted homoplasy Σ h/(h + k). It found ${plural(r.trees.length, 'tree', 'trees')} with weighted homoplasy ${num(r.score, 4)} and length ${num(r.length)}.`);
    } else if (W.scheme === 'sw') {
      const r = W.result, idx = { ci: L('índice de consistencia', 'consistency index'), ri: L('índice de retención', 'retention index'), rc: L('índice de consistencia reescalado', 'rescaled consistency index') }[W.sw.index] || W.sw.index;
      p = L(`Se aplicaron pesos sucesivos (${C('Farris 1969')}) con el ${idx} de cada carácter en los árboles más cortos, en una escala de 0 a ${W.sw.base}, hasta que los pesos dejaron de cambiar; el resultado fueron ${plural(r.trees.length, 'árbol', 'árboles')}.`, `Successive weighting (${C('Farris 1969')}) was applied with the ${idx} of each character on the shortest trees, on a scale from 0 to ${W.sw.base}, until the weights stopped changing; the result was ${plural(r.trees.length, 'tree', 'trees')}.`);
    } else if (W.runs) {
      const ks = list(W.runs.map(x => num(x.k)), lang);
      p = L(`Se exploró la sensibilidad del resultado a la constante de concavidad con pesos implícitos${W.crit === 'eiw' ? ' extendidos' : ''} (k = ${ks}); ${W.tied && W.tied.length > 1 ? `los valores cuyo consenso estricto se pareció más en promedio a los demás, con el mismo resultado, fueron k = ${list(W.tied.map(num), lang)}` : `el valor cuyo consenso estricto se pareció más en promedio a los demás fue k = ${num(W.recommended)}`} (${C('Mirande 2009')}).`,
        `The sensitivity of the result to the concavity constant was explored under ${W.crit === 'eiw' ? 'extended ' : ''}implied weights (k = ${ks}); ${W.tied && W.tied.length > 1 ? `the values whose strict consensus was on average most similar to the others, with the same result, were k = ${list(W.tied.map(num), lang)}` : `the value whose strict consensus was on average most similar to the others was k = ${num(W.recommended)}`} (${C('Mirande 2009')}).`);
    }
    add('weights', L('Pesos', 'Weighting'), [p]);
  }

  /* 5 · mapping */
  const K = st.clado;
  if (K && K.map) {
    const opt = K.opts.optimization;
    const how = opt === 'deltran' ? L('con la optimización DELTRAN, que retrasa los cambios y prefiere paralelismos', 'with the DELTRAN optimization, which delays changes and prefers parallelisms')
      : opt === 'unambiguous' ? L('y se muestran sólo los cambios no ambiguos', 'and only the unambiguous changes are shown')
        : L('con la optimización ACCTRAN, que adelanta los cambios y prefiere reversiones', 'with the ACCTRAN optimization, which accelerates changes and prefers reversals');
    const edited = K.undo && K.undo.length;
    add('mapping', L('Cladograma y optimización', 'Cladogram and optimization'), [
      L(`Los cambios de estado se reconstruyeron sobre ${edited ? 'un árbol editado a mano' : 'el árbol elegido'} (longitud ${num(K.map.length)}) ${how} (${C('Swofford y Maddison 1987', 'Agnarsson y Miller 2008')}).`, `State changes were reconstructed on ${edited ? 'a hand-edited tree' : 'the chosen tree'} (length ${num(K.map.length)}) ${how} (${C('Swofford y Maddison 1987', 'Agnarsson y Miller 2008')}).`) +
      (K.map.fallback ? L(` En ${plural(K.map.fallback, 'carácter', 'caracteres')} con inaplicables el árbol tenía politomías y «–» se leyó como «?».`, ` In ${plural(K.map.fallback, 'character', 'characters')} with inapplicable entries the tree had polytomies and “–” was read as “?”.`) : ''),
    ]);
  }

  /* 6 · diagnosis */
  const D = st.diag;
  if (D && D.per) {
    add('diag', L('Diagnóstico de caracteres', 'Character diagnosis'), [
      L(`Para cada carácter se calcularon sus pasos y sus índices de consistencia y retención (${C('Kluge y Farris 1969', 'Farris 1989')})${D.nTrees > 1 ? ` en los ${D.nTrees} árboles, con su intervalo` : ''}, y para cada clado sus sinapomorfías, separadas en únicas y homoplásicas.`, `For each character its steps and its consistency and retention indices were computed (${C('Kluge y Farris 1969', 'Farris 1989')})${D.nTrees > 1 ? ` on the ${D.nTrees} trees, with their range` : ''}, and for each clade its synapomorphies, split into unique and homoplastic.`),
    ]);
  }

  /* 7 · support */
  const P = st.support;
  if (P && (P.bremer || (P.res && Object.keys(P.res).length))) {
    const paras = [];
    if (P.bremer) {
      const b = P.bremer;
      paras.push((b.method === 'subopt'
        ? L(`El apoyo de Bremer (${C('Bremer 1988', 'Bremer 1994')}) se leyó en los ${b.kept} árboles guardados hasta ${b.k} pasos más largos que los más cortos${b.overflow ? ' (se llegó al máximo guardado, así que los valores son cotas)' : ''}`, `Bremer support (${C('Bremer 1988', 'Bremer 1994')}) was read from the ${b.kept} trees kept up to ${b.k} steps longer than the shortest${b.overflow ? ' (the maximum kept was reached, so the values are bounds)' : ''}`)
        : L(`El apoyo de Bremer (${C('Bremer 1988', 'Bremer 1994')}) se calculó como la diferencia entre el árbol más corto sin cada grupo, obtenido ${b.exact ? 'por búsqueda exacta' : `por una búsqueda heurística de ${plural(b.reps, 'réplica', 'réplicas')}`}, y los más cortos`, `Bremer support (${C('Bremer 1988', 'Bremer 1994')}) was computed as the difference between the shortest tree without each group, found ${b.exact ? 'by exact search' : `by a heuristic search of ${plural(b.reps, 'replicate', 'replicates')}`}, and the shortest trees`)) +
        L(`, junto con el Bremer relativo (${C('Goloboff y Farris 2001')}).`, `, together with relative Bremer support (${C('Goloboff y Farris 2001')}).`));
    }
    const names = { boot: [L('bootstrap', 'bootstrap'), 'Felsenstein 1985'], jack: [L('jackknife', 'jackknife'), 'Farris et al. 1996'], sym: [L('remuestreo simétrico', 'symmetric resampling'), 'Goloboff et al. 2003'] };
    Object.keys(P.res || {}).forEach(k => {
      const r = P.res[k], nm = names[k];
      if (!nm) return;
      const search = r.search && r.search.method === 'exact' ? L('una búsqueda exacta', 'an exact search') : L(`una búsqueda heurística de ${plural((r.search && r.search.replicates) || 1, 'réplica', 'réplicas')}`, `a heuristic search of ${plural((r.search && r.search.replicates) || 1, 'replicate', 'replicates')}`);
      paras.push(L(`Se hicieron ${r.reps} pseudorréplicas de ${nm[0]} (${C(nm[1])})${r.p != null ? ` con probabilidad de cambio p = ${Math.round(r.p * 100)} %` : ''}, cada una con ${search}; de cada grupo se registró su frecuencia absoluta y su diferencia GC (${C('Goloboff et al. 2003')}).`, `${r.reps} ${nm[0]} pseudoreplicates were run (${C(nm[1])})${r.p != null ? ` with change probability p = ${Math.round(r.p * 100)} %` : ''}, each with ${search}; for each group its absolute frequency and its GC difference were recorded (${C('Goloboff et al. 2003')}).`));
    });
    add('support', L('Apoyo de ramas', 'Branch support'), paras);
  }

  /* 8 · consensus */
  const Q = st.consensus;
  if (Q && (Q.tree || Q.wild)) {
    const paras = [];
    if (Q.tree) {
      const th = Q.threshold == null ? 50 : Q.threshold > 1 ? Q.threshold : Q.threshold * 100;
      /* each sentence is built only if it is used, so only its reference is cited */
      const mtf = {
        strict: () => L(`el consenso estricto (${C('Sokal y Rohlf 1981')})`, `the strict consensus (${C('Sokal y Rohlf 1981')})`),
        majority: () => L(`el consenso de mayoría al ${Math.round(th)} % (${C('Margush y McMorris 1981')})`, `the ${Math.round(th)} % majority-rule consensus (${C('Margush y McMorris 1981')})`),
        extended: () => L(`el consenso de mayoría extendido (${C('Margush y McMorris 1981')})`, `the extended majority-rule consensus (${C('Margush y McMorris 1981')})`),
        semistrict: () => L(`el consenso semiestricto (${C('Bremer 1990')})`, `the semistrict consensus (${C('Bremer 1990')})`),
        adams: () => L(`el consenso de Adams (${C('Adams 1972')})`, `the Adams consensus (${C('Adams 1972')})`),
      }[Q.method];
      const mt = mtf && mtf();
      if (mt) paras.push(L(`Los árboles se resumieron además con ${mt}.`, `The trees were also summarized with ${mt}.`));
    }
    if (Q.wild && Q.wild.wild) {
      const w = Q.wild.wild;
      paras.push(w.length
        ? L(`Los taxones comodín se buscaron podando, uno por uno, el que más clados devuelve al consenso estricto (${C('Wilkinson 1994', 'Pol y Escapa 2009')}): ${list(w.map(x => '«' + x.name + '»'), lang)}.`, `Wildcard taxa were sought by pruning, one at a time, the one that returns the most clades to the strict consensus (${C('Wilkinson 1994', 'Pol y Escapa 2009')}): ${list(w.map(x => '“' + x.name + '”'), lang)}.`)
        : L(`Se buscaron taxones comodín (${C('Wilkinson 1994', 'Pol y Escapa 2009')}) y ninguno devolvió clados al consenso estricto al podarlo.`, `Wildcard taxa were sought (${C('Wilkinson 1994', 'Pol y Escapa 2009')}) and none returned clades to the strict consensus when pruned.`));
    }
    add('consensus', L('Consensos y comodines', 'Consensus and wildcards'), paras);
  }

  /* 9 · hypotheses */
  const H = st.hypotheses;
  if (H && H.list && H.list.length) {
    const paras = [L(`Cada hipótesis se comparó con el árbol más corto carácter por carácter con la prueba de ${N('Templeton 1983')}, la de sitios ganadores (${C('Prager y Wilson 1988')}) y la de ${N('Kishino y Hasegawa 1989')} adaptada a parsimonia; estas pruebas sólo son válidas para hipótesis planteadas de antemano (${C('Goldman et al. 2000')}).`,
      `Each hypothesis was compared with the shortest tree character by character with the test of ${N('Templeton 1983')}, the winning-sites test (${C('Prager y Wilson 1988')}) and that of ${N('Kishino y Hasegawa 1989')} adapted to parsimony; these tests are only valid for hypotheses set beforehand (${C('Goldman et al. 2000')}).`)];
    H.list.forEach(h => {
      const c = h.cmp;
      const what = h.kind === 'groups' ? L(`el mejor árbol con «${h.name}», obtenido con la búsqueda repetida bajo esa restricción`, `the best tree with “${h.name}”, found by repeating the search under that constraint`) : L(`el árbol propuesto «${h.name}»`, `the proposed tree “${h.name}”`);
      paras.push(L(`Para ${what}, la longitud fue ${num(h.length)} contra ${num(h.best)} (${h.extra > 1e-9 ? '+' + num(h.extra) + ' pasos' : 'sin costo'}); Templeton: V = ${num(c.templeton.V)}, p ${pval(c.templeton.p)}; sitios ganadores: ${c.favourHyp} contra ${c.favourBest}, p ${pval(c.winning.p)}; Kishino–Hasegawa: t = ${num(c.kh.t)}, p ${pval(c.kh.p)}.`,
        `For ${what}, the length was ${num(h.length)} against ${num(h.best)} (${h.extra > 1e-9 ? '+' + num(h.extra) + ' steps' : 'no cost'}); Templeton: V = ${num(c.templeton.V)}, p ${pval(c.templeton.p)}; winning sites: ${c.favourHyp} against ${c.favourBest}, p ${pval(c.winning.p)}; Kishino–Hasegawa: t = ${num(c.kh.t)}, p ${pval(c.kh.p)}.`));
    });
    add('hypotheses', L('Hipótesis', 'Hypotheses'), paras);
  }

  /* the program */
  add('program', L('Programa', 'Program'), [
    L(`Todos los análisis se hicieron con CladisticsPro ${opts.version || ''} (Barrera-Guzmán 2026), un programa que corre en el navegador con un motor de parsimonia propio, sin conexión a la red.`, `All analyses were run with CladisticsPro ${opts.version || ''} (Barrera-Guzmán 2026), a program that runs in the browser with its own parsimony engine, offline.`).replace('  ', ' '),
  ]);
  const cited = [...used].sort((a, b) => a.localeCompare(b, 'es'));
  return { sections, cited, lang };
};

/* the full entries of the works cited, from the list of the app */
R.references = function (cited, refs, lang, version) {
  const out = [];
  const strip = s => String(s).replace(/<[^>]+>/g, '');
  cited.forEach(k => {
    const pre = WORKS[k];
    const hit = pre && (refs || []).find(r => strip(r[0]).indexOf(pre) === 0);
    out.push({ key: k, html: hit ? hit[0] : citeText(k, lang), text: hit ? strip(hit[0]) : citeText(k, lang) });
  });
  const doi = typeof APP_DOI !== 'undefined' ? ' https://doi.org/' + APP_DOI : '';
  const self = `Barrera-Guzmán LÁ. 2026. CladisticsPro${version ? ' ' + version : ''}: ${lang === 'en' ? 'morphological cladistics in the browser. Computer program.' : 'cladística morfológica en el navegador. Programa de cómputo.'}${doi}`;
  out.push({ key: 'Barrera-Guzmán 2026', html: self, text: self });
  /* the usual order: by first author; one author, then two, then more; then by year */
  const order = r => {
    const m = /^(.*?)\.\s*(\d{4})/.exec(r.text) || [r.text, r.text, ''];
    const authors = m[1].split(',');
    return [authors[0].trim().split(' ')[0], Math.min(authors.length, 3), authors.length === 2 ? authors[1].trim() : '', m[2]];
  };
  return out.sort((a, b) => {
    const x = order(a), y = order(b);
    return x[0].localeCompare(y[0], 'es') || x[1] - y[1] || x[2].localeCompare(y[2], 'es') || x[3].localeCompare(y[3]);
  });
};

/* the report as plain text and as a page */
R.asText = function (rep, refs) {
  const en = rep.lang === 'en';
  const L = [];
  rep.sections.forEach(s => { L.push(s.title.toUpperCase()); s.paras.forEach(p => L.push(p, '')); });
  L.push(en ? 'REFERENCES' : 'REFERENCIAS', '');
  refs.forEach(r => L.push(r.text));
  return L.join('\n').replace(/\n{3,}/g, '\n\n') + '\n';
};
const escH = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
R.asHtml = function (rep, refs, meta) {
  meta = meta || {};
  const en = rep.lang === 'en';
  const body = rep.sections.map(s => `<h2>${escH(s.title)}</h2>\n` + s.paras.map(p => `<p>${escH(p)}</p>`).join('\n')).join('\n');
  const bib = `<h2>${en ? 'References' : 'Referencias'}</h2>\n<ol class="refs">` + refs.map(r => `<li>${r.html}</li>`).join('\n') + '</ol>';
  return `<!doctype html>\n<html lang="${en ? 'en' : 'es'}">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${escH(meta.title || (en ? 'Methods' : 'Métodos'))}</title>\n<style>
body{font:16px/1.6 ui-serif,serif;color:#1b1b1b;background:#fff;max-width:760px;margin:40px auto;padding:0 16px}
h1{font:700 1.5rem/1.25 system-ui,sans-serif;margin:0 0 4px}h2{font:700 1.05rem/1.3 system-ui,sans-serif;margin:28px 0 8px;color:#6b4a12}
.meta{font:0.85rem/1.4 system-ui,sans-serif;color:#666;margin:0 0 24px}p{margin:0 0 12px;text-align:justify}
.refs{padding-left:1.2em}.refs li{margin:0 0 6px;font-size:0.92rem}
@media print{body{margin:0;max-width:none}}
</style>\n</head>\n<body>\n<h1>${escH(meta.title || (en ? 'Methods' : 'Métodos'))}</h1>\n<p class="meta">${escH(meta.sub || '')}</p>\n${body}\n${bib}\n</body>\n</html>\n`;
};

/* ---------------- figures as files ---------------- */
const STYLE_PROPS = ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin',
  'opacity', 'font-family', 'font-size', 'font-weight', 'font-style', 'text-anchor', 'dominant-baseline', 'letter-spacing', 'visibility'];
/* a colour mixed in CSS comes back as color(srgb r g b / a): it is written as rgb() */
const rgbOf = v => (v.indexOf('color(srgb') < 0 ? v : v.replace(/color\(srgb\s+([-\d.e]+)\s+([-\d.e]+)\s+([-\d.e]+)(?:\s*\/\s*([\d.]+%?))?\)/g, (m0, r, gg, b, a) => {
  const c = x => Math.round(Math.max(0, Math.min(1, +x)) * 255);
  return a == null ? `rgb(${c(r)}, ${c(gg)}, ${c(b)})` : `rgba(${c(r)}, ${c(gg)}, ${c(b)}, ${/%$/.test(a) ? parseFloat(a) / 100 : +a})`;
}));
function withLight(fn) {
  const html = document.documentElement, prev = html.getAttribute('data-theme');
  html.setAttribute('data-theme', 'light');
  try { return fn(); } finally { if (prev == null) html.removeAttribute('data-theme'); else html.setAttribute('data-theme', prev); }
}
R.svgText = function (svg, o) {
  o = o || {};
  if (o.light) return withLight(() => R.svgText(svg, Object.assign({}, o, { light: false })));
  const clone = svg.cloneNode(true);
  const a = [svg, ...svg.querySelectorAll('*')], b = [clone, ...clone.querySelectorAll('*')];
  for (let i = 0; i < a.length && i < b.length; i++) {
    const cs = getComputedStyle(a[i]), dst = b[i];
    const st = [];
    STYLE_PROPS.forEach(p => { const v = cs.getPropertyValue(p); if (v && v !== 'normal' && v !== 'auto') st.push(p + ':' + rgbOf(v)); });
    if (cs.display === 'none') st.push('display:none');
    dst.setAttribute('style', st.join(';'));
    /* attributes that ask the page for a value have no page to ask outside it */
    [...dst.attributes].forEach(at => { if (/var\(/.test(at.value) || at.name === 'class' || /^data-(fe|lfs)/.test(at.name)) dst.removeAttribute(at.name); });
  }
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  if (!clone.getAttribute('viewBox')) { const r = svg.getBoundingClientRect(); clone.setAttribute('viewBox', `0 0 ${Math.round(r.width)} ${Math.round(r.height)}`); }
  if (o.background) {
    const vb = clone.getAttribute('viewBox').split(/[\s,]+/).map(Number);
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('x', vb[0]); bg.setAttribute('y', vb[1]); bg.setAttribute('width', vb[2]); bg.setAttribute('height', vb[3]); bg.setAttribute('fill', o.background);
    clone.insertBefore(bg, clone.firstChild);
  }
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone) + '\n';
};

/* ---------------- ZIP ---------------- */
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();
R.crc32 = function (bytes) {
  let c = ~0;
  for (let i = 0; i < bytes.length; i++) c = (c >>> 8) ^ CRC[(c ^ bytes[i]) & 255];
  return ~c >>> 0;
};
const enc = s => new TextEncoder().encode(s);
const bytesOf = c => (typeof c === 'string' ? enc(c) : c instanceof Uint8Array ? c : new Uint8Array(c));
function dosStamp(d) {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}
/* entries: [{ name, raw (bytes), body (bytes as stored), method (0 stored, 8 deflated) }] */
function assemble(entries, when) {
  const ds = dosStamp(when || new Date());
  const chunks = [], dir = [];
  let at = 0;
  entries.forEach(e => {
    const name = enc(e.name), crc = R.crc32(e.raw);
    const head = new Uint8Array(30 + name.length), h = new DataView(head.buffer);
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, e.method, true);
    h.setUint16(10, ds.time, true); h.setUint16(12, ds.date, true); h.setUint32(14, crc, true);
    h.setUint32(18, e.body.length, true); h.setUint32(22, e.raw.length, true); h.setUint16(26, name.length, true);
    head.set(name, 30);
    const cen = new Uint8Array(46 + name.length), c = new DataView(cen.buffer);
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, e.method, true);
    c.setUint16(12, ds.time, true); c.setUint16(14, ds.date, true); c.setUint32(16, crc, true);
    c.setUint32(20, e.body.length, true); c.setUint32(24, e.raw.length, true); c.setUint16(28, name.length, true);
    c.setUint32(42, at, true);
    cen.set(name, 46);
    chunks.push(head, e.body);
    dir.push(cen);
    at += head.length + e.body.length;
  });
  const dirLen = dir.reduce((s, x) => s + x.length, 0);
  const end = new Uint8Array(22), z = new DataView(end.buffer);
  z.setUint32(0, 0x06054b50, true); z.setUint16(8, entries.length, true); z.setUint16(10, entries.length, true);
  z.setUint32(12, dirLen, true); z.setUint32(16, at, true);
  const all = chunks.concat(dir, [end]);
  const out = new Uint8Array(all.reduce((s, x) => s + x.length, 0));
  let p = 0;
  all.forEach(x => { out.set(x, p); p += x.length; });
  return out;
}
/* files: [{ name, content (text or bytes) }] → the bytes of a ZIP, every entry stored */
R.zipBytes = function (files, when) {
  return assemble(files.map(f => { const raw = bytesOf(f.content); return { name: f.name, raw, body: raw, method: 0 }; }), when);
};
/* the same, deflated where that makes an entry smaller and the platform offers the stream */
R.zip = async function (files, when) {
  const canDeflate = typeof CompressionStream === 'function';
  const entries = [];
  for (const f of files) {
    const raw = bytesOf(f.content);
    let body = raw, method = 0;
    if (canDeflate && raw.length > 128) {
      try {
        const s = new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'));
        const packed = new Uint8Array(await new Response(s).arrayBuffer());
        if (packed.length < raw.length) { body = packed; method = 8; }
      } catch (e) { /* stored, which is always valid */ }
    }
    entries.push({ name: f.name, raw, body, method });
  }
  return assemble(entries, when);
};

g.Report = R;
return R;
}
if (typeof window !== 'undefined') ReportCore(window);
