/* CladisticsPro — morphological cladistics in the browser.
   Copyright (C) 2026  Luis Ángel Barrera-Guzmán

   This program is free software: you can redistribute it and/or modify it under
   the terms of the GNU General Public License as published by the Free Software
   Foundation, either version 3 of the License, or (at your option) any later
   version. It is distributed in the hope that it will be useful, but WITHOUT ANY
   WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
   A PARTICULAR PURPOSE. See the GNU General Public License, in the file LICENSE
   at the root of this program, or <https://www.gnu.org/licenses/>. */

/* CladisticsPro — Block 7: branch support.

   Bremer support (absolute and relative) by one search without each group or
   from the suboptimal trees, and resampling (bootstrap, jackknife, symmetric)
   with absolute frequencies and GC. The values are kept by group (support.js),
   so they can be read on any tree that has the group.

   state.support = { fingerprint, best, values: {group: {bremer, bremerAbove,
   rfd, boot, jack, sym}}, bremer: {method, k, …}, res: {method: {reps, p,
   search, counts}} } */
(function () {
  const B7 = {};
  window.Block7 = B7;
  const $ = el;
  const RMETHODS = [
    { id: 'boot', es: 'Bootstrap', en: 'Bootstrap', p: null, d: ['Tantos caracteres como hay, tomados con reemplazo (Felsenstein 1985)', 'As many characters as there are, drawn with replacement (Felsenstein 1985)'] },
    { id: 'jack', es: 'Jackknife', en: 'Jackknife', p: 36, d: ['Cada carácter se borra con probabilidad p (Farris et al. 1996)', 'Each character is deleted with probability p (Farris et al. 1996)'] },
    { id: 'sym', es: 'Remuestreo simétrico', en: 'Symmetric resampling', p: 33, d: ['Cada carácter cambia con probabilidad p: la mitad se borra, la mitad se duplica (Goloboff et al. 2003)', 'Each character changes with probability p: half are deleted, half doubled (Goloboff et al. 2003)'] },
  ];
  let rmethod = 'jack';

  /* ---------------- what is measured ---------------- */
  const ready = () => !!(state.matrix && state.search && state.search.trees && state.search.trees.length && state.search.fingerprint === Mx.fingerprint(state.matrix));
  const A = () => Mx.toAnalysis(state.matrix);
  const r0 = () => { const a = A(); return a.outgroup.length ? a.outgroup[0] : 0; };
  function refRoot() {
    const k = $('b7RefSel').value, s = state.search;
    if (k === 'mpt') return s.trees[0].root;
    if (k === 'clado' && window.Block5) { const C = Block5.ensure(); if (C) return C.root; }
    return s.strict;
  }
  function groups() { return Support.cladesOf(refRoot(), A().taxa.length, r0()); }
  function store() {
    const fp = Mx.fingerprint(state.matrix);
    if (!state.support || state.support.fingerprint !== fp || state.support.search !== state.search) state.support = { fingerprint: fp, search: state.search, values: {}, res: {}, bremer: null };
    return state.support;
  }
  const val = key => { const S = store(); if (!S.values[key]) S.values[key] = {}; return S.values[key]; };
  /* the prep of the search, without its constraints */
  function prepOf() { return Object.assign({}, state.search.prep || {}, { constraints: [] }); }
  const weightsOf = () => state.matrix.chars.map(c => (c.weight == null ? 1 : c.weight));

  /* ---------------- Bremer ---------------- */
  async function runBremer() {
    if (!ready()) return;
    clearMessages('b7Msg');
    const S = store(), s = state.search;
    const list = groups();
    if (!list.length) { showMessage('b7Msg', 'warning', T('El árbol de referencia no tiene grupos que medir.', 'The reference tree has no groups to measure.')); paintResults(); return; }
    const how = $('b7BMethod').value;
    const best = s.score, ref = s.trees[0].byChar, w = weightsOf();
    const n = A().taxa.length;
    const maxTime = Block3.maxTime();
    let job = null, cancelled = false;
    const done = await LABG.work.run({ title: T('Apoyo de Bremer', 'Bremer support'), cancel: () => { cancelled = true; if (job) job.cancel(); }, delay: 300 }, async wk => {
      if (how === 'subopt') {
        const k = Math.max(1, +$('b7K').value || 3);
        wk.update(0.03, T('Guardando los árboles hasta ', 'Keeping the trees up to ') + k + T(' pasos más largos…', ' steps longer…'));
        job = Pool.runOne({ task: 'suboptimal', matrix: state.matrix, prep: prepOf(), newicks: s.trees.map(t => t.newick), opts: { delta: k, maxTrees: Math.max(50, +$('b7Max').value || 2000) }, maxTime }, d => wk.update(Math.max(0.03, Math.min(0.95, d.f || 0))));
        const r = await job;
        list.forEach(gr => {
          const v = val(gr.key);
          const b = Support.bremerFromTrees(r.trees, r.best, gr.key);
          v.bremer = b == null ? k : b; v.bremerAbove = b == null; v.rfd = Support.rfdFromTrees(r.trees, ref, gr.key, w);
        });
        S.bremer = { method: 'subopt', k, kept: r.trees.length, overflow: r.overflow, best: r.best, improved: r.best < best - 1e-9 };
        return true;
      }
      /* one search without each group, several at a time */
      const reps = Math.max(1, +$('b7BReps').value || 5);
      const method = n <= 12 ? 'exact' : 'heuristic';
      let next = 0, finished = 0, lowest = best;
      const worker = async () => {
        while (next < list.length && !cancelled) {
          const gr = list[next++];
          const taxa = [];
          for (let i = 0; i < gr.key.length; i++) if (gr.key[i] === '1') taxa.push(i);
          const p = Pool.runOne({ task: 'search', matrix: state.matrix, prep: Object.assign(prepOf(), { constraints: [{ taxa, positive: false }] }), opts: { method, replicates: reps, maxTrees: 20, seed: 1 + next }, maxTime });
          job = p;
          const r = await p;
          const v = val(gr.key);
          v.bremer = r.score - best; v.bremerAbove = false;
          v.rfd = Support.rfdFromTrees(r.trees, ref, gr.key, w);
          lowest = Math.min(lowest, r.score);
          finished++;
          wk.update(finished / list.length, T(`${finished} de ${list.length} grupos`, `${finished} of ${list.length} groups`));
        }
      };
      await Promise.all(Array.from({ length: Math.min(Pool.threads(), list.length) }, worker));
      S.bremer = { method: 'constraint', reps, exact: method === 'exact', groups: list.length };
      if (lowest < best - 1e-9) S.bremer.improved = true;
      return !cancelled;
    });
    if (!done) return;
    if (S.bremer && S.bremer.improved) showMessage('b7Msg', 'warning', T('Sin algún grupo apareció un árbol MÁS CORTO que los del Bloque 3: la búsqueda no llegó al óptimo. Conviene repetirla con más réplicas; mientras tanto ese Bremer sale negativo.', 'Without some group a SHORTER tree than those of Block 3 turned up: the search did not reach the optimum. It should be repeated with more replicates; meanwhile that Bremer is negative.'));
    afterRun();
  }

  /* ---------------- resampling ---------------- */
  async function runResample() {
    if (!ready()) return;
    clearMessages('b7Msg');
    const S = store();
    const reps = Math.max(10, Math.min(10000, +$('b7Reps').value || 100));
    const p = rmethod === 'boot' ? null : Math.max(1, Math.min(80, +$('b7P').value || 36)) / 100;
    const kind = $('b7Search').value, n = A().taxa.length;
    const search = kind === 'exact' && n <= 12 ? { method: 'exact' } : { method: 'heuristic', replicates: kind === 'thorough' ? 10 : 2, maxTrees: 20 };
    let job = null;
    const name = RMETHODS.find(x => x.id === rmethod);
    const r = await LABG.work.run({ title: T(name.es, name.en) + T(` · ${reps} pseudorréplicas`, ` · ${reps} pseudoreplicates`), cancel: () => job && job.cancel(), delay: 300 }, async wk => {
      wk.update(0.02, T('Remuestreando…', 'Resampling…'));
      job = Pool.resample({ matrix: state.matrix, prep: prepOf(), opts: { method: rmethod, reps, p, seed: Math.max(1, +$('b7Seed').value || 1), search }, maxTime: Block3.maxTime() }, d => wk.update(Math.max(0.02, d.f || 0)));
      return job;
    });
    if (!r) return;
    S.res[rmethod] = { reps: r.reps, asked: reps, p, search, counts: r.counts, threads: r.threads };
    afterRun();
  }

  function afterRun() {
    enableStep(7, true);
    refreshStepMarks();
    paintShow();
    paintResults();
  }

  /* ---------------- results ---------------- */
  function available() {
    const S = state.support, out = [];
    if (!S) return out;
    if (S.bremer) { out.push(['bremer', T('Bremer', 'Bremer')]); out.push(['rfd', T('Bremer relativo', 'Relative Bremer')]); }
    RMETHODS.forEach(m => { if (S.res[m.id]) { out.push([m.id + '-f', T(m.es + ' · frecuencia', m.en + ' · frequency')]); out.push([m.id + '-gc', T(m.es + ' · GC', m.en + ' · GC')]); } });
    if (S.bremer && Object.keys(S.res).length) out.push(['combo', T('Bremer / GC del último remuestreo', 'Bremer / GC of the last resampling')]);
    return out;
  }
  function paintShow() {
    const list = available(), cur = $('b7Show').value;
    $('b7Show').innerHTML = list.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('');
    if (list.some(x => x[0] === cur)) $('b7Show').value = cur;
    else if (list.length) $('b7Show').value = list[list.length - 1][0].endsWith('-gc') ? list[list.length - 2][0] : list[0][0];
  }
  /* the value of a group for what is shown, as a number and as text */
  function valueOf(key, show) {
    const S = state.support, v = S.values[key] || {};
    const pct = x => (x == null ? '' : Math.round(x * 100));
    if (show === 'bremer') return v.bremer == null ? null : { x: v.bremer, t: (v.bremerAbove ? '>' : '') + fmtNum(v.bremer, 3), kind: 'bremer' };
    if (show === 'rfd') return v.rfd == null ? null : { x: v.rfd, t: String(pct(Math.max(0, v.rfd))), kind: 'freq' };
    if (show === 'combo') {
      const last = Object.keys(S.res).pop(), r = S.res[last];
      const fg = Support.freqGC(r.counts, r.reps, key);
      return { x: fg.gc, t: (v.bremer == null ? '?' : (v.bremerAbove ? '>' : '') + fmtNum(v.bremer, 3)) + '/' + pct(fg.gc), kind: 'freq' };
    }
    const [m, f] = show.split('-');
    const r = S.res[m];
    if (!r) return null;
    const fg = Support.freqGC(r.counts, r.reps, key);
    return f === 'gc' ? { x: fg.gc, t: String(pct(fg.gc)), kind: 'freq' } : { x: fg.freq, t: String(pct(fg.freq)), kind: 'freq' };
  }
  /* reading scale: four classes */
  const CLASSES = {
    freq: [[0.9, 'var(--st2)', ['≥ 90: fuerte', '≥ 90: strong']], [0.7, 'var(--st5)', ['70–89: bueno', '70–89: good']], [0.5, 'var(--st3)', ['50–69: débil', '50–69: weak']], [-Infinity, 'var(--st1)', ['< 50: sin apoyo', '< 50: unsupported']]],
    bremer: [[3, 'var(--st2)', ['≥ 3: fuerte', '≥ 3: strong']], [2, 'var(--st5)', ['2 a 3: bueno', '2 to 3: good']], [1, 'var(--st3)', ['1 a 2: débil', '1 to 2: weak']], [-Infinity, 'var(--st1)', ['< 1: sin apoyo', '< 1: unsupported']]],
  };
  const classOf = (kind, x) => CLASSES[kind].find(c => x >= c[0] - 1e-9);
  function paintResults() {
    const S = state.support;
    const has = S && (S.bremer || Object.keys(S.res).length);
    $('b7Results').hidden = !has;
    if (!has) return;
    const root = refRoot(), list = groups();
    const show = $('b7Show').value || (available()[0] || [])[0];
    /* tiles */
    const tiles = [[T('Grupos medidos', 'Groups measured'), String(list.length), T('del árbol de referencia', 'of the reference tree')]];
    if (S.bremer) {
      const bs = list.map(gr => (S.values[gr.key] || {}).bremer).filter(x => x != null);
      tiles.push([T('Bremer', 'Bremer'), bs.length ? fmtNum(Math.min(...bs), 3) + '–' + fmtNum(Math.max(...bs), 3) : '—', S.bremer.method === 'subopt' ? T(`con ${S.bremer.kept} árboles hasta ${S.bremer.k} pasos más`, `with ${S.bremer.kept} trees up to ${S.bremer.k} steps more`) + (S.bremer.overflow ? T(' (se llegó al máximo)', ' (the maximum was reached)') : '') : (S.bremer.exact ? T('búsqueda exacta sin cada grupo', 'exact search without each group') : T(`búsqueda sin cada grupo, ${S.bremer.reps} réplicas`, `search without each group, ${S.bremer.reps} replicates`)), S.bremer.improved ? 'warn' : null]);
    }
    RMETHODS.forEach(m => {
      const r = S.res[m.id];
      if (!r) return;
      const strong = list.filter(gr => Support.freqGC(r.counts, r.reps, gr.key).freq >= 0.5).length;
      tiles.push([T(m.es, m.en), `${strong} / ${list.length}`, T(`grupos ≥ 50 % en ${r.reps} pseudorréplicas`, `groups ≥ 50 % in ${r.reps} pseudoreplicates`) + (r.p != null ? ` · p = ${Math.round(r.p * 100)} %` : '')]);
    });
    statTiles('b7Tiles', tiles);
    /* the tree */
    const text = new Map(), color = new Map();
    let kind = 'freq';
    list.forEach(gr => {
      const v = valueOf(gr.key, show);
      if (!v) return;
      kind = v.kind;
      text.set(gr.node, v.t);
      const cl = classOf(v.kind, v.x);
      color.set(gr.node, cl[1]);
      /* with two branches at the root, both sides of the root branch are one group */
      if (gr.node.parent === root && root.children.length === 2) root.children.forEach(c => { if (c !== gr.node && c.children.length) { text.set(c, v.t); color.set(c, cl[1]); } });
    });
    $('b7Tree').innerHTML = Clado.render(root, { names: v => v.name, nodeText: text, paintColor: v => color.get(v) || null, paintLegend: CLASSES[kind].map(c => ({ color: c[1], label: T(...c[2]) })), rowH: 22, fontSize: 12, minUnit: 34, maxUnit: 48, ariaLabel: T('Árbol con el apoyo de cada grupo', 'Tree with the support of each group') });
    $('b7Scale').innerHTML = kind === 'bremer'
      ? T('Bremer: pasos que cuesta perder el grupo. Las ramas sin color son grupos sin valor calculado.', 'Bremer: steps that losing the group costs. Uncoloured branches are groups without a computed value.')
      : T('Valores en %. GC = frecuencia del grupo − frecuencia del grupo contradictorio más frecuente: negativo si algo lo contradice más de lo que aparece. Bremer relativo × 100.', 'Values in %. GC = frequency of the group − frequency of the most frequent contradicting group: negative if something contradicts it more than it appears. Relative Bremer × 100.');
    /* the table */
    const num = Block6 && Block6.numbered ? Block6.numbered(root) : new Map();
    const cols = [
      { key: 'n', label: T('Clado', 'Clade'), num: true, get: r => num.get(r.node) },
      { key: 'taxa', label: T('Taxones', 'Taxa'), html: true, get: r => { const t = g_tips(r.node); return `<i>${esc(t[0])}</i> … <i>${esc(t[t.length - 1])}</i> (${t.length})`; } },
    ];
    if (S.bremer) {
      cols.push({ key: 'b', label: 'Bremer', num: true, get: r => { const v = S.values[r.key] || {}; return v.bremer == null ? '—' : (v.bremerAbove ? '>' : '') + fmtNum(v.bremer, 3); } });
      cols.push({ key: 'rfd', label: T('Relativo', 'Relative'), num: true, get: r => { const v = S.values[r.key] || {}; return v.rfd == null ? '—' : fmtNum(Math.max(0, v.rfd), 3); } });
    }
    RMETHODS.forEach(m => {
      const res = S.res[m.id];
      if (!res) return;
      cols.push({ key: m.id, label: T(m.es, m.en) + ' %', num: true, get: r => { const f = Support.freqGC(res.counts, res.reps, r.key); return Math.round(f.freq * 100) + ' / ' + Math.round(f.gc * 100); } });
    });
    buildTable('b7Table', cols, list, { limit: 500 });
    $('b7Table').insertAdjacentHTML('beforeend', `<p class="hint" style="padding:6px 12px;margin:0">${T('Remuestreo: frecuencia / GC, en %. Los clados se numeran como en el Bloque 6, sobre el árbol de referencia: coinciden con los de allí cuando es el mismo árbol.', 'Resampling: frequency / GC, in %. Clades are numbered as in Block 6, on the reference tree: they match those there when it is the same tree.')}</p>`);
  }
  const g_tips = v => Tree.tips(v).map(t => t.name);

  /* ---------------- exports ---------------- */
  function exportNewick() {
    const root = Tree.clone(refRoot()), show = $('b7Show').value;
    const list = Support.cladesOf(root, A().taxa.length, r0());
    list.forEach(gr => { const v = valueOf(gr.key, show); if (v) gr.node.label = v.t; });
    download(Tree.toNewick(root, { labels: true }) + '\n', slug(state.matrix.title || 'matriz') + '_apoyo.nwk');
  }
  function exportCsv() {
    const S = state.support, list = groups();
    const head = [T('taxones', 'taxa'), 'bremer', T('bremer_relativo', 'relative_bremer')];
    RMETHODS.forEach(m => { if (S.res[m.id]) head.push(m.id + '_freq', m.id + '_gc'); });
    const rows = list.map(gr => {
      const v = S.values[gr.key] || {};
      const row = [g_tips(gr.node).join(' | '), v.bremer == null ? '' : (v.bremerAbove ? '>' : '') + v.bremer, v.rfd == null ? '' : Math.max(0, v.rfd).toFixed(4)];
      RMETHODS.forEach(m => { const r = S.res[m.id]; if (r) { const f = Support.freqGC(r.counts, r.reps, gr.key); row.push(f.freq.toFixed(4), f.gc.toFixed(4)); } });
      return row;
    });
    download([head].concat(rows).map(r => r.map(csvEscape).join(',')).join('\n') + '\n', slug(state.matrix.title || 'matriz') + '_apoyo.csv', 'text/csv;charset=utf-8');
  }

  /* ---------------- wiring ---------------- */
  function paintMethods() {
    $('b7Methods').innerHTML = RMETHODS.map(x => `<button type="button" class="design-tile${x.id === rmethod ? ' on' : ''}" data-r="${x.id}" aria-pressed="${x.id === rmethod}"><b>${L2(x.es, x.en)}</b><small>${L2(x.d[0], x.d[1])}</small></button>`).join('');
    const m = RMETHODS.find(x => x.id === rmethod);
    $('b7PF').hidden = m.p == null;
    if (m.p != null) $('b7P').value = m.p;
  }
  function paintHints() {
    const n = state.matrix ? A().taxa.length : 0;
    const sub = $('b7BMethod').value === 'subopt';
    $('b7KF').hidden = !sub; $('b7MaxF').hidden = !sub; $('b7RepsF').hidden = sub;
    $('b7BHint').innerHTML = sub ? T('Rápido, pero sólo ve los árboles que guarda: un grupo sin árbol que lo contradiga dentro de k pasos sale «> k».', 'Quick, but it only sees the trees it keeps: a group without a contradicting tree within k steps comes out «> k».')
      : (n <= 12 ? T(`Con ${n} taxones cada búsqueda sin el grupo es exacta (rama y cota): el Bremer es exacto.`, `With ${n} taxa each search without the group is exact (branch and bound): the Bremer is exact.`) : T('Cada grupo, una búsqueda heurística con la restricción de que el grupo NO exista. Más réplicas, más confianza.', 'Each group, a heuristic search constrained so that the group does NOT exist. More replicates, more confidence.'));
    $('b7RHint').innerHTML = T('En cada pseudorréplica cuenta el consenso estricto de los árboles que se encontraron. Con pocas pseudorréplicas las frecuencias varían de una corrida a otra; la misma semilla repite el resultado.', 'In each pseudoreplicate what counts is the strict consensus of the trees found. With few pseudoreplicates the frequencies vary from one run to another; the same seed repeats the result.');
  }
  function onShow() {
    const ok = ready();
    $('b7NoData').hidden = ok; $('b7Work').hidden = !ok;
    if (!ok) return;
    const s = state.search;
    statTiles('b7RefTiles', [
      [T('Árboles más cortos', 'Shortest trees'), String(s.trees.length), T('del Bloque 3', 'from Block 3')],
      [T('Longitud', 'Length'), fmtNum(s.length, 3), T('la referencia del Bremer', 'the Bremer reference')],
      [T('Grupos', 'Groups'), String(groups().length), T('del árbol de referencia', 'of the reference tree')],
    ]);
    paintMethods(); paintHints(); paintShow(); paintResults();
  }
  B7.onShow = onShow;
  function wire() {
    if (!$('panel-7')) return;
    $('b7GoSearch').addEventListener('click', () => goStep(3));
    $('b7Methods').addEventListener('click', e => { const b = e.target.closest('[data-r]'); if (!b) return; rmethod = b.dataset.r; paintMethods(); });
    $('b7BMethod').addEventListener('change', paintHints);
    $('b7RefSel').addEventListener('change', onShow);
    $('b7Show').addEventListener('change', paintResults);
    $('b7BRun').addEventListener('click', () => runBremer().catch(e => showMessage('b7Msg', 'error', T('El cálculo falló: ', 'The computation failed: ') + esc(e.message || String(e)))));
    $('b7RRun').addEventListener('click', () => runResample().catch(e => showMessage('b7Msg', 'error', T('El remuestreo falló: ', 'The resampling failed: ') + esc(e.message || String(e)))));
    $('b7ExpNwk').addEventListener('click', exportNewick);
    $('b7ExpCsv').addEventListener('click', exportCsv);
    document.addEventListener('stepchange', e => { if (e.detail.step === 7) onShow(); });
    document.addEventListener('matrixchange', () => { state.support = null; });
    document.addEventListener('searchdone', e => { if (e.detail && e.detail.block === 3) state.support = null; });
    document.addEventListener('langchange', () => { if ($('panel-7').classList.contains('active')) onShow(); });
  }
  document.addEventListener('DOMContentLoaded', wire);
  Object.assign(B7, { RMETHODS, valueOf, groups, refRoot, runBremer, runResample });
})();
