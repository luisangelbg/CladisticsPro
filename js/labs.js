/* CladisticsPro — morphological cladistics in the browser.
   Copyright (C) 2026  Luis Ángel Barrera-Guzmán

   This program is free software: you can redistribute it and/or modify it under
   the terms of the GNU General Public License as published by the Free Software
   Foundation, either version 3 of the License, or (at your option) any later
   version. It is distributed in the hope that it will be useful, but WITHOUT ANY
   WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
   A PARTICULAR PURPOSE. See the GNU General Public License, in the file LICENSE
   at the root of this program, or <https://www.gnu.org/licenses/>. */

/* CladisticsPro — the two labs of the home page.

   Nothing here is an animation. Lab 1 evaluates, at every click, the length of
   the fifteen possible trees of five taxa with the same optimization the app
   uses on real matrices, and draws the changes of the one you pick. Lab 2
   optimises one character on a fixed tree and shows that two shortest
   reconstructions can tell two different stories. */
(function () {
  /* ---------------- Lab 1 · counting steps ---------------- */
  const LAB1_TAXA = { es: ['Grupo externo', 'A', 'B', 'C', 'D'], en: ['Outgroup', 'A', 'B', 'C', 'D'] };
  const LAB1_CHARS = [
    { es: 'Hoja', en: 'Leaf', s: [['simple', 'simple'], ['compuesta', 'compound']] },
    { es: 'Simetría floral', en: 'Floral symmetry', s: [['radial', 'radial'], ['bilateral', 'bilateral']] },
    { es: 'Fruto', en: 'Fruit', s: [['seco', 'dry'], ['carnoso', 'fleshy']] },
    { es: 'Arilo de la semilla', en: 'Seed aril', s: [['ausente', 'absent'], ['presente', 'present']] },
    { es: 'Tricomas', en: 'Trichomes', s: [['ausentes', 'absent'], ['presentes', 'present']] },
    { es: 'Estípulas', en: 'Stipules', s: [['ausentes', 'absent'], ['presentes', 'present']] },
  ];
  const LAB1_DEFAULT = ['000000', '110001', '110000', '101100', '101111'];
  const lab1 = { M: LAB1_DEFAULT.slice(), sel: null, opt: 'acctran' };
  const cellMask = ch => ch === '0' ? 1 : ch === '1' ? 2 : 3;
  const taxaNames = () => LAB1_TAXA[I18N.lang === 'en' ? 'en' : 'es'];

  function lab1Matrix() {
    return {
      taxa: taxaNames(),
      chars: LAB1_CHARS.map(c => ({ name: T(c.es, c.en), states: ['0', '1'], type: 'unord' })),
      cells: lab1.M.map(row => [...row].map(cellMask)),
    };
  }
  function lab1Trees() {
    const trees = Tree.allTrees(5, taxaNames());
    const M = lab1Matrix();
    return trees.map((t, i) => {
      let L = 0;
      for (let c = 0; c < 6; c++) L += Opt.fitch(t, k => M.cells[k][c]);
      return { i, t, L };
    }).sort((a, b) => a.L - b.L || a.i - b.i);
  }
  function renderLab1() {
    const host = el('lab1');
    if (!host) return;
    const M = lab1Matrix();
    const ranked = lab1Trees();
    const best = ranked[0].L;
    const nBest = ranked.filter(r => r.L === best).length;
    if (lab1.sel == null || !ranked.some(r => r.i === lab1.sel)) lab1.sel = ranked[0].i;
    const chosen = ranked.find(r => r.i === lab1.sel);
    const A = Opt.analyse(chosen.t, M, { optimization: lab1.opt === 'deltran' ? 'deltran' : 'acctran', unambiguousOnly: lab1.opt === 'unamb' });
    /* the matrix: a button per cell */
    const head = '<tr><th scope="col">' + L2('Taxón', 'Taxon') + '</th>' + LAB1_CHARS.map((c, j) => {
      const r = A.per[j];
      const ci = r && r.ci != null ? r.ci : null;
      return `<th scope="col" class="c" title="${esc(T(c.es, c.en))}">${j + 1}<small class="lab-ci${ci === 1 ? ' ok' : ci != null ? ' hp' : ''}">${ci == null ? '—' : 'CI ' + ci.toFixed(2)}</small></th>`;
    }).join('') + '<th scope="col" class="c" title="' + esc(T('pasos en este árbol', 'steps on this tree')) + '">Σ</th></tr>';
    const body = lab1.M.map((row, i) => '<tr><th scope="row">' + esc(taxaNames()[i]) + '</th>' + [...row].map((ch, j) =>
      `<td class="c"><button type="button" class="lab-cell s${ch === '?' ? 'q' : ch}" data-i="${i}" data-j="${j}" aria-label="${esc(taxaNames()[i] + ' · ' + (j + 1) + ' ' + T(LAB1_CHARS[j].es, LAB1_CHARS[j].en) + ': ' + ch + ' (' + (ch === '?' ? T('desconocido', 'unknown') : T(LAB1_CHARS[j].s[+ch][0], LAB1_CHARS[j].s[+ch][1])) + ')')}">${ch}</button></td>`).join('') + '<td></td></tr>').join('');
    const stepsRow = '<tr class="lab-steps"><th scope="row">' + L2('en este árbol', 'on this tree') + '</th>' + A.per.map(r => `<td class="c"><b>${r.steps}</b></td>`).join('') + `<td class="c"><b>${A.length}</b></td></tr>`;
    el('lab1Matrix').innerHTML = `<table class="lab-matrix"><thead>${head}</thead><tbody>${body}${stepsRow}</tbody></table>`;
    el('lab1Legend').innerHTML = LAB1_CHARS.map((c, j) => `<li><b>${j + 1}</b> ${T(c.es, c.en)}: 0 = ${T(c.s[0][0], c.s[0][1])}, 1 = ${T(c.s[1][0], c.s[1][1])}</li>`).join('');
    /* the fifteen trees */
    /* the name of each button carries what the button shows, in the same order: its tips (as the tree in
       parentheses, which also tells apart trees of the same length) and its length */
    const tipName = v => v.tip === 0 ? T('GE', 'OG') : v.name;
    const nested = v => v.children.length ? '(' + v.children.map(nested).join(',') + ')' : tipName(v);
    el('lab1Trees').innerHTML = ranked.map(r => {
      const svg = Clado.render(r.t, { rowH: 15, treeWidth: 64, fontSize: 11, legend: false, stem: true, names: tipName });
      const cls = 'lab-tree' + (r.L === best ? ' best' : '') + (r.i === lab1.sel ? ' on' : '');
      return `<button type="button" class="${cls}" data-t="${r.i}" aria-pressed="${r.i === lab1.sel}" aria-label="${esc(T('Árbol ', 'Tree ') + nested(r.t) + ': ' + r.L + T(' pasos', ' steps'))}">${svg} <span class="lab-len">${r.L}</span></button>`;
    }).join('');
    /* the chosen tree, with its marks */
    const big = Clado.render(chosen.t, {
      marks: A.byNode, rowH: 34, fontSize: 14, minUnit: 46, stateLabel: (c, s) => String(s),
      legendUnique: T('única', 'unique'), legendHomo: T('homoplásica', 'homoplastic'), legendAmbig: T('ambigua', 'ambiguous'),
      showAmbig: lab1.opt !== 'unamb',
      ariaLabel: T('Cladograma elegido con los cambios de cada carácter', 'Chosen cladogram with the changes of every character'),
    });
    el('lab1Big').innerHTML = big;
    /* histogram of the fifteen lengths */
    const counts = new Map();
    ranked.forEach(r => counts.set(r.L, (counts.get(r.L) || 0) + 1));
    const Ls = [...counts.keys()].sort((a, b) => a - b);
    const maxC = Math.max(...counts.values());
    const bw = 22, hh = 70;
    let h = '';
    Ls.forEach((L, k) => {
      const c = counts.get(L), x = 20 + k * (bw + 6), bh = c / maxC * hh;
      h += `<rect x="${x}" y="${90 - bh}" width="${bw}" height="${bh}" rx="3" fill="${L === best ? 'var(--gold)' : 'var(--primary)'}" opacity="${L === best ? 1 : 0.55}"/>` +
        `<text x="${x + bw / 2}" y="${86 - bh}" text-anchor="middle" class="art-txt" font-size="9">${c}</text>` +
        `<text x="${x + bw / 2}" y="103" text-anchor="middle" class="art-mut" font-size="9">${L}</text>`;
    });
    const hw = 20 + Ls.length * (bw + 6) + 10;
    el('lab1Hist').innerHTML = `<svg viewBox="0 0 ${Math.max(hw, 140)} 112" width="${Math.max(hw, 140) * 1.25}" height="140" role="img" aria-label="${esc(T('Cuántos árboles hay de cada longitud', 'How many trees have each length'))}">${h}</svg>`;
    statTiles('lab1Tiles', [
      [T('Longitud', 'Length'), String(A.length), chosen.L === best ? T('de las más cortas', 'one of the shortest') : T('+' + (chosen.L - best) + ' sobre la mínima', '+' + (chosen.L - best) + ' over the minimum'), chosen.L === best ? 'ok' : 'warn'],
      ['CI', fmtIdx(A.ci), T('consistencia', 'consistency')],
      ['RI', fmtIdx(A.ri), T('retención', 'retention')],
      [T('Árboles más cortos', 'Shortest trees'), nBest + ' / 15', nBest > 1 ? T('empate: hará falta un consenso', 'a tie: a consensus will be needed') : T('uno solo', 'just one')],
    ]);
    const homo = A.per.filter(r => r.ci != null && r.ci < 1).map(r => r.c + 1);
    el('lab1Status').innerHTML = T(
      `De los 15 árboles posibles, <b>${nBest}</b> ${nBest === 1 ? 'es el más corto' : 'empatan como los más cortos'} con <b>${best} pasos</b>. ` +
      (homo.length ? `En el árbol elegido, ${homo.length === 1 ? 'el carácter' : 'los caracteres'} <b>${homo.join(', ')}</b> ${homo.length === 1 ? 'cambia' : 'cambian'} más de lo mínimo: eso es homoplasia. ` : 'En el árbol elegido ningún carácter cambia más de lo mínimo: no hay homoplasia. ') +
      'Haz clic en una celda para cambiarla (0 → 1 → ? → 0) y mira cómo se reordenan los árboles.',
      `Of the 15 possible trees, <b>${nBest}</b> ${nBest === 1 ? 'is the shortest' : 'tie as the shortest'} with <b>${best} steps</b>. ` +
      (homo.length ? `On the chosen tree, character${homo.length === 1 ? '' : 's'} <b>${homo.join(', ')}</b> change${homo.length === 1 ? 's' : ''} more than the minimum: that is homoplasy. ` : 'On the chosen tree no character changes more than the minimum: there is no homoplasy. ') +
      'Click a cell to change it (0 → 1 → ? → 0) and watch the trees reorder.');
  }
  function wireLab1() {
    const host = el('lab1');
    if (!host) return;
    host.addEventListener('click', e => {
      const cell = e.target.closest('.lab-cell');
      if (cell) {
        const i = +cell.dataset.i, j = +cell.dataset.j;
        const cur = lab1.M[i][j];
        const nxt = cur === '0' ? '1' : cur === '1' ? '?' : '0';
        lab1.M[i] = lab1.M[i].slice(0, j) + nxt + lab1.M[i].slice(j + 1);
        renderLab1();
        const again = host.querySelector(`.lab-cell[data-i="${i}"][data-j="${j}"]`);
        if (again) again.focus();
        return;
      }
      const tr = e.target.closest('.lab-tree');
      if (tr) { lab1.sel = +tr.dataset.t; renderLab1(); const b = host.querySelector(`.lab-tree[data-t="${lab1.sel}"]`); if (b) b.focus(); }
    });
    el('lab1Reset').addEventListener('click', () => { lab1.M = LAB1_DEFAULT.slice(); lab1.sel = null; renderLab1(); });
    el('lab1Random').addEventListener('click', () => {
      const r = rng((Date.now() >>> 0) ^ 0x5bd1e995);
      lab1.M = lab1.M.map((row, i) => i === 0 ? '000000' : [...row].map(() => (r() < 0.5 ? '0' : '1')).join(''));
      lab1.sel = null; renderLab1();
    });
    el('lab1Opt').addEventListener('change', e => { lab1.opt = e.target.value; renderLab1(); });
  }

  /* ---------------- Lab 2 · ACCTRAN against DELTRAN ---------------- */
  const LAB2_TREE = '(GE,(A,(B,(C,(D,(E,F))))));';
  const lab2 = { tips: ['0', '0', '1', '0', '1', '1', '1'] };
  function renderLab2() {
    const host = el('lab2');
    if (!host) return;
    const root = Tree.parseNewick(LAB2_TREE);
    const names = ['GE', 'A', 'B', 'C', 'D', 'E', 'F'];
    Tree.tips(root).forEach(v => { v.tip = names.indexOf(v.name); });
    const shown = k => (k === 0 ? T('GE', 'OG') : names[k]);
    const mask = k => cellMask(lab2.tips[k]);
    const cost = Opt.costMatrix('unord', 2);
    const r = Opt.character(root, mask, 2, cost);
    const draw = (rec, title) => {
      const marks = new Map();
      rec.changes.forEach(c => { if (!marks.has(c.node)) marks.set(c.node, []); marks.get(c.node).push({ c: 0, to: c.to, homoplastic: c.homoplastic, unambiguous: c.unambiguous }); });
      return Clado.render(root, {
        marks, paint: rec.states, rowH: 26, fontSize: 12, title, names: v => shown(v.tip),
        charLabel: () => "", stateLabel: (c, s) => String(s), legend: false, minUnit: 30,
      });
    };
    const describe = rec => {
      const gains = rec.changes.filter(c => c.to === 1).length, losses = rec.changes.filter(c => c.to === 0).length;
      return T(`${gains} ${gains === 1 ? 'ganancia' : 'ganancias'} y ${losses} ${losses === 1 ? 'pérdida' : 'pérdidas'}`,
        `${gains} gain${gains === 1 ? '' : 's'} and ${losses} loss${losses === 1 ? '' : 'es'}`);
    };
    el('lab2Acc').innerHTML = draw(r.acctran, 'ACCTRAN');
    el('lab2Del').innerHTML = draw(r.deltran, 'DELTRAN');
    el('lab2Mpr').innerHTML = Clado.render(root, {
      nodeSets: r.mpr, rowH: 26, fontSize: 12, legend: false, minUnit: 30, names: v => shown(v.tip),
      title: T('Conjuntos MPR', 'MPR sets'),
    });
    /* the tip toggles */
    el('lab2Tips').innerHTML = names.map((n, k) =>
      `<button type="button" class="lab-cell s${lab2.tips[k] === '?' ? 'q' : lab2.tips[k]}" data-k="${k}" aria-label="${esc(shown(k) + ': ' + lab2.tips[k] + (lab2.tips[k] === '?' ? ' (' + T('desconocido', 'unknown') + ')' : ''))}"><small>${esc(shown(k))}</small> ${lab2.tips[k]}</button>`).join('');
    const unamb = r.acctran.changes.filter(c => c.unambiguous).length;
    const same = r.acctran.changes.length === r.deltran.changes.length && unamb === r.acctran.changes.length;
    statTiles('lab2Tiles', [
      [T('Longitud', 'Length'), String(r.length), T('pasos, en las dos', 'steps, in both')],
      ['ACCTRAN', describe(r.acctran), T('cambios lo antes posible', 'changes as early as possible')],
      ['DELTRAN', describe(r.deltran), T('cambios lo más tarde posible', 'changes as late as possible')],
      [T('No ambiguos', 'Unambiguous'), String(unamb), same ? T('las dos coinciden', 'both agree') : T('el resto depende de la elección', 'the rest depends on the choice'), same ? 'ok' : 'warn'],
    ]);
    el('lab2Status').innerHTML = same
      ? T('Con estos estados, las dos reconstrucciones coinciden: cada cambio está donde tiene que estar y no hay ambigüedad.',
        'With these states both reconstructions agree: every change is where it has to be and there is no ambiguity.')
      : T('Las dos reconstrucciones miden lo mismo, pero no cuentan la misma historia. <b>ACCTRAN</b> adelanta el cambio y lo deshace después (reversión); <b>DELTRAN</b> lo retrasa y lo repite (paralelismo). Los nodos con dos colores en los <b>conjuntos MPR</b> son justo los que pueden estar en cualquiera de los dos estados. Por eso una sinapomorfía ambigua no debe venderse como segura.',
        'Both reconstructions are equally long, but they do not tell the same story. <b>ACCTRAN</b> brings the change forward and undoes it later (a reversal); <b>DELTRAN</b> delays it and repeats it (parallelism). The two-coloured nodes in the <b>MPR sets</b> are exactly those that can be in either state. That is why an ambiguous synapomorphy should not be sold as a sure one.');
  }
  function wireLab2() {
    const host = el('lab2');
    if (!host) return;
    host.addEventListener('click', e => {
      const b = e.target.closest('#lab2Tips .lab-cell');
      if (!b) return;
      const k = +b.dataset.k, cur = lab2.tips[k];
      lab2.tips[k] = cur === '0' ? '1' : cur === '1' ? '?' : '0';
      renderLab2();
      const again = host.querySelector(`#lab2Tips .lab-cell[data-k="${k}"]`);
      if (again) again.focus();
    });
    el('lab2Reset').addEventListener('click', () => { lab2.tips = ['0', '0', '1', '0', '1', '1', '1']; renderLab2(); });
  }

  function renderAll() { renderLab1(); renderLab2(); }
  /* the two tabs; arrows move between them, as in any tab list */
  function wireTabs() {
    const tabs = els('.lab-tab');
    const pick = t => {
      tabs.forEach(b => {
        const on = b === t;
        b.classList.toggle('on', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
        b.tabIndex = on ? 0 : -1;
        const p = el(b.dataset.lab);
        if (p) p.classList.toggle('on', on);
      });
    };
    tabs.forEach((b, i) => {
      b.tabIndex = b.classList.contains('on') ? 0 : -1;
      b.addEventListener('click', () => pick(b));
      b.addEventListener('keydown', e => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        const j = (i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
        pick(tabs[j]); tabs[j].focus(); e.preventDefault();
      });
    });
  }
  document.addEventListener('DOMContentLoaded', () => {
    wireTabs(); wireLab1(); wireLab2(); renderAll();
    document.addEventListener('langchange', renderAll);
  });
  window.Labs = { renderAll, lab1, lab2, lab1Trees, lab1Matrix };
})();
