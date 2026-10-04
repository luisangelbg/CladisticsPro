/* CladisticsPro — Copyright (C) 2026 Luis Ángel Barrera-Guzmán.
   Free software under the GNU General Public License, version 3 or later; see LICENSE. */

/* Unit tests for Block 9: the distributions and the three tests of hypo.js,
   and the cost of a group with the searches under constraint. */
sec('28 · Las pruebas de hipótesis (hypo.js)');
{
  const near = (a, b, e) => Math.abs(a - b) <= (e || 1e-9);
  t('normal: Φ(1.96) = 0.975002 y Φ(−3) = 0.0013499', near(Hypo.pnorm(1.96), 0.9750021048517795, 1e-12) && near(Hypo.pnorm(-3), 0.0013498980316301, 1e-14));
  t('t de Student: P(T > 2.228139) con 10 g.l. = 0.025', near(Hypo.ptUpper(2.2281388519649385, 10), 0.025, 1e-10));
  const w = Hypo.wilcoxon([1, 2, 3, 4, 5]);
  t('Wilcoxon exacta: cinco diferencias positivas, V = 15 y p = 2/32', w.method === 'exact' && w.V === 15 && near(w.p, 0.0625));
  const w0 = Hypo.wilcoxon([0, 0, 0]);
  t('Wilcoxon sin diferencias: p = 1', w0.n === 0 && w0.p === 1);
  const wt = Hypo.wilcoxon([1, 1, 1, -1, 2, 0, 3]);
  t('Wilcoxon con empates y ceros pasa a la normal', wt.method === 'normal' && wt.n === 6 && wt.p > 0 && wt.p < 1);
  t('binomial: 0 de 5 → p = 2/32; 2 de 4 → p = 1', near(Hypo.binomial(0, 5).p, 0.0625) && near(Hypo.binomial(2, 4).p, 1));
  const tt = Hypo.tMean([1, 2, 3, 4, 5]);
  t('t de la diferencia media de 1…5: t = 4.2426 con 4 g.l., p = 0.01324', near(tt.t, 3 / Math.sqrt(2.5 / 5), 1e-12) && tt.df === 4 && near(tt.p, 0.013236, 1e-5), tt.p);
  const c = Hypo.compare({ 0: 1, 1: 2, 2: 1 }, { 0: 2, 1: 1, 2: 1 }, { 0: 2 });
  t('la comparación pondera cada carácter y cuenta a quién prefiere', c.extra === 1 && c.favourBest === 1 && c.favourHyp === 1 && c.d.join() === '2,-1,0');
}

sec('29 · El costo de un grupo (búsqueda con restricción)');
{
  const m = exM('bursera');
  const best = E.search(m, {}, { method: 'exact' });
  const P = E.prepare(m, {});
  /* a group that is in the shortest trees and one that is not */
  const k1 = best.trees[0].keys.find(k => [...k].filter(x => x === '1').length >= 2 && best.trees.every(tr => tr.keys.includes(k)));
  const taxa = [...k1].map((x, i) => (x === '1' ? i : -1)).filter(i => i >= 0);
  const withG = E.search(m, { constraints: [{ taxa, positive: true }] }, { method: 'exact' });
  const without = E.search(m, { constraints: [{ taxa, positive: false }] }, { method: 'exact' });
  t('con un grupo de los árboles más cortos la longitud no cambia', near2(withG.score, best.score));
  t('sin ese grupo cuesta pasos (el mejor sin él es más largo)', without.score > best.score && without.trees.every(x => !x.keys.includes(k1)), without.score + ' > ' + best.score);
  /* for any group, the shortest tree either has it or not */
  const other = [0, P.n - 1].concat(P.n > 4 ? [2] : []);
  const a = E.search(m, { constraints: [{ taxa: other, positive: true }] }, { method: 'exact' }).score;
  const b = E.search(m, { constraints: [{ taxa: other, positive: false }] }, { method: 'exact' }).score;
  t('para cualquier grupo, el más corto de «con» y «sin» es el árbol más corto', near2(Math.min(a, b), best.score), `${a} · ${b} · ${best.score}`);
  const wts = {}; m.chars.forEach((ch, j) => { wts[j] = ch.weight == null ? 1 : ch.weight; });
  const cmp = Hypo.compare(best.trees[0].byChar, without.trees[0].byChar, wts);
  t('la suma de las diferencias por carácter es la diferencia de longitud', near2(cmp.extra, without.score - best.score));
  t('el Bloque 9 está listo', STEPS[8].ready === true);
  function near2(x, y) { return Math.abs(x - y) < 1e-9; }
}
