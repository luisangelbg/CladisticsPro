/* CladisticsPro — morphological cladistics in the browser.
   Copyright (C) 2026  Luis Ángel Barrera-Guzmán

   This program is free software: you can redistribute it and/or modify it under
   the terms of the GNU General Public License as published by the Free Software
   Foundation, either version 3 of the License, or (at your option) any later
   version. It is distributed in the hope that it will be useful, but WITHOUT ANY
   WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
   A PARTICULAR PURPOSE. See the GNU General Public License, in the file LICENSE
   at the root of this program, or <https://www.gnu.org/licenses/>. */

/* CladisticsPro — Block 1, the home page.
   Builds the block bar, the cards of the ten blocks, the kinds of character,
   the gallery of methods with their sources, the theory, the measured limits,
   the references and how to cite. Every text is written in both languages
   side by side (L2), so a change of language needs no redraw except for the
   pictures. */
(function () {
  const BLOCKS = [
    { n: 1, es: 'Inicio', en: 'Home', tag: ['Teoría y laboratorios', 'Theory and labs'],
      d: ['La lógica de la cladística en lenguaje llano y dos laboratorios que calculan de verdad.', 'The logic of cladistics in plain words and two labs that really compute.'] },
    { n: 2, es: 'Matriz de caracteres', en: 'Character matrix', tag: ['Codificar', 'Code'],
      d: ['Editor de taxones × caracteres con el enunciado de cada carácter y el nombre de cada estado; polimorfismos, «?», inaplicables, continuos, matrices de pasos, imágenes por estado e imágenes de cada taxón para el cladograma.', 'Taxa × characters editor with the statement of each character and the name of each state; polymorphisms, «?», inapplicables, continuous characters, step matrices, pictures per state and a picture of each taxon for the cladogram.'] },
    { n: 3, es: 'Búsqueda de árboles', en: 'Tree search', tag: ['Buscar', 'Search'],
      d: ['Rama y cota exacta, adición de Wagner + TBR, ratchet, deriva, búsqueda sectorial y fusión de árboles, con restricciones y en varios hilos.', 'Exact branch and bound, Wagner addition + TBR, ratchet, drift, sectorial search and tree fusing, with constraints and on several threads.'] },
    { n: 4, es: 'Pesos', en: 'Weighting', tag: ['Pesar', 'Weight'],
      d: ['Pesos sucesivos, pesos implícitos con su constante k, pesos implícitos extendidos para datos faltantes y sensibilidad a k.', 'Successive weighting, implied weights with their constant k, extended implied weights for missing data, and sensitivity to k.'] },
    { n: 5, es: 'Cladograma y mapeo', en: 'Cladogram and mapping', tag: ['Mapear', 'Map'],
      d: ['Cada cambio dibujado sobre su rama (lleno o vacío), ACCTRAN, DELTRAN o sólo no ambiguos, el árbol pintado por un carácter y la edición con el ratón con la longitud al instante.', 'Every change drawn on its branch (filled or open), ACCTRAN, DELTRAN or unambiguous only, the tree painted by one character, and mouse editing with the length updated at once.'] },
    { n: 6, es: 'Diagnóstico de caracteres', en: 'Character diagnosis', tag: ['Diagnosticar', 'Diagnose'],
      d: ['Pasos, CI, RI y RC por carácter, sinapomorfías, autapomorfías y homoplasias de cada clado con los nombres de los estados, y la matriz ordenada por el árbol.', 'Steps, CI, RI and RC per character, synapomorphies, autapomorphies and homoplasies of each clade with the names of the states, and the matrix sorted by the tree.'] },
    { n: 7, es: 'Apoyo de ramas', en: 'Branch support', tag: ['Medir', 'Measure'],
      d: ['Bremer absoluto y relativo, bootstrap, jackknife, remuestreo simétrico y diferencias de frecuencia GC, con su escala de lectura.', 'Absolute and relative Bremer support, bootstrap, jackknife, symmetric resampling and GC frequency differences, with their reading scale.'] },
    { n: 8, es: 'Consensos y comodines', en: 'Consensus and wildcards', tag: ['Resumir', 'Summarise'],
      d: ['Estricto, mayoría, semiestricto, Adams y Nelsen; consenso reducido y los taxones comodín que esconden la resolución.', 'Strict, majority, semistrict, Adams and Nelsen; reduced consensus and the wildcard taxa that hide resolution.'] },
    { n: 9, es: 'Hipótesis', en: 'Hypotheses', tag: ['Poner a prueba', 'Test'],
      d: ['¿Cuántos pasos cuesta un grupo propuesto? Búsquedas con restricción y pruebas de topología bajo parsimonia, carácter por carácter.', 'How many steps does a proposed group cost? Constrained searches and parsimony topology tests, character by character.'] },
    { n: 10, es: 'Figuras e informe', en: 'Figures and report', tag: ['Publicar', 'Publish'],
      d: ['Estudio de cladogramas, exportación Newick, NEXUS y xread, figuras por ppp, informe de métodos redactado con lo que se corrió y paquete reproducible.', 'Cladogram studio, Newick, NEXUS and xread export, figures by dpi, a methods report written from what was run, and a reproducible package.'] },
  ];

  const TYPES = [
    { k: 'unord', es: 'No ordenado', en: 'Unordered', t: ['Cualquier estado pasa a cualquier otro con un paso.', 'Any state turns into any other in one step.'], tag: ['Fitch', 'Fitch'] },
    { k: 'ord', es: 'Ordenado (aditivo)', en: 'Ordered (additive)', t: ['Los estados forman una serie: de 0 a 2 hay que pasar por 1.', 'The states form a series: from 0 to 2 one passes through 1.'], tag: ['Wagner', 'Wagner'] },
    { k: 'step', es: 'Matriz de pasos', en: 'Step matrix', t: ['Cada cambio con su costo, incluso distinto de ida y de vuelta.', 'Each change with its own cost, even different there and back.'], tag: ['Sankoff', 'Sankoff'] },
    { k: 'cont', es: 'Continuo', en: 'Continuous', t: ['Una medida analizada como tal, sin cortarla en clases.', 'A measurement analysed as such, without cutting it into classes.'], tag: ['intervalos', 'intervals'] },
    { k: 'inap', es: 'Inaplicable', en: 'Inapplicable', t: ['«–»: el carácter no existe en ese taxón; no es lo mismo que «no sé».', '«–»: the character does not exist in that taxon; not the same as «don\'t know».'], tag: ['2019', '2019'] },
    { k: 'poly', es: 'Polimórfico o desconocido', en: 'Polymorphic or unknown', t: ['{01} y «?» se leen como incertidumbre entre estados.', '{01} and «?» are read as uncertainty among states.'], tag: ['incertidumbre', 'uncertainty'] },
  ];

  /* the methods of the app, each with the source it follows */
  const FAMS = {
    mat: ['Matriz y codificación', 'Matrix and coding'], bus: ['Búsqueda', 'Search'], pes: ['Pesos', 'Weighting'],
    opt: ['Optimización', 'Optimization'], idx: ['Índices', 'Indices'], apo: ['Apoyo', 'Support'],
    con: ['Consenso', 'Consensus'], hip: ['Hipótesis', 'Hypotheses'], fig: ['Figuras e informe', 'Figures and report'],
  };
  const METHODS = [
    ['mat', 'Enunciados de carácter y nombres de estado', 'Character statements and state names', 'Sereno 2007'],
    ['mat', 'Polimorfismos y datos faltantes', 'Polymorphisms and missing data', 'Nixon y Davis 1991'],
    ['mat', 'Caracteres inaplicables', 'Inapplicable characters', 'Brazeau et al. 2019'],
    ['mat', 'Caracteres continuos', 'Continuous characters', 'Goloboff et al. 2006'],
    ['mat', 'Matrices de pasos', 'Step matrices', 'Sankoff 1975'],
    ['mat', 'Codificación binaria aditiva', 'Additive binary coding', 'Farris et al. 1970'],
    ['bus', 'Rama y cota (exacta)', 'Branch and bound (exact)', 'Hendy y Penny 1982'],
    ['bus', 'Adición paso a paso de Wagner', 'Wagner stepwise addition', 'Farris 1970'],
    ['bus', 'Intercambio de ramas TBR', 'TBR branch swapping', 'Swofford y Olsen 1990'],
    ['bus', 'Longitudes por conjuntos de arista', 'Lengths from edge sets', 'Goloboff 1996'],
    ['bus', 'Ratchet', 'Ratchet', 'Nixon 1999'],
    ['bus', 'Deriva, búsqueda sectorial y fusión', 'Drift, sectorial search and fusing', 'Goloboff 1999'],
    ['bus', 'Colapso de ramas sin soporte', 'Collapsing unsupported branches', 'Coddington y Scharff 1994'],
    ['pes', 'Pesos sucesivos', 'Successive weighting', 'Farris 1969'],
    ['pes', 'Pesos implícitos', 'Implied weights', 'Goloboff 1993'],
    ['pes', 'Pesos implícitos extendidos', 'Extended implied weights', 'Goloboff 2014'],
    ['pes', 'Estabilidad frente a k', 'Stability across k', 'Mirande 2009'],
    ['opt', 'Optimización de Fitch', 'Fitch optimization', 'Fitch 1971'],
    ['opt', 'Optimización de Wagner', 'Wagner optimization', 'Farris 1970'],
    ['opt', 'Matrices de costo', 'Cost matrices', 'Sankoff 1975'],
    ['opt', 'ACCTRAN y DELTRAN', 'ACCTRAN and DELTRAN', 'Swofford y Maddison 1987'],
    ['opt', 'Cambios no ambiguos', 'Unambiguous changes', 'Agnarsson y Miller 2008'],
    ['opt', 'Grupo externo y polaridad', 'Outgroup and polarity', 'Maddison et al. 1984'],
    ['idx', 'Índice de consistencia', 'Consistency index', 'Kluge y Farris 1969'],
    ['idx', 'Índice de retención y CI reescalado', 'Retention index and rescaled CI', 'Farris 1989'],
    ['idx', 'Sinapomorfías por clado', 'Synapomorphies per clade', 'Hennig 1966'],
    ['apo', 'Soporte de Bremer', 'Bremer support', 'Bremer 1988, 1994'],
    ['apo', 'Bremer relativo', 'Relative Bremer support', 'Goloboff y Farris 2001'],
    ['apo', 'Bootstrap', 'Bootstrap', 'Felsenstein 1985'],
    ['apo', 'Jackknife de parsimonia', 'Parsimony jackknife', 'Farris et al. 1996'],
    ['apo', 'Remuestreo simétrico y GC', 'Symmetric resampling and GC', 'Goloboff et al. 2003'],
    ['con', 'Consenso estricto', 'Strict consensus', 'Sokal y Rohlf 1981'],
    ['con', 'Consenso de mayoría', 'Majority-rule consensus', 'Margush y McMorris 1981'],
    ['con', 'Semiestricto', 'Semistrict', 'Bremer 1990'],
    ['con', 'Consenso de Adams', 'Adams consensus', 'Adams 1972'],
    ['con', 'Consenso de Nelsen', 'Nelsen consensus', 'Nelson 1979'],
    ['con', 'Consenso reducido y comodines', 'Reduced consensus and wildcards', 'Wilkinson 1994; Pol y Escapa 2009'],
    ['hip', 'Prueba de Templeton', 'Templeton test', 'Templeton 1983'],
    ['hip', 'Kishino–Hasegawa por carácter', 'Kishino–Hasegawa by character', 'Kishino y Hasegawa 1989'],
    ['hip', 'Sitios ganadores', 'Winning sites', 'Prager y Wilson 1988'],
    ['fig', 'Cladograma con marcas de cambio', 'Cladogram with change marks', 'Hennig 1966'],
    ['fig', 'Paleta segura al daltonismo', 'Colour-blind-safe palette', 'Okabe e Ito 2008'],
  ];

  const REFS = [
    ['Adams EN. 1972. Consensus techniques and the comparison of taxonomic trees. <i>Systematic Zoology</i> 21: 390–397.', 'con'],
    ['Agnarsson I, Miller JA. 2008. Is ACCTRAN better than DELTRAN? <i>Cladistics</i> 24: 1032–1038.', 'opt'],
    ['Brazeau MD, Guillerme T, Smith MR. 2019. An algorithm for morphological phylogenetic analysis with inapplicable data. <i>Systematic Biology</i> 68: 619–631.', 'mat'],
    ['Bremer K. 1988. The limits of amino acid sequence data in angiosperm phylogenetic reconstruction. <i>Evolution</i> 42: 795–803.', 'apo'],
    ['Bremer K. 1990. Combinable component consensus. <i>Cladistics</i> 6: 369–372.', 'con'],
    ['Bremer K. 1994. Branch support and tree stability. <i>Cladistics</i> 10: 295–304.', 'apo'],
    ['Coddington J, Scharff N. 1994. Problems with zero-length branches. <i>Cladistics</i> 10: 415–423.', 'bus'],
    ['de Pinna MCC. 1991. Concepts and tests of homology in the cladistic paradigm. <i>Cladistics</i> 7: 367–394.', 'teo'],
    ['Dreyfus SE, Wagner RA. 1971. The Steiner problem in graphs. <i>Networks</i> 1: 195–207.', 'idx'],
    ['Farris JS. 1969. A successive approximations approach to character weighting. <i>Systematic Zoology</i> 18: 374–385.', 'pes'],
    ['Farris JS. 1970. Methods for computing Wagner trees. <i>Systematic Zoology</i> 19: 83–92.', 'bus'],
    ['Farris JS. 1983. The logical basis of phylogenetic analysis. En: Platnick NI, Funk VA (eds.), <i>Advances in Cladistics</i> 2: 7–36. Columbia University Press.', 'teo'],
    ['Farris JS. 1989. The retention index and the rescaled consistency index. <i>Cladistics</i> 5: 417–419.', 'idx'],
    ['Farris JS, Kluge AG, Eckardt MJ. 1970. A numerical approach to phylogenetic systematics. <i>Systematic Zoology</i> 19: 172–189.', 'mat'],
    ['Farris JS, Albert VA, Källersjö M, Lipscomb D, Kluge AG. 1996. Parsimony jackknifing outperforms neighbor-joining. <i>Cladistics</i> 12: 99–124.', 'apo'],
    ['Felsenstein J. 1985. Confidence limits on phylogenies: an approach using the bootstrap. <i>Evolution</i> 39: 783–791.', 'apo'],
    ['Fitch WM. 1971. Toward defining the course of evolution: minimum change for a specific tree topology. <i>Systematic Zoology</i> 20: 406–416.', 'opt'],
    ['Goldman N, Anderson JP, Rodrigo AG. 2000. Likelihood-based tests of topologies in phylogenetics. <i>Systematic Biology</i> 49: 652–670.', 'hip'],
    ['Goloboff PA. 1993. Estimating character weights during tree search. <i>Cladistics</i> 9: 83–91.', 'pes'],
    ['Goloboff PA. 1996. Methods for faster parsimony analysis. <i>Cladistics</i> 12: 199–220.', 'bus'],
    ['Goloboff PA. 1999. Analyzing large data sets in reasonable times: solutions for composite optima. <i>Cladistics</i> 15: 415–428.', 'bus'],
    ['Goloboff PA. 2014. Extended implied weighting. <i>Cladistics</i> 30: 260–272.', 'pes'],
    ['Goloboff PA, Farris JS. 2001. Methods for quick consensus estimation. <i>Cladistics</i> 17: S26–S34.', 'apo'],
    ['Goloboff PA, Farris JS, Källersjö M, Oxelman B, Ramírez MJ, Szumik CA. 2003. Improvements to resampling measures of group support. <i>Cladistics</i> 19: 324–332.', 'apo'],
    ['Goloboff PA, Mattoni CI, Quinteros AS. 2006. Continuous characters analyzed as such. <i>Cladistics</i> 22: 589–601.', 'mat'],
    ['Hendy MD, Penny D. 1982. Branch and bound algorithms to determine minimal evolutionary trees. <i>Mathematical Biosciences</i> 59: 277–290.', 'bus'],
    ['Hennig W. 1966. <i>Phylogenetic Systematics</i>. University of Illinois Press, Urbana.', 'teo'],
    ['Kearney M. 2002. Fragmentary taxa, missing data, and ambiguity: mistaken assumptions and conclusions. <i>Systematic Biology</i> 51: 369–381.', 'con'],
    ['Kishino H, Hasegawa M. 1989. Evaluation of the maximum likelihood estimate of the evolutionary tree topologies from DNA sequence data, and the branching order in Hominoidea. <i>Journal of Molecular Evolution</i> 29: 170–179.', 'hip'],
    ['Kitching IJ, Forey PL, Humphries CJ, Williams DM. 1998. <i>Cladistics: The Theory and Practice of Parsimony Analysis</i>, 2.ª ed. Oxford University Press.', 'teo'],
    ['Kluge AG, Farris JS. 1969. Quantitative phyletics and the evolution of anurans. <i>Systematic Zoology</i> 18: 1–32.', 'idx'],
    ['Maddison WP. 1993. Missing data versus missing characters in phylogenetic analysis. <i>Systematic Biology</i> 42: 576–581.', 'mat'],
    ['Maddison WP, Donoghue MJ, Maddison DR. 1984. Outgroup analysis and parsimony. <i>Systematic Zoology</i> 33: 83–103.', 'opt'],
    ['Margush T, McMorris FR. 1981. Consensus n-trees. <i>Bulletin of Mathematical Biology</i> 43: 239–244.', 'con'],
    ['Mirande JM. 2009. Weighted parsimony phylogeny of the family Characidae (Teleostei: Characiformes). <i>Cladistics</i> 25: 574–613.', 'pes'],
    ['Nelson G. 1979. Cladistic analysis and synthesis: principles and definitions, with a historical note on Adanson\'s <i>Familles des Plantes</i> (1763–1764). <i>Systematic Zoology</i> 28: 1–21.', 'con'],
    ['Nixon KC. 1999. The parsimony ratchet, a new method for rapid parsimony analysis. <i>Cladistics</i> 15: 407–414.', 'bus'],
    ['Nixon KC, Carpenter JM. 1993. On outgroups. <i>Cladistics</i> 9: 413–426.', 'opt'],
    ['Nixon KC, Davis JI. 1991. Polymorphic taxa, missing values and cladistic analysis. <i>Cladistics</i> 7: 233–241.', 'mat'],
    ['Okabe M, Ito K. 2008. Color universal design (CUD): how to make figures and presentations that are friendly to colorblind people. Documento en línea.', 'fig'],
    ['Patterson C. 1982. Morphological characters and homology. En: Joysey KA, Friday AE (eds.), <i>Problems of Phylogenetic Reconstruction</i>: 21–74. Academic Press.', 'teo'],
    ['Pol D, Escapa IH. 2009. Unstable taxa in cladistic analysis: identification and the assessment of relevant characters. <i>Cladistics</i> 25: 515–527.', 'con'],
    ['Prager EM, Wilson AC. 1988. Ancient origin of lactalbumin from lysozyme: analysis of DNA and amino acid sequences. <i>Journal of Molecular Evolution</i> 27: 326–335.', 'hip'],
    ['Sankoff D. 1975. Minimal mutation trees of sequences. <i>SIAM Journal on Applied Mathematics</i> 28: 35–42.', 'opt'],
    ['Schuh RT, Brower AVZ. 2009. <i>Biological Systematics: Principles and Applications</i>, 2.ª ed. Cornell University Press.', 'teo'],
    ['Sereno PC. 2007. Logical basis for morphological characters in phylogenetics. <i>Cladistics</i> 23: 565–587.', 'mat'],
    ['Sokal RR, Rohlf FJ. 1981. Taxonomic congruence in the Leptopodomorpha re-examined. <i>Systematic Zoology</i> 30: 309–325.', 'con'],
    ['Strong EE, Lipscomb D. 1999. Character coding and inapplicable data. <i>Cladistics</i> 15: 363–371.', 'mat'],
    ['Swofford DL, Maddison WP. 1987. Reconstructing ancestral character states under Wagner parsimony. <i>Mathematical Biosciences</i> 87: 199–229.', 'opt'],
    ['Swofford DL, Olsen GJ. 1990. Phylogeny reconstruction. En: Hillis DM, Moritz C (eds.), <i>Molecular Systematics</i>: 411–501. Sinauer.', 'bus'],
    ['Templeton AR. 1983. Phylogenetic inference from restriction endonuclease cleavage site maps with particular reference to the evolution of humans and the apes. <i>Evolution</i> 37: 221–244.', 'hip'],
    ['Wiley EO, Lieberman BS. 2011. <i>Phylogenetics: Theory and Practice of Phylogenetic Systematics</i>, 2.ª ed. Wiley-Blackwell.', 'teo'],
    ['Wilkinson M. 1994. Common cladistic information and its consensus representation: reduced Adams and reduced cladistic consensus trees and profiles. <i>Systematic Biology</i> 43: 343–368.', 'con'],
  ];
  const REF_TOPICS = Object.assign({ teo: ['Teoría', 'Theory'] }, FAMS);

  /* sizes measured on this computer (research/02); a TBR round is the work of
     one full pass over every rearrangement of a tree */
  const LIMITS = [
    ['25 × 100', '0.7 ms', ['instantáneo', 'instant']],
    ['50 × 100', '4.4 ms', ['búsqueda completa en menos de un segundo', 'full search in under a second']],
    ['50 × 300', '18 ms', ['segundos', 'seconds']],
    ['100 × 300', '77 ms', ['decenas de segundos con ratchet', 'tens of seconds with the ratchet']],
    ['100 × 1000', '173 ms', ['un par de minutos con ratchet', 'a couple of minutes with the ratchet']],
    ['200 × 500', '0.68 s', ['varios minutos; réplicas en paralelo', 'several minutes; replicates in parallel']],
  ];

  /* ---------------- builders ---------------- */
  function buildStepper() {
    const nav = el('stepper');
    if (!nav) return;
    nav.innerHTML = STEPS.map(s => `<button type="button" class="step-btn${s.n === 1 ? ' active' : ''}${s.ready ? '' : ' soon'}" data-step="${s.n}"${s.ready ? '' : ' disabled data-soon="' + T('pronto', 'soon') + '"'}><span class="step-num">${s.n}</span>${L2(s.es, s.en)}</button>`).join('');
    nav.addEventListener('click', e => { const b = e.target.closest('.step-btn'); if (b && !b.disabled) goStep(b.dataset.step); });
  }
  function buildBlocks() {
    const host = el('blockGrid');
    if (!host) return;
    host.innerHTML = BLOCKS.map(b => {
      const st = STEPS.find(s => s.n === b.n);
      return `<button type="button" class="feature" data-go="${b.n}"${st && st.ready ? '' : ' aria-disabled="true"'}>` +
        `<span class="f-num">${b.n}</span><div class="f-art" data-card="${b.n}"></div>` +
        `<span class="f-tag">${L2(b.tag[0], b.tag[1])}${st && st.ready ? '' : ` <span class="f-soon">${L2('pronto', 'soon')}</span>`}</span>` +
        `<h3>${L2(b.es, b.en)}</h3><p>${L2(b.d[0], b.d[1])}</p></button>`;
    }).join('');
    host.addEventListener('click', e => {
      const b = e.target.closest('.feature');
      if (!b) return;
      const n = b.dataset.go;
      if (stepOn(n)) goStep(n);
      else if (window.LABG) LABG.toast(T('Ese bloque llega en una próxima versión de esta construcción.', 'That block arrives in a later stage of this build.'));
    });
  }
  function buildTypes() {
    const host = el('typeStrip');
    if (!host) return;
    host.innerHTML = TYPES.map(t => `<div class="material"><div class="mt-art" data-type="${t.k}"></div><div class="mt-t">${L2(t.es, t.en)}</div>` +
      `<div class="mt-s">${L2(t.t[0], t.t[1])}</div><span class="mt-k">${L2(t.tag[0], t.tag[1])}</span></div>`).join('');
  }
  function buildMethods() {
    const host = el('methodGallery'), filt = el('methodFilter');
    if (!host || !filt) return;
    filt.innerHTML = `<button type="button" class="chip on" data-f="">${L2('Todos', 'All')} (${METHODS.length})</button>` +
      Object.keys(FAMS).map(f => `<button type="button" class="chip" data-f="${f}">${L2(FAMS[f][0], FAMS[f][1])}</button>`).join('');
    host.innerHTML = METHODS.map((m, i) => `<div class="method-card" data-fam="${m[0]}">` +
      `<span class="m-fam ${m[0]}">${L2(FAMS[m[0]][0], FAMS[m[0]][1])}</span>` +
      `<div class="m-art" data-fam="${m[0]}" data-seed="${11 + i * 7}"></div>` +
      `<div class="m-name">${L2(m[1], m[2])}</div><div class="m-sub">${L2(m[3], m[3].replace(/ (y|e) /g, ' &amp; '))}</div></div>`).join('');
    filt.addEventListener('click', e => {
      const b = e.target.closest('.chip');
      if (!b) return;
      filt.querySelectorAll('.chip').forEach(c => { c.classList.toggle('on', c === b); c.setAttribute('aria-pressed', c === b); });
      const f = b.dataset.f;
      host.querySelectorAll('.method-card').forEach(c => { c.hidden = !!f && c.dataset.fam !== f; });
    });
  }
  function buildLimits() {
    const host = el('limitsTable');
    if (!host) return;
    host.innerHTML = '<table><thead><tr><th>' + L2('Taxones × caracteres', 'Taxa × characters') + '</th><th class="num">' +
      L2('Una ronda completa de TBR', 'One full TBR round') + '</th><th>' + L2('Qué esperar', 'What to expect') + '</th></tr></thead><tbody>' +
      LIMITS.map(r => `<tr><td>${r[0]}</td><td class="num">${r[1]}</td><td>${L2(r[2][0], r[2][1])}</td></tr>`).join('') + '</tbody></table>';
  }
  function buildTheory() {
    const fig = (k, es, en) => `<figure class="theory-fig"><div data-theory="${k}"></div><figcaption class="cap">${L2(es, en)}</figcaption></figure>`;
    const host = el('theoryHost');
    if (!host) return;
    host.innerHTML = THEORY.map((t, i) => `<details class="acc"${i === 0 ? ' open' : ''}><summary>${L2(t.h[0], t.h[1])}<span class="acc-tag">${L2(t.tag[0], t.tag[1])}</span></summary>` +
      `<div class="acc-body clearfix">${t.fig ? fig(t.fig[0], t.fig[1], t.fig[2]) : ''}${L2(t.es, t.en)}</div></details>`).join('');
  }
  function buildRefs() {
    const host = el('refList'), tools = el('refTools');
    if (!host) return;
    const topics = [...new Set(REFS.map(r => r[1]))];
    if (tools) {
      tools.innerHTML = `<button type="button" class="chip on" data-t="">${L2('Todas', 'All')} (${REFS.length})</button>` +
        topics.map(t => `<button type="button" class="chip" data-t="${t}">${L2(REF_TOPICS[t][0], REF_TOPICS[t][1])}</button>`).join('');
      tools.addEventListener('click', e => {
        const b = e.target.closest('.chip');
        if (!b) return;
        tools.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === b));
        host.querySelectorAll('li').forEach(li => { li.hidden = !!b.dataset.t && li.dataset.t !== b.dataset.t; });
      });
    }
    host.innerHTML = REFS.map(r => `<li data-t="${r[1]}">${r[0]} <span class="ref-topic">${L2(REF_TOPICS[r[1]][0], REF_TOPICS[r[1]][1])}</span></li>`).join('');
  }
  function buildCite() {
    /* cited by its author, title, version and the concept DOI of Zenodo */
    const url = `https://doi.org/${APP_DOI}`;
    const apa = `Barrera-Guzmán, L. Á. (2026). <i>CladisticsPro: cladística morfológica en el navegador</i> (versión ${APP_VERSION}) [Programa de cómputo]. <a href="${url}" target="_blank" rel="noopener">${url}</a>`;
    const bib = `@software{barreraguzman2026cladisticspro,\n  author  = {Barrera-Guzmán, Luis Ángel},\n  title   = {CladisticsPro: cladística morfológica en el navegador},\n  version = {${APP_VERSION}},\n  year    = {2026},\n  doi     = {${APP_DOI}},\n  url     = {${url}}\n}`;
    const a = el('citeApa'), b = el('citeBib');
    if (a) a.innerHTML = apa;
    if (b) b.textContent = bib;
    const copy = (btn, text) => btn && btn.addEventListener('click', () => {
      const done = () => { if (window.LABG) LABG.toast(T('Copiado', 'Copied')); };
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, () => {}); else done();
    });
    copy(el('copyApa'), apa.replace(/<[^>]+>/g, ''));
    copy(el('copyBib'), bib);
  }
  /* Every picture is drawn again when the language changes: their labels are
     written with T() at drawing time. */
  function paintArt() {
    const h = el('heroArt');
    if (h) h.innerHTML = Art.hero();
    els('[data-card]').forEach(d => { d.innerHTML = Art.cards[d.dataset.card](); });
    els('[data-type]').forEach(d => { d.innerHTML = Art.typeArt(d.dataset.type); });
    els('.m-art[data-fam]').forEach(d => { d.innerHTML = Art.methodArt(d.dataset.fam, +d.dataset.seed); });
    els('[data-theory]').forEach(d => { d.innerHTML = Art.theory[d.dataset.theory](); });
    els('.soon-art[data-art]').forEach(d => { const g = Art.cards[d.dataset.art]; if (g) d.innerHTML = g(); });
  }

  /* ---------------- theory ---------------- */
  const THEORY = [
    { h: ['La lógica de Hennig: sólo las novedades agrupan', 'Hennig\'s logic: only novelties group'], tag: ['Bloques 5 y 6', 'Blocks 5 and 6'],
      fig: ['apomorphy', 'Una misma novedad es apomorfía en un nivel y plesiomorfía en otro.', 'The same novelty is an apomorphy at one level and a plesiomorphy at another.'],
      es: '<p>Un <b>carácter</b> es una conjetura de que una parte de distintos organismos es «la misma» (homología primaria; de Pinna 1991). Sus <b>estados</b> son las formas que toma. Hennig (1966) vio que el parecido sólo indica parentesco cuando es <b>compartido y derivado</b>: una <b>sinapomorfía</b>. El estado antiguo (<b>plesiomorfía</b>) no dice nada, porque lo tenían también los antepasados de grupos que no están emparentados entre sí.</p><p>Una <b>autapomorfía</b> (novedad de un solo taxón) describe a ese taxón pero no agrupa a nadie. La palabra depende del nivel: una apomorfía de un grupo grande es una plesiomorfía cuando se comparan dos subgrupos suyos.</p>',
      en: '<p>A <b>character</b> is a conjecture that some part of different organisms is «the same» (primary homology; de Pinna 1991). Its <b>states</b> are the forms it takes. Hennig (1966) saw that likeness only signals kinship when it is <b>shared and derived</b>: a <b>synapomorphy</b>. The old state (<b>plesiomorphy</b>) says nothing, because the ancestors of unrelated groups had it too.</p><p>An <b>autapomorphy</b> (a novelty of a single taxon) describes that taxon but groups nobody. The word depends on the level: an apomorphy of a large group is a plesiomorphy when two of its subgroups are compared.</p>' },
    { h: ['Grupos monofiléticos, parafiléticos y polifiléticos', 'Monophyletic, paraphyletic and polyphyletic groups'], tag: ['Bloques 5 y 9', 'Blocks 5 and 9'],
      fig: ['groups', 'Sólo el primero es un grupo natural en sentido cladístico.', 'Only the first is a natural group in the cladistic sense.'],
      es: '<p>Un grupo <b>monofilético</b> (un clado) reúne a un antepasado y a <b>todos</b> sus descendientes, y se reconoce por sinapomorfías. Un grupo <b>parafilético</b> deja fuera a algunos descendientes (se define por plesiomorfías: «los que aún no tienen X»). Uno <b>polifilético</b> junta linajes por convergencia, sin su antepasado común. El Bloque 9 mide cuántos pasos cuesta forzar que un grupo propuesto sea monofilético.</p>',
      en: '<p>A <b>monophyletic</b> group (a clade) holds an ancestor and <b>all</b> its descendants, and is recognised by synapomorphies. A <b>paraphyletic</b> group leaves some descendants out (it is defined by plesiomorphies: «those that do not have X yet»). A <b>polyphyletic</b> one joins lineages by convergence, without their common ancestor. Block 9 measures how many steps it costs to force a proposed group to be monophyletic.</p>' },
    { h: ['Homología y homoplasia', 'Homology and homoplasy'], tag: ['Bloques 5 y 6', 'Blocks 5 and 6'],
      fig: ['homoplasy', 'Dos historias igual de cortas para el mismo carácter.', 'Two equally short histories for the same character.'],
      es: '<p>La codificación propone homologías; el árbol las pone a prueba. Cuando un estado aparece más de una vez en el árbol más corto, esa semejanza no era homología sino <b>homoplasia</b>: un <b>paralelismo</b> o una <b>convergencia</b> (el mismo estado ganado dos veces) o una <b>reversión</b> (el estado antiguo recuperado). Es la prueba de congruencia de Patterson (1982): una homología primaria que no encaja con las demás se rechaza.</p><p>En el cladograma de esta app, una marca <b>llena</b> es un cambio a un estado que aparece una sola vez; una marca <b>vacía</b>, a un estado que aparece más de una vez.</p>',
      en: '<p>Coding proposes homologies; the tree tests them. When a state arises more than once on the shortest tree, that likeness was not homology but <b>homoplasy</b>: a <b>parallelism</b> or a <b>convergence</b> (the same state gained twice) or a <b>reversal</b> (the old state regained). It is Patterson\'s (1982) congruence test: a primary homology that does not fit with the rest is rejected.</p><p>In this app\'s cladogram a <b>filled</b> mark is a change into a state that arises only once; an <b>open</b> mark, into a state that arises more than once.</p>' },
    { h: ['Por qué parsimonia', 'Why parsimony'], tag: ['Bloque 3', 'Block 3'],
      es: '<p>Entre todos los árboles posibles se prefiere el que necesita <b>menos cambios</b>, porque es el que explica más semejanzas como homologías y deja menos como homoplasias ad hoc (Farris 1983). No supone un modelo de cambio: por eso es la herramienta habitual en morfología, donde cada carácter es distinto y no hay un proceso común que modelar. Su límite conocido es la atracción de ramas largas cuando hay mucho cambio en pocos linajes; para datos moleculares con esa estructura conviene un modelo (la app hermana PhylogenyPro lo trata).</p><p>El número de árboles crece como (2n − 5)!!: 15 con 5 taxones, más de dos millones con 10, más que átomos en la Tierra con 50. Por eso la búsqueda es heurística salvo en matrices pequeñas.</p>',
      en: '<p>Among all possible trees one prefers the one that needs <b>fewest changes</b>, because it explains the most likenesses as homologies and leaves the fewest as ad hoc homoplasies (Farris 1983). It assumes no model of change: that is why it is the usual tool for morphology, where every character is different and there is no common process to model. Its known limit is long-branch attraction when much change falls on a few lineages; for molecular data with that structure a model is better (the sister app PhylogenyPro deals with it).</p><p>The number of trees grows as (2n − 5)!!: 15 with 5 taxa, over two million with 10, more than atoms on Earth with 50. That is why the search is heuristic except for small matrices.</p>' },
    { h: ['Polaridad y grupo externo', 'Polarity and outgroup'], tag: ['Bloques 2 y 5', 'Blocks 2 and 5'],
      es: '<p>La parsimonia da árboles <b>sin raíz</b>: la longitud no cambia al mover la raíz. La raíz —y con ella qué estado es antiguo y cuál derivado— la pone el <b>grupo externo</b>, uno o más taxones que se sabe que quedan fuera del grupo estudiado (Maddison et al. 1984; Nixon y Carpenter 1993). Lo correcto es incluir el grupo externo en el análisis, no polarizar los caracteres a mano antes de empezar.</p>',
      en: '<p>Parsimony yields <b>unrooted</b> trees: the length does not change when the root moves. The root —and with it which state is old and which derived— is set by the <b>outgroup</b>, one or more taxa known to lie outside the group studied (Maddison et al. 1984; Nixon and Carpenter 1993). The right practice is to include the outgroup in the analysis, not to polarise the characters by hand beforehand.</p>' },
    { h: ['Codificar caracteres (y el problema del «–»)', 'Coding characters (and the «–» problem)'], tag: ['Bloque 2', 'Block 2'],
      fig: ['inapplicable', 'El problema clásico del color de una cola que no existe.', 'The classic problem of the colour of a tail that does not exist.'],
      es: '<p>Un buen carácter tiene un <b>enunciado</b> (la parte y la variable) y estados mutuamente excluyentes (Sereno 2007). Cuando un carácter depende de otro —el tipo de tricoma sólo existe si hay tricomas— el taxón sin la estructura recibe «–», <b>inaplicable</b>. Tratar «–» como «?» deja que el análisis invente estados donde no hay estructura y puede favorecer árboles absurdos (Maddison 1993; Strong y Lipscomb 1999). El algoritmo de Brazeau, Guillerme y Smith (2019), que esta app implementa, cuenta los cambios del carácter dependiente sólo donde la estructura existe.</p><p>Los polimorfismos ({01}) y los «?» se leen como incertidumbre entre estados, no como un estado más (Nixon y Davis 1991).</p>',
      en: '<p>A good character has a <b>statement</b> (the part and the variable) and mutually exclusive states (Sereno 2007). When a character depends on another —trichome type only exists if there are trichomes— the taxon without the structure gets «–», <b>inapplicable</b>. Treating «–» as «?» lets the analysis invent states where there is no structure and can favour absurd trees (Maddison 1993; Strong and Lipscomb 1999). The algorithm of Brazeau, Guillerme and Smith (2019), which this app implements, counts the changes of the dependent character only where the structure exists.</p><p>Polymorphisms ({01}) and «?» are read as uncertainty among states, not as one more state (Nixon and Davis 1991).</p>' },
    { h: ['Optimizar: dónde ocurrió cada cambio', 'Optimizing: where each change happened'], tag: ['Bloque 5', 'Block 5'],
      es: '<p>Dado un árbol, la <b>optimización</b> asigna estados a los nodos internos con el menor número de cambios. Un carácter no ordenado se optimiza por el método de Fitch (1971); uno ordenado, por el de Wagner (Farris 1970); una matriz de pasos, por el método general de Sankoff (1975), que incluye a los otros dos. A menudo hay <b>varias reconstrucciones igual de cortas</b>: <b>ACCTRAN</b> pone los cambios lo más cerca posible de la raíz (prefiere una ganancia seguida de una reversión) y <b>DELTRAN</b> lo más cerca posible de las puntas (prefiere paralelismos) (Swofford y Maddison 1987). Un cambio que aparece en las dos es <b>no ambiguo</b>. El segundo laboratorio de esta página lo muestra.</p>',
      en: '<p>Given a tree, <b>optimization</b> assigns states to the internal nodes with the fewest changes. An unordered character is optimized by Fitch\'s method (1971); an ordered one by Wagner\'s (Farris 1970); a step matrix by the general method of Sankoff (1975), which contains the other two. Often there are <b>several equally short reconstructions</b>: <b>ACCTRAN</b> puts the changes as close to the root as possible (it prefers a gain followed by a reversal) and <b>DELTRAN</b> as close to the tips as possible (it prefers parallelisms) (Swofford and Maddison 1987). A change present in both is <b>unambiguous</b>. The second lab on this page shows it.</p>' },
    { h: ['Los índices: CI, RI, RC', 'The indices: CI, RI, RC'], tag: ['Bloque 6', 'Block 6'],
      fig: ['indices', 'Tres caracteres con el mismo mínimo y distinta homoplasia.', 'Three characters with the same minimum and different homoplasy.'],
      es: '<p>Para cada carácter, <b>m</b> es el mínimo de pasos posible, <b>s</b> los que toma en el árbol y <b>g</b> los que tomaría en un árbol estrella. El <b>índice de consistencia</b> CI = m/s vale 1 sin homoplasia (Kluge y Farris 1969); baja con el número de taxones y con los caracteres no informativos, así que no se compara entre matrices. El <b>índice de retención</b> RI = (g − s)/(g − m) mide qué fracción de la semejanza posible se conserva como sinapomorfía (Farris 1989); <b>RC = CI × RI</b>. Un carácter no informativo tiene g = m y su RI es <b>0/0, no cero</b>: la app escribe «—».</p>',
      en: '<p>For each character, <b>m</b> is the fewest steps possible, <b>s</b> the steps on the tree and <b>g</b> those it would take on a star tree. The <b>consistency index</b> CI = m/s is 1 without homoplasy (Kluge and Farris 1969); it falls with the number of taxa and with uninformative characters, so it is not compared across matrices. The <b>retention index</b> RI = (g − s)/(g − m) measures what fraction of the possible similarity is kept as synapomorphy (Farris 1989); <b>RC = CI × RI</b>. An uninformative character has g = m and its RI is <b>0/0, not zero</b>: the app writes «—».</p>' },
    { h: ['Pesar los caracteres', 'Weighting characters'], tag: ['Bloque 4', 'Block 4'],
      es: '<p>Con pesos iguales, un carácter que cambia veinte veces pesa lo mismo que uno perfecto. Los <b>pesos sucesivos</b> (Farris 1969) repiten la búsqueda dando a cada carácter un peso según su consistencia hasta que el árbol deja de cambiar. Los <b>pesos implícitos</b> (Goloboff 1993) buscan el árbol que maximiza el ajuste total Σ k/(k + h), donde h es la homoplasia de cada carácter y <b>k</b> la constante de concavidad: k pequeña castiga mucho la homoplasia; k grande se acerca a los pesos iguales. Con muchos datos faltantes conviene la versión <b>extendida</b> (Goloboff 2014). Como el resultado depende de k, la práctica es explorar varios valores y ver qué clados son estables (Mirande 2009).</p>',
      en: '<p>With equal weights a character that changes twenty times weighs as much as a perfect one. <b>Successive weighting</b> (Farris 1969) repeats the search weighting each character by its consistency until the tree stops changing. <b>Implied weights</b> (Goloboff 1993) look for the tree that maximises the total fit Σ k/(k + h), where h is each character\'s homoplasy and <b>k</b> the concavity constant: a small k punishes homoplasy hard; a large k approaches equal weights. With much missing data the <b>extended</b> version is advisable (Goloboff 2014). Since the result depends on k, the practice is to explore several values and see which clades are stable (Mirande 2009).</p>' },
    { h: ['Apoyo y consenso', 'Support and consensus'], tag: ['Bloques 7 y 8', 'Blocks 7 and 8'],
      fig: ['consensus', 'Dos árboles igual de cortos y lo que comparten.', 'Two equally short trees and what they share.'],
      es: '<p>El árbol más corto no dice cuánto hay que creerle a cada clado. El <b>soporte de Bremer</b> es cuántos pasos de más cuesta perderlo (Bremer 1988, 1994); el <b>bootstrap</b> y el <b>jackknife</b> repiten el análisis sobre matrices remuestreadas y cuentan cuántas veces aparece (Felsenstein 1985; Farris et al. 1996); el remuestreo simétrico y las diferencias GC corrigen sesgos de ambos (Goloboff et al. 2003).</p><p>Cuando hay varios árboles igual de cortos, un <b>consenso</b> resume lo que comparten. Una politomía en el consenso estricto es «no sé», no una especiación múltiple. Un solo taxón inestable (un <b>comodín</b>, a menudo un fósil fragmentario) puede colapsar todo el consenso; el consenso reducido lo detecta (Wilkinson 1994; Pol y Escapa 2009).</p>',
      en: '<p>The shortest tree does not say how much to believe each clade. <b>Bremer support</b> is how many extra steps it costs to lose it (Bremer 1988, 1994); the <b>bootstrap</b> and the <b>jackknife</b> repeat the analysis on resampled matrices and count how often it appears (Felsenstein 1985; Farris et al. 1996); symmetric resampling and GC differences correct biases of both (Goloboff et al. 2003).</p><p>When there are several equally short trees, a <b>consensus</b> summarises what they share. A polytomy in the strict consensus means «don\'t know», not a multiple speciation. A single unstable taxon (a <b>wildcard</b>, often a fragmentary fossil) can collapse the whole consensus; the reduced consensus detects it (Wilkinson 1994; Pol and Escapa 2009).</p>' },
  ];

  /* ---------------- start ---------------- */
  document.addEventListener('DOMContentLoaded', () => {
    buildStepper();
    buildBlocks();
    buildTypes();
    buildMethods();
    buildLimits();
    buildTheory();
    buildRefs();
    buildCite();
    paintArt();
    const go = (id, f) => { const b = el(id); if (b) b.addEventListener('click', f); };
    const scrollTo = id => { const t = el(id); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    go('startBtn', () => { if (stepOn(2)) goStep(2); else { scrollTo('labs'); if (window.LABG) LABG.toast(T('El editor de matrices llega en el Bloque 2; mientras, prueba los laboratorios.', 'The matrix editor arrives with Block 2; meanwhile, try the labs.')); } });
    go('labsBtn', () => scrollTo('labs'));
    go('theoryBtn', () => scrollTo('theory'));
    go('citeBtn', () => scrollTo('cite'));
  });
  document.addEventListener('langchange', () => {
    paintArt();
    const nav = el('stepper');
    if (nav) nav.querySelectorAll('.step-btn.soon').forEach(b => b.setAttribute('data-soon', T('pronto', 'soon')));
  });

  window.Home = { BLOCKS, TYPES, METHODS, REFS, FAMS, THEORY, LIMITS };
})();
