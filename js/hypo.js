/* CladisticsPro — morphological cladistics in the browser.
   Copyright (C) 2026  Luis Ángel Barrera-Guzmán

   This program is free software: you can redistribute it and/or modify it under
   the terms of the GNU General Public License as published by the Free Software
   Foundation, either version 3 of the License, or (at your option) any later
   version. It is distributed in the hope that it will be useful, but WITHOUT ANY
   WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
   A PARTICULAR PURPOSE. See the GNU General Public License, in the file LICENSE
   at the root of this program, or <https://www.gnu.org/licenses/>. */

/* CladisticsPro — testing a phylogenetic hypothesis under parsimony (Block 9).

   Two trees are compared character by character: d = steps on the tree of the
   hypothesis − steps on the shortest tree, weighted as the search weights.
   Three classic tests read those differences:

   · Templeton (1983): the Wilcoxon signed-ranks test on the characters that
     differ. Exact distribution when there are fewer than 50 of them and no
     ties or zeros; otherwise the normal approximation with the correction for
     ties and for continuity, as the usual statistical practice computes it.
   · Winning sites (Prager and Wilson 1988): how many characters prefer each
     tree, against a binomial with p = 1/2 (two-sided, by adding up the
     outcomes no more probable than the one seen).
   · Kishino and Hasegawa (1989), for parsimony: the mean difference over all
     the characters against zero, with Student's t on n − 1 degrees of freedom.

   The distributions (normal, Student's t, binomial, signed ranks) are written
   here from their definitions: the regularized incomplete beta function by
   its continued fraction, the complementary error function by the incomplete
   gamma function. Nothing here touches the DOM. */
function HypoCore(g) {
const H = {};

/* ---------------- special functions ---------------- */
function lgamma(x) {
  /* Lanczos approximation (g = 7, nine terms) */
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x);
  x -= 1;
  let a = c[0];
  const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}
H.lgamma = lgamma;
/* regularized lower incomplete gamma P(a, x) and its complement Q(a, x) */
function gammaPQ(a, x) {
  if (x <= 0) return { P: 0, Q: 1 };
  const gln = lgamma(a);
  if (x < a + 1) {
    let ap = a, sum = 1 / a, del = sum;
    for (let n = 0; n < 1000; n++) { ap += 1; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 1e-16) break; }
    const P = sum * Math.exp(-x + a * Math.log(x) - gln);
    return { P, Q: 1 - P };
  }
  /* continued fraction (modified Lentz) */
  let b = x + 1 - a, c = 1 / 1e-300, d = 1 / b, h = d;
  for (let i = 1; i < 1000; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300;
    c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-16) break;
  }
  const Q = Math.exp(-x + a * Math.log(x) - gln) * h;
  return { P: 1 - Q, Q };
}
/* standard normal: lower tail; precise in both tails through erfc = Q(1/2, z²/2·2) */
H.pnorm = function (z) {
  const q = gammaPQ(0.5, z * z / 2).Q / 2;   // P(Z > |z|)
  return z < 0 ? q : 1 - q;
};
H.pnormUpper = z => H.pnorm(-z);
/* regularized incomplete beta I_x(a, b) */
function betacf(a, b, x) {
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - qab * x / qap;
  if (Math.abs(d) < 1e-300) d = 1e-300;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 2000; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-300) d = 1e-300;
    c = 1 + aa / c; if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-300) d = 1e-300;
    c = 1 + aa / c; if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-16) break;
  }
  return h;
}
H.ibeta = function (x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b;
};
/* Student's t: P(T > t) for t ≥ 0 */
H.ptUpper = function (t, df) {
  const x = df / (df + t * t);
  const tail = H.ibeta(x, df / 2, 0.5) / 2;
  return t >= 0 ? tail : 1 - tail;
};

