/* CladisticsPro — morphological cladistics in the browser.
   Copyright (C) 2026  Luis Ángel Barrera-Guzmán

   This program is free software: you can redistribute it and/or modify it under
   the terms of the GNU General Public License as published by the Free Software
   Foundation, either version 3 of the License, or (at your option) any later
   version. It is distributed in the hope that it will be useful, but WITHOUT ANY
   WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
   A PARTICULAR PURPOSE. See the GNU General Public License, in the file LICENSE
   at the root of this program, or <https://www.gnu.org/licenses/>. */

/* CladisticsPro — Block 6: the diagnosis of characters and clades.

   Reads the trees chosen in Block 5 (state.clado): the tree on screen — edited
   or not — and every tree of the same source. Per character: its bounds,
   steps, CI, RI and RC on the tree, its range over all the trees and whether
   its changes fall on the same branches in all of them; the weight it would
   have under implied weights. Per clade: its synapomorphies (unique or
   homoplastic, ambiguous or not), and per terminal its autapomorphies, with
   the names of the states. And the matrix ordered by the tree. */
(function () {
  const B6 = {};
  window.Block6 = B6;
  const $ = el;
  const KIND = { disc: null, inap: ['con «–»', 'with «–»'], cont: ['continuo', 'continuous'] };
  const TYPE = { unord: ['no ord.', 'unord.'], ord: ['ordenado', 'ordered'], step: ['pasos', 'step'], cont: ['continuo', 'continuous'] };

  /* ---------------- computing ---------------- */
  /* the key of every clade of a tree, by node */
  function keysOf(root, n) { const m = new Map(); Tree.clades(root, n).forEach((v, k) => m.set(v, k)); return m; }
  /* the changes of one character, written so that trees can be compared */
  function signature(map, c, keys, n) {
    const out = [];
    map.byNode.forEach((list, v) => list.forEach(chg => {
      if (chg.c !== c) return;
      const k = v.children.length ? keys.get(v) : 'tip' + v.tip;
      out.push(k + ':' + (typeof chg.from === 'number' ? +chg.from.toFixed(9) : chg.from) + '>' + (typeof chg.to === 'number' ? +chg.to.toFixed(9) : chg.to));
    }));
    void n;
    return out.sort().join('|');
  }
  B6.compute = async function (progress) {
    const C = Block5.ensure();
    if (!C) return null;
    const M = C.M, n = M.n;
    const list = C.list.slice(0, 500);
    const maps = [];
    for (let i = 0; i < list.length; i++) {
      maps.push(Mapping.map(M, list[i].root, { optimization: C.opts.optimization }));
      if (progress && i % 5 === 4) { progress((i + 1) / list.length); await LABG.nextPaint(); }
    }
    const keys = list.map(t => keysOf(t.root, n));
    const cur = C.map;
    const per = M.chars.map((ch, c) => {
      const p = cur.per[c];
      const steps = maps.map(m => m.per[c].steps);
      const sigs = maps.map((m, t) => signature(m, c, keys[t], n));
      const cis = maps.map(m => m.per[c].ci).filter(x => x != null), ris = maps.map(m => m.per[c].ri).filter(x => x != null);
      const homo = p.ci != null && p.ci < 1 - 1e-9;
      return {
        c, j: ch.j, name: ch.name, kind: ch.kind, type: ch.type, w: ch.w, unit: ch.unit,
        min: p.min, max: p.max, steps: p.steps, ci: p.ci, ri: p.ri, rc: p.rc, informative: p.informative, homo,
        regions: p.kind === 'inap' ? p.regions : null,
        sMin: Math.min(...steps), sMax: Math.max(...steps),
        ciMin: cis.length ? Math.min(...cis) : null, ciMax: cis.length ? Math.max(...cis) : null,
        riMin: ris.length ? Math.min(...ris) : null, riMax: ris.length ? Math.max(...ris) : null,
        moves: new Set(sigs).size > 1,
        movedIn: sigs.filter(s => s !== sigs[0]).length,
      };
    });
    const lens = maps.map(m => m.length), cis = maps.map(m => m.ci).filter(x => x != null), ris = maps.map(m => m.ri).filter(x => x != null);
    return {
      fingerprint: C.fingerprint, src: C.src, nTrees: list.length, truncated: C.list.length > list.length, per,
      len: [Math.min(...lens), Math.max(...lens)], ci: [Math.min(...cis), Math.max(...cis)], ri: [Math.min(...ris), Math.max(...ris)],
      optimization: C.opts.optimization, date: new Date().toISOString(),
    };
  };

  /* ---------------- clades ---------------- */
  /* the internal nodes of the tree on screen, numbered in preorder (the root is 0) */
  function numbered(root) {
    const m = new Map();
    let k = 0;
    Tree.preorder(root).forEach(v => { if (v.children.length) m.set(v, k++); });
    return m;
  }
  B6.numbered = numbered;
  /* everything said about one branch: its changes split by kind */
  function branchFacts(v) {
    const C = state.clado;
    const list = (C.map.byNode.get(v) || []).slice().sort((a, b) => a.j - b.j);
    return {
      unique: list.filter(x => x.kind !== 'cont' && !x.homoplastic),
      homo: list.filter(x => x.kind !== 'cont' && x.homoplastic),
      cont: list.filter(x => x.kind === 'cont'),
      regions: C.map.per.filter(p => p.kind === 'inap' && p.regions > 1 && p.regionRoots.includes(v) && p.regionRoots[0] !== v),
    };
  }
  B6.branchFacts = branchFacts;
  function itemHTML(chg) {
    const ch = state.clado.M.chars[chg.c];
    return `<li><b>${ch.j + 1}.</b> ${esc(ch.name || '')}: ${Block5.changeText(chg)}${chg.unambiguous === false ? ` <span class="badge">${T('ambiguo', 'ambiguous')}</span>` : ''}</li>`;
  }
  function itemText(chg) {
    const ch = state.clado.M.chars[chg.c];
    return `${ch.j + 1}. ${ch.name || ''}: ${Block5.changeText(chg).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')}${chg.unambiguous === false ? T(' (ambiguo)', ' (ambiguous)') : ''}`;
  }
  function factsHTML(f) {
    let h = '';
    if (f.unique.length) h += `<p class="b5-sub">${T('Sinapomorfías únicas', 'Unique synapomorphies')}</p><ul class="b5-changes">${f.unique.map(itemHTML).join('')}</ul>`;
    if (f.homo.length) h += `<p class="b5-sub">${T('Cambios homoplásicos', 'Homoplastic changes')}</p><ul class="b5-changes">${f.homo.map(itemHTML).join('')}</ul>`;
    if (f.cont.length) h += `<p class="b5-sub">${T('Caracteres continuos', 'Continuous characters')}</p><ul class="b5-changes">${f.cont.map(itemHTML).join('')}</ul>`;
    if (f.regions.length) h += `<p class="b5-sub">${T('Empieza una región aplicable más de', 'Another applicable region starts for')}</p><ul class="b5-changes">${f.regions.map(p => `<li><b>${p.ch.j + 1}.</b> ${esc(p.ch.name || '')}</li>`).join('')}</ul>`;
    return h || `<p class="hint">${T('Sin cambios en esta rama.', 'No changes on this branch.')}</p>`;
  }
  function paintClades() {
    const C = state.clado;
    const num = numbered(C.root);
    const text = new Map();
    num.forEach((k, v) => { if (v !== C.root) text.set(v, String(k)); });
    $('b6Tree').innerHTML = Clado.render(C.root, { names: v => v.name, nodeText: text, legend: false, rowH: 22, fontSize: 12, minUnit: 26, maxUnit: 40, ariaLabel: T('Cladograma con los clados numerados', 'Cladogram with numbered clades') });
    const opt = C.opts.optimization;
    $('b6CladeHint').innerHTML = T(`Con la optimización ${opt === 'unambiguous' ? 'de sólo los cambios no ambiguos' : opt.toUpperCase()} del Bloque 5, sobre el árbol que está a la vista allí${C.undo.length ? ' (editado)' : ''}. Una sinapomorfía única es un cambio a un estado que aparece una sola vez en el árbol.`,
      `With the ${opt === 'unambiguous' ? 'unambiguous-changes-only' : opt.toUpperCase()} optimization of Block 5, on the tree on screen there${C.undo.length ? ' (edited)' : ''}. A unique synapomorphy is a change to a state that arises only once on the tree.`);
    let h = '';
    Tree.preorder(C.root).forEach(v => {
      if (!v.children.length || v === C.root) return;
      const tips = Tree.tips(v);
      h += `<div class="b6-clade"><h4>${T('Clado', 'Clade')} ${num.get(v)} · ${plural(tips.length, T('taxón', 'taxon'), T('taxones', 'taxa'))}</h4>` +
        `<p class="b5-taxa">${tips.slice(0, 12).map(t => `<i>${esc(t.name)}</i>`).join(', ')}${tips.length > 12 ? T(` y ${tips.length - 12} más`, ` and ${tips.length - 12} more`) : ''}</p>${factsHTML(branchFacts(v))}</div>`;
    });
    const auts = Tree.tips(C.root).map(v => ({ v, f: branchFacts(v) })).filter(x => x.f.unique.length + x.f.homo.length + x.f.cont.length + x.f.regions.length);
    if (auts.length) {
      h += `<div class="b6-clade"><h4>${T('Autapomorfías de los terminales', 'Autapomorphies of the terminals')}</h4></div>`;
      auts.forEach(x => { h += `<div class="b6-clade"><h4><i>${esc(x.v.name)}</i></h4>${factsHTML(x.f)}</div>`; });
    }
    $('b6Diag').innerHTML = h;
    /* the clade to highlight in the ordered matrix */
    const prev = $('b6Focus').value;
    $('b6Focus').innerHTML = `<option value="">${T('— ninguno —', '— none —')}</option>` + [...num.entries()].filter(([v]) => v !== C.root).map(([v, k]) => `<option value="${k}">${T('Clado', 'Clade')} ${k} (${Tree.tips(v).length})</option>`).join('');
    if ([...$('b6Focus').options].some(o => o.value === prev)) $('b6Focus').value = prev;
  }
  function diagnosisText() {
    const C = state.clado, m = state.matrix;
    const num = numbered(C.root);
    const L = [];
    const opt = C.opts.optimization;
    L.push(T('Diagnosis de los clados', 'Diagnosis of the clades') + ' — ' + (m.title || ''));
    L.push(T(`Optimización: ${opt === 'unambiguous' ? 'sólo cambios no ambiguos' : opt.toUpperCase()}. Longitud del árbol: ${fmtNum(C.map.length, 3)}; CI ${fmtIdx(C.map.ci)}; RI ${fmtIdx(C.map.ri)}.`, `Optimization: ${opt === 'unambiguous' ? 'unambiguous changes only' : opt.toUpperCase()}. Tree length: ${fmtNum(C.map.length, 3)}; CI ${fmtIdx(C.map.ci)}; RI ${fmtIdx(C.map.ri)}.`));
    L.push(T('Árbol: ', 'Tree: ') + Tree.toNewick(C.root));
    L.push('');
    const block = (title, f) => {
      L.push(title);
      if (f.unique.length) { L.push('  ' + T('Sinapomorfías únicas:', 'Unique synapomorphies:')); f.unique.forEach(x => L.push('    ' + itemText(x))); }
      if (f.homo.length) { L.push('  ' + T('Cambios homoplásicos:', 'Homoplastic changes:')); f.homo.forEach(x => L.push('    ' + itemText(x))); }
      if (f.cont.length) { L.push('  ' + T('Continuos:', 'Continuous:')); f.cont.forEach(x => L.push('    ' + itemText(x))); }
      if (f.regions.length) { L.push('  ' + T('Empieza una región aplicable más de:', 'Another applicable region starts for:')); f.regions.forEach(p => L.push(`    ${p.ch.j + 1}. ${p.ch.name || ''}`)); }
      if (!f.unique.length && !f.homo.length && !f.cont.length && !f.regions.length) L.push('  ' + T('Sin cambios.', 'No changes.'));
      L.push('');
    };
    Tree.preorder(C.root).forEach(v => {
      if (!v.children.length || v === C.root) return;
      block(`${T('Clado', 'Clade')} ${num.get(v)}: ${Tree.tips(v).map(t => t.name).join(', ')}`, branchFacts(v));
    });
    Tree.tips(C.root).forEach(v => block(`${v.name} (${T('autapomorfías', 'autapomorphies')})`, branchFacts(v)));
    return L.join('\n');
  }
  B6.diagnosisText = diagnosisText;

  /* ---------------- the matrix ordered by the tree ---------------- */
  function paintOrdered() {
    const C = state.clado, m = state.matrix, M = C.M;
    const tips = Tree.tips(C.root);
    const num = numbered(C.root);
    const order = Tree.preorder(C.root);
    const pos = new Map(order.map((v, i) => [v, i]));
    /* the first branch (in preorder) where each character has a unique change */
    const first = new Map();
    C.map.byNode.forEach((list, v) => list.forEach(chg => {
      if (chg.kind === 'cont' || chg.homoplastic) return;
      const p = pos.get(v);
      if (!first.has(chg.c) || p < first.get(chg.c)) first.set(chg.c, p);
    }));
    let cols = M.chars.map((ch, c) => c);
    if ($('b6Order').value === 'clade') cols.sort((a, b) => (first.has(a) ? first.get(a) : 1e9) - (first.has(b) ? first.get(b) : 1e9) || M.chars[a].j - M.chars[b].j);
    /* cells that carry the derived state of a unique synapomorphy */
    const syn = new Set(), foc = new Set();
    const focK = $('b6Focus').value === '' ? null : +$('b6Focus').value;
    const focNode = focK == null ? null : [...num.entries()].find(([, k]) => k === focK);
    const inFocus = new Set(focNode ? Tree.tips(focNode[0]).map(t => t.tip) : []);
    C.map.byNode.forEach((list, v) => list.forEach(chg => {
      if (chg.kind === 'cont' || chg.homoplastic) return;
      const isFoc = focNode && focNode[0] === v;
      Tree.tips(v).forEach(t => {
        const cell = m.cells[M.rows[t.tip]][M.chars[chg.c].j];
        if (typeof cell === 'number' && cell > 0 && ((cell & Mx.MASK) >>> chg.to) & 1) { syn.add(t.tip + ':' + chg.c); if (isFoc) foc.add(t.tip + ':' + chg.c); }
      });
    }));
    let h = `<table class="b6-mx"><thead><tr><th>${T('Taxón', 'Taxon')}</th>` + cols.map(c => `<th class="c" title="${esc(M.chars[c].name || '')}">${M.chars[c].j + 1}</th>`).join('') + '</tr></thead><tbody>';
    tips.forEach(t => {
      h += `<tr${inFocus.has(t.tip) ? ' class="inclade"' : ''}><td class="t">${esc(t.name)}</td>`;
      cols.forEach(c => {
        const ch = M.chars[c];
        const cell = m.cells[M.rows[t.tip]][ch.j];
        let cls = 's';
        if (ch.kind === 'cont') cls += ' na';
        else if (typeof cell === 'number' && cell > 0) { const b = Mx.bits(cell & Mx.MASK); if (b.length === 1) cls += ' b6-st' + (b[0] % 8); }
        else cls += ' na';
        const key = t.tip + ':' + c;
        if (foc.has(key)) cls += ' foc'; else if (syn.has(key)) cls += ' syn';
        h += `<td class="${cls}">${esc(Mx.cellText(cell))}</td>`;
      });
      h += '</tr>';
    });
    $('b6Matrix').innerHTML = h + '</tbody></table>';
  }

  /* ---------------- the table of characters ---------------- */
  function kVal() { return Math.max(0.1, Math.min(1000, +$('b6K').value || 3)); }
  function paintChars() {
    const D = state.diag;
    const k = kVal();
    const f = $('b6Filter').value;
    const rows = D.per.filter(r => f === 'all' || (f === 'homo' && r.homo) || (f === 'clean' && !r.homo && r.informative) || (f === 'unstable' && (r.moves || r.sMin !== r.sMax)) || (f === 'uninf' && !r.informative));
    const many = D.nTrees > 1;
    const cols = [
      { key: 'n', label: '#', num: true, get: r => r.j + 1 },
      { key: 'name', label: T('Carácter', 'Character'), get: r => r.name || '—' },
      { key: 'type', label: T('Tipo', 'Type'), get: r => T(...(KIND[r.kind] || TYPE[r.type] || TYPE.unord)) + (r.regions > 1 ? T(` · ${r.regions} regiones`, ` · ${r.regions} regions`) : '') },
      { key: 'min', label: T('Mín.', 'Min.'), num: true, get: r => fmtNum(r.min, 3) },
      { key: 'steps', label: T('Pasos', 'Steps'), num: true, get: r => fmtNum(r.steps, 3) },
      { key: 'max', label: T('Máx.', 'Max.'), num: true, get: r => fmtNum(r.max, 3) },
      { key: 'ci', label: 'CI', num: true, get: r => fmtIdx(r.ci) },
      { key: 'ri', label: 'RI', num: true, get: r => fmtIdx(r.ri) },
      { key: 'rc', label: 'RC', num: true, get: r => fmtIdx(r.rc) },
    ];
    if (many) {
      cols.push({ key: 'range', label: T(`Pasos (${D.nTrees} árb.)`, `Steps (${D.nTrees} trees)`), num: true, get: r => (Math.abs(r.sMax - r.sMin) < 1e-9 ? fmtNum(r.sMin, 3) : fmtNum(r.sMin, 3) + '–' + fmtNum(r.sMax, 3)) });
      cols.push({ key: 'moves', label: T('Cambios', 'Changes'), html: true, get: r => (r.moves ? `<span class="badge warn" title="${T(`cambian de rama en ${r.movedIn} de ${D.nTrees} árboles`, `they move in ${r.movedIn} of ${D.nTrees} trees`)}">${T('se mueven', 'move')} ${r.movedIn}/${D.nTrees}</span>` : `<span class="badge ok">${T('fijos', 'fixed')}</span>`) });
    }
    cols.push({ key: 'fit', label: T('Peso impl.', 'Impl. weight'), num: true, get: r => fmtIdx(k / (k + Math.max(0, r.steps - r.min))) });
    buildTable('b6Table', cols, rows.map(r => Object.assign({ _class: r.homo ? '' : 'b6-clean' }, r)), { limit: 600, className: 'b6-tbl' });
  }
  function exportChars() {
    const D = state.diag, k = kVal();
    const head = ['#', T('carácter', 'character'), T('tipo', 'type'), T('mín', 'min'), T('pasos', 'steps'), T('máx', 'max'), 'CI', 'RI', 'RC', T('pasos mín en los árboles', 'min steps over trees'), T('pasos máx en los árboles', 'max steps over trees'), T('cambian de rama', 'changes move'), T('peso implícito', 'implied weight') + ' k=' + k];
    const rows = D.per.map(r => [r.j + 1, r.name, T(...(KIND[r.kind] || TYPE[r.type] || TYPE.unord)), r.min, r.steps, r.max, r.ci == null ? '' : r.ci.toFixed(4), r.ri == null ? '' : r.ri.toFixed(4), r.rc == null ? '' : r.rc.toFixed(4), r.sMin, r.sMax, r.moves ? r.movedIn : 0, (k / (k + Math.max(0, r.steps - r.min))).toFixed(4)]);
    download([head].concat(rows).map(r => r.map(csvEscape).join(',')).join('\n') + '\n', slug(state.matrix.title || 'matriz') + '_caracteres.csv', 'text/csv;charset=utf-8');
  }

  /* ---------------- what changes among trees ---------------- */
  function paintUnstable() {
    const D = state.diag;
    if (D.nTrees < 2) { $('b6UnstableBody').innerHTML = `<p class="hint">${T('Sólo hay un árbol en esta fuente: no hay nada que comparar.', 'There is only one tree in this source: nothing to compare.')}</p>`; return; }
    const var1 = D.per.filter(r => Math.abs(r.sMax - r.sMin) > 1e-9);
    const mov = D.per.filter(r => r.moves && Math.abs(r.sMax - r.sMin) <= 1e-9);
    /* when the trees agree, say so instead of «from 97.036 to 97.036» */
    const same = Math.abs(D.len[1] - D.len[0]) < 1e-9 && Math.abs(D.ci[1] - D.ci[0]) < 1e-9 && Math.abs(D.ri[1] - D.ri[0]) < 1e-9;
    let h = `<p>${same ? T(`Los ${D.nTrees} árboles tienen la misma longitud (${fmtNum(D.len[0], 3)}), el mismo CI (${fmtIdx(D.ci[0])}) y el mismo RI (${fmtIdx(D.ri[0])}).`, `The ${D.nTrees} trees have the same length (${fmtNum(D.len[0], 3)}), the same CI (${fmtIdx(D.ci[0])}) and the same RI (${fmtIdx(D.ri[0])}).`)
      : T(`Entre los ${D.nTrees} árboles, la longitud va de ${fmtNum(D.len[0], 3)} a ${fmtNum(D.len[1], 3)}, el CI de ${fmtIdx(D.ci[0])} a ${fmtIdx(D.ci[1])} y el RI de ${fmtIdx(D.ri[0])} a ${fmtIdx(D.ri[1])}.`, `Among the ${D.nTrees} trees, the length goes from ${fmtNum(D.len[0], 3)} to ${fmtNum(D.len[1], 3)}, the CI from ${fmtIdx(D.ci[0])} to ${fmtIdx(D.ci[1])} and the RI from ${fmtIdx(D.ri[0])} to ${fmtIdx(D.ri[1])}.`)}</p>`;
    h += var1.length ? `<p class="b5-sub">${T(`Cambian de número de pasos (${var1.length}):`, `Their number of steps changes (${var1.length}):`)}</p><ul class="b5-changes">${var1.map(r => `<li><b>${r.j + 1}.</b> ${esc(r.name || '')}: ${fmtNum(r.sMin, 3)}–${fmtNum(r.sMax, 3)} ${T('pasos', 'steps')}</li>`).join('')}</ul>` : `<p class="hint">${T('Ningún carácter cambia de número de pasos.', 'No character changes its number of steps.')}</p>`;
    h += mov.length ? `<p class="b5-sub">${T(`Los mismos pasos, pero en ramas distintas según el árbol (${mov.length}):`, `The same steps, but on different branches depending on the tree (${mov.length}):`)}</p><ul class="b5-changes">${mov.map(r => `<li><b>${r.j + 1}.</b> ${esc(r.name || '')} · ${T(`distinto en ${r.movedIn} de ${D.nTrees} árboles`, `different in ${r.movedIn} of ${D.nTrees} trees`)}</li>`).join('')}</ul>` : '';
    h += `<p class="hint">${T('Un carácter cuyos cambios caen en ramas distintas según el árbol es lo que separa a los árboles igual de cortos; su lectura en una diagnosis depende del árbol elegido.', 'A character whose changes fall on different branches depending on the tree is what separates the equally short trees; its reading in a diagnosis depends on the tree chosen.')}</p>`;
    $('b6UnstableBody').innerHTML = h;
  }

  /* ---------------- painting ---------------- */
  function paintAll() {
    const D = state.diag, C = state.clado;
    if (!D || !C) return;
    const srcLabel = (Block5.sources().find(s => s.id === C.src) || {}).label || '';
    $('b6Source').innerHTML = T(`Árboles de: <b>${esc(srcLabel)}</b>. Se cambian en el Bloque 5.`, `Trees from: <b>${esc(srcLabel)}</b>. They are changed in Block 5.`) + (D.truncated ? T(' Se compararon los primeros 500.', ' The first 500 were compared.') : '');
    const inf = D.per.filter(r => r.informative).length;
    const homo = D.per.filter(r => r.homo).length;
    const unst = D.per.filter(r => r.moves || Math.abs(r.sMax - r.sMin) > 1e-9).length;
    statTiles('b6Tiles', [
      [T('Árboles comparados', 'Trees compared'), String(D.nTrees), D.nTrees > 1 ? T(`longitud ${fmtNum(D.len[0], 3)}${D.len[1] > D.len[0] + 1e-9 ? '–' + fmtNum(D.len[1], 3) : ''}`, `length ${fmtNum(D.len[0], 3)}${D.len[1] > D.len[0] + 1e-9 ? '–' + fmtNum(D.len[1], 3) : ''}`) : ''],
      [T('Caracteres', 'Characters'), String(D.per.length), T(`${inf} informativos`, `${inf} informative`)],
      [T('Con homoplasia', 'With homoplasy'), String(homo), T('en el árbol a la vista', 'on the tree on screen')],
      ['CI · RI', `${fmtIdx(C.map.ci)} · ${fmtIdx(C.map.ri)}`, D.nTrees > 1 ? (Math.abs(D.ri[1] - D.ri[0]) < 1e-9 ? T('el mismo RI en todos los árboles', 'the same RI in every tree') : T(`RI de ${fmtIdx(D.ri[0])} a ${fmtIdx(D.ri[1])} entre árboles`, `RI from ${fmtIdx(D.ri[0])} to ${fmtIdx(D.ri[1])} among trees`)) : ''],
      [T('Cambian entre árboles', 'Change among trees'), D.nTrees > 1 ? String(unst) : '—', D.nTrees > 1 ? T('pasos o ramas', 'steps or branches') : T('un solo árbol', 'a single tree'), unst ? 'warn' : null],
    ]);
    paintChars(); paintClades(); paintOrdered(); paintUnstable();
  }
  /* the per-character figures of the tree on screen follow its edits */
  function refreshCurrent() {
    const D = state.diag, C = state.clado;
    if (!D || !C) return;
    D.per.forEach(r => { const p = C.map.per[r.c]; Object.assign(r, { steps: p.steps, ci: p.ci, ri: p.ri, rc: p.rc, homo: p.ci != null && p.ci < 1 - 1e-9, regions: p.kind === 'inap' ? p.regions : null }); });
  }
  async function onShow() {
    const C = state.matrix ? Block5.ensure() : null;
    $('b6NoData').hidden = !!C;
    $('b6Work').hidden = !C;
    if (!C) return;
    const D = state.diag;
    if (D && D.fingerprint === C.fingerprint && D.src === C.src && D.optimization === C.opts.optimization && D.M === C.M) { refreshCurrent(); paintAll(); return; }
    if (state.weights && state.weights.k && !B6.kTouched) $('b6K').value = state.weights.k;
    const run = async (progress) => { const r = await B6.compute(progress); if (r) r.M = C.M; return r; };
    let r;
    if (C.list.length > 8 && window.LABG && LABG.work) r = await LABG.work.run({ title: T('Diagnosticando los caracteres en cada árbol', 'Diagnosing the characters on every tree'), delay: 300 }, async w => run(f => w.update(f, T('Optimizando…', 'Optimizing…'))));
    else r = await run();
    if (!r) return;
    state.diag = r;
    enableStep(6, true);
    refreshStepMarks();
    paintAll();
  }
  B6.onShow = onShow;

  function wire() {
    if (!$('panel-6')) return;
    $('b6GoClado').addEventListener('click', () => goStep(5));
    $('b6Filter').addEventListener('change', () => state.diag && paintChars());
    $('b6K').addEventListener('input', () => { B6.kTouched = true; if (state.diag) paintChars(); });
    $('b6Order').addEventListener('change', () => state.clado && paintOrdered());
    $('b6Focus').addEventListener('change', () => state.clado && paintOrdered());
    $('b6ExpChars').addEventListener('click', exportChars);
    $('b6ExpDiag').addEventListener('click', () => download(diagnosisText() + '\n', slug(state.matrix.title || 'matriz') + '_diagnosis.txt'));
    document.addEventListener('stepchange', e => { if (e.detail.step === 6) onShow(); });
    document.addEventListener('matrixchange', () => { state.diag = null; });
    document.addEventListener('searchdone', () => { state.diag = null; });
    document.addEventListener('cladochange', () => { if (state.diag && $('panel-6').classList.contains('active')) { refreshCurrent(); paintAll(); } });
    document.addEventListener('langchange', () => { if (state.diag && state.clado && $('panel-6').classList.contains('active')) paintAll(); });
  }
  document.addEventListener('DOMContentLoaded', wire);
  Object.assign(B6, { paintAll, signature, keysOf });
})();
