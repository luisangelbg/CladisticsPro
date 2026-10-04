/* CladisticsPro — morphological cladistics in the browser.
   Copyright (C) 2026  Luis Ángel Barrera-Guzmán

   This program is free software: you can redistribute it and/or modify it under
   the terms of the GNU General Public License as published by the Free Software
   Foundation, either version 3 of the License, or (at your option) any later
   version. It is distributed in the hope that it will be useful, but WITHOUT ANY
   WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
   A PARTICULAR PURPOSE. See the GNU General Public License, in the file LICENSE
   at the root of this program, or <https://www.gnu.org/licenses/>. */

/* CladisticsPro — optimization of characters on a given cladogram.

   This is the module that answers «where did each change happen?». It is not
   the search engine (that one packs 32 characters per word and only counts);
   here every character is followed one by one, so that each change can be
   drawn on its branch, with its states, and classified.

   One general method serves every kind of discrete character: the
   cost-matrix optimization of Sankoff (1975). An unordered character is the
   matrix with 0 on the diagonal and 1 elsewhere (and then it gives exactly
   the lengths of Fitch 1971); an ordered one costs |i − j| (the Wagner
   characters of Farris 1970); a step matrix is whatever the user writes.

   For every node:
     g[v][s]  cost of the subtree below v if v is in state s (down pass)
     f[v][s]  cost of the whole tree if v is in state s (up pass, by rerooting)
   The most parsimonious reconstruction (MPR) set of a node is argmin f — the
   states it has in at least one shortest reconstruction.

   Two of those reconstructions are named, after Swofford and Maddison (1987):
     ACCTRAN  changes as close to the root as possible: favours a gain followed
              by a reversal over two independent gains;
     DELTRAN  changes as close to the tips as possible: favours parallelism.
   Both are built in preorder: given the state already chosen for the parent,
   the child takes a state that minimises (its subtree + the branch); when
   several tie, ACCTRAN takes one that differs from the parent and DELTRAN the
   parent's own. Every choice is optimal given the one above, so both are
   shortest reconstructions (the tests check that their length equals the
   down-pass length).

   A change is UNAMBIGUOUS when the same change (same branch, same states)
   occurs under both. Polymorphic cells are read as uncertainty (any of their
   states), «?» as any state.

   Validated against an independent implementation (validation/block1). */
