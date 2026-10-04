/* CladisticsPro — morphological cladistics in the browser.
   Copyright (C) 2026  Luis Ángel Barrera-Guzmán

   This program is free software: you can redistribute it and/or modify it under
   the terms of the GNU General Public License as published by the Free Software
   Foundation, either version 3 of the License, or (at your option) any later
   version. It is distributed in the hope that it will be useful, but WITHOUT ANY
   WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
   A PARTICULAR PURPOSE. See the GNU General Public License, in the file LICENSE
   at the root of this program, or <https://www.gnu.org/licenses/>. */

/* CladisticsPro — Block 2, the character matrix.

   Opens a matrix (an example, a file, pasted text, a new one or the last
   session), shows what it holds, lets every cell, character and taxon be
   edited with unlimited undo, checks the matrix, writes the list of
   characters as it goes in a paper and exports it.

   Every change goes through Ed.do(op): the matrix module applies it and hands
   back its inverse, which goes on the undo stack. After every change the
   results of the later blocks are dropped (they were computed on another
   matrix) and the session is saved in the browser a moment later. */
(function () {
  const Ed = { undo: [], redo: [], grid: null, trees: [], source: '' };
  window.Block2 = Ed;
  const $ = id => document.getElementById(id);
  const TYPE_NAMES = () => ({ unord: T('No ordenado', 'Unordered'), ord: T('Ordenado (aditivo)', 'Ordered (additive)'), step: T('Matriz de pasos', 'Step matrix'), cont: T('Continuo', 'Continuous') });

  /* ---------------- loading ---------------- */
  function setMatrix(m, source, trees, notes) {
    Mx.normalize(m);
    state.matrix = m;
    state.matrixTrees = trees || [];
    state.fileName = source || m.title || '';
    Ed.undo = []; Ed.redo = [];
    Ed.source = source || '';
    dropResults();
    $('b2Work').hidden = false;
    $('b2Empty').hidden = true;
    if (!Ed.grid) Ed.grid = MatrixGrid.create($('b2Grid'), { getMatrix: () => state.matrix, onEdit: (op, label) => Ed.do(op, label), onSelect: () => paintInspector() });
    Ed.grid.refresh();
    Ed.grid.select(0, 0);
    $('b2Title').value = m.title || '';
    clearMessages('b2Msg');
    const st = Mx.stats(m);
    showMessage('b2Msg', 'success', T(`Matriz leída: ${st.taxa} taxones × ${st.chars} caracteres`, `Matrix read: ${st.taxa} taxa × ${st.chars} characters`) + (source ? ' · ' + esc(source) : '') + '.');
    (notes || []).forEach(n => showMessage('b2Msg', 'warning', esc(T(n.es, n.en))));
    if (/didáctico|simulada/i.test(m.title || '')) showMessage('b2Msg', 'info', T('Es una matriz <b>simulada</b> sobre un árbol conocido: los nombres de las especies son reales, los estados no. Sirve para aprender y para probar, no para concluir nada sobre esas plantas.', 'This is a <b>simulated</b> matrix on a known tree: the species names are real, the states are not. It is for learning and testing, not for concluding anything about those plants.'));
    paintAll();
    if (window.TaxonImg) TaxonImg.load(m);
    save();
    enableStep(2, true);
    refreshLater();
  }
  function dropResults() {
    ['search', 'weights', 'clado', 'diag', 'support', 'consensus', 'hypotheses'].forEach(k => { state[k] = null; });
    document.dispatchEvent(new CustomEvent('matrixchange'));
  }
  function readText(text, name) {
    try {
      const t = String(text);
      if (/^\s*\{/.test(t)) {
        const r = MatIO.readProject(t);
        StateImg.restore(r.images).then(() => setMatrix(r.matrix, name, r.trees, r.notes));
        return;
      }
      const r = MatIO.read(t, name);
      setMatrix(r.matrix, name, r.trees, r.notes);
    } catch (e) {
      clearMessages('b2Msg');
      showMessage('b2Msg', 'error', T('No se pudo leer la matriz: ', 'The matrix could not be read: ') + esc(e.message) +
        `<div class="msg-fix">${T('Formatos que lee: NEXUS (.nex), xread (.ss, .xread), tablas separadas por comas, punto y coma o tabuladores (.csv, .tsv, .txt) y proyectos de esta app (.json).', 'Formats it reads: NEXUS (.nex), xread (.ss, .xread), tables separated by commas, semicolons or tabs (.csv, .tsv, .txt) and projects of this app (.json).')}</div>`);
      $('b2Msg').scrollIntoView({ block: 'nearest' });
    }
  }
  function loadExample(id) {
    const ex = window.EXAMPLES && EXAMPLES[id];
    if (!ex) return;
    readText(ex.nexus, ex.file);
  }

  /* ---------------- edits with undo ---------------- */
  Ed.do = function (op, label) {
    const m = state.matrix;
    if (!m) return;
    const inv = Mx.apply(m, op);
    Ed.undo.push({ op, inv, label: label || '' });
    if (Ed.undo.length > 2000) Ed.undo.shift();
    Ed.redo = [];
    changed(op);
  };
  Ed.undoLast = function () {
    const u = Ed.undo.pop(); if (!u) return;
    Mx.apply(state.matrix, u.inv);
    Ed.redo.push(u);
    changed(u.inv);
    if (window.LABG) LABG.announce(T('Deshecho: ', 'Undone: ') + u.label);
  };
  Ed.redoLast = function () {
    const r = Ed.redo.pop(); if (!r) return;
    r.inv = Mx.apply(state.matrix, r.op);
    Ed.undo.push(r);
    changed(r.op);
    if (window.LABG) LABG.announce(T('Rehecho: ', 'Redone: ') + r.label);
  };
  /* the picture of a taxon changes no analysis: the results of the blocks stay */
  const pictureOnly = op => !!op && (op.kind === 'taxon' ? Object.keys(op.patch || {}).length > 0 && Object.keys(op.patch).every(k => k === 'image')
    : op.kind === 'batch' ? op.ops.length > 0 && op.ops.every(pictureOnly) : false);
  function changed(op) {
    if (pictureOnly(op)) {
      Ed.grid.refresh(); paintInspector(); paintUndo(); saveLater();
      document.dispatchEvent(new CustomEvent('taximgchange'));
      return;
    }
    dropResults();
    Ed.grid.refresh();
    paintInspector();
    paintUndo();
    refreshLater();
    saveLater();
  }
  let refreshT = 0;
  function refreshLater() {
    clearTimeout(refreshT);
    refreshT = setTimeout(() => { paintSummary(); paintQC(); paintList(); }, state.matrix && state.matrix.taxa.length * state.matrix.chars.length > 20000 ? 400 : 60);
  }
  function paintAll() { paintSummary(); paintInspector(); paintQC(); paintList(); paintUndo(); paintPictures(); }
  function paintPictures() { if (window.TaxonImg && $('b2PicsHost')) TaxonImg.gallery($('b2PicsHost')); }
  function paintUndo() {
    const u = Ed.undo[Ed.undo.length - 1], r = Ed.redo[Ed.redo.length - 1];
    $('b2Undo').disabled = !u; $('b2Redo').disabled = !r;
    $('b2Undo').title = u ? T('Deshacer: ', 'Undo: ') + u.label + ' (Ctrl+Z)' : T('Nada que deshacer', 'Nothing to undo');
    $('b2Redo').title = r ? T('Rehacer: ', 'Redo: ') + r.label + ' (Ctrl+Y)' : T('Nada que rehacer', 'Nothing to redo');
  }

  /* ---------------- the session in the browser ---------------- */
  let saveT = 0;
  function saveLater() { clearTimeout(saveT); saveT = setTimeout(save, 800); }
  function save() {
    if (!state.matrix || !window.Store) return;
    Store.put('session', 'matriz', { matrix: state.matrix, trees: state.matrixTrees || [], source: Ed.source, saved: Date.now() });
  }
  function offerRecovery() {
    if (!window.Store) return;
    Store.get('session', 'matriz').then(s => {
      if (!s || !s.matrix) return;
      const b = $('b2Recover');
      b.hidden = false;
      const d = new Date(s.saved);
      b.querySelector('small').textContent = `${s.matrix.title || s.source || T('sin título', 'untitled')} · ${s.matrix.taxa.length} × ${s.matrix.chars.length} · ${d.toLocaleString(I18N.lang === 'en' ? 'en-GB' : 'es-MX', { dateStyle: 'medium', timeStyle: 'short' })}`;
      b.onclick = () => setMatrix(s.matrix, s.source || s.matrix.title, s.trees);
    });
  }

  /* ---------------- summary ---------------- */
  function paintSummary() {
    const m = state.matrix; if (!m) return;
    const s = Mx.stats(m);
    const tn = TYPE_NAMES();
    const types = Object.keys(s.byType).filter(k => s.byType[k]).map(k => s.byType[k] + ' ' + tn[k].toLowerCase()).join(' · ');
    statTiles('b2Tiles', [
      [T('Taxones', 'Taxa'), String(s.activeTaxa), s.activeTaxa < s.taxa ? T(`${s.taxa - s.activeTaxa} inactivos`, `${s.taxa - s.activeTaxa} inactive`) : T('todos activos', 'all active')],
      [T('Caracteres', 'Characters'), String(s.activeChars), types],
      [T('Informativos', 'Informative'), String(s.informative), T('cambian de longitud entre árboles', 'their length differs among trees'), s.informative ? null : 'warn'],
      [T('Datos faltantes', 'Missing data'), fmtPct(s.pMissing), s.missing + ' «?»', s.pMissing > 0.3 ? 'warn' : null],
      [T('Inaplicables', 'Inapplicable'), String(s.gaps), s.dependent ? T(`${s.dependent} caracteres dependientes`, `${s.dependent} dependent characters`) : T('sin dependencias declaradas', 'no dependencies declared')],
      [T('Polimorfismos', 'Polymorphisms'), String(s.poly), T('celdas con varios estados', 'cells with several states')],
      [T('Grupo externo', 'Outgroup'), String(s.outgroup), m.taxa.filter(t => t.outgroup).map(t => esc(t.name)).slice(0, 3).join(', ') || T('ninguno', 'none'), s.outgroup ? null : 'warn'],
    ]);
  }

  /* ---------------- inspector ---------------- */
  function paintInspector() {
    const m = state.matrix, host = $('b2Insp');
    if (!m || !Ed.grid || !Ed.grid.range()) { host.innerHTML = ''; return; }
    const r = Ed.grid.range();
    const multiCols = Ed.grid.wholeCols() && r.cb > r.ca;
    let h = '';
    if (multiCols) h += bulkHTML(r.ca, r.cb);
    h += charHTML(r.j) + taxonHTML(r.i);
    host.innerHTML = h;
    wireInspector(r);
    paintThumbs(r.j);
  }
  function stateRows(ch, j) {
    if (Mx.isCont(ch)) return `<div class="field"><label for="b2Unit">${T('Unidad', 'Unit')}</label><input type="text" id="b2Unit" value="${esc(ch.unit || '')}" placeholder="mm, cm, número…"></div>`;
    return `<div class="b2-states" role="list" aria-label="${esc(T('Estados', 'States'))}">` + ch.states.map((s, k) => `
      <div class="b2-state" role="listitem">
        <span class="b2-sym s${k % 8}">${Mx.SYMBOLS[k]}</span>
        <input type="text" value="${esc(s)}" data-k="${k}" class="b2-sname" aria-label="${esc(T('Nombre del estado ', 'Name of state ') + Mx.SYMBOLS[k])}">
        <button type="button" class="icon-btn b2-img" data-k="${k}" title="${esc(T('Imagen del estado', 'Picture of the state'))}" aria-label="${esc(T('Imagen del estado ', 'Picture of state ') + Mx.SYMBOLS[k])}"><span class="b2-thumb" data-k="${k}">▣</span></button>
        <button type="button" class="icon-btn b2-up" data-k="${k}" ${k === 0 ? 'disabled' : ''} title="${esc(T('Subir el estado (recodifica las celdas)', 'Move the state up (recodes the cells)'))}" aria-label="${esc(T('Subir el estado ', 'Move up state ') + Mx.SYMBOLS[k])}">↑</button>
        <button type="button" class="icon-btn b2-down" data-k="${k}" ${k === ch.states.length - 1 ? 'disabled' : ''} title="${esc(T('Bajar el estado', 'Move the state down'))}" aria-label="${esc(T('Bajar el estado ', 'Move down state ') + Mx.SYMBOLS[k])}">↓</button>
        <button type="button" class="icon-btn b2-del" data-k="${k}" ${ch.states.length <= 1 ? 'disabled' : ''} title="${esc(T('Quitar el estado (sus celdas quedan en «?»)', 'Remove the state (its cells become «?»)'))}" aria-label="${esc(T('Quitar el estado ', 'Remove state ') + Mx.SYMBOLS[k])}">✕</button>
      </div>`).join('') + `</div>
      <button type="button" class="btn btn-ghost btn-sm" id="b2AddState" ${ch.states.length >= Mx.MAXSTATES ? 'disabled' : ''}>+ ${T('Estado', 'State')}</button>`;
  }
  function stepHTML(ch) {
    if (ch.type !== 'step') return '';
    const k = ch.states.length, C = ch.cost || [];
    let t = `<table class="b2-step"><caption>${T('Costo de pasar del estado de la fila (antepasado) al de la columna (descendiente)', 'Cost of going from the row state (ancestor) to the column state (descendant)')}</caption><thead><tr><th scope="col"></th>${ch.states.map((s, b) => `<th scope="col">${Mx.SYMBOLS[b]}</th>`).join('')}</tr></thead><tbody>`;
    for (let a = 0; a < k; a++) {
      t += `<tr><th scope="row">${Mx.SYMBOLS[a]}</th>`;
      for (let b = 0; b < k; b++) {
        const v = C[a] && C[a][b] != null ? C[a][b] : (a === b ? 0 : 1);
        t += a === b ? '<td class="dg">0</td>' : `<td><input type="number" min="0" step="1" value="${v}" data-a="${a}" data-b="${b}" class="b2-cost" aria-label="${esc(T('Costo de ', 'Cost from ') + Mx.SYMBOLS[a] + T(' a ', ' to ') + Mx.SYMBOLS[b])}"></td>`;
      }
      t += '</tr>';
    }
    t += `</tbody></table><div class="btn-row"><button type="button" class="btn btn-ghost btn-sm" data-fill="unord">${T('Todos 1', 'All 1')}</button><button type="button" class="btn btn-ghost btn-sm" data-fill="ord">${T('Como ordenado', 'As ordered')}</button><button type="button" class="btn btn-ghost btn-sm" data-fill="sym">${T('Hacer simétrica', 'Make symmetric')}</button></div>`;
    return t;
  }
  function charHTML(j) {
    const m = state.matrix, ch = m.chars[j], tn = TYPE_NAMES();
    const dep = ch.depends;
    const ctl = dep ? m.chars[dep.on] : null;
    return `<section class="b2-sec" aria-labelledby="b2CharH">
      <div class="b2-sec-h"><h3 id="b2CharH">${T('Carácter', 'Character')} ${j + 1}</h3>
        <span class="b2-nav"><button type="button" class="icon-btn" id="b2PrevC" ${j === 0 ? 'disabled' : ''} aria-label="${esc(T('Carácter anterior', 'Previous character'))}">‹</button><button type="button" class="icon-btn" id="b2NextC" ${j === m.chars.length - 1 ? 'disabled' : ''} aria-label="${esc(T('Carácter siguiente', 'Next character'))}">›</button></span></div>
      <div class="field"><label for="b2CName">${T('Enunciado del carácter', 'Character statement')}</label><input type="text" id="b2CName" value="${esc(ch.name)}" placeholder="${esc(T('p. ej., Hoja: división', 'e.g., Leaf: division'))}"></div>
      <div class="form-grid tight">
        <div class="field"><label for="b2CType">${T('Tipo', 'Type')}</label><select id="b2CType">${Mx.TYPES.map(t => `<option value="${t}"${ch.type === t ? ' selected' : ''}>${esc(tn[t])}</option>`).join('')}</select></div>
        <div class="field"><label for="b2CWeight">${T('Peso', 'Weight')}</label><input type="number" id="b2CWeight" min="0" max="1000" step="1" value="${ch.weight == null ? 1 : ch.weight}"></div>
      </div>
      <label class="checkbox-label"><input type="checkbox" id="b2CActive"${ch.active === false ? '' : ' checked'}> ${T('Activo (entra en el análisis)', 'Active (enters the analysis)')}</label>
      <h4>${Mx.isCont(ch) ? T('Medida', 'Measurement') : T('Estados', 'States')}</h4>
      ${stateRows(ch, j)}
      ${stepHTML(ch)}
      ${Mx.isCont(ch) ? '' : `<h4>${T('Inaplicable cuando…', 'Inapplicable when…')}</h4>
      <div class="field"><label for="b2Dep">${T('Depende del carácter', 'Depends on character')}</label><select id="b2Dep"><option value="">${T('— de ninguno —', '— none —')}</option>${m.chars.map((c, q) => (q === j || Mx.isCont(c) ? '' : `<option value="${q}"${dep && dep.on === q ? ' selected' : ''}>${q + 1}. ${esc((c.name || '').slice(0, 40))}</option>`)).join('')}</select></div>
      ${ctl ? `<fieldset class="b2-depstates"><legend>${T('Existe sólo si el carácter', 'Exists only if character')} ${dep.on + 1} ${T('está en', 'is in')}</legend>${ctl.states.map((s, k) => `<label class="checkbox-label"><input type="checkbox" class="b2-dstate" data-k="${k}"${dep.states.includes(k) ? ' checked' : ''}> ${Mx.SYMBOLS[k]} ${esc(s)}</label>`).join('')}</fieldset>
      <button type="button" class="btn btn-secondary btn-sm" id="b2FillGaps">${T('Poner «–» donde no aplica', 'Put «–» where it does not apply')}</button>` : ''}`}
      <div class="field"><label for="b2CNote">${T('Nota (fuente, criterio de codificación)', 'Note (source, coding criterion)')}</label><textarea id="b2CNote" rows="2">${esc(ch.note || '')}</textarea></div>
      <div class="btn-row b2-acts">
        <button type="button" class="btn btn-ghost btn-sm" id="b2CIns">${T('Insertar después', 'Insert after')}</button>
        <button type="button" class="btn btn-ghost btn-sm" id="b2CDup">${T('Duplicar', 'Duplicate')}</button>
        <button type="button" class="btn btn-ghost btn-sm" id="b2CLeft" ${j === 0 ? 'disabled' : ''}>← ${T('Mover', 'Move')}</button>
        <button type="button" class="btn btn-ghost btn-sm" id="b2CRight" ${j === m.chars.length - 1 ? 'disabled' : ''}>${T('Mover', 'Move')} →</button>
        <button type="button" class="btn btn-ghost btn-sm danger" id="b2CDel" ${m.chars.length <= 1 ? 'disabled' : ''}>${T('Eliminar', 'Delete')}</button>
      </div>
    </section>`;
  }
  function taxonHTML(i) {
    const m = state.matrix, t = m.taxa[i];
    return `<section class="b2-sec" aria-labelledby="b2TaxH">
      <div class="b2-sec-h"><h3 id="b2TaxH">${T('Taxón', 'Taxon')} ${i + 1}</h3></div>
      <div class="field"><label for="b2TName">${T('Nombre', 'Name')}</label><input type="text" id="b2TName" value="${esc(t.name)}"></div>
      <label class="checkbox-label"><input type="checkbox" id="b2TOut"${t.outgroup ? ' checked' : ''}> ${T('Grupo externo (enraíza el árbol)', 'Outgroup (roots the tree)')}</label>
      <label class="checkbox-label"><input type="checkbox" id="b2TActive"${t.active === false ? '' : ' checked'}> ${T('Activo (entra en el análisis)', 'Active (enters the analysis)')}</label>
      <div class="field"><label for="b2TNote">${T('Nota (ejemplar, fuente)', 'Note (specimen, source)')}</label><textarea id="b2TNote" rows="2">${esc(t.note || '')}</textarea></div>
      <div class="b2-timg">${(() => { const u = window.TaxonImg ? TaxonImg.urlOfTaxon(t) : null; return u ? `<img src="${u}" alt="">` : ''; })()}
        <button type="button" class="btn btn-ghost btn-sm" id="b2TImg">${t.image ? T('Cambiar la imagen…', 'Change the picture…') : T('Añadir una imagen…', 'Add a picture…')}</button></div>
      <div class="btn-row b2-acts">
        <button type="button" class="btn btn-ghost btn-sm" id="b2TIns">${T('Insertar debajo', 'Insert below')}</button>
        <button type="button" class="btn btn-ghost btn-sm" id="b2TDup">${T('Duplicar', 'Duplicate')}</button>
        <button type="button" class="btn btn-ghost btn-sm" id="b2TUp" ${i === 0 ? 'disabled' : ''}>↑ ${T('Mover', 'Move')}</button>
        <button type="button" class="btn btn-ghost btn-sm" id="b2TDown" ${i === m.taxa.length - 1 ? 'disabled' : ''}>↓ ${T('Mover', 'Move')}</button>
        <button type="button" class="btn btn-ghost btn-sm danger" id="b2TDel" ${m.taxa.length <= 3 ? 'disabled' : ''}>${T('Eliminar', 'Delete')}</button>
      </div>
    </section>`;
  }
  function bulkHTML(a, b) {
    const tn = TYPE_NAMES();
    return `<section class="b2-sec b2-bulk" aria-labelledby="b2BulkH">
      <div class="b2-sec-h"><h3 id="b2BulkH">${T('Caracteres', 'Characters')} ${a + 1}–${b + 1} (${b - a + 1})</h3></div>
      <div class="form-grid tight">
        <div class="field"><label for="b2BType">${T('Tipo para todos', 'Type for all')}</label><select id="b2BType"><option value="">—</option>${['unord', 'ord'].map(t => `<option value="${t}">${esc(tn[t])}</option>`).join('')}</select></div>
        <div class="field"><label for="b2BWeight">${T('Peso para todos', 'Weight for all')}</label><input type="number" id="b2BWeight" min="0" step="1" placeholder="—"></div>
      </div>
      <div class="btn-row"><button type="button" class="btn btn-secondary btn-sm" id="b2BApply">${T('Aplicar', 'Apply')}</button><button type="button" class="btn btn-ghost btn-sm" id="b2BOff">${T('Desactivar', 'Deactivate')}</button><button type="button" class="btn btn-ghost btn-sm" id="b2BOn">${T('Activar', 'Activate')}</button><button type="button" class="btn btn-ghost btn-sm danger" id="b2BDel">${T('Eliminar', 'Delete')}</button></div>
    </section>`;
  }
  function wireInspector(r) {
    const m = state.matrix, j = r.j, i = r.i, ch = m.chars[j];
    const on = (id, ev, f) => { const e = $(id); if (e) e.addEventListener(ev, f); };
    const charPatch = (patch, label) => Ed.do({ kind: 'char', j, patch }, label);
    on('b2PrevC', 'click', () => Ed.grid.select(i, j - 1));
    on('b2NextC', 'click', () => Ed.grid.select(i, j + 1));
    on('b2CName', 'change', e => charPatch({ name: e.target.value.trim() }, T('Enunciado', 'Statement')));
    on('b2CWeight', 'change', e => { const v = Math.max(0, Math.round(+e.target.value || 0)); charPatch({ weight: v }, T('Peso', 'Weight')); });
    on('b2CActive', 'change', e => charPatch({ active: e.target.checked }, T('Activar carácter', 'Activate character')));
    on('b2CNote', 'change', e => charPatch({ note: e.target.value }, T('Nota', 'Note')));
    on('b2Unit', 'change', e => charPatch({ unit: e.target.value.trim() }, T('Unidad', 'Unit')));
    on('b2CType', 'change', e => changeType(j, e.target.value));
    document.querySelectorAll('#b2Insp .b2-sname').forEach(inp => inp.addEventListener('change', () => {
      const st = ch.states.slice(); st[+inp.dataset.k] = inp.value.trim() || Mx.SYMBOLS[+inp.dataset.k];
      charPatch({ states: st }, T('Nombre de estado', 'State name'));
    }));
    on('b2AddState', 'click', () => {
      const st = ch.states.concat(String(ch.states.length));
      const patch = { states: st };
      if (ch.type === 'step' && ch.cost) patch.cost = st.map((_, a) => st.map((_, b) => (a === b ? 0 : ch.cost[a] && ch.cost[a][b] != null ? ch.cost[a][b] : 1)));
      charPatch(patch, T('Añadir estado', 'Add state'));
    });
    const recode = (map, states, label) => Ed.do({ kind: 'recode', j, map, states }, label);
    document.querySelectorAll('#b2Insp .b2-up, #b2Insp .b2-down').forEach(b => b.addEventListener('click', () => {
      const k = +b.dataset.k, d = b.classList.contains('b2-up') ? -1 : 1;
      const map = ch.states.map((_, s) => s); map[k] = k + d; map[k + d] = k;
      const st = ch.states.slice(); [st[k], st[k + d]] = [st[k + d], st[k]];
      recode(map, st, T('Reordenar estados', 'Reorder states'));
    }));
    document.querySelectorAll('#b2Insp .b2-del').forEach(b => b.addEventListener('click', () => {
      const k = +b.dataset.k;
      const n = m.cells.filter(row => typeof row[j] === 'number' && row[j] > 0 && (row[j] & (1 << k))).length;
      if (n && !confirm(T(`${n} celdas usan el estado ${Mx.SYMBOLS[k]}. Al quitarlo, las que sólo tienen ese estado quedarán en «?». ¿Seguir?`, `${n} cells use state ${Mx.SYMBOLS[k]}. Removing it leaves the cells with only that state as «?». Continue?`))) return;
      const map = ch.states.map((_, s) => (s < k ? s : s === k ? -1 : s - 1));
      recode(map, ch.states.filter((_, s) => s !== k), T('Quitar estado', 'Remove state'));
    }));
    document.querySelectorAll('#b2Insp .b2-img').forEach(b => b.addEventListener('click', () => {
      const k = +b.dataset.k;
      StateImg.edit(ch, k, id => {
        const im = Object.assign({}, ch.images || {});
        if (id) im[k] = id; else delete im[k];
        charPatch({ images: Object.keys(im).length ? im : null }, T('Imagen de estado', 'State picture'));
      });
    }));
    document.querySelectorAll('#b2Insp .b2-cost').forEach(inp => inp.addEventListener('change', () => {
      const k = ch.states.length;
      const C = Array.from({ length: k }, (_, a) => Array.from({ length: k }, (_, b) => (a === b ? 0 : ch.cost && ch.cost[a] && ch.cost[a][b] != null ? ch.cost[a][b] : 1)));
      C[+inp.dataset.a][+inp.dataset.b] = Math.max(0, +inp.value || 0);
      charPatch({ cost: C }, T('Costo', 'Cost'));
    }));
    document.querySelectorAll('#b2Insp [data-fill]').forEach(b => b.addEventListener('click', () => {
      const k = ch.states.length, f = b.dataset.fill;
      const old = ch.cost || [];
      const C = Array.from({ length: k }, (_, a) => Array.from({ length: k }, (_, c) => {
        if (a === c) return 0;
        if (f === 'unord') return 1;
        if (f === 'ord') return Math.abs(a - c);
        return Math.min(old[a] && old[a][c] != null ? old[a][c] : 1, old[c] && old[c][a] != null ? old[c][a] : 1);
      }));
      charPatch({ cost: C }, T('Costos', 'Costs'));
    }));
    on('b2Dep', 'change', e => {
      const v = e.target.value;
      if (v === '') { charPatch({ depends: null }, T('Dependencia', 'Dependency')); return; }
      const on2 = +v, ctl = m.chars[on2];
      /* by default: applicable when the controlling character is in its last state («present») */
      charPatch({ depends: { on: on2, states: [Math.max(0, ctl.states.length - 1)] } }, T('Dependencia', 'Dependency'));
    });
    document.querySelectorAll('#b2Insp .b2-dstate').forEach(cb => cb.addEventListener('change', () => {
      const sts = [...document.querySelectorAll('#b2Insp .b2-dstate')].filter(x => x.checked).map(x => +x.dataset.k);
      charPatch({ depends: sts.length ? { on: ch.depends.on, states: sts } : null }, T('Dependencia', 'Dependency'));
    }));
    on('b2FillGaps', 'click', () => {
      const d = ch.depends, list = [];
      m.cells.forEach((row, q) => {
        const cc = row[d.on];
        if (typeof cc !== 'number' || cc <= 0) return;
        const st = Mx.bits(cc & Mx.MASK);
        if (st.every(s => !d.states.includes(s)) && row[j] !== Mx.GAP) list.push([q, j, Mx.GAP]);
        if (st.every(s => d.states.includes(s)) && row[j] === Mx.GAP) list.push([q, j, Mx.MISSING]);
      });
      if (list.length) Ed.do({ kind: 'cells', list }, T('Inaplicables', 'Inapplicables'));
      if (window.LABG) LABG.toast(list.length ? T(`${list.length} celdas corregidas.`, `${list.length} cells corrected.`) : T('Todo estaba en su lugar.', 'Everything was in place.'));
    });
    on('b2CIns', 'click', () => insertChar(j + 1));
    /* the copy's dependency is written in the numbering after the insertion */
    on('b2CDup', 'click', () => Ed.do({ kind: 'insertChars', at: j + 1, chars: [Object.assign(Mx.clone({ c: ch }).c, { name: ch.name + T(' (copia)', ' (copy)'), depends: ch.depends ? { on: ch.depends.on >= j + 1 ? ch.depends.on + 1 : ch.depends.on, states: ch.depends.states.slice() } : null })], columns: [m.cells.map(row => row[j])] }, T('Duplicar carácter', 'Duplicate character')));
    on('b2CLeft', 'click', () => { Ed.do({ kind: 'moveChar', from: j, to: j - 1 }, T('Mover carácter', 'Move character')); Ed.grid.select(i, j - 1); });
    on('b2CRight', 'click', () => { Ed.do({ kind: 'moveChar', from: j, to: j + 1 }, T('Mover carácter', 'Move character')); Ed.grid.select(i, j + 1); });
    on('b2CDel', 'click', () => deleteChars(j, j));
    /* taxon */
    const taxPatch = (patch, label) => Ed.do({ kind: 'taxon', i, patch }, label);
    on('b2TName', 'change', e => {
      const v = e.target.value.trim();
      if (!v) { e.target.value = m.taxa[i].name; return; }
      taxPatch({ name: v }, T('Nombre de taxón', 'Taxon name'));
    });
    on('b2TOut', 'change', e => taxPatch({ outgroup: e.target.checked }, T('Grupo externo', 'Outgroup')));
    on('b2TActive', 'change', e => taxPatch({ active: e.target.checked }, T('Activar taxón', 'Activate taxon')));
    on('b2TNote', 'change', e => taxPatch({ note: e.target.value }, T('Nota', 'Note')));
    on('b2TImg', 'click', () => TaxonImg.edit(i));
    on('b2TIns', 'click', () => insertTaxon(i + 1));
    on('b2TDup', 'click', () => Ed.do({ kind: 'insertTaxa', at: i + 1, taxa: [Object.assign({}, m.taxa[i], { name: uniqueName(m.taxa[i].name), outgroup: false })], rows: [m.cells[i].slice()] }, T('Duplicar taxón', 'Duplicate taxon')));
    on('b2TUp', 'click', () => { Ed.do({ kind: 'moveTaxon', from: i, to: i - 1 }, T('Mover taxón', 'Move taxon')); Ed.grid.select(i - 1, j); });
    on('b2TDown', 'click', () => { Ed.do({ kind: 'moveTaxon', from: i, to: i + 1 }, T('Mover taxón', 'Move taxon')); Ed.grid.select(i + 1, j); });
    on('b2TDel', 'click', () => deleteTaxa(i, i));
    /* bulk */
    on('b2BApply', 'click', () => {
      const ty = $('b2BType').value, w = $('b2BWeight').value;
      const ops = [];
      for (let q = r.ca; q <= r.cb; q++) {
        const c = m.chars[q], patch = {};
        if (ty && !Mx.isCont(c)) patch.type = ty;
        if (w !== '' && +w >= 0) patch.weight = Math.round(+w);
        if (Object.keys(patch).length) ops.push({ kind: 'char', j: q, patch });
      }
      if (ops.length) Ed.do({ kind: 'batch', ops }, T('Cambiar varios caracteres', 'Change several characters'));
    });
    const setAct = v => Ed.do({ kind: 'batch', ops: Array.from({ length: r.cb - r.ca + 1 }, (_, q) => ({ kind: 'char', j: r.ca + q, patch: { active: v } })) }, v ? T('Activar caracteres', 'Activate characters') : T('Desactivar caracteres', 'Deactivate characters'));
    on('b2BOff', 'click', () => setAct(false));
    on('b2BOn', 'click', () => setAct(true));
    on('b2BDel', 'click', () => deleteChars(r.ca, r.cb));
  }
  function paintThumbs(j) {
    const ch = state.matrix && state.matrix.chars[j];
    if (!ch || !ch.images) return;
    StateImg.thumbs(ch).then(th => {
      Object.keys(th).forEach(k => {
        const span = document.querySelector(`#b2Insp .b2-thumb[data-k="${k}"]`);
        if (span) span.innerHTML = `<img src="${th[k].data}" alt="">`;
      });
    });
  }
  function changeType(j, ty) {
    const m = state.matrix, ch = m.chars[j];
    const wasCont = Mx.isCont(ch), toCont = ty === 'cont';
    const filled = m.cells.filter(row => row[j] !== Mx.MISSING && row[j] !== Mx.GAP).length;
    if (wasCont !== toCont && filled) {
      if (!confirm(T(`Pasar de ${wasCont ? 'continuo a discreto' : 'discreto a continuo'} borra los ${filled} valores de esta columna (quedan en «?»). ¿Seguir?`, `Switching from ${wasCont ? 'continuous to discrete' : 'discrete to continuous'} clears the ${filled} values of this column (they become «?»). Continue?`))) { paintInspector(); return; }
      const list = m.cells.map((row, q) => (row[j] !== Mx.MISSING && row[j] !== Mx.GAP ? [q, j, Mx.MISSING] : null)).filter(Boolean);
      const patch = { type: ty };
      if (toCont) { patch.states = []; patch.depends = null; patch.cost = null; } else patch.states = ['0', '1'];
      Ed.do({ kind: 'batch', ops: [{ kind: 'cells', list }, { kind: 'char', j, patch }] }, T('Tipo de carácter', 'Character type'));
      return;
    }
    const patch = { type: ty };
    if (toCont && !wasCont) { patch.states = []; patch.depends = null; }
    if (!toCont && wasCont) patch.states = ['0', '1'];
    if (ty === 'step' && !ch.cost) { const k = ch.states.length; patch.cost = Array.from({ length: k }, (_, a) => Array.from({ length: k }, (_, b) => (a === b ? 0 : 1))); }
    Ed.do({ kind: 'char', j, patch }, T('Tipo de carácter', 'Character type'));
  }
  function uniqueName(base) {
    const names = new Set(state.matrix.taxa.map(t => t.name));
    let n = 2, s = base + ' ' + n;
    while (names.has(s)) s = base + ' ' + (++n);
    return s;
  }
  function insertChar(at) {
    const m = state.matrix;
    Ed.do({ kind: 'insertChars', at, chars: [Mx.newChar('', 2)] }, T('Insertar carácter', 'Insert character'));
    Ed.grid.select(Ed.grid.range() ? Ed.grid.range().i : 0, Math.min(at, m.chars.length - 1));
    setTimeout(() => { const e = $('b2CName'); if (e) e.focus(); }, 30);
  }
  function insertTaxon(at) {
    const m = state.matrix;
    Ed.do({ kind: 'insertTaxa', at, taxa: [Mx.newTaxon(uniqueName(T('Taxón nuevo', 'New taxon')))] }, T('Insertar taxón', 'Insert taxon'));
    Ed.grid.select(Math.min(at, m.taxa.length - 1), Ed.grid.range() ? Ed.grid.range().j : 0);
    setTimeout(() => { const e = $('b2TName'); if (e) { e.focus(); e.select(); } }, 30);
  }
  function deleteChars(a, b) {
    const m = state.matrix;
    if (b - a + 1 >= m.chars.length) { if (window.LABG) LABG.toast(T('La matriz necesita al menos un carácter.', 'The matrix needs at least one character.')); return; }
    const n = b - a + 1;
    if (n > 1 && !confirm(T(`¿Eliminar ${n} caracteres? Se puede deshacer.`, `Delete ${n} characters? It can be undone.`))) return;
    Ed.do({ kind: 'removeChars', at: a, n }, T('Eliminar caracteres', 'Delete characters'));
    Ed.grid.select(Ed.grid.range() ? Ed.grid.range().i : 0, Math.min(a, m.chars.length - 1));
  }
  function deleteTaxa(a, b) {
    const m = state.matrix;
    if (m.taxa.length - (b - a + 1) < 3) { if (window.LABG) LABG.toast(T('Un análisis necesita al menos tres taxones.', 'An analysis needs at least three taxa.')); return; }
    Ed.do({ kind: 'removeTaxa', at: a, n: b - a + 1 }, T('Eliminar taxones', 'Delete taxa'));
    Ed.grid.select(Math.min(a, m.taxa.length - 1), Ed.grid.range() ? Ed.grid.range().j : 0);
  }

  /* ---------------- quality control ---------------- */
  let qcFilter = '';
  function paintQC() {
    const m = state.matrix; if (!m) return;
    const issues = Mx.qc(m);
    const n = { error: 0, warn: 0, info: 0 };
    issues.forEach(q => n[q.level]++);
    statTiles('b2QCTiles', [
      [T('Errores', 'Errors'), String(n.error), T('el análisis no los lee como quieres', 'the analysis does not read them as you mean'), n.error ? 'bad' : 'ok'],
      [T('Avisos', 'Warnings'), String(n.warn), T('probablemente no es lo que querías', 'probably not what you meant'), n.warn ? 'warn' : 'ok'],
      [T('Notas', 'Notes'), String(n.info), T('vale la pena saberlo', 'worth knowing')],
    ]);
    if (window.LABG) LABG.markStep(2, n.error ? 'warn' : (state.matrix ? 'done' : null));
    const shown = issues.filter(q => !qcFilter || q.level === qcFilter);
    const lv = { error: T('Error', 'Error'), warn: T('Aviso', 'Warning'), info: T('Nota', 'Note') };
    $('b2QCList').innerHTML = shown.length ? shown.slice(0, 400).map((q, k) => `<li class="qc-${q.level}"><span class="qc-lv">${lv[q.level]}</span><span class="qc-t">${esc(T(q.es, q.en))}</span>${q.i != null || q.j != null ? `<button type="button" class="btn btn-ghost btn-sm qc-go" data-i="${q.i == null ? '' : q.i}" data-j="${q.j == null ? '' : q.j}">${T('Ir', 'Go')}</button>` : ''}</li>`).join('') + (shown.length > 400 ? `<li class="qc-info">${T('… y ', '… and ')}${shown.length - 400}${T(' más', ' more')}</li>` : '')
      : `<li class="qc-ok">${T('Nada que señalar con este filtro.', 'Nothing to point out with this filter.')}</li>`;
  }

  /* ---------------- character list ---------------- */
  function paintList() {
    const m = state.matrix; if (!m) return;
    const base = +$('b2ListBase').value;
    const rows = MatIO.characterList(m, I18N.lang, { base });
    $('b2ListOut').innerHTML = rows.map(r => `<li${m.chars[r.n - base].active === false ? ' class="off"' : ''}><span class="cl-t">${esc(r.text)}</span> <span class="cl-tags">[${esc(r.tags.join('; '))}]</span>${r.note ? ` <span class="cl-note">${esc(r.note)}</span>` : ''}</li>`).join('');
  }
  function listHTMLDoc() {
    const m = state.matrix;
    const base = +$('b2ListBase').value;
    const rows = MatIO.characterList(m, I18N.lang, { base });
    return StateImg.collect(m).then(imgs => {
      const items = rows.map((r, q) => {
        const ch = m.chars[q];
        const pics = ch.images ? Object.keys(ch.images).map(s => { const im = imgs[ch.images[s]]; return im && im.confirmed ? `<figure><img src="${im.data}" alt="${esc(ch.states[s] || '')}"><figcaption>(${Mx.SYMBOLS[s]}) ${esc(ch.states[s] || '')}${im.credit ? ' · ' + esc(im.credit) : ''}${im.licence ? ' · ' + esc(im.licence) : ''}</figcaption></figure>` : ''; }).join('') : '';
        return `<li><p>${esc(r.text)} <span class="tags">[${esc(r.tags.join('; '))}]</span>${r.note ? ' ' + esc(r.note) : ''}</p>${pics ? `<div class="pics">${pics}</div>` : ''}</li>`;
      }).join('\n');
      return `<!DOCTYPE html><html lang="${I18N.lang}"><head><meta charset="utf-8"><title>${esc(m.title || 'Lista de caracteres')}</title><style>body{font-family:ui-serif,serif;max-width:820px;margin:32px auto;padding:0 18px;line-height:1.5;color:#222}h1{font-size:1.4rem}ol{padding-left:0;list-style:none}li{margin:0 0 12px}.tags{color:#666;font-size:.9em}.pics{display:flex;gap:10px;flex-wrap:wrap}figure{margin:4px 0;width:160px}img{width:160px;height:120px;object-fit:cover;border:1px solid #ccc}figcaption{font-size:.75rem;color:#555}</style></head><body><h1>${esc(m.title || T('Lista de caracteres', 'Character list'))}</h1><ol>${items}</ol><p style="color:#777;font-size:.8rem">CladisticsPro</p></body></html>`;
    });
  }

  /* ---------------- export ---------------- */
  function base() { return slug(state.matrix.title || state.fileName || 'matriz'); }
  function exportAs(kind) {
    const m = state.matrix; if (!m) return;
    const trees = $('b2ExpTrees').checked ? (state.matrixTrees || []) : [];
    if (kind === 'nexus') download(MatIO.writeNexus(m, { trees }), base() + '.nex', 'text/plain;charset=utf-8');
    else if (kind === 'xread') download(MatIO.writeXread(m), base() + '.ss', 'text/plain;charset=utf-8');
    else if (kind === 'csv') download(MatIO.writeTable(m, ','), base() + '.csv', 'text/csv;charset=utf-8');
    else if (kind === 'tsv') download(MatIO.writeTable(m, '\t'), base() + '.tsv', 'text/tab-separated-values;charset=utf-8');
    else if (kind === 'list') download('﻿' + MatIO.characterListText(m, I18N.lang, { base: +$('b2ListBase').value }), base() + '_caracteres.txt', 'text/plain;charset=utf-8');
    else if (kind === 'listhtml') listHTMLDoc().then(h => download(h, base() + '_caracteres.html', 'text/html;charset=utf-8'));
    else if (kind === 'project') StateImg.collect(m).then(images => download(MatIO.writeProject(m, { trees: state.matrixTrees || [], images }), base() + '.cladisticspro.json', 'application/json'));
  }

  /* ---------------- new matrix ---------------- */
  function newMatrix() {
    const nt = Math.max(3, Math.min(2000, +$('b2NewTaxa').value || 0));
    const nc = Math.max(1, Math.min(5000, +$('b2NewChars').value || 0));
    const m = Mx.create(nt, nc, { title: T('Matriz nueva', 'New matrix'), taxonPrefix: T('Taxón ', 'Taxon '), charPrefix: '' });
    m.chars.forEach(c => { c.name = ''; });
    setMatrix(m, '', [], []);
    $('b2NewBox').hidden = true;
  }

  /* ---------------- wiring ---------------- */
  function wire() {
    if (!$('panel-2')) return;
    /* example tiles */
    const ex = window.EXAMPLES || {};
    $('b2Examples').innerHTML = Object.keys(ex).map(id => `<button type="button" class="src-tile" data-ex="${id}"><b>${L2(esc(ex[id].es), esc(ex[id].en))}</b><small>${L2(esc(ex[id].des), esc(ex[id].den))}</small></button>`).join('');
    $('b2Examples').addEventListener('click', e => { const b = e.target.closest('[data-ex]'); if (b) loadExample(b.dataset.ex); });
    $('b2File').addEventListener('change', e => {
      const f = e.target.files[0]; if (!f) return;
      const fr = new FileReader();
      fr.onload = () => readText(fr.result, f.name);
      fr.readAsText(f);
      e.target.value = '';
    });
    $('b2Drop').addEventListener('click', () => $('b2File').click());
    const drop = $('b2Drop');
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', e => {
      e.preventDefault(); drop.classList.remove('over');
      const f = e.dataTransfer.files[0]; if (!f) return;
      const fr = new FileReader(); fr.onload = () => readText(fr.result, f.name); fr.readAsText(f);
    });
    $('b2PasteBtn').addEventListener('click', () => { $('b2PasteBox').hidden = !$('b2PasteBox').hidden; if (!$('b2PasteBox').hidden) $('b2PasteText').focus(); });
    $('b2PasteRead').addEventListener('click', () => { const t = $('b2PasteText').value; if (t.trim()) readText(t, T('texto pegado', 'pasted text')); });
    $('b2NewBtn').addEventListener('click', () => { $('b2NewBox').hidden = !$('b2NewBox').hidden; });
    $('b2NewMake').addEventListener('click', newMatrix);
    $('b2Title').addEventListener('change', e => Ed.do({ kind: 'meta', patch: { title: e.target.value.trim() } }, T('Título', 'Title')));
    $('b2Undo').addEventListener('click', () => Ed.undoLast());
    $('b2Redo').addEventListener('click', () => Ed.redoLast());
    $('b2AddTaxon').addEventListener('click', () => insertTaxon(Ed.grid && Ed.grid.range() ? Ed.grid.range().rb + 1 : state.matrix.taxa.length));
    $('b2AddChar').addEventListener('click', () => insertChar(Ed.grid && Ed.grid.range() ? Ed.grid.range().cb + 1 : state.matrix.chars.length));
    $('b2DelSel').addEventListener('click', () => {
      const r = Ed.grid && Ed.grid.range(); if (!r) return;
      if (Ed.grid.wholeCols()) deleteChars(r.ca, r.cb);
      else if (Ed.grid.wholeRows()) deleteTaxa(r.ra, r.rb);
      else if (window.LABG) LABG.toast(T('Para eliminar, selecciona columnas enteras (clic en su número) o filas enteras (clic en el nombre).', 'To delete, select whole columns (click their number) or whole rows (click the name).'));
    });
    let zoom = 1;
    $('b2ZoomIn').addEventListener('click', () => { zoom = Math.min(1.6, zoom + 0.15); Ed.grid && Ed.grid.setZoom(zoom); });
    $('b2ZoomOut').addEventListener('click', () => { zoom = Math.max(0.7, zoom - 0.15); Ed.grid && Ed.grid.setZoom(zoom); });
    $('b2ShowNames').addEventListener('change', e => Ed.grid && Ed.grid.setShowNames(e.target.checked));
    $('b2SortTaxa').addEventListener('click', () => {
      const m = state.matrix;
      const order = m.taxa.map((t, i) => i).sort((a, b) => (m.taxa[b].outgroup - m.taxa[a].outgroup) || m.taxa[a].name.localeCompare(m.taxa[b].name, 'es'));
      const nm = Mx.clone(m);
      nm.taxa = order.map(i => m.taxa[i]); nm.cells = order.map(i => m.cells[i]);
      Ed.do({ kind: 'replace', matrix: nm }, T('Ordenar taxones', 'Sort taxa'));
    });
    $('b2QCFilter').addEventListener('change', e => { qcFilter = e.target.value; paintQC(); });
    $('b2QCList').addEventListener('click', e => {
      const b = e.target.closest('.qc-go'); if (!b) return;
      const i = b.dataset.i === '' ? null : +b.dataset.i, j = b.dataset.j === '' ? null : +b.dataset.j;
      if (i != null && j != null) Ed.grid.select(i, j);
      else if (j != null) Ed.grid.selectChars(j);
      else if (i != null) Ed.grid.selectTaxa(i);
      $('b2Grid').scrollIntoView({ block: 'center', behavior: 'smooth' });
      Ed.grid.wrap.focus({ preventScroll: true });
    });
    $('b2ListBase').addEventListener('change', paintList);
    $('b2ListCopy').addEventListener('click', () => {
      const t = MatIO.characterListText(state.matrix, I18N.lang, { base: +$('b2ListBase').value });
      if (navigator.clipboard) navigator.clipboard.writeText(t).then(() => window.LABG && LABG.toast(T('Lista copiada', 'List copied')), () => {});
    });
    document.querySelectorAll('#panel-2 [data-export]').forEach(b => b.addEventListener('click', () => exportAs(b.dataset.export)));
    /* undo and redo from the keyboard, while the block is open */
    document.addEventListener('keydown', e => {
      if (!$('panel-2').classList.contains('active') || !state.matrix) return;
      if (e.target.matches('input, textarea, select') && !e.target.classList.contains('mx-edit')) return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) { Ed.undoLast(); e.preventDefault(); }
      else if (ctrl && ((e.key === 'y' || e.key === 'Y') || (e.shiftKey && (e.key === 'z' || e.key === 'Z')))) { Ed.redoLast(); e.preventDefault(); }
    });
    document.addEventListener('langchange', () => { if (state.matrix) paintAll(); });
    document.addEventListener('taximgchange', () => { if (state.matrix) { paintPictures(); paintInspector(); } });
    offerRecovery();
  }
  document.addEventListener('DOMContentLoaded', wire);
  Object.assign(Ed, { setMatrix, readText, loadExample, exportAs, paintAll });
})();
