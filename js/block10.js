/* CladisticsPro — morphological cladistics in the browser.
   Copyright (C) 2026  Luis Ángel Barrera-Guzmán

   This program is free software: you can redistribute it and/or modify it under
   the terms of the GNU General Public License as published by the Free Software
   Foundation, either version 3 of the License, or (at your option) any later
   version. It is distributed in the hope that it will be useful, but WITHOUT ANY
   WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
   A PARTICULAR PURPOSE. See the GNU General Public License, in the file LICENSE
   at the root of this program, or <https://www.gnu.org/licenses/>. */

/* CladisticsPro — Block 10: figures and report.

   · the cladogram to publish: any tree of the session, with its change marks
     (ACCTRAN, DELTRAN or unambiguous), the support values of Block 7 and the
     look the journal asks for; the figure studio exports it;
   · every figure drawn in the blocks, as a standalone SVG;
   · the trees and the matrix in NEXUS, xread and Newick;
   · the methods written from what was run (report.js), in Spanish or English;
   · the reproducible package: a ZIP written by the app itself. */
(function () {
  const B10 = {};
  window.Block10 = B10;
  const $ = el;
  const base = () => slug(state.matrix.title || 'cladisticspro');
  const A = () => Mx.toAnalysis(state.matrix);
  const r0 = () => { const a = A(); return a.outgroup.length ? a.outgroup[0] : 0; };

  /* ---------------- the trees of the session ---------------- */
  /* every tree a figure can be drawn on: [{ id, label, prep, items: [{root, label}] }] */
  function treeSources() {
    const out = [];
    if (window.Block5) {
      const C = Block5.ensure();
      if (C) out.push({ id: 'clado', label: T('El árbol del Bloque 5', 'The tree of Block 5') + (C.undo.length ? T(' (editado)', ' (edited)') : ''), prep: C.opts, items: [{ root: C.root, label: T('Bloque 5', 'Block 5') }] });
      Block5.sources().forEach(s => out.push({ id: s.id, label: s.label, prep: s.prep || (state.search && state.search.prep), items: s.list() }));
    }
    const Q = state.consensus;
    if (Q && Q.tree) {
      const M = window.Block8 ? Block8.METHODS.find(x => x.id === Q.method) : null;
      out.push({ id: 'consensus', label: T('Consenso del Bloque 8', 'Consensus of Block 8') + (M ? ' · ' + T(M.es, M.en) : ''), prep: state.search && state.search.prep, items: [{ root: Q.tree, label: T('Consenso', 'Consensus') }] });
    }
    const H = state.hypotheses;
    if (H && H.list.length) out.push({ id: 'hyp', label: T('Hipótesis del Bloque 9', 'Hypotheses of Block 9'), prep: state.search && state.search.prep, items: H.list.map(h => ({ root: h.root, label: h.id + '. ' + h.name })) });
    return out;
  }
  /* every tree that can be exported, by set: [{ id, label, trees: [{name, newick}] }] */
  function treeSets() {
    const sets = [];
    const nw = r => Tree.toNewick(r);
    const S = state.search;
    if (S && S.trees && S.trees.length) {
      sets.push({ id: 'mpt', label: T(`Árboles más cortos (${S.trees.length})`, `Shortest trees (${S.trees.length})`), on: true, trees: S.trees.map((t, i) => ({ name: 'mpt_' + (i + 1), newick: nw(t.root) })) });
      if (S.collapse && S.condensed) sets.push({ id: 'col', label: T(`Colapsados por la regla 1 (${S.condensed.length})`, `Collapsed by rule 1 (${S.condensed.length})`), trees: S.condensed.map((r, i) => ({ name: 'colapsado_' + (i + 1), newick: nw(r) })) });
      if (S.strict) sets.push({ id: 'strict', label: T('Consenso estricto', 'Strict consensus'), on: true, trees: [{ name: 'consenso_estricto', newick: nw(S.strict) }] });
    }
    const W = state.weights;
    if (W && W.result && W.result.trees) sets.push({ id: 'weights', label: T(`Con pesos, Bloque 4 (${W.result.trees.length})`, `Weighted, Block 4 (${W.result.trees.length})`), on: true, trees: W.result.trees.map((t, i) => ({ name: 'pesos_' + W.scheme + '_' + (i + 1), newick: nw(t.root) })) });
    const C = state.clado;
    if (C && C.root && C.fingerprint === Mx.fingerprint(state.matrix)) sets.push({ id: 'clado', label: T('El árbol del Bloque 5', 'The tree of Block 5') + (C.undo.length ? T(' (editado)', ' (edited)') : ''), on: !!C.undo.length, trees: [{ name: 'arbol_bloque5', newick: nw(C.root) }] });
    const Q = state.consensus;
    if (Q && Q.tree) sets.push({ id: 'cons', label: T('Consenso del Bloque 8', 'Consensus of Block 8'), on: true, trees: [{ name: 'consenso_' + Q.method, newick: nw(Q.tree) }] });
    const H = state.hypotheses;
    if (H && H.list.length) sets.push({ id: 'hyp', label: T(`Hipótesis del Bloque 9 (${H.list.length})`, `Hypotheses of Block 9 (${H.list.length})`), on: true, trees: H.list.map(h => ({ name: 'hipotesis_' + h.id, newick: nw(h.root) })) });
    if (state.matrixTrees && state.matrixTrees.length) sets.push({ id: 'file', label: T(`Del archivo de la matriz (${state.matrixTrees.length})`, `From the matrix file (${state.matrixTrees.length})`), trees: state.matrixTrees.map((t, i) => ({ name: t.name || 'archivo_' + (i + 1), newick: t.newick })) });
    return sets;
  }
  B10.treeSets = treeSets;
  const chosenTrees = () => {
    const on = new Set(els('#b10Sets input:checked').map(x => x.value));
    return treeSets().filter(s => on.has(s.id)).flatMap(s => s.trees);
  };

  /* ---------------- the cladogram to publish ---------------- */
  let mapCache = null;
  function supportOptions() {
    const S = state.support, out = [['none', T('Ninguno', 'None')]];
    if (!S || !window.Block7) return out;
    if (S.bremer) { out.push(['bremer', T('Bremer', 'Bremer')], ['rfd', T('Bremer relativo', 'Relative Bremer')]); }
    Block7.RMETHODS.forEach(m => { if (S.res[m.id]) out.push([m.id + '-f', T(m.es + ' · frecuencia', m.en + ' · frequency')], [m.id + '-gc', T(m.es + ' · GC', m.en + ' · GC')]); });
    if (S.bremer && Object.keys(S.res).length) out.push(['combo', T('Bremer / GC', 'Bremer / GC')]);
    return out;
  }
  function paintControls() {
    const srcs = treeSources();
    const prev = $('b10Src').value;
    $('b10Src').innerHTML = srcs.map(s => `<option value="${s.id}">${esc(s.label)}</option>`).join('');
    if (srcs.some(s => s.id === prev)) $('b10Src').value = prev;
    paintIdx();
    const sp = $('b10Sup').value;
    const so = supportOptions();
    $('b10Sup').innerHTML = so.map(o => `<option value="${o[0]}">${esc(o[1])}</option>`).join('');
    if (so.some(o => o[0] === sp)) $('b10Sup').value = sp;
    $('b10Sup').disabled = so.length < 2;
    if (!$('b10Title').dataset.touched) $('b10Title').value = '';
    $('b10FigHint').innerHTML = srcs.length ? T('Elige el árbol y lo que se dibuja sobre él. Los valores de apoyo salen del Bloque 7 y se leen en cualquier árbol que tenga el grupo.', 'Choose the tree and what is drawn on it. The support values come from Block 7 and are read on any tree that has the group.')
      : T('Todavía no hay árboles: búscalos en el Bloque 3 o lee un archivo con árboles en el Bloque 2.', 'There are no trees yet: search for them in Block 3 or read a file with trees in Block 2.');
  }
  function paintIdx() {
    const s = treeSources().find(x => x.id === $('b10Src').value);
    const items = s ? s.items : [];
    const prev = +$('b10Idx').value || 0;
    $('b10Idx').innerHTML = items.map((t, i) => `<option value="${i}">${esc(t.label || String(i + 1))}</option>`).join('');
    $('b10Idx').value = String(Math.min(prev, Math.max(0, items.length - 1)));
    $('b10IdxF').hidden = items.length < 2;
  }
  function currentTree() {
    const s = treeSources().find(x => x.id === $('b10Src').value);
    if (!s || !s.items.length) return null;
    const it = s.items[Math.min(+$('b10Idx').value || 0, s.items.length - 1)];
    return { src: s, root: it.root, label: it.label };
  }
  const sym = s => (Mx.SYMBOLS ? Mx.SYMBOLS[s] : String(s));
  function stateName(j, s) { const st = state.matrix.chars[j].states || []; return st[s] != null && st[s] !== '' ? st[s] : sym(s); }
  function drawFigure() {
    const cur = currentTree();
    if (!cur) { $('b10Tree').innerHTML = `<p class="hint" style="padding:12px">${T('Sin árboles que dibujar.', 'No trees to draw.')}</p>`; return; }
    const m = state.matrix, show = $('b10Marks').value, opt = $('b10Opt').value;
    const prep = cur.src.prep || {};
    const key = [cur.src.id, $('b10Idx').value, opt, prep.inapplicable, prep.continuous, Mx.fingerprint(m)].join('|');
    let map = null;
    if (show !== 'none') {
      if (!mapCache || mapCache.key !== key || mapCache.root !== cur.root) {
        const M = Mapping.prepare(m, { inapplicable: prep.inapplicable, continuous: prep.continuous, weights: prep.weights });
        mapCache = { key, root: cur.root, M, map: Mapping.map(M, cur.root, { optimization: opt }) };
      }
      map = mapCache.map;
    }
    const marks = new Map();
    if (map) map.byNode.forEach((list, v) => {
      const ok = list.filter(chg => chg.kind !== 'cont' && (show !== 'inf' || map.per[chg.c].informative) && (show !== 'unique' || !chg.homoplastic));
      if (ok.length) marks.set(v, ok.slice().sort((a, b) => a.j - b.j));
    });
    /* the support values, by group */
    const text = new Map();
    const sup = $('b10Sup').value;
    if (sup !== 'none' && state.support && window.Block7) {
      const n = A().taxa.length;
      Support.cladesOf(cur.root, n, r0()).forEach(gr => {
        const v = Block7.valueOf(gr.key, sup);
        if (!v) return;
        text.set(gr.node, v.t);
        if (gr.node.parent === cur.root && cur.root.children.length === 2) cur.root.children.forEach(c => { if (c !== gr.node && c.children.length) text.set(c, v.t); });
      });
    }
    const fs = Math.max(8, Math.min(20, +$('b10Font').value || 12));
    const withMarks = marks.size > 0;
    const svg = Clado.render(cur.root, {
      names: v => v.name, rowH: Math.round(fs * (withMarks ? 2.6 : 1.85)), fontSize: fs, markGap: Math.max(11, fs * 1.05),
      fitMarks: withMarks && $('b10Len').value === 'marks', minUnit: withMarks ? 16 : 30, maxUnit: withMarks ? undefined : 48,
      marks, charLabel: c => String(map.per[c].ch.j + 1),
      stateLabel: (c, s) => { if ($('b10Lab').value !== 'name') return sym(s); const t = stateName(map.per[c].ch.j, s); return t.length > 14 ? t.slice(0, 13) + '…' : t; },
      legend: $('b10Legend').checked && withMarks, showAmbig: opt !== 'unambiguous',
      legendUnique: T('cambio único', 'unique change'), legendHomo: T('homoplásico', 'homoplastic'), legendAmbig: T('ambiguo', 'ambiguous'),
      nodeText: text.size ? text : null, title: $('b10Title').value.trim() || null, id: 'b10',
      tipImg: imgWanted() ? v => TaxonImg.url(v.name) : null, imgPlace: $('b10Img').value, imgSize: Math.max(16, Math.min(160, +$('b10ImgSize').value || 44)),
      imgShape: $('b10ImgShape').value, imgFrame: $('b10ImgFrame').checked,
      ariaLabel: T('Cladograma para publicar', 'Cladogram to publish'),
    });
    $('b10Tree').innerHTML = svg;
    $('b10Tree').classList.toggle('b10-roman', !$('b10Italic').checked);
    paintCredits(cur.root);
  }
  const imgWanted = () => $('b10Img').value !== 'none' && !!window.TaxonImg;
  /* the credit line of the pictures, for the caption of the figure */
  function creditsOf(root) { return imgWanted() && root ? TaxonImg.credits(Tree.tips(root).map(v => v.name)) : []; }
  function paintCredits(root) {
    const on = imgWanted();
    ['b10ImgSizeF', 'b10ImgShapeF', 'b10ImgFrameL'].forEach(id => { $(id).hidden = !on; });
    const n = window.TaxonImg ? TaxonImg.count() : 0;
    const box = $('b10Credits');
    if (!on) { box.hidden = true; return; }
    box.hidden = false;
    const cr = creditsOf(root);
    box.innerHTML = !n ? `<p class="hint">${T('Todavía no hay imágenes confirmadas: agrégalas con «Imágenes de los taxones…» o en el Bloque 2.', 'There are no confirmed pictures yet: add them with «Taxon pictures…» or in Block 2.')}</p>`
      : `<p class="hint"><b>${T('Créditos de las imágenes', 'Picture credits')}</b> ${T('(para el pie de la figura)', '(for the figure caption)')}: ${cr.length ? esc(cr.join('; ')) + '.' : T('sin crédito anotado.', 'no credit recorded.')}</p>`
        + (cr.length ? `<button type="button" class="btn btn-ghost btn-sm" id="b10CopyCredits">${T('Copiar los créditos', 'Copy the credits')}</button>` : '');
    const b = $('b10CopyCredits');
    if (b) b.addEventListener('click', () => { const t = cr.join('; ') + '.'; if (navigator.clipboard) navigator.clipboard.writeText(t).then(() => window.LABG && LABG.toast(T('Créditos copiados.', 'Credits copied.'))); });
  }
  B10.drawFigure = drawFigure;

  /* ---------------- every figure ---------------- */
  /* the result each block hands on: its figures count only while it holds */
  const RESULT = { 2: 'matrix', 3: 'search', 4: 'weights', 5: 'clado', 6: 'diag', 7: 'support', 8: 'consensus', 9: 'hypotheses' };
  function figureList() {
    const out = [];
    const seen = new Set();
    const add = (node, title) => {
      if (seen.has(node)) return;
      const panel = node.closest('.step-panel');
      if (!panel) return;
      const n = +panel.id.replace('panel-', '');
      if (n === 1 || (RESULT[n] && !state[RESULT[n]])) return;
      if (node.tagName.toLowerCase() === 'svg' && !node.querySelector('line, path, rect, circle, polyline, polygon, text')) return;
      seen.add(node);
      const fb = node.closest('.fig-block');
      const h = fb && fb.querySelector('.fig-head h4');
      out.push({ el: node, block: n, title: (title || (h && h.textContent) || node.getAttribute('aria-label') || T('Figura', 'Figure')).trim() });
    };
    if (window.LABGFigureStudio && LABGFigureStudio.figures) {
      try { LABGFigureStudio.figures(document).forEach(f => add(f.el, f.title)); } catch (e) { /* the fallback below finds them */ }
    }
    els('.step-panel svg[data-plot], .step-panel svg.clado, .step-panel .fig-canvas > svg').forEach(s => add(s));
    out.sort((a, b) => a.block - b.block);
    return out;
  }
  B10.figureList = figureList;
  const figName = (f, i) => String(f.block).padStart(2, '0') + '_' + (i + 1) + '_' + slug(f.title).slice(0, 40);
  function paintFigures() {
    const list = figureList();
    B10.figs = list;
    if (!list.length) { $('b10Figs').innerHTML = `<p class="hint" style="padding:8px 12px">${T('Todavía no hay figuras dibujadas.', 'No figures drawn yet.')}</p>`; return; }
    buildTable('b10Figs', [
      { key: 'block', label: T('Bloque', 'Block'), num: true },
      { key: 'title', label: T('Figura', 'Figure') },
      { key: 'size', label: T('Tamaño del dibujo', 'Drawing size'), num: true },
      { key: 'act', label: '', html: true },
    ], list.map((f, i) => {
      const vb = f.el.viewBox && f.el.viewBox.baseVal;
      const size = vb && vb.width ? `${Math.round(vb.width)} × ${Math.round(vb.height)}` : f.el.width ? `${f.el.width} × ${f.el.height}` : '—';
      const isSvg = f.el.tagName.toLowerCase() === 'svg';
      return { block: f.block, title: f.title, size, act: `<button type="button" class="btn btn-ghost btn-sm" data-fsave="${i}">${isSvg ? 'SVG' : 'PNG'}</button> <button type="button" class="btn btn-ghost btn-sm" data-fopen="${i}">${T('Abrir en el estudio', 'Open in the studio')}</button>` };
    }));
  }
  function figureFile(f, i) {
    if (f.el.tagName.toLowerCase() === 'svg') return Promise.resolve({ name: figName(f, i) + '.svg', content: Report.svgText(f.el, { light: true, background: '#ffffff' }) });
    if (f.el.tagName.toLowerCase() === 'canvas') return new Promise(ok => f.el.toBlob(b => (b ? b.arrayBuffer().then(buf => ok({ name: figName(f, i) + '.png', content: new Uint8Array(buf) })) : ok(null)), 'image/png'));
    return Promise.resolve(null);
  }
  async function saveFigure(i) {
    const f = B10.figs[i];
    if (!f) return;
    const file = await figureFile(f, i);
    if (!file) return;
    download(typeof file.content === 'string' ? file.content : new Blob([file.content], { type: 'image/png' }), base() + '_' + file.name, file.name.endsWith('.svg') ? 'image/svg+xml' : 'image/png');
  }
  function openFigure(i) {
    const f = B10.figs[i];
    if (!f || !window.LABGFigureStudio) return;
    goStep(f.block);
    setTimeout(() => { try { LABGFigureStudio.open(f.el); } catch (e) { /* the studio stays closed */ } }, 350);
  }

  /* ---------------- exports ---------------- */
  function paintSets() {
    const prev = new Set(els('#b10Sets input').map(x => (x.checked ? x.value : null)).filter(Boolean));
    const had = els('#b10Sets input').length > 0;
    const sets = treeSets();
    $('b10Sets').innerHTML = sets.length ? sets.map(s => `<label class="checkbox-label"><input type="checkbox" value="${s.id}"${(had ? prev.has(s.id) : s.on) ? ' checked' : ''}> ${esc(s.label)}</label>`).join('')
      : `<p class="hint">${T('Todavía no hay árboles: se exporta sólo la matriz.', 'No trees yet: only the matrix is exported.')}</p>`;
  }
  function exportNexus() { download(MatIO.writeNexus(state.matrix, { trees: chosenTrees() }), base() + '.nex', 'text/plain;charset=utf-8'); }
  function exportXread() { download(MatIO.writeXread(state.matrix, { trees: chosenTrees() }), base() + '.ss', 'text/plain;charset=utf-8'); }
  function exportNewick() {
    const t = chosenTrees();
    if (!t.length) { if (window.LABG) LABG.toast(T('Marca al menos un conjunto de árboles.', 'Tick at least one set of trees.')); return; }
    /* each tree with its name in brackets, as in the package (readers take it as a comment) */
    download(t.map(x => '[' + x.name + '] ' + x.newick).join('\n') + '\n', base() + '.tre', 'text/plain;charset=utf-8');
  }

  /* ---------------- the methods ---------------- */
  function report(lang) {
    const rep = Report.methods(state, lang, { version: APP_VERSION, cladeCount: window.Block8 ? Block8.cladeCount : null });
    const refs = Report.references(rep.cited, window.Home ? Home.REFS : [], lang, APP_VERSION);
    return { rep, refs };
  }
  B10.report = report;
  function paintReport() {
    const { rep, refs } = report($('b10Lang').value);
    $('b10RepView').innerHTML = rep.sections.map(s => `<h3>${esc(s.title)}</h3>` + s.paras.map(p => `<p>${esc(p)}</p>`).join('')).join('') +
      `<h3>${rep.lang === 'en' ? 'References' : 'Referencias'}</h3><ol class="b10-refs">${refs.map(r => `<li>${r.html}</li>`).join('')}</ol>`;
  }
  const reportTitle = lang => (lang === 'en' ? 'Methods' : 'Métodos') + (state.matrix.title ? ' — ' + state.matrix.title : '');
  const reportSub = lang => `CladisticsPro ${APP_VERSION} · ${new Date().toISOString().slice(0, 10)}` + (lang === 'en' ? ' · written from the analyses run' : ' · redactado a partir de los análisis corridos');
  function reportFiles(lang) {
    const { rep, refs } = report(lang);
    return { txt: Report.asText(rep, refs), html: Report.asHtml(rep, refs, { title: reportTitle(lang), sub: reportSub(lang) }) };
  }

  /* ---------------- the tables ---------------- */
  function csv(rows) { return rows.map(r => r.map(csvEscape).join(',')).join('\n') + '\n'; }
  function tables() {
    const out = [], m = state.matrix, names = A().taxa;
    const S = state.search;
    if (S && S.trees && S.trees.length) out.push({ name: 'tablas/busqueda_arboles.csv', what: T('los árboles más cortos: longitud e índices', 'the shortest trees: length and indices'),
      content: csv([['arbol', 'longitud', 'IC', 'IR', 'ICR']].concat(S.trees.map((t, i) => ['mpt_' + (i + 1), t.length, t.ci, t.ri, t.rc]))) });
    const W = state.weights;
    if (W && W.result && W.result.table) {
      const rows = W.result.table, keys = Object.keys(rows[0] || {}).filter(k => rows.every(r => r[k] == null || typeof r[k] !== 'object'));
      out.push({ name: 'tablas/pesos_caracteres.csv', what: T('los caracteres con sus pesos (Bloque 4)', 'the characters with their weights (Block 4)'), content: csv([keys].concat(rows.map(r => keys.map(k => r[k])))) });
    }
    const D = state.diag;
    if (D && D.per) {
      const per = D.per;
      out.push({ name: 'tablas/diagnostico_caracteres.csv', what: T('pasos, IC, IR e ICR de cada carácter (Bloque 6)', 'steps, CI, RI and RC of each character (Block 6)'),
        content: csv([['caracter', 'nombre', 'pasos', 'IC', 'IR', 'ICR']].concat(per.map(r => { const j = r.j != null ? r.j : r.c; return [j + 1, m.chars[j] ? m.chars[j].name : '', r.steps, r.ci, r.ri, r.rc]; }))) });
    }
    const P = state.support;
    if (P && (P.bremer || Object.keys(P.res).length) && window.Block7) {
      const groups = Block7.groups();
      const methods = Object.keys(P.res);
      const head = ['grupo', 'taxones', 'bremer', 'bremer_relativo'].concat(...methods.map(k => [k + '_frecuencia', k + '_GC']));
      const rows = groups.map((gr, i) => {
        const v = P.values[gr.key] || {};
        const taxa = [...gr.key].map((c, q) => (c === '1' ? names[q] : null)).filter(Boolean).join(' ');
        return [i + 1, taxa, v.bremer == null ? '' : (v.bremerAbove ? '>' : '') + v.bremer, v.rfd].concat(...methods.map(k => { const fg = Support.freqGC(P.res[k].counts, P.res[k].reps, gr.key); return [fg.freq, fg.gc]; }));
      });
      out.push({ name: 'tablas/apoyo_grupos.csv', what: T('el apoyo de cada grupo (Bloque 7)', 'the support of each group (Block 7)'), content: csv([head].concat(rows)) });
    }
    const H = state.hypotheses;
    if (H && H.list.length) out.push({ name: 'tablas/hipotesis.csv', what: T('las hipótesis y sus pruebas (Bloque 9)', 'the hypotheses and their tests (Block 9)'),
      content: csv([['n', 'hipotesis', 'tipo', 'L_mas_corto', 'L_hipotesis', 'pasos_de_mas', 'templeton_V', 'templeton_p', 'a_favor', 'en_contra', 'sitios_ganadores_p', 'kh_t', 'kh_p']].concat(H.list.map(h => [h.id, h.name, h.kind, h.best, h.length, h.extra, h.cmp.templeton.V, h.cmp.templeton.p, h.cmp.favourHyp, h.cmp.favourBest, h.cmp.winning.p, h.cmp.kh.t, h.cmp.kh.p]))) });
    return out;
  }
  B10.tables = tables;

  /* ---------------- the package ---------------- */
  function readme(manifest, lang) {
    const en = lang === 'en', m = state.matrix, L = [];
    L.push(en ? 'ANALYSIS PACKAGE — CladisticsPro ' + APP_VERSION : 'PAQUETE DE ANÁLISIS — CladisticsPro ' + APP_VERSION);
    L.push('='.repeat(56), '');
    L.push((en ? 'Matrix: ' : 'Matriz: ') + (m.title || '—'));
    L.push((en ? 'Written on ' : 'Escrito el ') + new Date().toISOString().slice(0, 10), '');
    L.push(en ? 'Everything here was written by the program from this session: the trees,\nthe tables and the methods describe only what was run.' : 'Todo lo que hay aquí lo escribió el programa a partir de esta sesión: los\nárboles, las tablas y los métodos describen sólo lo que se corrió.');
    L.push('', en ? 'CONTENTS' : 'CONTENIDO', '-'.repeat(56));
    manifest.forEach(x => L.push(x.name, '    ' + x.what));
    L.push('', en ? 'HOW TO OPEN IT AGAIN' : 'CÓMO VOLVER A ABRIRLO', '-'.repeat(56));
    L.push(en ? 'The .cladisticspro.json file opens in CladisticsPro (Block 2) and brings back\nthe matrix with its trees and pictures. The .nex and .ss files are read by\ncladistics programs that accept those formats. The .svg figures open in any\nvector graphics editor or in a web browser, at any size. The .csv tables open\nin any spreadsheet. The .html methods page prints to PDF from the browser.'
      : 'El archivo .cladisticspro.json se abre en CladisticsPro (Bloque 2) y\nrecupera la matriz con sus árboles e imágenes. Los .nex y .ss los leen los\nprogramas de cladística que aceptan esos formatos. Las figuras .svg se abren\nen cualquier editor de gráficos vectoriales o en el navegador, a cualquier\ntamaño. Las tablas .csv se abren en cualquier hoja de cálculo. La página de\nmétodos .html se imprime a PDF desde el navegador.');
    return L.join('\n') + '\n';
  }
  async function buildZip() {
    if (!state.matrix) return;
    clearMessages('b10ZipMsg');
    const lang = $('b10Lang').value;
    const r = await LABG.work.run({ title: T('Armando el paquete', 'Building the package'), delay: 200 }, async w => {
      const files = [], manifest = [];
      const put = (name, content, what) => { files.push({ name, content }); manifest.push({ name, what, size: typeof content === 'string' ? new TextEncoder().encode(content).length : content.length }); };
      const m = state.matrix, b = base();
      if ($('b10ZMat').checked) {
        w.update(0.1, T('La matriz…', 'The matrix…'));
        const images = window.StateImg ? await StateImg.collect(m) : null;
        put('matriz/' + b + '.cladisticspro.json', MatIO.writeProject(m, { trees: state.matrixTrees || [], images }), T('el proyecto completo: matriz, árboles del archivo e imágenes', 'the whole project: matrix, trees of the file and pictures'));
        put('matriz/' + b + '.nex', MatIO.writeNexus(m, { trees: [] }), T('la matriz en NEXUS', 'the matrix in NEXUS'));
        put('matriz/' + b + '.ss', MatIO.writeXread(m), T('la matriz en formato xread', 'the matrix in xread format'));
        put('matriz/' + b + '.csv', MatIO.writeTable(m, ','), T('la matriz como tabla', 'the matrix as a table'));
        put('matriz/caracteres.txt', MatIO.characterListText(m, lang), T('la lista de caracteres y estados', 'the list of characters and states'));
      }
      if ($('b10ZTre').checked) {
        const all = treeSets().flatMap(s => s.trees);
        if (all.length) {
          put('arboles/arboles.nex', MatIO.writeNexus(m, { trees: all }), T('la matriz con todos los árboles de la sesión, NEXUS', 'the matrix with every tree of the session, NEXUS'));
          put('arboles/arboles.tre', all.map(t => '[' + t.name + '] ' + t.newick).join('\n') + '\n', T('todos los árboles en Newick, cada uno con su nombre entre corchetes', 'every tree in Newick, each with its name in brackets'));
          put('arboles/arboles.ss', MatIO.writeXread(m, { trees: all }), T('la matriz con los árboles en formato xread', 'the matrix with the trees in xread format'));
        }
      }
      if ($('b10ZFig').checked) {
        w.update(0.35, T('Las figuras…', 'The figures…'));
        drawFigure();
        const list = figureList();
        for (let i = 0; i < list.length; i++) {
          const f = await figureFile(list[i], i);
          if (f) put('figuras/' + f.name, f.content, T(`Bloque ${list[i].block}: `, `Block ${list[i].block}: `) + list[i].title);
          if (i % 4 === 3) { w.update(0.35 + 0.4 * i / list.length); await LABG.nextPaint(); }
        }
      }
      if ($('b10ZTab').checked) tables().forEach(t => put(t.name, t.content, t.what));
      if ($('b10ZFig').checked && window.TaxonImg && TaxonImg.count()) {
        const cr = TaxonImg.credits();
        if (cr.length) put('figuras/creditos_imagenes.txt', cr.join('\n') + '\n', T('el crédito y la licencia de cada imagen de taxón', 'the credit and licence of each taxon picture'));
      }
      if ($('b10ZRep').checked) {
        const rf = reportFiles(lang);
        put(lang === 'en' ? 'methods.html' : 'metodos.html', rf.html, T('los métodos redactados, para imprimir', 'the methods written, to print'));
        put(lang === 'en' ? 'methods.txt' : 'metodos.txt', rf.txt, T('los métodos en texto plano, para pegar', 'the methods as plain text, to paste'));
      }
      const rd = readme(manifest, lang);
      files.unshift({ name: lang === 'en' ? 'README.txt' : 'LEEME.txt', content: rd });
      manifest.unshift({ name: lang === 'en' ? 'README.txt' : 'LEEME.txt', what: T('este índice', 'this index'), size: new TextEncoder().encode(rd).length });
      w.update(0.85, T('Comprimiendo…', 'Compressing…'));
      const bytes = await Report.zip(files);
      return { bytes, manifest };
    });
    if (!r) return;
    download(new Blob([r.bytes], { type: 'application/zip' }), base() + '_paquete_' + new Date().toISOString().slice(0, 10) + '.zip', 'application/zip');
    B10.lastZip = r;
    statTiles('b10ZipTiles', [
      [T('Archivos', 'Files'), String(r.manifest.length), T('con su índice', 'with its index')],
      [T('Tamaño', 'Size'), fmtNum(r.bytes.length / 1024, 1) + ' kB', T('comprimido', 'compressed')],
      [T('Sin comprimir', 'Uncompressed'), fmtNum(r.manifest.reduce((a, x) => a + x.size, 0) / 1024, 1) + ' kB', ''],
    ]);
    buildTable('b10ZipList', [
      { key: 'name', label: T('Archivo', 'File') },
      { key: 'what', label: T('Qué es', 'What it is') },
      { key: 'size', label: 'bytes', num: true },
    ], r.manifest, { limit: 80 });
  }

  /* ---------------- showing the block ---------------- */
  function onShow() {
    const ok = !!state.matrix;
    $('b10NoData').hidden = ok; $('b10Work').hidden = !ok;
    if (!ok) return;
    if (!$('b10Lang').dataset.touched) $('b10Lang').value = (document.documentElement.lang || 'es').slice(0, 2) === 'en' ? 'en' : 'es';
    paintControls();
    drawFigure();
    paintFigures();
    paintSets();
    paintReport();
  }
  B10.onShow = onShow;
  function wire() {
    if (!$('panel-10')) return;
    $('b10GoMatrix').addEventListener('click', () => goStep(2));
    $('b10Src').addEventListener('change', () => { paintIdx(); drawFigure(); });
    ['b10Idx', 'b10Marks', 'b10Opt', 'b10Lab', 'b10Sup', 'b10Len', 'b10Italic', 'b10Legend', 'b10Img', 'b10ImgShape', 'b10ImgFrame'].forEach(id => $(id).addEventListener('change', drawFigure));
    $('b10ImgSize').addEventListener('input', drawFigure);
    $('b10ImgManage').addEventListener('click', () => { if (state.matrix && window.TaxonImg) TaxonImg.manage(); });
    document.addEventListener('taximgchange', () => {
      if (!state.matrix) return;
      if (TaxonImg.count() && $('b10Img').value === 'none' && !$('b10Img').dataset.touched) $('b10Img').value = 'before';
      if ($('panel-10').classList.contains('active')) drawFigure();
    });
    $('b10Img').addEventListener('change', e => { e.target.dataset.touched = '1'; });
    $('b10Font').addEventListener('input', drawFigure);
    $('b10Title').addEventListener('input', e => { e.target.dataset.touched = '1'; drawFigure(); });
    $('b10Figs').addEventListener('click', e => {
      const s = e.target.closest('[data-fsave]'), o = e.target.closest('[data-fopen]');
      if (s) saveFigure(+s.dataset.fsave);
      if (o) openFigure(+o.dataset.fopen);
    });
    $('b10Nex').addEventListener('click', exportNexus);
    $('b10Xread').addEventListener('click', exportXread);
    $('b10Nwk').addEventListener('click', exportNewick);
    $('b10Lang').addEventListener('change', e => { e.target.dataset.touched = '1'; paintReport(); });
    $('b10Copy').addEventListener('click', () => {
      const t = reportFiles($('b10Lang').value).txt;
      const done = () => window.LABG && LABG.toast(T('Texto copiado.', 'Text copied.'));
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, () => download(t, base() + '_metodos.txt'));
      else download(t, base() + '_metodos.txt');
    });
    $('b10Txt').addEventListener('click', () => download(reportFiles($('b10Lang').value).txt, base() + ($('b10Lang').value === 'en' ? '_methods.txt' : '_metodos.txt'), 'text/plain;charset=utf-8'));
    $('b10Html').addEventListener('click', () => download(reportFiles($('b10Lang').value).html, base() + ($('b10Lang').value === 'en' ? '_methods.html' : '_metodos.html'), 'text/html;charset=utf-8'));
    $('b10ZipRun').addEventListener('click', () => buildZip().catch(e => showMessage('b10ZipMsg', 'error', T('No se pudo armar el paquete: ', 'The package could not be built: ') + esc(e.message || String(e)))));
    document.addEventListener('stepchange', e => { if (e.detail.step === 10) onShow(); });
    document.addEventListener('matrixchange', () => { mapCache = null; });
    document.addEventListener('langchange', () => { if ($('panel-10').classList.contains('active')) onShow(); });
  }
  document.addEventListener('DOMContentLoaded', wire);
  Object.assign(B10, { treeSources, buildZip, readme });
})();