function OptimizeCore(g) {
const Opt = {};
const INF = 1e15;

/* ---------------- cost matrices ---------------- */
Opt.costMatrix = function (type, k, custom) {
  const M = [];
  for (let i = 0; i < k; i++) {
    M.push(new Float64Array(k));
    for (let j = 0; j < k; j++) {
      if (type === 'ord') M[i][j] = Math.abs(i - j);
      else if (type === 'step') M[i][j] = custom && custom[i] && custom[i][j] != null ? +custom[i][j] : (i === j ? 0 : 1);
      else M[i][j] = i === j ? 0 : 1;
    }
  }
  return M;
};

/* bit helpers: a cell is a bit mask over the states */
Opt.bits = function (m) { const out = []; for (let s = 0; m; s++, m >>>= 1) if (m & 1) out.push(s); return out; };
Opt.popcount = function (m) { let c = 0; while (m) { m &= m - 1; c++; } return c; };

/* ---------------- one character on one tree ----------------
   root: a tree of tree.js; tipMask(i) → bit mask of taxon i; k states;
   cost: k×k matrix. Returns the down-pass length, the MPR sets and the two
   named reconstructions, each with its list of changes. */
Opt.character = function (root, tipMask, k, cost, opts) {
  opts = opts || {};
  const post = g.Tree.postorder(root);
  const N = post.length;
  const id = new Map(post.map((v, i) => [v, i]));
  const G = new Float64Array(N * k);
  /* down pass */
  for (let i = 0; i < N; i++) {
    const v = post[i], o = i * k;
    if (!v.children.length) {
      const m = v.tip >= 0 ? tipMask(v.tip) : 0;
      for (let s = 0; s < k; s++) G[o + s] = (m >>> s) & 1 ? 0 : INF;
      continue;
    }
    for (let s = 0; s < k; s++) {
      let tot = 0;
      for (const c of v.children) {
        const co = id.get(c) * k;
        let best = INF;
        for (let t = 0; t < k; t++) { const x = cost[s][t] + G[co + t]; if (x < best) best = x; }
        tot += best;
      }
      G[o + s] = Math.min(tot, INF);
    }
  }
  const ro = id.get(root) * k;
  let length = INF;
  for (let s = 0; s < k; s++) if (G[ro + s] < length) length = G[ro + s];
  /* light modes: the length alone (the down pass), or the two passes without
     the named reconstructions (what the indices and rule 1 need) */
  if (opts.lengthOnly) return { length, G, index: id };

  /* up pass: F[v][s] = cost of the whole tree with v in state s */
  const F = new Float64Array(N * k);
  for (let s = 0; s < k; s++) F[ro + s] = G[ro + s];
  const pre = g.Tree.preorder(root);
  for (const v of pre) {
    if (!v.children.length) continue;
    const vo = id.get(v) * k;
    for (const c of v.children) {
      const co = id.get(c) * k;
      /* what c contributes to G[v][s] */
      const contrib = new Float64Array(k);
      for (let s = 0; s < k; s++) {
        let best = INF;
        for (let t = 0; t < k; t++) { const x = cost[s][t] + G[co + t]; if (x < best) best = x; }
        contrib[s] = best;
      }
      for (let t = 0; t < k; t++) {
        let best = INF;
        for (let s = 0; s < k; s++) {
          const rest = F[vo + s] - contrib[s];
          const x = rest + cost[s][t];
          if (x < best) best = x;
        }
        F[co + t] = Math.min(best + G[co + t], INF);
      }
    }
  }
  if (opts.passesOnly) return { length, G, F, index: id };
  const mpr = new Map();
  for (const v of post) {
    const o = id.get(v) * k;
    let m = 0;
    for (let s = 0; s < k; s++) if (Math.abs(F[o + s] - length) < 1e-9) m |= 1 << s;
    mpr.set(v, m);
  }

  /* named reconstructions. The root may itself be ambiguous (several states
     give the shortest length); then the tie is broken towards the outgroup's
     state (the first child, when it is a tip) so the change goes into the
     ingroup, or else towards the lowest state. `forced` (or opts.rootState)
     picks one of the tied states explicitly; a state that is not optimal at
     the root is ignored. */
  const rootCandidates = [];
  for (let s = 0; s < k; s++) if (Math.abs(G[ro + s] - length) < 1e-9) rootCandidates.push(s);
  function build(kind, forced) {
    const st = new Map();
    const cand = rootCandidates;
    let rs = cand[0];
    const og = root.children[0];
    if (og && !og.children.length && og.tip >= 0) {
      const ogm = tipMask(og.tip);
      const pick = cand.find(s => (ogm >>> s) & 1);
      if (pick != null && Opt.popcount(ogm) < k) rs = pick;
    }
    if (forced != null && cand.includes(forced)) rs = forced;
    st.set(root, rs);
    for (const v of pre) {
      if (v === root) continue;
      const x = st.get(v.parent), o = id.get(v) * k;
      let best = INF;
      for (let t = 0; t < k; t++) { const y = G[o + t] + cost[x][t]; if (y < best) best = y; }
      const ties = [];
      for (let t = 0; t < k; t++) if (Math.abs(G[o + t] + cost[x][t] - best) < 1e-9) ties.push(t);
      let pickT;
      if (kind === 'acctran') pickT = ties.find(t => t !== x); else pickT = ties.find(t => t === x);
      if (pickT == null) pickT = ties[0];
      st.set(v, pickT);
    }
    const changes = [];
    let steps = 0;
    for (const v of pre) {
      if (v === root) continue;
      const a = st.get(v.parent), b = st.get(v);
      if (a !== b) { changes.push({ node: v, from: a, to: b, cost: cost[a][b] }); steps += cost[a][b]; }
    }
    /* how many times each state arises: once at the root for its state, once
       more for every change into it. A change into a state that arises more
       than once is homoplastic (a parallelism, a convergence or a reversal). */
    const arises = new Int32Array(k);
    arises[rs]++;
    changes.forEach(c => arises[c.to]++);
    changes.forEach(c => { c.homoplastic = arises[c.to] > 1; });
    return { states: st, changes, steps, rootState: rs };
  }
  const acctran = build('acctran', opts.rootState);
  const deltran = build('deltran', opts.rootState);
  const key = c => id.get(c.node) + ':' + c.from + '>' + c.to;
  const inD = new Set(deltran.changes.map(key));
  const inA = new Set(acctran.changes.map(key));
  acctran.changes.forEach(c => { c.unambiguous = inD.has(key(c)); });
  deltran.changes.forEach(c => { c.unambiguous = inA.has(key(c)); });
  return { length, mpr, acctran, deltran, G, F, index: id, rootCandidates, reconstruct: build };
};

/* ---------------- bounds for the indices ----------------
   m: the fewest steps the character can take on any tree;
   g: the steps it takes on the bush (a star with every taxon on the root),
      the most it can need on any tree (Farris 1989).
   Polymorphic and missing cells are read as uncertainty, as in the
   optimization, so m and g are the bounds the optimization can reach. */
Opt.minSteps = function (masks, k, type, cost) {
  const ms = masks.filter(m => m && Opt.popcount(m) < k);
  if (!ms.length) return 0;
  if (type === 'ord') {
    /* the narrowest window [a, b] of states that meets every cell */
    let best = INF;
    for (let a = 0; a < k; a++) for (let b = a; b < k; b++) {
      const w = ((1 << (b + 1)) - 1) ^ ((1 << a) - 1);
      if (ms.every(m => m & w)) { if (b - a < best) best = b - a; break; }
    }
    return best;
  }
  if (type === 'step') return Opt.minStepsSteiner(ms, k, cost);
  /* unordered: the fewest states that meet every cell, minus one */
  if (k > 16) {   /* greedy cover; exact search would be too long and k > 16 never happens in practice */
    let left = ms.slice(), used = 0;
    while (left.length) {
      let bs = 0, bc = -1;
      for (let s = 0; s < k; s++) { const c = left.filter(m => (m >>> s) & 1).length; if (c > bc) { bc = c; bs = s; } }
      used++; left = left.filter(m => !((m >>> bs) & 1));
    }
    return used - 1;
  }
  for (let size = 1; size <= k; size++) {
    /* every subset of states of this size */
    const comb = [];
    const rec = (start, depth, mask) => {
      if (depth === size) { comb.push(mask); return; }
      for (let s = start; s < k; s++) rec(s + 1, depth + 1, mask | (1 << s));
    };
    rec(0, 0, 0);
    if (comb.some(c => ms.every(m => m & c))) return size - 1;
  }
  return k - 1;
};
/* Step matrices: the minimum is the cheapest tree that connects the observed
   states with arbitrary costs — a Steiner arborescence. Solved exactly by
   dynamic programming over subsets of the observed states (Dreyfus and
   Wagner 1971), with costs first closed under shortest paths. Cells with
   several states choose the cheapest of them. Practical for k ≤ 12. */
Opt.minStepsSteiner = function (ms, k, cost) {
  const D = [];
  for (let i = 0; i < k; i++) { D.push(Float64Array.from(cost[i])); }
  for (let m = 0; m < k; m++) for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) if (D[i][m] + D[m][j] < D[i][j]) D[i][j] = D[i][m] + D[m][j];
  /* terminals: the distinct cells */
  const terms = [...new Set(ms)];
  const T = terms.length;
  if (T > 12) return null;
  /* cost of reaching a cell from state v: the cheapest of its states */
  const reach = terms.map(m => { const r = new Float64Array(k); for (let v = 0; v < k; v++) { let b = INF; for (let s = 0; s < k; s++) if ((m >>> s) & 1) b = Math.min(b, D[v][s]); r[v] = b; } return r; });
  const full = (1 << T) - 1;
  const S = Array.from({ length: full + 1 }, () => new Float64Array(k).fill(INF));
  for (let t = 0; t < T; t++) for (let v = 0; v < k; v++) S[1 << t][v] = reach[t][v];
  for (let sub = 1; sub <= full; sub++) {
    if (!(sub & (sub - 1))) continue;
    const row = S[sub];
    for (let v = 0; v < k; v++) {
      for (let a = (sub - 1) & sub; a > 0; a = (a - 1) & sub) {
        const x = S[a][v] + S[sub ^ a][v];
        if (x < row[v]) row[v] = x;
      }
    }
    /* relax along the (directed) costs: the subtree may hang from another state */
    for (let it = 0; it < k; it++) {
      let changed = false;
      for (let u = 0; u < k; u++) for (let v = 0; v < k; v++) {
        const x = D[u][v] + row[v];
        if (x < row[u] - 1e-12) { row[u] = x; changed = true; }
      }
      if (!changed) break;
    }
  }
  let best = INF;
  for (let v = 0; v < k; v++) best = Math.min(best, S[full][v]);
  return best;
};
Opt.maxSteps = function (masks, k, cost) {
  let best = INF;
  for (let s = 0; s < k; s++) {
    let tot = 0;
    for (const m of masks) {
      if (!m) continue;
      let b = INF;
      for (let t = 0; t < k; t++) if ((m >>> t) & 1) b = Math.min(b, cost[s][t]);
      tot += b;
    }
    best = Math.min(best, tot);
  }
  return best;
};

