/* CladisticsPro — morphological cladistics in the browser.
   Copyright (C) 2026  Luis Ángel Barrera-Guzmán

   This program is free software: you can redistribute it and/or modify it under
   the terms of the GNU General Public License as published by the Free Software
   Foundation, either version 3 of the License, or (at your option) any later
   version. It is distributed in the hope that it will be useful, but WITHOUT ANY
   WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
   A PARTICULAR PURPOSE. See the GNU General Public License, in the file LICENSE
   at the root of this program, or <https://www.gnu.org/licenses/>. */

/* CladisticsPro — the arithmetic of branch support (Block 7).

   A group is written as a string of 0/1 over the active taxa: the side of the
   branch without the first outgroup taxon, the same on every tree rooted on
   the outgroup (engine.js E.groupKeys). On a cladogram, the outgroup clade
   and the ingroup are two sides of one branch: one group.

   · Bremer support (Bremer 1988, 1994): how many steps longer the shortest
     tree WITHOUT the group is.
   · Relative Bremer support, the relative fit difference (Goloboff and Farris
     2001): for a tree without the group, F is what the characters lose there
     (steps in favour of the group) and C what they gain (steps against it);
     RFD = (F − C)/F, the least over the trees without the group that were kept.
     When F = 0 it is 0: nothing favours the group.
   · Resampling frequencies and GC, «group present / contradicted» (Goloboff et
     al. 2003): the frequency of the group minus that of the most frequent
     group that contradicts it. Nothing here touches the DOM. */
function SupportCore(g) {
const S = {};

/* the group of a node of a cladogram (its taxa as 0/1), as a group key */
S.keyOfClade = function (cladeKey, r0) {
  if (cladeKey[r0] !== '1') return cladeKey;
  let s = '';
  for (let i = 0; i < cladeKey.length; i++) s += cladeKey[i] === '1' ? '0' : '1';
  return s;
};
const size = k => { let c = 0; for (let i = 0; i < k.length; i++) if (k[i] === '1') c++; return c; };
S.size = size;
/* groups of a tree to support: one per internal branch, without the trivial ones */
S.cladesOf = function (root, n, r0) {
  const out = [], seen = new Map();
  g.Tree.preorder(root).forEach(v => {
    if (!v.children.length || v === root) return;
    const a = new Array(n).fill('0');
    g.Tree.tips(v).forEach(t => { if (t.tip >= 0) a[t.tip] = '1'; });
    const raw = a.join('');
    const key = S.keyOfClade(raw, r0);
    const k = size(key);
    if (k < 2 || k > n - 2) return;
    /* the two sides of the root branch are one group: it goes on the side
       without the outgroup's first taxon (the ingroup) */
    if (seen.has(key)) { if (raw === key) seen.get(key).node = v; return; }
    const item = { node: v, key };
    seen.set(key, item);
    out.push(item);
  });
  return out;
};
/* two groups (both without r0) fit in one tree when one holds the other or
   they share nothing */
S.compatible = function (a, b) {
  let ab = false, aNotB = false, bNotA = false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] === '1', y = b[i] === '1';
    if (x && y) ab = true; else if (x) aNotB = true; else if (y) bNotA = true;
    if (ab && aNotB && bNotA) return false;
  }
  return true;
};
/* frequency and GC of a group from the counts of the replicates */
S.freqGC = function (counts, reps, key) {
  const f = (counts[key] || 0) / reps;
  let contra = 0;
  for (const k in counts) if (k !== key && counts[k] > 0 && !S.compatible(k, key)) contra = Math.max(contra, counts[k] / reps);
  return { freq: f, gc: f - contra, contra };
};
/* Bremer from a set of trees with their scores and groups */
S.bremerFromTrees = function (trees, best, key) {
  let low = Infinity;
  trees.forEach(t => { if (!t.keys.includes(key) && t.score < low) low = t.score; });
  return low === Infinity ? null : low - best;
};
/* relative fit difference of one tree without the group against the
   reference: byChar are the steps by character of the matrix, w the weights */
S.rfd = function (ref, other, w) {
  let F = 0, C = 0;
  for (const j in ref) {
    const wj = w ? (w[j] == null ? 1 : w[j]) : 1;
    const d = (other[j] == null ? ref[j] : other[j]) - ref[j];
    if (d > 0) F += wj * d; else C -= wj * d;
  }
  return F > 0 ? (F - C) / F : 0;
};
S.rfdFromTrees = function (trees, ref, key, w) {
  let low = Infinity;
  trees.forEach(t => { if (!t.keys.includes(key)) low = Math.min(low, S.rfd(ref, t.byChar, w)); });
  return low === Infinity ? null : low;
};

g.Support = S;
return S;
}
if (typeof window !== 'undefined') SupportCore(window);