/* ---------------- the three tests ---------------- */
/* Wilcoxon signed ranks on d (zeros left out) */
H.wilcoxon = function (d) {
  const x = d.filter(v => Math.abs(v) > 1e-12);
  const zeros = x.length < d.length;
  const n = x.length;
  if (!n) return { n: 0, V: 0, p: 1, method: 'none' };
  /* mean ranks of |x| */
  const idx = x.map((v, i) => i).sort((a, b) => Math.abs(x[a]) - Math.abs(x[b]));
  const rank = new Float64Array(n);
  const tieSizes = [];
  for (let i = 0; i < n;) {
    let j = i;
    while (j + 1 < n && Math.abs(Math.abs(x[idx[j + 1]]) - Math.abs(x[idx[i]])) < 1e-12) j++;
    const r = (i + j + 2) / 2;
    for (let k = i; k <= j; k++) rank[idx[k]] = r;
    tieSizes.push(j - i + 1);
    i = j + 1;
  }
  let V = 0;
  for (let i = 0; i < n; i++) if (x[i] > 0) V += rank[i];
  const ties = tieSizes.some(t => t > 1);
  if (n < 50 && !ties && !zeros) {
    /* exact: the number of subsets of 1…n with each sum */
    const max = n * (n + 1) / 2;
    let cnt = new Float64Array(max + 1);
    cnt[0] = 1;
    for (let k = 1; k <= n; k++) for (let s = max; s >= k; s--) cnt[s] += cnt[s - k];
    const total = Math.pow(2, n);
    const cdf = v => { let a = 0; for (let s = 0; s <= Math.min(max, Math.floor(v)); s++) a += cnt[s]; return a / total; };
    const p1 = V > n * (n + 1) / 4 ? 1 - cdf(V - 1) : cdf(V);
    return { n, V, p: Math.min(1, 2 * p1), method: 'exact' };
  }
  const z0 = V - n * (n + 1) / 4;
  const sigma = Math.sqrt(n * (n + 1) * (2 * n + 1) / 24 - tieSizes.reduce((a, t) => a + (t * t * t - t), 0) / 48);
  const z = sigma > 0 ? (z0 - Math.sign(z0) * 0.5) / sigma : 0;
  const p = 2 * Math.min(H.pnorm(z), H.pnorm(-z));
  return { n, V, z, p: Math.min(1, p), method: 'normal' };
};
/* two-sided exact binomial test with p = 1/2 */
H.binomial = function (k, n) {
  if (n === 0) return { k, n, p: 1 };
  const lp = i => lgamma(n + 1) - lgamma(i + 1) - lgamma(n - i + 1) - n * Math.LN2;
  const dk = lp(k);
  let p = 0;
  for (let i = 0; i <= n; i++) { const di = lp(i); if (di <= dk + Math.log1p(1e-7)) p += Math.exp(di); }
  return { k, n, p: Math.min(1, p) };
};
/* one-sample t on the mean difference */
H.tMean = function (d) {
  const n = d.length;
  if (n < 2) return { n, t: 0, df: 0, p: 1 };
  const mean = d.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(d.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (n - 1));
  if (!(sd > 0)) return { n, mean, t: mean === 0 ? 0 : Infinity, df: n - 1, p: mean === 0 ? 1 : 0 };
  const t = mean / (sd / Math.sqrt(n));
  return { n, mean, sd, t, df: n - 1, p: Math.min(1, 2 * H.ptUpper(Math.abs(t), n - 1)) };
};
/* all three, from the steps by character of the two trees (objects j → steps)
   and the weights by character */
H.compare = function (best, hyp, w) {
  const d = [], rows = [];
  for (const j in best) {
    if (hyp[j] == null) continue;
    const wj = w ? (w[j] == null ? 1 : w[j]) : 1;
    const x = wj * (hyp[j] - best[j]);
    d.push(x);
    rows.push({ j: +j, best: best[j], hyp: hyp[j], d: x });
  }
  const plus = d.filter(x => x > 1e-12).length, minus = d.filter(x => x < -1e-12).length;
  return {
    rows, d,
    extra: d.reduce((a, b) => a + b, 0),
    favourBest: plus, favourHyp: minus,
    templeton: H.wilcoxon(d),
    winning: H.binomial(minus, plus + minus),
    kh: H.tMean(d),
  };
};

g.Hypo = H;
return H;
}
if (typeof window !== 'undefined') HypoCore(window);