/* ---------------- a whole matrix on one tree ----------------
   matrix: { taxa, chars: [{ name, states, type, weight, active, cost }],
             cells: taxon × character bit masks }
   Returns, per character, its steps, bounds, CI, RI and the reconstruction;
   per branch, the list of changes; and the ensemble indices of Kluge and
   Farris (1969) and Farris (1989). */
Opt.analyse = function (root, matrix, opts) {
  opts = opts || {};
  const kind = opts.optimization || 'acctran';
  const per = [];
  const byNode = new Map();
  let len = 0, wlen = 0, sumM = 0, sumS = 0, sumG = 0;
  let sumMi = 0, sumSi = 0, sumGi = 0;   // informative characters only
  matrix.chars.forEach((ch, c) => {
    if (ch.active === false) return;
    const k = Math.max(2, ch.states ? ch.states.length : 2);
    const cost = ch.costM || Opt.costMatrix(ch.type, k, ch.cost);
    const masks = matrix.cells.map(row => row[c]);
    const r = Opt.character(root, i => matrix.cells[i][c], k, cost);
    const m = Opt.minSteps(masks, k, ch.type, cost);
    const gmax = Opt.maxSteps(masks, k, cost);
    const s = r.length;
    const w = ch.weight == null ? 1 : ch.weight;
    const informative = gmax > m;
    const ci = s > 0 ? m / s : null;
    const ri = gmax > m ? (gmax - s) / (gmax - m) : null;
    const rec = kind === 'deltran' ? r.deltran : r.acctran;
    const other = kind === 'deltran' ? r.acctran : r.deltran;
    per.push({ c, name: ch.name, steps: s, min: m, max: gmax, ci, ri, rc: ci != null && ri != null ? ci * ri : null,
      weight: w, informative, reconstruction: rec, other, mpr: r.mpr });
    rec.changes.forEach(ch2 => {
      if (opts.unambiguousOnly && !ch2.unambiguous) return;
      if (!byNode.has(ch2.node)) byNode.set(ch2.node, []);
      byNode.get(ch2.node).push(Object.assign({ c }, ch2));
    });
    len += s; wlen += s * w;
    sumM += m; sumS += s; sumG += gmax;
    if (informative) { sumMi += m; sumSi += s; sumGi += gmax; }
  });
  const ci = sumS > 0 ? sumM / sumS : null;
  const ri = sumG > sumM ? (sumG - sumS) / (sumG - sumM) : null;
  const ciInf = sumSi > 0 ? sumMi / sumSi : null;
  return {
    length: len, weighted: wlen, per, byNode,
    ci, ri, rc: ci != null && ri != null ? ci * ri : null, hi: ci != null ? 1 - ci : null,
    ciInformative: ciInf,
    sums: { min: sumM, steps: sumS, max: sumG },
  };
};

/* Which branches can measure zero (Coddington and Scharff 1994, rule 1): a
   branch is collapsed when, for every character, some most parsimonious
   reconstruction puts no change on it. For a character, the branch above v
   (parent u) can be zero exactly when min over s of
   [cost of the rest of the tree with u = s] + [cost of v's subtree with v = s]
   equals the length of the character — the cost-matrix passes give both
   terms. Returns the set of nodes whose parent branch can be zero.
   The two branches that leave a binary root are one branch of the unrooted
   tree (the root only marks where the outgroup is): they are judged together.
   That branch can be zero when, for every character, both children can take
   the same state at no extra cost; then both collapse (a root polytomy). If a
   child of the root is a terminal, that branch is terminal and neither does. */
Opt.zeroBranches = function (root, matrix) {
  const pre = g.Tree.preorder(root).filter(v => v !== root);
  const ok = new Set(pre.filter(v => v.children.length));   // only internal branches are collapsed
  const pair = root.children.length === 2 ? root.children : null;
  let rootZero = !!pair && pair.every(v => v.children.length > 0);
  if (pair) pair.forEach(v => ok.delete(v));
  matrix.chars.forEach((ch, c) => {
    if (ch.active === false || (!ok.size && !rootZero)) return;
    const k = Math.max(2, ch.states ? ch.states.length : 2);
    const cost = ch.costM || Opt.costMatrix(ch.type, k, ch.cost);
    const r = Opt.character(root, i => matrix.cells[i][c], k, cost, { passesOnly: true });
    const id = r.index, G = r.G, F = r.F;
    if (rootZero) {
      const ao = id.get(pair[0]) * k, bo = id.get(pair[1]) * k;
      let best = Infinity;
      for (let s = 0; s < k; s++) best = Math.min(best, G[ao + s] + G[bo + s]);
      if (best > r.length + 1e-9) rootZero = false;
    }
    for (const v of [...ok]) {
      const u = v.parent, vo = id.get(v) * k, uo = id.get(u) * k;
      let best = Infinity;
      for (let s = 0; s < k; s++) {
        let contrib = Infinity;
        for (let t = 0; t < k; t++) contrib = Math.min(contrib, cost[s][t] + G[vo + t]);
        best = Math.min(best, F[uo + s] - contrib + G[vo + s]);
      }
      if (best > r.length + 1e-9) ok.delete(v);
    }
  });
  if (rootZero) pair.forEach(v => ok.add(v));
  return ok;
};
/* a copy of the tree with the branches that can be zero collapsed */
Opt.collapse = function (root, matrix) {
  const copy = g.Tree.clone(root);
  const zero = Opt.zeroBranches(copy, matrix);
  g.Tree.postorder(copy).forEach(v => {
    if (!zero.has(v)) return;
    const p = v.parent, k = p.children.indexOf(v);
    p.children.splice(k, 1, ...v.children);
    v.children.forEach(c => { c.parent = p; });
  });
  return copy;
};

/* Plain Fitch length of one character, the 1971 down pass. Kept on its own
   because the labs evaluate hundreds of trees per keystroke and it is the
   reference the cost-matrix pass must reproduce for unordered characters.
   Binary trees only: on a polytomy the pairwise pass measures one of its
   resolutions, not the polytomy itself; Opt.character treats a polytomy as
   a hard one (every child branch can change). */
Opt.fitch = function (root, tipMask) {
  let steps = 0;
  const set = new Map();
  for (const v of g.Tree.postorder(root)) {
    if (!v.children.length) { set.set(v, v.tip >= 0 ? tipMask(v.tip) : 0); continue; }
    let cur = set.get(v.children[0]);
    for (let i = 1; i < v.children.length; i++) {
      const o = set.get(v.children[i]);
      const x = cur & o;
      if (x) cur = x; else { cur |= o; steps++; }
    }
    set.set(v, cur);
  }
  return steps;
};

g.Opt = Opt;
return Opt;
}
if (typeof window !== 'undefined') OptimizeCore(window);
