/* CladisticsPro — morphological cladistics in the browser.
   Copyright (C) 2026  Luis Ángel Barrera-Guzmán

   This program is free software: you can redistribute it and/or modify it under
   the terms of the GNU General Public License as published by the Free Software
   Foundation, either version 3 of the License, or (at your option) any later
   version. It is distributed in the hope that it will be useful, but WITHOUT ANY
   WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
   A PARTICULAR PURPOSE. See the GNU General Public License, in the file LICENSE
   at the root of this program, or <https://www.gnu.org/licenses/>. */

/* CladisticsPro — the search engine: how long is a tree, and which trees are
   the shortest.

   THE DATA, PACKED. Unordered characters are kept «vertically»: for every node
   and every state s a strip of bits with one bit per character, 32 characters
   per machine word, so that one Fitch step (Fitch 1971) treats 32 characters at
   once. Characters with the same number of states share a block. Integer weights
   are kept as slices of bits (a weight 5 = 4 + 1 is two masks), so a weighted
   count is a few popcounts. Ordered characters enter as their additive binary
   coding (Farris, Kluge and Eckardt 1970): a character of k ordered states is
   exactly k − 1 binary characters. Continuous characters are intervals,
   optimized as additive (Farris 1970; Goloboff, Mattoni and Quinteros 2006).
   Step matrices (Sankoff 1975) and characters with inapplicable entries read
   by the algorithm of Brazeau, Guillerme and Smith (2019) are «slow»
   characters: they are optimized one by one on the rooted tree.

   THE SHORTCUT. To evaluate a rearrangement the tree is not rebuilt. Cutting an
   edge leaves two subtrees A and B whose lengths do not depend on where they are
   rooted; with the «edge set» of every edge of each side (Fitch's set of the
   tree rooted on that edge), the length of the tree that joins edge e of A with
   edge f of B is L(A) + L(B) + the characters whose edge sets are disjoint
   (Goloboff 1996). The same holds for the intervals of additive characters.
   Slow characters are re-optimized only for the rearrangements that pass that
   filter.

   CRITERIA. Equal or prior weights (fewest weighted steps), or implied weights
   (Goloboff 1993): minimize Σ w·h/(h + k), with h the extra steps of each
   character; extended implied weights (Goloboff 2014) give each character with
   missing entries its own concavity k/f, f = 1 + r·(t − o)/o (at most M), and
   rescale it so its first step costs as much as under k.

   Trees are unrooted and stored as neighbour lists: tips 0 … n−1 (the active
   taxa in matrix order), internal nodes n … 2n−3, three neighbours each.

   Wrapped in a named function so that a Web Worker can be built from its own
   source text. Nothing here touches the DOM. */
function EngineCore(g) {
const E = {};
const MISS = -1, GAP = -2, UNC = 1 << 30, MASK = UNC - 1;
const BIG = 1e300;
function popcount(v) {
  v = v - ((v >>> 1) & 0x55555555);
  v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
  return Math.imul((v + (v >>> 4)) & 0x0F0F0F0F, 0x01010101) >>> 24;
}
function bits(m) { const o = []; for (let s = 0; m; s++, m >>>= 1) if (m & 1) o.push(s); return o; }
function ctz(v) { return 31 - Math.clz32(v & -v); }

/* ================================================================
   1 · preparation
   ================================================================ */
/* m: the matrix of matrix.js. o: { inapplicable: 'missing' | 'algorithm',
   continuous: 'scaled' | 'raw' | 'off', weights: [by character] (overrides),
   criterion: 'ew' | 'iw' | 'eiw', k, eiwRatio, eiwMax, constraints } */
E.prepare = function (m, o) {
  o = o || {};
  const rows = [];
  m.taxa.forEach((t, i) => { if (t.active !== false) rows.push(i); });
  const n = rows.length;
  if (n < 3) throw new Error('hacen falta al menos tres taxones activos');
  const P = { n, rows, names: rows.map(i => m.taxa[i].name), chars: [], blocks: [], slow: [], cont: null, opts: o };
  P.outgroup = rows.map((i, q) => (m.taxa[i].outgroup ? q : -1)).filter(q => q >= 0);
  if (!P.outgroup.length) P.outgroup = [0];
  const inapAlg = o.inapplicable === 'algorithm';
  const contMode = o.continuous || 'scaled';
  const fastComps = [];   // { S, w, q, tipSet(i) }
  const contChars = [];
  m.chars.forEach((c, j) => {
    if (c.active === false) return;
    const w0 = o.weights ? o.weights[j] : (c.weight == null ? 1 : c.weight);
    /* discrete characters count whole steps: their weights are whole numbers */
    const w = c.type === 'cont' ? w0 : Math.round(w0);
    if (!(w > 0)) return;
    const col = rows.map(i => m.cells[i][j]);
    if (c.type === 'cont') {
      if (contMode === 'off') return;
      const vals = col.filter(Array.isArray);
      if (vals.length < 2) return;
      let lo = Infinity, hi = -Infinity;
      vals.forEach(v => { lo = Math.min(lo, v[0]); hi = Math.max(hi, v[1]); });
      const scale = contMode === 'scaled' ? (hi > lo ? 1 / (hi - lo) : 1) : 1;
      const q = P.chars.length;
      const iv = col.map(v => (Array.isArray(v) ? [(v[0] - lo) * scale, (v[1] - lo) * scale] : [-Infinity, Infinity]));
      P.chars.push({ j, q, type: 'cont', k: 0, w, path: 'cont', scale, offset: lo, missing: col.filter(v => !Array.isArray(v)).length });
      contChars.push({ q, w, iv });
      return;
    }
    let k = Math.max(2, c.states ? c.states.length : 2);
    col.forEach(v => { if (typeof v === 'number' && v > 0) { const b = bits(v & MASK); k = Math.max(k, b[b.length - 1] + 1); } });
    k = Math.min(30, k);
    const full = (1 << k) - 1;
    const hasGap = col.some(v => v === GAP);
    const q = P.chars.length;
    const missing = col.filter(v => v === MISS || (v === GAP && !inapAlg)).length;
    const rec = { j, q, type: c.type, k, w, missing, gaps: col.filter(v => v === GAP).length };
    const maskOf = v => (typeof v === 'number' && v > 0 ? (v & MASK) & full || full : full);
    if (c.type === 'step' || (inapAlg && hasGap && c.type !== 'ord')) {
      /* a slow character: optimized one by one */
      rec.path = 'slow';
      const cost = [];
      for (let a = 0; a < k; a++) {
        cost.push(new Float64Array(k));
        for (let b = 0; b < k; b++) cost[a][b] = a === b ? 0 : c.type === 'step' && c.cost && c.cost[a] && c.cost[a][b] != null ? +c.cost[a][b] : 1;
      }
      const inap = inapAlg && hasGap;
      const I = 1 << k;
      const tip = new Int32Array(n);
      col.forEach((v, i) => {
        if (inap) tip[i] = v === GAP ? I : v === MISS ? (full | I) : maskOf(v);
        else tip[i] = maskOf(v);
      });
      rec.slow = { kind: inap ? 'inap' : 'step', k, cost, tip, w, q, I };
      if (inap && c.type === 'step') rec.slow.kind = 'inap';
      /* an asymmetric step matrix gives a length that depends on where the
         root is: it is measured with the root between outgroup and ingroup */
      if (!inap) for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) if (cost[a][b] !== cost[b][a]) rec.slow.asym = true;
      P.slow.push(rec.slow);
      /* a shadow in the fast part, so that the TBR shortcut keeps a tight lower
         bound and only the promising rearrangements are evaluated in full (the
         full evaluation replaces the shadow's steps by the exact ones):
         · inapplicables: the same character with «–» read as «?», whose length
           never exceeds that of the algorithm (checked on 1 260 characters of
           three published matrices);
         · step matrices: the unordered character, weighted by the cheapest
           change, since every change costs at least that much. */
      let cmin = Infinity;
      if (!inap) for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) if (a !== b) cmin = Math.min(cmin, cost[a][b]);
      const sw = inap ? w : (isFinite(cmin) && cmin >= 1 ? w * Math.floor(cmin) : 0);
      if (sw > 0 && Number.isInteger(sw)) {
        rec.slow.shadow = true;
        fastComps.push({ S: k, w: sw, q, tipSet: i => maskOf(col[i]) });
      }
    } else if (c.type === 'ord') {
      /* additive binary coding: threshold t (1 … k−1) is 1 from state t up */
      rec.path = 'fast';
      for (let t = 1; t < k; t++) {
        fastComps.push({ S: 2, w, q, tipSet: i => {
          const v = col[i];
          if (!(typeof v === 'number' && v > 0)) return 3;
          const b = bits((v & MASK) & full);
          if (!b.length) return 3;
          const lo = b[0], hi = b[b.length - 1];
          return lo >= t ? 2 : hi < t ? 1 : 3;
        } });
      }
    } else {
      rec.path = 'fast';
      fastComps.push({ S: k, w, q, tipSet: i => maskOf(col[i]) });
    }
    P.chars.push(rec);
  });
  /* blocks by number of states */
  const byS = new Map();
  fastComps.forEach(c => { if (!byS.has(c.S)) byS.set(c.S, []); byS.get(c.S).push(c); });
  [...byS.keys()].sort((a, b) => a - b).forEach(S => {
    const comps = byS.get(S);
    const nb = comps.length, W = Math.ceil(nb / 32);
    const tip = new Uint32Array(n * S * W);
    const valid = new Uint32Array(W);
    const charOf = new Int32Array(nb);
    const maxW = Math.max(...comps.map(c => c.w));
    const nSl = Math.max(1, Math.ceil(Math.log2(maxW + 1)));
    const slices = Array.from({ length: nSl }, () => new Uint32Array(W));
    comps.forEach((c, b) => {
      const w = b >>> 5, bit = 1 << (b & 31);
      valid[w] |= bit;
      charOf[b] = c.q;
      for (let s = 0; s < nSl; s++) if ((c.w >>> s) & 1) slices[s][w] |= bit;
      for (let i = 0; i < n; i++) {
        const set = c.tipSet(i);
        for (let s = 0; s < S; s++) if ((set >>> s) & 1) tip[(i * S + s) * W + w] |= bit;
      }
    });
    /* unit weights everywhere: one slice equal to valid, a plain popcount */
    const unit = nSl === 1 && comps.every(c => c.w === 1);
    P.blocks.push({ S, W, nb, tip, valid, charOf, slices, unit, SW: S * W });
  });
  /* the characters of the inapplicable algorithm, side by side as well: one
     plane per applicable state plus one for «–», 32 characters per word, so
     the three passes of every character run at once */
  P.inapBlocks = [];
  const byK = new Map();
  P.slow.forEach(sc => { if (sc.kind === 'inap') { if (!byK.has(sc.k)) byK.set(sc.k, []); byK.get(sc.k).push(sc); } });
  [...byK.keys()].sort((a, b) => a - b).forEach(k => {
    const list = byK.get(k);
    const S = k + 1, nb = list.length, W = Math.ceil(nb / 32), SW = S * W;
    const tip = new Uint32Array(n * SW), valid = new Uint32Array(W), charOf = new Int32Array(nb);
    list.forEach((sc, b) => {
      const w = b >>> 5, bit = 1 << (b & 31);
      valid[w] |= bit; charOf[b] = sc.q; sc.inBlock = true;
      for (let i = 0; i < n; i++) { const t = sc.tip[i]; for (let s = 0; s < S; s++) if ((t >>> s) & 1) tip[(i * S + s) * W + w] |= bit; }
    });
    P.inapBlocks.push({ k, S, W, SW, nb, tip, valid, charOf });
  });
  if (contChars.length) {
    const C = contChars.length;
    const lo = new Float64Array(n * C), hi = new Float64Array(n * C), w = new Float64Array(C), charOf = new Int32Array(C);
    contChars.forEach((cc, c) => { w[c] = cc.w; charOf[c] = cc.q; cc.iv.forEach((v, i) => { lo[i * C + c] = v[0]; hi[i * C + c] = v[1]; }); });
    P.cont = { C, lo, hi, w, charOf };
  }
  P.nq = P.chars.length;
  /* bounds of every character (for indices and implied weights) */
  P.minSteps = new Float64Array(P.nq);
  P.maxSteps = new Float64Array(P.nq);
  P.chars.forEach(rec => {
    const col = rows.map(i => m.cells[i][rec.j]);
    if (rec.type === 'cont') {
      const cc = contChars.find(x => x.q === rec.q);
      const iv = cc.iv.filter(v => isFinite(v[0]));
      let best = Infinity;
      /* narrowest window that meets every interval */
      const L = Math.max(...iv.map(v => v[0])), H = Math.min(...iv.map(v => v[1]));
      best = Math.max(0, L - H);
      P.minSteps[rec.q] = best;
      /* bush: the best single value, at one of the endpoints */
      let mx = Infinity;
      iv.forEach(a => [a[0], a[1]].forEach(x => { let s = 0; iv.forEach(b => { s += x < b[0] ? b[0] - x : x > b[1] ? x - b[1] : 0; }); mx = Math.min(mx, s); }));
      P.maxSteps[rec.q] = mx;
      return;
    }
    if (!g.Opt) return;
    const k = rec.k, full = (1 << k) - 1;
    const masks = col.map(v => (typeof v === 'number' && v > 0 ? (v & MASK) & full || full : 0)).filter(x => x);
    const cost = g.Opt.costMatrix(rec.type === 'ord' ? 'ord' : rec.type === 'step' ? 'step' : 'unord', k, rec.slow && rec.type === 'step' ? rec.slow.cost.map(r => Array.from(r)) : null);
    P.minSteps[rec.q] = g.Opt.minSteps(masks, k, rec.type === 'ord' ? 'ord' : rec.type === 'step' ? 'step' : 'unord', cost) || 0;
    P.maxSteps[rec.q] = g.Opt.maxSteps(masks, k, cost);
  });
  /* criterion */
  setCriterion(P, o);
  /* constraints: groups of taxa (analysis indices) */
  P.constraints = (o.constraints || []).map(c => {
    const set = new Uint8Array(n);
    c.taxa.forEach(q => { if (q >= 0 && q < n) set[q] = 1; });
    return { set, size: c.taxa.length, positive: c.positive !== false };
  }).filter(c => c.size >= 2 && c.size <= n - 2);
  return P;
};

function setCriterion(P, o) {
  const crit = o.criterion || 'ew';
  P.crit = crit;
  if (crit === 'ew') { P.iw = null; return; }
  const kRef = o.k || 3;
  const r = o.eiwRatio == null ? 0.5 : o.eiwRatio, M = o.eiwMax == null ? 5 : o.eiwMax;
  /* per character: concavity and the rescaling factor of extended weights */
  const kc = new Float64Array(P.nq), phi = new Float64Array(P.nq), wq = new Float64Array(P.nq);
  P.chars.forEach(rec => {
    let k = kRef, f = 1;
    if (crit === 'eiw' && rec.missing > 0) {
      const t = P.n, ob = t - rec.missing;
      f = ob > 0 ? Math.min(M, 1 + r * (t - ob) / ob) : M;
      k = kRef / f;
    }
    kc[rec.q] = k;
    /* the first extra step costs the same as under the reference concavity */
    phi[rec.q] = (1 + k) / (1 + kRef);
    wq[rec.q] = rec.w;
    rec.f = f;
  });
  P.iw = { kRef, kc, phi, wq };
}
E.setCriterion = setCriterion;
/* distortion of one character with s steps */
function distortion(P, q, s) {
  const h = s - P.minSteps[q];
  if (h <= 1e-12) return 0;
  const k = P.iw.kc[q];
  return P.iw.wq[q] * P.iw.phi[q] * h / (h + k);
}
E.distortion = distortion;
/* the score of a tree from its steps per character: weighted steps, or
   total distortion under implied weights */
E.scoreFromSteps = function (P, steps) {
  if (!P.iw) { let s = 0; P.chars.forEach(rec => { s += rec.w * steps[rec.q]; }); return s; }
  let s = 0;
  for (let q = 0; q < P.nq; q++) s += distortion(P, q, steps[q]);
  return s;
};

/* ================================================================
   2 · trees
   ================================================================ */
E.emptyTree = function (n) { return { n, nb: new Int32Array((2 * n - 2) * 3).fill(-1) }; };
E.cloneTree = T => ({ n: T.n, nb: Int32Array.from(T.nb) });
function slotOf(T, a, b) { const o = a * 3; return T.nb[o] === b ? 0 : T.nb[o + 1] === b ? 1 : T.nb[o + 2] === b ? 2 : -1; }
function link(T, a, b) {
  let sa = a * 3; while (T.nb[sa] !== -1) sa++;
  let sb = b * 3; while (T.nb[sb] !== -1) sb++;
  T.nb[sa] = b; T.nb[sb] = a;
}
function unlink(T, a, b) {
  for (let s = 0; s < 3; s++) { if (T.nb[a * 3 + s] === b) T.nb[a * 3 + s] = -1; if (T.nb[b * 3 + s] === a) T.nb[b * 3 + s] = -1; }
}
E.slotOf = slotOf;
/* every edge [a, b] of a tree (a < b), or of the nodes reachable from `from` */
E.edges = function (T, from) {
  const out = [], seen = new Uint8Array(T.nb.length / 3);
  const st = [from == null ? 0 : from];
  seen[st[0]] = 1;
  while (st.length) {
    const u = st.pop();
    for (let s = 0; s < 3; s++) {
      const v = T.nb[u * 3 + s];
      if (v < 0 || seen[v]) continue;
      seen[v] = 1; out.push([u, v]); st.push(v);
    }
  }
  return out;
};
/* inserts tip x on edge (a, b) using internal node m */
function insertOn(T, x, a, b, m) { unlink(T, a, b); link(T, a, m); link(T, m, b); link(T, m, x); }
/* removes tip x (inverse of insertOn) */
function removeTip(T, x) {
  const m = T.nb[x * 3];
  const o = [];
  for (let s = 0; s < 3; s++) { const v = T.nb[m * 3 + s]; if (v !== x && v >= 0) o.push(v); }
  unlink(T, m, x); unlink(T, m, o[0]); unlink(T, m, o[1]); link(T, o[0], o[1]);
  return [o[0], o[1], m];
}
E.insertOn = insertOn;
E.removeTip = removeTip;
/* the TBR move: cut (p, q); reconnect edge ea of p's side with edge eb of q's
   side. An edge of a side is [x, y], or [tip, −1] when the side is one tip. */
E.applyTBR = function (T0, cut, ea, eb) {
  const T = E.cloneTree(T0);
  const [p, q] = cut;
  unlink(T, p, q);
  const sup = x => {
    if (x < T.n) return;
    const o = [];
    for (let s = 0; s < 3; s++) if (T.nb[x * 3 + s] >= 0) o.push(T.nb[x * 3 + s]);
    if (o.length === 2) { unlink(T, x, o[0]); unlink(T, x, o[1]); link(T, o[0], o[1]); }
  };
  sup(p); sup(q);
  const sub = (x, e) => { if (x < T.n) return; unlink(T, e[0], e[1]); link(T, e[0], x); link(T, x, e[1]); };
  sub(p, ea); sub(q, eb);
  link(T, p, q);
  return T;
};

/* splits: for every internal edge, the side without the root tip, as words.
   `root` defaults to the first tip present in the tree (taxon 0 may still be
   missing from a partial tree). */
E.splits = function (T, root) {
  const n = T.n, Wd = Math.ceil(n / 32);
  const N = T.nb.length / 3;
  let r0 = root;
  if (r0 == null) { r0 = 0; while (r0 < n && T.nb[r0 * 3] < 0) r0++; }
  const par = new Int32Array(N).fill(-2), order = [];
  par[r0] = -1;
  const st = [r0];
  while (st.length) { const u = st.pop(); order.push(u); for (let s = 0; s < 3; s++) { const v = T.nb[u * 3 + s]; if (v >= 0 && par[v] === -2) { par[v] = u; st.push(v); } } }
  const sets = new Map();
  for (let i = order.length - 1; i >= 0; i--) {
    const u = order[i];
    const a = new Uint32Array(Wd);
    if (u < n) a[u >>> 5] |= 1 << (u & 31);
    else for (let s = 0; s < 3; s++) { const v = T.nb[u * 3 + s]; if (v >= 0 && v !== par[u]) { const b = sets.get(v); for (let w = 0; w < Wd; w++) a[w] |= b[w]; } }
    sets.set(u, a);
  }
  const out = [];
  sets.forEach((a, u) => {
    if (u < n || par[u] === r0 || par[u] < 0) return;
    let c = 0; for (let w = 0; w < Wd; w++) c += popcount(a[w]);
    if (c >= 2) out.push(a);
  });
  return out;
};
E.treeKey = function (T) {
  return E.splits(T).map(a => Array.from(a, x => (x >>> 0).toString(36)).join('.')).sort().join('|');
};
/* constraints: a positive group must be a split; a negative one must not */
E.satisfies = function (P, T, present, exactBound) {
  if (!P.constraints || !P.constraints.length) return true;
  const n = P.n, Wd = Math.ceil(n / 32);
  let r0 = 0;
  while (r0 < n && (T.nb[r0 * 3] < 0 || (present && !present[r0]))) r0++;
  const keys = new Set(E.splits(T, r0).map(a => Array.from(a).join(',')));
  for (const c of P.constraints) {
    /* on a partial tree only a positive constraint is certain: a group present
       now can still be broken by a taxon added later (found by checking the
       Bremer support against full enumeration). Branch and bound
       (exactBound) leaves the negative ones for the whole tree; Wagner
       addition still uses them as a guide. */
    if (present && exactBound && !c.positive) continue;
    /* the group, among the taxa present, written as the side without the root tip */
    const side = new Uint32Array(Wd);
    let inG = 0, outG = 0;
    const rootIn = c.set[r0] === 1;
    for (let i = 0; i < n; i++) {
      if (present ? !present[i] : T.nb[i * 3] < 0) continue;
      if (c.set[i]) inG++; else outG++;
      if (i !== r0 && (c.set[i] === 1) !== rootIn) side[i >>> 5] |= 1 << (i & 31);
    }
    /* a group of fewer than two, or of all but at most one, is always a clade */
    if (inG < 2 || outG < 2) { if (!c.positive && !present && inG >= 2 && outG < 2) return false; continue; }
    const has = keys.has(Array.from(side).join(','));
    if (c.positive && !has) return false;
    if (!c.positive && has) return false;
  }
  return true;
};

/* Newick, rooted on the edge of the first outgroup taxon */
E.toNewick = function (P, T) {
  const n = T.n, r = P.outgroup[0];
  const q = s => (/^[A-Za-z0-9_.\-]+$/.test(s) ? s : "'" + String(s).replace(/'/g, "''") + "'");
  const write = (u, from) => {
    if (u < n) return q(P.names[u]);
    const kids = [];
    for (let s = 0; s < 3; s++) { const v = T.nb[u * 3 + s]; if (v >= 0 && v !== from) kids.push(write(v, u)); }
    return '(' + kids.join(',') + ')';
  };
  const m = T.nb[r * 3];
  return '(' + q(P.names[r]) + ',' + write(m, r) + ');';
};
/* a tree of tree.js (binary or not: polytomies are resolved arbitrarily) → engine tree */
E.fromNodeTree = function (P, root) {
  const T = E.emptyTree(P.n);
  let next = P.n;
  const idx = new Map(P.names.map((nm, i) => [nm, i]));
  const build = v => {
    if (!v.children.length) { const i = v.tip >= 0 && P.rows ? P.rows.indexOf(v.tip) : -1; return i >= 0 ? i : idx.get(v.name); }
    let kids = v.children.map(build).filter(x => x != null);
    while (kids.length > 2) { const a = kids.shift(), b = kids.shift(), m = next++; link(T, m, a); link(T, m, b); kids.unshift(m); }
    if (kids.length === 1) return kids[0];
    const m = next++; link(T, m, kids[0]); link(T, m, kids[1]); return m;
  };
  const top = v => {
    let kids = v.children.map(build).filter(x => x != null);
    while (kids.length > 3) { const a = kids.shift(), b = kids.shift(), m = next++; link(T, m, a); link(T, m, b); kids.unshift(m); }
    if (kids.length === 3) { const m = next++; kids.forEach(k => link(T, m, k)); }
    else if (kids.length === 2) link(T, kids[0], kids[1]);
  };
  top(root);
  /* a root with two children made a single edge between them; fine for an unrooted tree */
  return T;
};

/* ================================================================
   3 · optimization on a tree: directional sets
   ================================================================ */
/* For every directed edge (u looking away from v) the Fitch set of each block,
   its weighted steps, and (for implied weights) the steps per character. */
function workspace(P, T) {
  const N = T.nb.length / 3;
  const ws = { D: P.blocks.map(b => new Uint32Array(N * 3 * b.SW)), L: new Float64Array(N * 3) };
  if (P.cont) { ws.lo = new Float64Array(N * 3 * P.cont.C); ws.hi = new Float64Array(N * 3 * P.cont.C); }
  if (P.iw) ws.pc = new Float64Array(N * 3 * P.nq);
  return ws;
}
/* combine two directions into a third; returns the weighted steps added and,
   when pc is given, adds the steps per character */
function combine(P, ws, ia, ib, io) {
  let add = 0;
  const nq = P.nq, pc = ws.pc;
  if (pc) { const oa = ia * nq, ob = ib * nq, oo = io * nq; for (let q = 0; q < nq; q++) pc[oo + q] = pc[oa + q] + pc[ob + q]; }
  for (let bi = 0; bi < P.blocks.length; bi++) {
    const B = P.blocks[bi], S = B.S, W = B.W, D = ws.D[bi];
    const A0 = ia * B.SW, B0 = ib * B.SW, O0 = io * B.SW;
    for (let w = 0; w < W; w++) {
      let any = 0;
      for (let s = 0; s < S; s++) any |= D[A0 + s * W + w] & D[B0 + s * W + w];
      const empty = ~any & B.valid[w];
      if (empty) {
        if (B.unit) add += popcount(empty);
        else for (let k = 0; k < B.slices.length; k++) { const x = empty & B.slices[k][w]; if (x) add += popcount(x) * (1 << k); }
        if (pc) { let e = empty; while (e) { const b = ctz(e); e &= e - 1; pc[io * nq + B.charOf[(w << 5) + b]] += 1; } }
      }
      for (let s = 0; s < S; s++) {
        const a = D[A0 + s * W + w], b = D[B0 + s * W + w];
        D[O0 + s * W + w] = (a & b) | ((a | b) & empty);
      }
    }
  }
  if (P.cont) {
    const C = P.cont.C, lo = ws.lo, hi = ws.hi;
    const a0 = ia * C, b0 = ib * C, o0 = io * C;
    for (let c = 0; c < C; c++) {
      const al = lo[a0 + c], ah = hi[a0 + c], bl = lo[b0 + c], bh = hi[b0 + c];
      const L = al > bl ? al : bl, H = ah < bh ? ah : bh;
      if (L <= H) { lo[o0 + c] = L; hi[o0 + c] = H; }
      else { lo[o0 + c] = H; hi[o0 + c] = L; const d = L - H; add += d * P.cont.w[c]; if (pc) pc[io * nq + P.cont.charOf[c]] += d; }
    }
  }
  ws.L[io] = ws.L[ia] + ws.L[ib] + add;
  return add;
}
function setTip(P, ws, i, io) {
  for (let bi = 0; bi < P.blocks.length; bi++) {
    const B = P.blocks[bi];
    ws.D[bi].set(B.tip.subarray(i * B.SW, i * B.SW + B.SW), io * B.SW);
  }
  if (P.cont) { const C = P.cont.C; for (let c = 0; c < C; c++) { ws.lo[io * C + c] = P.cont.lo[i * C + c]; ws.hi[io * C + c] = P.cont.hi[i * C + c]; } }
  ws.L[io] = 0;
  if (ws.pc) ws.pc.fill(0, io * P.nq, io * P.nq + P.nq);
}
/* all directions of a tree (or of the part of it reachable from `root`);
   with `downOnly`, only those that point towards the root */
function allDirectional(P, T, ws, root, downOnly) {
  const N = T.nb.length / 3;
  const r = root == null ? 0 : root;
  const par = new Int32Array(N).fill(-2), order = [];
  par[r] = -1;
  const st = [r];
  while (st.length) { const u = st.pop(); order.push(u); for (let s = 0; s < 3; s++) { const v = T.nb[u * 3 + s]; if (v >= 0 && par[v] === -2) { par[v] = u; st.push(v); } } }
  for (let i = order.length - 1; i >= 0; i--) {
    const u = order[i]; if (u === r) continue;
    const io = u * 3 + slotOf(T, u, par[u]);
    if (u < T.n) { setTip(P, ws, u, io); continue; }
    const kids = [];
    for (let s = 0; s < 3; s++) { const v = T.nb[u * 3 + s]; if (v >= 0 && v !== par[u]) kids.push(v); }
    combine(P, ws, kids[0] * 3 + slotOf(T, kids[0], u), kids[1] * 3 + slotOf(T, kids[1], u), io);
  }
  /* the root tip looking at its only neighbour */
  setTip(P, ws, r, r * 3 + 0);
  if (downOnly) return order;
  for (let i = 0; i < order.length; i++) {
    const u = order[i]; if (u < T.n) continue;
    for (let s = 0; s < 3; s++) {
      const c = T.nb[u * 3 + s]; if (c < 0 || c === par[u]) continue;
      const others = [];
      for (let t = 0; t < 3; t++) if (t !== s && T.nb[u * 3 + t] >= 0) others.push(T.nb[u * 3 + t]);
      combine(P, ws, others[0] * 3 + slotOf(T, others[0], u), others[1] * 3 + slotOf(T, others[1], u), u * 3 + s);
    }
  }
  return order;
}
/* join cost of two «sets» held in arrays (Fitch of the two, without storing) */
function joinCost(P, ws1, i1, ws2, i2, bound, pcAdd) {
  let add = 0;
  for (let bi = 0; bi < P.blocks.length; bi++) {
    const B = P.blocks[bi], S = B.S, W = B.W, D1 = ws1.D[bi], D2 = ws2.D[bi];
    const A0 = i1 * B.SW, B0 = i2 * B.SW;
    for (let w = 0; w < W; w++) {
      let any = 0;
      for (let s = 0; s < S; s++) any |= D1[A0 + s * W + w] & D2[B0 + s * W + w];
      const empty = ~any & B.valid[w];
      if (empty) {
        if (pcAdd) { let e = empty; while (e) { const b = ctz(e); e &= e - 1; pcAdd(B.charOf[(w << 5) + b], 1); } }
        else {
          if (B.unit) add += popcount(empty);
          else for (let k = 0; k < B.slices.length; k++) { const x = empty & B.slices[k][w]; if (x) add += popcount(x) * (1 << k); }
          if (add > bound) return add;
        }
      }
    }
  }
  if (P.cont) {
    const C = P.cont.C;
    for (let c = 0; c < C; c++) {
      const L = Math.max(ws1.lo[i1 * C + c], ws2.lo[i2 * C + c]), H = Math.min(ws1.hi[i1 * C + c], ws2.hi[i2 * C + c]);
      if (L > H) { if (pcAdd) pcAdd(P.cont.charOf[c], L - H); else add += (L - H) * P.cont.w[c]; }
    }
  }
  return add;
}

/* ---------------- slow characters, on the tree rooted on the outgroup ---------------- */
function rooted(P, T) {
  const n = T.n, r = P.outgroup[0];
  const N = T.nb.length / 3;
  /* the root is a virtual node on the edge (r, m): children r and m */
  const m = T.nb[r * 3];
  const par = new Int32Array(N).fill(-2), post = [];
  par[m] = -1;
  const st = [[m, 0]];
  const kids = Array.from({ length: N }, () => []);
  const order = [m];
  const seen = new Uint8Array(N); seen[m] = 1; seen[r] = 1;
  for (let i = 0; i < order.length; i++) {
    const u = order[i];
    for (let s = 0; s < 3; s++) { const v = T.nb[u * 3 + s]; if (v >= 0 && !seen[v]) { seen[v] = 1; par[v] = u; kids[u].push(v); order.push(v); } }
  }
  for (let i = order.length - 1; i >= 0; i--) post.push(order[i]);
  void st;
  return { r, m, kids, post, pre: order, n, N };
}
/* the same rooted view as flat arrays for the inapplicable passes, built once
   per tree and shared by every character: a virtual root VR above r and m,
   both children of every node, the parent, the two orders and the scratch
   arrays of the passes */
function inapView(R) {
  const N = R.N, VR = N, n = R.n;
  const kA = new Int32Array(N + 1).fill(-1), kB = new Int32Array(N + 1).fill(-1), par = new Int32Array(N + 1).fill(-1);
  for (const u of R.pre) { const k = R.kids[u]; if (k.length) { kA[u] = k[0]; kB[u] = k[1]; par[k[0]] = u; par[k[1]] = u; } }
  kA[VR] = R.r; kB[VR] = R.m; par[R.r] = VR; par[R.m] = VR;
  const post = Int32Array.from(R.post.concat([R.r, VR]));
  const pre = Int32Array.from([VR, R.r].concat(R.pre));
  return { VR, n, kA, kB, par, post, pre, d1: new Int32Array(N + 1), u1: new Int32Array(N + 1), d2: new Int32Array(N + 1), tr: new Uint8Array(N + 1) };
}
function sankoffLen(sc, R) {
  const k = sc.k, cost = sc.cost, N = R.kids.length;
  const G = new Float64Array(N * k);
  const leaf = (u) => { for (let s = 0; s < k; s++) G[u * k + s] = (sc.tip[u] >>> s) & 1 ? 0 : 1e9; };
  for (const u of R.post) {
    if (u < R.n) { leaf(u); continue; }
    for (let s = 0; s < k; s++) {
      let tot = 0;
      for (const c of R.kids[u]) { let b = 1e18; for (let t = 0; t < k; t++) { const x = cost[s][t] + G[c * k + t]; if (x < b) b = x; } tot += b; }
      G[u * k + s] = tot;
    }
  }
  if (!R.both) leaf(R.r);
  /* virtual root above r and m */
  let best = 1e18;
  for (let s = 0; s < k; s++) {
    let a = 1e18, b = 1e18;
    for (let t = 0; t < k; t++) { a = Math.min(a, cost[s][t] + G[R.r * k + t]); b = Math.min(b, cost[s][t] + G[R.m * k + t]); }
    best = Math.min(best, a + b);
  }
  return best;
}
/* Brazeau, Guillerme and Smith (2019): a first downpass and uppass decide
   which nodes are applicable; a second downpass counts the changes among
   applicable states and every additional region where the character becomes
   applicable again. I = the inapplicable token. */
function inapLen(sc, R) {
  const I = sc.I, APP = I - 1, tip = sc.tip;
  const V = R.iv || (R.iv = inapView(R));
  const { VR, n, kA, kB, par, post, pre, d1, u1, d2, tr } = V;
  /* first downpass */
  for (let i = 0; i < post.length; i++) {
    const u = post[i];
    if (u < n) { d1[u] = tip[u]; continue; }
    const a = d1[kA[u]], b = d1[kB[u]], c = a & b;
    if (c) d1[u] = (c === I && (a & APP) && (b & APP)) ? (a | b) : c;
    else d1[u] = ((a & APP) && (b & APP)) ? ((a | b) & APP) : (a | b);
  }
  /* first uppass: a node keeps applicable states where its neighbours do */
  for (let i = 0; i < pre.length; i++) {
    const u = pre[i];
    if (u === VR) { let x = d1[u]; if ((x & I) && (x & APP)) x &= APP; u1[u] = x; continue; }
    const anc = u1[par[u]];
    let x = d1[u];
    if (u < n) { if ((x & I) && (x & APP)) x = anc === I ? I : (x & APP); u1[u] = x; continue; }
    if (x & I) {
      if (x & APP) x = (anc & I) ? I : (x & APP);
      else if (anc & I) x = I;
      else { const a = (d1[kA[u]] | d1[kB[u]]) & APP; x = a ? a : I; }
    }
    u1[u] = x;
  }
  /* second downpass: changes among applicable states, and extra regions */
  let score = 0;
  for (let i = 0; i < post.length; i++) {
    const u = post[i];
    if (u < n) { d2[u] = u1[u]; tr[u] = (u1[u] & APP) ? 1 : 0; continue; }
    const ka = kA[u], kb = kB[u];
    const A = d2[ka], B = d2[kb];
    tr[u] = tr[ka] | tr[kb];
    if (u1[u] & APP) {
      const c = A & B;
      if (c) d2[u] = (c & APP) ? (c & APP) : I;
      else {
        d2[u] = (A | B) & APP;
        /* both sides applicable and different: a transformation; otherwise one
           side is inapplicable, and if both hide applicable regions, the one
           below is a separate region */
        if ((A & APP) && (B & APP)) score++;
        else if (tr[ka] && tr[kb]) score++;
      }
    } else {
      d2[u] = I;
      if (tr[ka] && tr[kb]) score++;
    }
  }
  return score;
}
E.inapLength = (P, T, sc) => inapLen(sc, rooted(P, T));
/* The same three passes for a whole block of characters at once, with masks:
   bit c of a word says, for character c, which branch of inapLen applies.
   Writes the steps of every character of the blocks into out[q]. */
function inapBlockSteps(P, R, out) {
  const V = R.iv || (R.iv = inapView(R));
  const { VR, n, kA, kB, par, post, pre } = V;
  const NN = kA.length;
  for (const B of P.inapBlocks) {
    const { S, W, SW, tip, valid, charOf } = B, k = S - 1, IW = k * W;
    let sc = V['s' + SW];
    if (!sc) sc = V['s' + SW] = { d1: new Uint32Array(NN * SW), u1: new Uint32Array(NN * SW), d2: new Uint32Array(NN * SW), tr: new Int32Array(NN * W) };
    const { d1, u1, d2, tr } = sc;
    for (let b = 0; b < B.nb; b++) out[charOf[b]] = 0;
    /* first downpass */
    for (let i = 0; i < post.length; i++) {
      const u = post[i], o = u * SW;
      if (u < n) { for (let x = 0; x < SW; x++) d1[o + x] = tip[o + x]; continue; }
      const a = kA[u] * SW, b = kB[u] * SW;
      for (let w = 0; w < W; w++) {
        let anyC = 0, appA = 0, appB = 0;
        for (let p = 0; p < k; p++) { const x = d1[a + p * W + w], y = d1[b + p * W + w]; anyC |= x & y; appA |= x; appB |= y; }
        const aI = d1[a + IW + w], bI = d1[b + IW + w], cI = aI & bI;
        const both = appA & appB, cz = ~(anyC | cI), onlyI = cI & ~anyC & both;
        /* c = a ∩ b: c if not empty (but a ∪ b when c is only «–» and both sides
           are applicable); if empty, a ∪ b, without «–» when both are applicable */
        const useOr = onlyI | (cz & ~both), useOrApp = cz & both, useC = ~cz & ~onlyI;
        for (let p = 0; p < k; p++) { const x = d1[a + p * W + w], y = d1[b + p * W + w]; d1[o + p * W + w] = ((x | y) & (useOr | useOrApp)) | (x & y & useC); }
        d1[o + IW + w] = ((aI | bI) & useOr) | (cI & useC);
      }
    }
    /* first uppass */
    for (let i = 0; i < pre.length; i++) {
      const u = pre[i], o = u * SW;
      if (u === VR) {
        for (let w = 0; w < W; w++) {
          let app = 0;
          for (let p = 0; p < k; p++) { const x = d1[o + p * W + w]; app |= x; u1[o + p * W + w] = x; }
          u1[o + IW + w] = d1[o + IW + w] & ~app;
        }
        continue;
      }
      const po = par[u] * SW;
      if (u < n) {
        for (let w = 0; w < W; w++) {
          let app = 0, ancApp = 0;
          for (let p = 0; p < k; p++) { app |= d1[o + p * W + w]; ancApp |= u1[po + p * W + w]; }
          const xI = d1[o + IW + w], cond = xI & app, ancOnlyI = u1[po + IW + w] & ~ancApp;
          const setI = cond & ancOnlyI, dropI = cond & ~ancOnlyI;
          for (let p = 0; p < k; p++) u1[o + p * W + w] = d1[o + p * W + w] & ~setI;
          u1[o + IW + w] = xI & ~dropI;
        }
        continue;
      }
      const a = kA[u] * SW, b = kB[u] * SW;
      for (let w = 0; w < W; w++) {
        let app = 0, kidsApp = 0;
        for (let p = 0; p < k; p++) { app |= d1[o + p * W + w]; kidsApp |= d1[a + p * W + w] | d1[b + p * W + w]; }
        const xI = d1[o + IW + w], ancI = u1[po + IW + w];
        const setI = xI & app & ancI, dropI = xI & app & ~ancI;
        const mC = xI & ~app & ~ancI, mCk = mC & kidsApp;
        for (let p = 0; p < k; p++) u1[o + p * W + w] = (d1[o + p * W + w] & ~setI & ~mC) | ((d1[a + p * W + w] | d1[b + p * W + w]) & mCk);
        u1[o + IW + w] = xI & ~dropI & ~mCk;
      }
    }
    /* second downpass: transformations and extra regions */
    for (let i = 0; i < post.length; i++) {
      const u = post[i], o = u * SW, ot = u * W;
      if (u < n) {
        for (let w = 0; w < W; w++) {
          let app = 0;
          for (let p = 0; p < k; p++) { const x = u1[o + p * W + w]; app |= x; d2[o + p * W + w] = x; }
          d2[o + IW + w] = u1[o + IW + w];
          tr[ot + w] = app;
        }
        continue;
      }
      const a = kA[u] * SW, b = kB[u] * SW, ta = kA[u] * W, tb = kB[u] * W;
      for (let w = 0; w < W; w++) {
        let uApp = 0, cApp = 0, appA = 0, appB = 0;
        for (let p = 0; p < k; p++) { uApp |= u1[o + p * W + w]; const x = d2[a + p * W + w], y = d2[b + p * W + w]; cApp |= x & y; appA |= x; appB |= y; }
        const cI = d2[a + IW + w] & d2[b + IW + w];
        const trA = tr[ta + w], trB = tr[tb + w];
        tr[ot + w] = trA | trB;
        const m1 = uApp & cApp, m2 = uApp & ~cApp & cI, m3 = uApp & ~cApp & ~cI, m4 = ~uApp;
        for (let p = 0; p < k; p++) { const x = d2[a + p * W + w], y = d2[b + p * W + w]; d2[o + p * W + w] = (x & y & m1) | ((x | y) & m3); }
        d2[o + IW + w] = m2 | m4;
        let inc = ((m3 & ((appA & appB) | (trA & trB))) | (m4 & trA & trB)) & valid[w];
        while (inc) { const bb = ctz(inc); inc &= inc - 1; out[charOf[(w << 5) + bb]] += 1; }
      }
    }
  }
}
function slowSteps(P, T, out) {
  if (!P.slow.length) return;
  const R = rooted(P, T);
  if (P.inapBlocks.length) inapBlockSteps(P, R, out);
  let Ro = null;
  for (const sc of P.slow) {
    if (sc.inBlock) continue;
    if (sc.asym && P.outgroup.length > 1) { Ro = Ro || rootedOnOutgroup(P, T, R); out[sc.q] = sankoffLen(sc, Ro); }
    else out[sc.q] = sc.kind === 'inap' ? inapLen(sc, R) : sankoffLen(sc, R);
  }
}
/* The tree with its root between the outgroup and the ingroup, when the
   outgroup is a clade (otherwise on the branch of its first taxon, as a
   cladogram is rooted). Both sides of the root are listed in `post`. */
function rootedOnOutgroup(P, T, R) {
  const n = T.n, N = T.nb.length / 3;
  const og = new Uint8Array(n);
  P.outgroup.forEach(q => { og[q] = 1; });
  const size = new Int32Array(N), below = new Int32Array(N), par = new Int32Array(N).fill(-1);
  for (const u of R.post) {
    if (u < n) { size[u] = 1; below[u] = og[u]; continue; }
    for (const c of R.kids[u]) { size[u] += size[c]; below[u] += below[c]; par[c] = u; }
  }
  const nIn = n - P.outgroup.length;
  let u = -1;
  for (const x of R.post) if (below[x] === 0 && size[x] === nIn) { u = x; break; }
  if (u < 0 || par[u] < 0) return R;
  const a = u, b = par[u];
  const kids = Array.from({ length: N }, () => []);
  const side = (s, from) => {
    const order = [s], seen = new Uint8Array(N); seen[s] = 1; seen[from] = 1;
    for (let i = 0; i < order.length; i++) { const x = order[i]; for (let t = 0; t < 3; t++) { const v = T.nb[x * 3 + t]; if (v >= 0 && !seen[v]) { seen[v] = 1; kids[x].push(v); order.push(v); } } }
    return order;
  };
  const oa = side(a, b), ob = side(b, a);
  return { r: a, m: b, kids, post: oa.slice().reverse().concat(ob.slice().reverse()), pre: oa.concat(ob), n, N, both: true };
}

/* ---------------- the score of a whole tree ---------------- */
E.evaluate = function (P, T) {
  /* one workspace per prepared matrix, reused: a whole evaluation only needs
     the directions towards taxon 0 */
  const N = T.nb.length / 3;
  let ws = P.evalWS;
  if (!ws || ws.N !== N) {
    ws = workspace(P, T);
    if (!ws.pc) ws.pc = new Float64Array(N * 3 * P.nq);
    ws.N = N;
    P.evalWS = ws;
  }
  allDirectional(P, T, ws, 0, true);
  const u = 0, v = T.nb[0];
  const iu = 0, iv = v * 3 + slotOf(T, v, u);
  const steps = new Float64Array(P.nq);
  const nq = P.nq;
  for (let q = 0; q < nq; q++) steps[q] = ws.pc[iu * nq + q] + ws.pc[iv * nq + q];
  joinCost(P, ws, iu, ws, iv, BIG, (q, d) => { steps[q] += d; });
  slowSteps(P, T, steps);
  let length = 0;
  P.chars.forEach(rec => { length += rec.w * steps[rec.q]; });
  return { steps, length, score: E.scoreFromSteps(P, steps) };
};
E.length = (P, T) => E.evaluate(P, T).length;
E.score = (P, T) => E.evaluate(P, T).score;

/* ================================================================
   4 · the TBR neighbourhood with the shortcut
   ================================================================ */
/* the edges of one side of a cut, each with its edge set; the side's length
   (weighted) and, under implied weights, its steps per character */
function sideOf(P, T, ws, p, q) {
  const n = T.n, nq = P.nq;
  const out = { edges: [], len: 0, pc: P.iw ? new Float64Array(nq) : null };
  /* the edge sets go into a small workspace of their own */
  if (p < n) {
    const sw = sideWS(P, 1);
    setTip(P, sw, p, 0);
    out.edges.push([p, -1]); out.ws = sw;
    return out;
  }
  const nbs = [];
  for (let s = 0; s < 3; s++) { const v = T.nb[p * 3 + s]; if (v !== q && v >= 0) nbs.push(v); }
  /* count the nodes of the side to size the workspace */
  const sideNodes = [];
  const st = [[nbs[0], p], [nbs[1], p]];
  while (st.length) { const [x, f] = st.pop(); sideNodes.push(x); if (x >= n) for (let s = 0; s < 3; s++) { const v = T.nb[x * 3 + s]; if (v >= 0 && v !== f) st.push([v, x]); } }
  const nE = sideNodes.length - 1;   // edges of the side once p is suppressed
  const sw = sideWS(P, 2 * nE + 2);   // per edge: its edge set; plus scratch «U» sets
  out.ws = sw;
  const a = nbs[0], b = nbs[1];
  const ia = a * 3 + slotOf(T, a, p), ib = b * 3 + slotOf(T, b, p);
  /* root edge (a, b): copy the two directions into the side workspace and join them */
  let slot = 0;
  const copyDir = (from, to) => {
    for (let bi = 0; bi < P.blocks.length; bi++) { const B = P.blocks[bi]; sw.D[bi].set(ws.D[bi].subarray(from * B.SW, from * B.SW + B.SW), to * B.SW); }
    if (P.cont) { const C = P.cont.C; for (let c = 0; c < C; c++) { sw.lo[to * C + c] = ws.lo[from * C + c]; sw.hi[to * C + c] = ws.hi[from * C + c]; } }
    sw.L[to] = ws.L[from];
    if (sw.pc) for (let k = 0; k < nq; k++) sw.pc[to * nq + k] = ws.pc[from * nq + k];
  };
  const TA = 2 * nE, TB = 2 * nE + 1;   // two scratch slots
  copyDir(ia, TA); copyDir(ib, TB);
  const rootE = slot++;
  combine(P, sw, TA, TB, rootE);
  out.len = sw.L[rootE];
  if (out.pc) for (let k = 0; k < nq; k++) out.pc[k] = sw.pc[rootE * nq + k];
  out.edges.push([a, b]);
  /* U(x): the rest of the side seen from x; edge set of (x, parent) = join(D[x→parent], U(x)) */
  const stack = [[a, p, ib, true], [b, p, ia, true]];
  /* U sets live in the slots after the edge sets; first the two root U's are the
     directions of the sibling, held in ws */
  const uSlot = new Map();
  while (stack.length) {
    const [x, from, uIdx, uInWs] = stack.pop();
    if (x < n) continue;
    const kids = [];
    for (let s = 0; s < 3; s++) { const v = T.nb[x * 3 + s]; if (v >= 0 && v !== from) kids.push(v); }
    for (let k2 = 0; k2 < 2; k2++) {
      const c = kids[k2], c2 = kids[1 - k2];
      const ic = c * 3 + slotOf(T, c, x), ic2 = c2 * 3 + slotOf(T, c2, x);
      /* U(c) = join(U(x), D[c2→x]) */
      const uC = slot++;
      if (uInWs) { copyDir(uIdx, TA); } else copyDirSW(sw, uIdx, TA, P);
      copyDir(ic2, TB);
      combine(P, sw, TA, TB, uC);
      /* edge set of (c, x) = join(D[c→x], U(c)) */
      const eC = slot++;
      copyDir(ic, TB);
      copyDirSW(sw, uC, TA, P);
      combine(P, sw, TB, TA, eC);
      out.edges.push([c, x]);
      out.edgeSlot = out.edgeSlot || [rootE];
      out.edgeSlot.push(eC);
      stack.push([c, x, uC, false]);
      uSlot.set(c, uC);
    }
  }
  if (!out.edgeSlot) out.edgeSlot = [rootE];
  return out;
}
function copyDirSW(sw, from, to, P) {
  for (let bi = 0; bi < P.blocks.length; bi++) { const B = P.blocks[bi]; sw.D[bi].copyWithin(to * B.SW, from * B.SW, from * B.SW + B.SW); }
  if (P.cont) { const C = P.cont.C; sw.lo.copyWithin(to * C, from * C, from * C + C); sw.hi.copyWithin(to * C, from * C, from * C + C); }
  sw.L[to] = sw.L[from];
  if (sw.pc) sw.pc.copyWithin(to * P.nq, from * P.nq, from * P.nq + P.nq);
}
function sideWS(P, slots) {
  const ws = { D: P.blocks.map(b => new Uint32Array(slots * b.SW)), L: new Float64Array(slots) };
  if (P.cont) { ws.lo = new Float64Array(slots * P.cont.C); ws.hi = new Float64Array(slots * P.cont.C); }
  if (P.iw) ws.pc = new Float64Array(slots * P.nq);
  return ws;
}

/* Evaluates the whole TBR (or SPR) neighbourhood of T and calls visit(move,
   score) for every rearrangement whose fast score is below `bound` (or every
   one, with bound = Infinity). The score includes the slow characters only if
   `exactSlow`; otherwise it is the fast part plus the slow part of T, a lower
   bound the caller confirms. Returns the number of rearrangements examined. */
E.neighbourhood = function (P, T, opts, visit) {
  opts = opts || {};
  const n = T.n, nq = P.nq;
  const ws = workspace(P, T);
  allDirectional(P, T, ws, 0);
  const spr = opts.spr;
  let count = 0;
  const cuts = opts.cuts || E.edges(T);
  const slowNow = opts.slowNow || 0;
  /* implied weights: increments by character */
  const iw = P.iw;
  const addCnt = iw ? new Float64Array(nq) : null;
  const touched = iw ? new Int32Array(nq + 8) : null;
  for (const [u, v] of cuts) {
    const A = sideOf(P, T, ws, u, v), B = sideOf(P, T, ws, v, u);
    let base, sA, sB;
    if (!iw) base = A.len + B.len + slowNow;
    else {
      base = 0;
      sA = A.pc; sB = B.pc;
      /* slow characters enter through their shadow (or with 0 steps, a lower bound) */
      for (let q = 0; q < nq; q++) base += distortion(P, q, sA[q] + sB[q]);
      base += slowNow;
    }
    const eA = A.edges, eB = B.edges;
    const listA = spr ? [0] : eA.map((_, i) => i);
    for (const i of listA) {
      const ia = A.edgeSlot ? A.edgeSlot[i] : 0;
      for (let jj = 0; jj < eB.length; jj++) {
        const ib = B.edgeSlot ? B.edgeSlot[jj] : 0;
        count++;
        let sc;
        if (!iw) {
          const bnd = opts.bound == null ? BIG : opts.bound - base;
          sc = base + joinCost(P, A.ws, ia, B.ws, ib, bnd);
        } else {
          let nt = 0;
          const pcAdd = (q, d) => { if (addCnt[q] === 0) touched[nt++] = q; addCnt[q] += d; };
          joinCost(P, A.ws, ia, B.ws, ib, BIG, pcAdd);
          let inc = 0;
          for (let t = 0; t < nt; t++) {
            const q = touched[t], s = sA[q] + sB[q];
            inc += distortion(P, q, s + addCnt[q]) - distortion(P, q, s);
            addCnt[q] = 0;
          }
          sc = base + inc;
        }
        if (opts.bound != null && sc >= opts.bound) continue;
        const r = visit([u, v], eA[i], eB[jj], sc);
        if (r === false) return count;
      }
    }
  }
  return count;
};

/* ================================================================
   5 · searches
   ================================================================ */
const EPS = 1e-9;
/* a tree is acceptable when it satisfies the constraints */
const okTree = (P, T) => E.satisfies(P, T);
/* lower bound of the slow characters that have no shadow in the fast part
   (step matrices): their minimum steps, under equal weights */
function slowFloor(P) {
  let s = 0;
  if (!P.iw) P.slow.forEach(sc => { if (!sc.shadow) s += sc.w * P.minSteps[sc.q]; });
  return s;
}
/* With slow characters the shortcut only gives a lower bound and every
   promising rearrangement needs a full evaluation. The first `quick` ones are
   evaluated as they come (early rounds find an improvement at once); after
   that only the `budget` rearrangements with the lowest bound are kept and
   evaluated in that order. visit(T2, score) returns false to stop. The pass
   is exhaustive (an exact local optimum) unless some candidate was dropped. */
const BUDGET = 3000, QUICK = 200;
function boundedMoves(P, T, nOpts, visit, budget, quick) {
  let evals = 0, stopped = false, dropped = false;
  const heap = [];   // max-heap by bound: [sc, cut, ea, eb]
  const up = i => { while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] >= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const down = i => { for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] > heap[m][0]) m = l; if (r < heap.length && heap[r][0] > heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } };
  const consider = (cut, ea, eb) => {
    const T2 = E.applyTBR(T, cut, ea, eb);
    if (P.constraints.length && !okTree(P, T2)) return true;
    evals++;
    return visit(T2, E.score(P, T2));
  };
  E.neighbourhood(P, T, nOpts, (cut, ea, eb, sc) => {
    if (evals < quick) { if (consider(cut, ea, eb) === false) { stopped = true; return false; } return true; }
    if (heap.length < budget) { heap.push([sc, cut, ea, eb]); up(heap.length - 1); }
    else { dropped = true; if (sc < heap[0][0]) { heap[0] = [sc, cut, ea, eb]; down(0); } }
    return true;
  });
  if (!stopped) {
    heap.sort((a, b) => a[0] - b[0]);
    for (const h of heap) if (consider(h[1], h[2], h[3]) === false) { stopped = true; break; }
  }
  return { exhaustive: !dropped, stopped };
}

/* Hill climbing by TBR (or SPR) to a local optimum: the first improving
   rearrangement is taken. Returns { T, score }. */
E.climb = function (P, T0, opts) {
  opts = opts || {};
  let T = T0, cur = E.score(P, T);
  /* a start that breaks a constraint (Wagner places taxa without knowing yet
     whether a group will form) steps first to the best rearrangement that
     keeps them all */
  if (P.constraints.length && !okTree(P, T)) {
    let best = null;
    E.neighbourhood(P, T, {}, (cut, ea, eb, sc) => {
      const T2 = E.applyTBR(T, cut, ea, eb);
      if (!okTree(P, T2)) return true;
      const s2 = P.slow.length ? E.score(P, T2) : sc;
      if (!best || s2 < best.s) best = { T: T2, s: s2 };
      return true;
    });
    if (best) { T = best.T; cur = best.s; }
  }
  const hasSlow = P.slow.length > 0;
  let rounds = 0;
  for (;;) {
    if (opts.shouldStop && opts.shouldStop()) break;
    rounds++;
    const slowNow = slowFloor(P);
    let improved = null;
    if (hasSlow) boundedMoves(P, T, { bound: cur - EPS, slowNow, spr: opts.spr }, (T2, s2) => {
      if (s2 >= cur - EPS) return true;
      improved = { T: T2, s: s2 };
      return false;
    }, opts.budget || BUDGET, QUICK);
    else E.neighbourhood(P, T, { bound: cur - EPS, slowNow, spr: opts.spr }, (cut, ea, eb, sc) => {
      const T2 = E.applyTBR(T, cut, ea, eb);
      if (P.constraints.length && !okTree(P, T2)) return true;
      improved = { T: T2, s: sc };
      return false;
    });
    if (!improved) break;
    T = improved.T; cur = improved.s;
    if (opts.onImprove) opts.onImprove(cur);
  }
  return { T, score: cur, rounds };
};

/* Wagner stepwise addition in a random order (Farris 1970): each taxon goes on
   the edge where it adds least. Positive constraints are honoured as taxa are
   placed. */
E.wagner = function (P, rng, opts) {
  opts = opts || {};
  const n = P.n;
  const order = opts.order || (() => { const o = [...Array(n).keys()]; for (let i = n - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } return o; })();
  const T = E.emptyTree(n);
  const present = new Uint8Array(n);
  let next = n;
  const [a, b, c] = order;
  const m0 = next++;
  link(T, m0, a); link(T, m0, b); link(T, m0, c);
  present[a] = present[b] = present[c] = 1;
  const ws = workspace(P, T);
  const tipWS = sideWS(P, 1);
  for (let k = 3; k < n; k++) {
    const x = order[k];
    allDirectional(P, T, ws, a);
    setTip(P, tipWS, x, 0);
    const edges = E.edges(T, a);
    let best = Infinity, cands = [];
    for (const [u, v] of edges) {
      /* edge set of (u, v) joined with the tip */
      const iu = u * 3 + slotOf(T, u, v), iv = v * 3 + slotOf(T, v, u);
      const tmp = sideWS(P, 3);
      copyFrom(P, ws, iu, tmp, 0); copyFrom(P, ws, iv, tmp, 1);
      combine(P, tmp, 0, 1, 2);
      let add;
      if (!P.iw) add = joinCost(P, tmp, 2, tipWS, 0, BIG);
      else {
        let inc = 0;
        const s0 = tmp.pc;
        const acc = new Map();
        joinCost(P, tmp, 2, tipWS, 0, BIG, (q, d) => acc.set(q, (acc.get(q) || 0) + d));
        acc.forEach((d, q) => { const s = s0[2 * P.nq + q]; inc += distortion(P, q, s + d) - distortion(P, q, s); });
        add = inc;
      }
      if (add < best - EPS) { best = add; cands = [[u, v]]; } else if (Math.abs(add - best) <= EPS) cands.push([u, v]);
    }
    /* constraints: try the candidates in order of cost until one keeps them */
    const all = P.constraints.length ? edges.map(e => e) : null;
    let placed = false;
    const tryEdges = all ? cands.concat(all.filter(e => !cands.includes(e))) : cands;
    const pick = tryEdges.length > 1 && !all ? [tryEdges[Math.floor(rng() * cands.length)]] : tryEdges;
    for (const [u, v] of pick) {
      const m = next;
      insertOn(T, x, u, v, m);
      present[x] = 1;
      if (!P.constraints.length || E.satisfies(P, T, present)) { next++; placed = true; break; }
      removeTip(T, x); present[x] = 0;
    }
    if (!placed) { const [u, v] = cands[0]; insertOn(T, x, u, v, next++); present[x] = 1; }
  }
  return T;
};
function copyFrom(P, ws, from, tmp, to) {
  for (let bi = 0; bi < P.blocks.length; bi++) { const B = P.blocks[bi]; tmp.D[bi].set(ws.D[bi].subarray(from * B.SW, from * B.SW + B.SW), to * B.SW); }
  if (P.cont) { const C = P.cont.C; for (let c = 0; c < C; c++) { tmp.lo[to * C + c] = ws.lo[from * C + c]; tmp.hi[to * C + c] = ws.hi[from * C + c]; } }
  tmp.L[to] = ws.L[from];
  if (tmp.pc && ws.pc) for (let q = 0; q < P.nq; q++) tmp.pc[to * P.nq + q] = ws.pc[from * P.nq + q];
}

/* Collects trees as short as the best into a buffer, swapping on every tree of
   the buffer (all the most parsimonious trees reachable by TBR). */
E.collect = function (P, trees, opts) {
  opts = opts || {};
  const max = opts.maxTrees || 100;
  let best = Math.min(...trees.map(t => t.score));
  let buf = [];
  const keys = new Set();
  /* the buffer never holds more than max trees, also when the trees come from several threads */
  trees.filter(t => t.score <= best + EPS).forEach(t => { const k = E.treeKey(t.T); if (!keys.has(k) && buf.length < max) { keys.add(k); buf.push(t); } });
  for (let i = 0; i < buf.length && buf.length < max; i++) {
    if (opts.shouldStop && opts.shouldStop()) break;
    const T = buf[i].T;
    const slowNow = slowFloor(P);
    let better = null;
    const take = (T2, s2) => {
      if (s2 < best - EPS) { better = { T: T2, score: s2 }; return false; }
      if (s2 > best + EPS) return true;
      const k = E.treeKey(T2);
      if (!keys.has(k)) { keys.add(k); buf.push({ T: T2, score: s2 }); if (buf.length >= max) return false; }
      return true;
    };
    if (P.slow.length) boundedMoves(P, T, { bound: best + EPS, slowNow }, take, opts.budget || BUDGET, 0);
    else E.neighbourhood(P, T, { bound: best + EPS, slowNow }, (cut, ea, eb, sc) => {
      if (sc > best + EPS) return true;
      const T2 = E.applyTBR(T, cut, ea, eb);
      if (P.constraints.length && !okTree(P, T2)) return true;
      return take(T2, sc);
    });
    if (better) {
      /* a shorter tree: climb from it and start the buffer again */
      const c = E.climb(P, better.T, opts);
      best = c.score; buf = [{ T: c.T, score: c.score }]; keys.clear(); keys.add(E.treeKey(c.T)); i = -1;
    }
  }
  return { trees: buf, score: best, overflow: buf.length >= max };
};

/* The ratchet (Nixon 1999): perturb the weights of a random fraction of the
   characters, climb under the perturbed weights holding one tree, restore the
   weights and climb again. Keeps the best tree found. */
E.ratchet = function (P, m, mOpts, start, rng, opts) {
  opts = opts || {};
  const iters = opts.iterations || 50, frac = opts.fraction == null ? 0.25 : opts.fraction;
  let best = start, cur = start;
  const pool = [start];
  for (let it = 0; it < iters; it++) {
    if (opts.shouldStop && opts.shouldStop()) break;
    /* perturbed weights: a fraction of the characters counts double */
    const w = m.chars.map(c => (c.weight == null ? 1 : c.weight));
    m.chars.forEach((c, j) => { if (rng() < frac) w[j] *= 2; });
    /* (reading «–» as «?» in this climb would be faster, but it was measured
       to reach worse trees on Wortley et al. 2006 and Zhu et al. 2013) */
    const Pp = E.prepare(m, Object.assign({}, mOpts, { weights: w }));
    const pert = E.climb(Pp, cur.T, { shouldStop: opts.shouldStop });
    const back = E.climb(P, pert.T, { shouldStop: opts.shouldStop });
    if (back.score <= best.score + EPS) {
      if (back.score < best.score - EPS) pool.length = 0;
      pool.push({ T: back.T, score: back.score });
      best = { T: back.T, score: back.score };
    }
    cur = back.score <= cur.score + EPS ? { T: back.T, score: back.score } : cur;
    if (opts.onIteration) opts.onIteration(it + 1, best.score);
  }
  return { best, pool };
};

/* Tree drifting, simplified from Goloboff (1999): rounds where rearrangements
   that cost little are accepted with a probability that falls with their cost,
   each followed by a normal climb. */
E.drift = function (P, start, rng, opts) {
  opts = opts || {};
  const cycles = opts.cycles || 10, moves = opts.moves || 30, maxDelta = opts.maxDelta || 2;
  let best = start, cur = start;
  for (let c = 0; c < cycles; c++) {
    if (opts.shouldStop && opts.shouldStop()) break;
    let T = cur.T, s = cur.score;
    for (let k = 0; k < moves; k++) {
      const cands = [];
      E.neighbourhood(P, T, { bound: s + maxDelta + EPS }, (cut, ea, eb, sc) => { if (cands.length < 400) cands.push([cut, ea, eb, sc]); return true; });
      if (!cands.length) break;
      const [cut, ea, eb, sc] = cands[Math.floor(rng() * cands.length)];
      const d = sc - s;
      if (d <= 0 || rng() < 1 / (1 + 2 * d)) {
        const T2 = E.applyTBR(T, cut, ea, eb);
        if (!P.constraints.length || okTree(P, T2)) { T = T2; s = P.slow.length ? E.score(P, T2) : sc; }
      }
    }
    const back = E.climb(P, T, opts);
    cur = back;
    if (back.score < best.score - EPS) best = back;
  }
  return best;
};

/* Sectorial search, after Goloboff (1999): rearrangements confined to a random
   sector (a clade of the tree rooted on the outgroup), then the whole tree. */
E.sectorial = function (P, start, rng, opts) {
  opts = opts || {};
  const rounds = opts.rounds || 6;
  let best = start;
  for (let r = 0; r < rounds; r++) {
    if (opts.shouldStop && opts.shouldStop()) break;
    const T = best.T, n = T.n;
    /* clades: for each edge, the side without the outgroup taxon */
    const R = rooted(P, T);
    const size = new Int32Array(T.nb.length / 3);
    for (const u of R.post) size[u] = u < n ? 1 : R.kids[u].reduce((a, c) => a + size[c], 0);
    const cand = R.pre.filter(u => u >= n && size[u] >= Math.min(6, n - 2) && size[u] <= Math.max(8, Math.round(n * 0.45)));
    if (!cand.length) break;
    const root = cand[Math.floor(rng() * cand.length)];
    const inSector = new Uint8Array(T.nb.length / 3);
    const st = [root];
    while (st.length) { const u = st.pop(); inSector[u] = 1; for (const c of R.kids[u]) st.push(c); }
    const cuts = E.edges(T).filter(([a, b]) => inSector[a] && inSector[b]);
    let cur = best;
    for (let pass = 0; pass < 4; pass++) {
      let improved = null;
      const take = (T2, s2) => { if (s2 < cur.score - EPS) { improved = { T: T2, score: s2 }; return false; } return true; };
      if (P.slow.length) boundedMoves(P, cur.T, { bound: cur.score - EPS, cuts, slowNow: slowFloor(P) }, take, opts.budget || BUDGET, QUICK);
      else E.neighbourhood(P, cur.T, { bound: cur.score - EPS, cuts }, (cut, ea, eb, sc) => {
        const T2 = E.applyTBR(cur.T, cut, ea, eb);
        if (P.constraints.length && !okTree(P, T2)) return true;
        return take(T2, sc);
      });
      if (!improved) break;
      cur = improved;
    }
    const full = E.climb(P, cur.T, opts);
    if (full.score < best.score - EPS) best = full;
  }
  return best;
};

/* Tree fusing (Goloboff 1999): two trees exchange the subtrees of the clades
   they share (same taxa), keeping every exchange that shortens the tree. */
E.fuse = function (P, trees, opts) {
  opts = opts || {};
  if (trees.length < 2) return trees[0];
  let best = trees.reduce((a, b) => (b.score < a.score ? b : a));
  const toNode = T => {
    const R = rooted(P, T);
    const tips = new Map();
    for (const u of R.post) tips.set(u, u < T.n ? [u] : R.kids[u].flatMap(c => tips.get(c)));
    return { R, tips };
  };
  for (const other of trees) {
    if (other === best) continue;
    const A = toNode(best.T), B = toNode(other.T);
    const keyB = new Map();
    B.tips.forEach((t, u) => { if (u >= other.T.n && t.length >= 3) keyB.set(t.slice().sort((a, b) => a - b).join(','), u); });
    for (const [u, t] of A.tips) {
      if (u < best.T.n || t.length < 3) continue;
      const vB = keyB.get(t.slice().sort((a, b) => a - b).join(','));
      if (vB == null) continue;
      /* graft B's subtree for this clade into A */
      const T2 = graft(best.T, A.R, u, other.T, B.R, vB);
      if (!T2) continue;
      if (P.constraints.length && !okTree(P, T2)) continue;
      const s2 = E.score(P, T2);
      if (s2 < best.score - EPS) { best = { T: T2, score: s2 }; return E.fuse(P, [best].concat(trees.filter(x => x !== other)), opts); }
    }
  }
  return best;
};
/* replaces the clade below node u of tree A by the clade below node v of tree B
   (same taxa); internal nodes are renumbered from A's free ones */
function graft(TA, RA, u, TB, RB, v) {
  const T = E.cloneTree(TA), n = T.n;
  /* free the internal nodes of A's clade (except u, which stays as the clade's root) */
  const freeNodes = [];
  const st = [u];
  const parA = new Int32Array(T.nb.length / 3).fill(-1);
  for (const x of RA.pre) for (const c of RA.kids[x]) parA[c] = x;
  while (st.length) { const x = st.pop(); for (const c of RA.kids[x]) { if (c >= n) { freeNodes.push(c); st.push(c); } } }
  /* detach everything below u */
  const below = [];
  const st2 = [u];
  while (st2.length) { const x = st2.pop(); for (const c of RA.kids[x]) { below.push([x, c]); if (c >= n) st2.push(c); } }
  below.forEach(([x, c]) => unlink(T, x, c));
  /* copy B's structure under v, mapping B's internal nodes to u + free nodes */
  const map = new Map([[v, u]]);
  let fi = 0;
  const st3 = [v];
  while (st3.length) {
    const x = st3.pop();
    for (const c of RB.kids[x]) {
      let cc = c;
      if (c >= n) { if (fi >= freeNodes.length) return null; cc = freeNodes[fi++]; map.set(c, cc); st3.push(c); }
      link(T, map.get(x), cc);
    }
  }
  return T;
}

/* Branch and bound (Hendy and Penny 1982): every tree is built by adding taxa
   one by one, and a partial tree already longer than the best complete tree
   is abandoned with all its descendants. Returns every most parsimonious tree. */
E.branchAndBound = function (P, opts) {
  opts = opts || {};
  const n = P.n;
  /* order: the outgroup first, then the taxa that differ most from what is placed */
  const order = [P.outgroup[0]];
  const left = new Set([...Array(n).keys()].filter(i => i !== order[0]));
  const ws1 = sideWS(P, 2);
  while (left.size) {
    let bestI = -1, bestD = -1;
    left.forEach(i => {
      let d = Infinity;
      order.forEach(o => { setTip(P, ws1, i, 0); setTip(P, ws1, o, 1); d = Math.min(d, joinCost(P, ws1, 0, ws1, 1, BIG)); });
      if (d > bestD) { bestD = d; bestI = i; }
    });
    order.push(bestI); left.delete(bestI);
  }
  let bound = opts.bound != null ? opts.bound + EPS : Infinity;
  let found = [];
  const T = E.emptyTree(n);
  const present = new Uint8Array(n);
  const [a, b, c] = order;
  link(T, n, a); link(T, n, b); link(T, n, c);
  present[a] = present[b] = present[c] = 1;
  let visited = 0;
  const stopAt = opts.maxNodes || 5e7;
  const slowPart = P.slow.length > 0;
  const partialScore = (whole) => {
    /* score of the partial tree, from a tip that is present: a lower bound of
       every tree that grows from it, and the exact score once it is whole */
    const ws = workspace(P, T);
    if (!ws.pc) ws.pc = new Float64Array((T.nb.length / 3) * 3 * P.nq);
    allDirectional(P, T, ws, a);
    const v = T.nb[a * 3], iv = v * 3 + slotOf(T, v, a), ia = a * 3;
    const steps = new Float64Array(P.nq);
    for (let q = 0; q < P.nq; q++) steps[q] = ws.pc[ia * P.nq + q] + ws.pc[iv * P.nq + q];
    joinCost(P, ws, ia, ws, iv, BIG, (q, d) => { steps[q] += d; });
    if (slowPart) {
      /* slow characters on the partial tree: tips not yet present are absent */
      slowStepsPartial(P, T, present, steps, a, whole);
    }
    return E.scoreFromSteps(P, steps);
  };
  const rec = (k, next) => {
    if (visited++ > stopAt || (opts.shouldStop && opts.shouldStop())) return;
    const s = partialScore(k === n);
    if (s > bound) return;
    if (k === n) {
      if (P.constraints.length && !okTree(P, T)) return;
      if (s < bound - 2 * EPS && bound !== Infinity && found.length) found = [];
      if (s < bound - 2 * EPS) { found = []; bound = s + EPS; }
      found.push({ T: E.cloneTree(T), score: s });
      return;
    }
    const x = order[k];
    const edges = E.edges(T, a);
    for (const [u, v] of edges) {
      insertOn(T, x, u, v, next);
      present[x] = 1;
      if (!P.constraints.length || E.satisfies(P, T, present, true)) rec(k + 1, next + 1);
      removeTip(T, x);
      present[x] = 0;
      if (opts.onProgress && k === 3) opts.onProgress(visited, bound);
    }
  };
  rec(3, n + 1);
  return { trees: found, score: found.length ? found[0].score : Infinity, visited, complete: visited <= stopAt };
};
/* slow characters on a partial tree (only the taxa present). The count of the
   inapplicable algorithm can go DOWN when a taxon is added (found comparing
   with full enumeration: one matrix of 40 lost 10 of its 29 shortest trees),
   so it is no bound for the trees that grow from a partial one; there the
   characters keep their shadow («–» read as «?»), which never goes down and
   never exceeds the algorithm, and the exact count waits for the whole tree.
   Step matrices (Sankoff) never go down and are counted exactly. */
function slowStepsPartial(P, T, present, out, root, whole) {
  const n = T.n;
  /* build a rooted view from the root tip over present nodes */
  const N = T.nb.length / 3;
  const kids = Array.from({ length: N }, () => []);
  const m = T.nb[root * 3];
  const order = [m]; const seen = new Uint8Array(N); seen[m] = 1; seen[root] = 1;
  for (let i = 0; i < order.length; i++) { const u = order[i]; for (let s = 0; s < 3; s++) { const v = T.nb[u * 3 + s]; if (v >= 0 && !seen[v]) { seen[v] = 1; kids[u].push(v); order.push(v); } } }
  const R = { r: root, m, kids, post: order.slice().reverse(), pre: order, n, N };
  if (whole && P.inapBlocks.length) inapBlockSteps(P, R, out);
  /* asymmetric step matrices depend on the root, which is only settled on the
     whole tree: on a partial one they keep their shadow (a lower bound from
     any root) */
  for (const sc of P.slow) {
    if (sc.inBlock || (!whole && (sc.kind === 'inap' || (sc.asym && P.outgroup.length > 1)))) continue;
    if (sc.asym && P.outgroup.length > 1) out[sc.q] = sankoffLen(sc, rootedOnOutgroup(P, T, R));
    else out[sc.q] = sc.kind === 'inap' ? inapLen(sc, R) : sankoffLen(sc, R);
  }
  void present;
}

/* ================================================================
   6 · a whole search
   ================================================================ */
/* opts: { method: 'exact' | 'heuristic' | 'ratchet' | 'combined', replicates,
   ratchetIterations, ratchetFraction, maxTrees, seed, shouldStop, onProgress } */
E.search = function (m, prepOpts, opts) {
  opts = opts || {};
  const P = E.prepare(m, prepOpts);
  const rng = rngOf(opts.seed == null ? 1 : opts.seed);
  const t0 = Date.now();
  const history = [];
  const progress = (frac, msg, best) => { if (opts.onProgress) opts.onProgress(frac, msg, best); };
  const stop = opts.shouldStop || (() => false);
  let pool = [];
  let hits = 0, reps = 0;
  if (opts.method === 'exact') {
    /* a heuristic bound first, then branch and bound */
    const w = E.climb(P, E.wagner(P, rng), { shouldStop: stop });
    const bb = E.branchAndBound(P, { bound: okTree(P, w.T) ? w.score : undefined, shouldStop: stop, onProgress: (v, b) => progress(0.5, 'bb', b) });
    pool = bb.trees;
    history.push({ step: 1, best: bb.score });
    return finish(P, pool, { method: 'exact', complete: bb.complete, visited: bb.visited, time: Date.now() - t0, history, hits: null, reps: 1 });
  }
  const R = opts.replicates || 10;
  let best = Infinity;
  for (let r = 0; r < R; r++) {
    if (stop()) break;
    reps++;
    const start = E.wagner(P, rng);
    let res = E.climb(P, start, { shouldStop: stop });
    /* progress inside the replicate too (a replicate of a large matrix can take tens of seconds) */
    progress((r + 0.05) / R, 'rep', Math.min(best, res.score));
    if (opts.method === 'ratchet' || opts.method === 'combined') {
      const its = opts.ratchetIterations || 30;
      const rt = E.ratchet(P, m, prepOpts, res, rng, { iterations: its, fraction: opts.ratchetFraction, shouldStop: stop, onIteration: (it, b) => progress((r + 0.05 + 0.85 * it / its) / R, 'rep', Math.min(best, b)) });
      res = rt.best;
      rt.pool.forEach(p => pool.push(p));
    }
    if (opts.method === 'combined') {
      res = E.sectorial(P, res, rng, { rounds: 4, shouldStop: stop });
      res = E.drift(P, res, rng, { cycles: 4, moves: 12, shouldStop: stop });
    }
    pool.push(res);
    if (res.score < best - EPS) { best = res.score; hits = 1; } else if (Math.abs(res.score - best) <= EPS) hits++;
    history.push({ step: r + 1, best, found: res.score });
    progress((r + 1) / R, 'rep', best);
  }
  if (opts.method === 'combined' && pool.length > 1 && !stop()) {
    const fused = E.fuse(P, pool.filter(p => p.score <= best + 3));
    pool.push(fused);
    if (fused.score < best - EPS) { best = fused.score; hits = 1; }
  }
  /* every equally short tree reachable by TBR from the best ones */
  const col = E.collect(P, pool.filter(p => p.score <= best + EPS), { maxTrees: opts.maxTrees || 100, shouldStop: stop });
  return finish(P, col.trees, { method: opts.method || 'heuristic', overflow: col.overflow, time: Date.now() - t0, history, hits, reps });
};
/* Merges trees found elsewhere (other threads), given as Newick, and swaps on
   the shortest ones to collect every equally short tree. */
E.collectNewicks = function (m, prepOpts, newicks, opts) {
  opts = opts || {};
  const t0 = Date.now();
  const P = E.prepare(m, prepOpts);
  const trees = newicks.map(nw => { const T = E.fromNodeTree(P, g.Tree.parseNewick(nw, P.names)); return { T, score: E.score(P, T) }; });
  const col = E.collect(P, trees, { maxTrees: opts.maxTrees || 100, shouldStop: opts.shouldStop });
  return finish(P, col.trees, { method: 'collect', overflow: col.overflow, time: Date.now() - t0, history: [], hits: null, reps: 0 });
};

/* Successive weighting (Farris 1969): search, weight every character by an
   index of its fit on the trees found (RC by default, as Carpenter 1988
   advised; CI or RI also), search again with those weights, and repeat until
   the weights stop changing. Weights are integers 0 … base. A character that
   cannot choose among trees (uninformative) gets weight 0. */
E.successive = function (m, prepOpts, searchOpts, sw) {
  sw = sw || {};
  const base = sw.base || 10, index = sw.index || 'rc', how = sw.how || 'max', maxIter = sw.maxIter || 10;
  let weights = m.chars.map(c => (c.weight == null ? 1 : c.weight));
  const log = [];
  let res = null;
  for (let it = 0; it < maxIter; it++) {
    if (searchOpts.shouldStop && searchOpts.shouldStop()) break;
    res = E.search(m, Object.assign({}, prepOpts, { weights, criterion: 'ew' }), Object.assign({}, searchOpts, { seed: (searchOpts.seed || 1) + it }));
    /* the indices of every character (also those weighted 0 in this round) on every tree found */
    const P = E.prepare(m, Object.assign({}, prepOpts, { weights: m.chars.map(() => 1), criterion: 'ew' }));
    const stepsOf = res.trees.map(t => E.evaluate(P, E.fromNodeTree(P, g.Tree.parseNewick(t.newick, P.names))).steps);
    const next = weights.slice();
    P.chars.forEach(rec => {
      const vals = stepsOf.map(st => {
        const s = st[rec.q];
        const mn = P.minSteps[rec.q], mx = P.maxSteps[rec.q];
        const ci = s > 0 ? mn / s : 1;
        const ri = mx > mn ? (mx - s) / (mx - mn) : null;
        if (ri == null) return null;
        return index === 'ci' ? ci : index === 'ri' ? ri : ci * ri;
      }).filter(v => v != null);
      const v = !vals.length ? 0 : how === 'min' ? Math.min(...vals) : how === 'mean' ? vals.reduce((a, b) => a + b, 0) / vals.length : Math.max(...vals);
      next[rec.j] = Math.max(0, Math.round(v * base));
    });
    /* characters left out of the analysis keep weight 0 */
    m.chars.forEach((c, j) => { if (!P.chars.some(r => r.j === j)) next[j] = 0; });
    const same = next.every((w, j) => w === weights[j]);
    log.push({ iteration: it + 1, length: res.length, trees: res.trees.length, weights: next.slice(), changed: next.filter((w, j) => w !== weights[j]).length });
    weights = next;
    if (same) break;
  }
  return Object.assign({}, res, { weights, log });
};
/* ================================================================
   7 · support of groups (Block 7)
   ================================================================ */
/* the groups of a tree as strings of 0/1 over the taxa: the side of every
   internal branch without the first outgroup taxon (the root of a cladogram) */
E.groupKeys = function (P, T) {
  const r = P.outgroup[0], n = P.n;
  return E.splits(T, r).map(a => { let s = ''; for (let i = 0; i < n; i++) s += (a[i >>> 5] >>> (i & 31)) & 1 ? '1' : '0'; return s; });
};
/* the weights of one pseudoreplicate, by character of the matrix: bootstrap
   (Felsenstein 1985: as many characters as there are, drawn with
   replacement), jackknife (Farris et al. 1996: each character deleted with
   probability p) or symmetric resampling (Goloboff et al. 2003: each
   character changed with probability p, half of them deleted and half
   doubled). The matrix weights multiply the factors. */
E.resampleWeights = function (m, method, p, rng) {
  const act = [];
  m.chars.forEach((c, j) => { if (c.active !== false && (c.weight == null ? 1 : c.weight) > 0) act.push(j); });
  const f = new Float64Array(m.chars.length);
  if (method === 'boot') { for (let k = 0; k < act.length; k++) f[act[Math.floor(rng() * act.length)]]++; }
  else if (method === 'jack') act.forEach(j => { f[j] = rng() < p ? 0 : 1; });
  else act.forEach(j => { const u = rng(); f[j] = u < p / 2 ? 0 : u < p ? 2 : 1; });
  return m.chars.map((c, j) => (c.weight == null ? 1 : c.weight) * f[j]);
};
/* Resampling: opts { method: 'boot' | 'jack' | 'sym', reps, first (number of
   the first replicate), seed, p, weightsList (given weights, for checking),
   search: { method: 'heuristic' | 'exact', replicates, maxTrees } } →
   { counts: {group: replicates}, reps }. Each replicate counts the groups of
   the strict consensus of the trees it found. Each one draws from a seed of
   its own, so the result does not depend on how the replicates are shared
   among threads. */
E.resample = function (m, prepOpts, opts) {
  const counts = new Map();
  let done = 0;
  const so = opts.search || {};
  const reps = opts.weightsList ? opts.weightsList.length : opts.reps;
  for (let r = 0; r < reps; r++) {
    if (opts.shouldStop && opts.shouldStop()) break;
    const idx = (opts.first || 0) + r;
    const rng = rngOf(((opts.seed || 1) * 1000003 + idx * 7919 + 17) >>> 0);
    const w = opts.weightsList ? opts.weightsList[r] : E.resampleWeights(m, opts.method, opts.p, rng);
    let P;
    try { P = E.prepare(m, Object.assign({}, prepOpts, { weights: w })); } catch (e) { continue; }
    let trees;
    if (so.method === 'exact') trees = E.branchAndBound(P, { shouldStop: opts.shouldStop }).trees;
    else {
      const pool = [];
      let best = Infinity;
      for (let k = 0; k < (so.replicates || 2); k++) { const c = E.climb(P, E.wagner(P, rng), { shouldStop: opts.shouldStop }); pool.push(c); best = Math.min(best, c.score); }
      trees = E.collect(P, pool.filter(x => x.score <= best + EPS), { maxTrees: so.maxTrees || 20, shouldStop: opts.shouldStop }).trees;
    }
    /* the groups common to every tree found */
    let common = null;
    trees.forEach(t => { const ks = new Set(E.groupKeys(P, t.T)); common = common ? new Set([...common].filter(k => ks.has(k))) : ks; });
    (common || new Set()).forEach(k => counts.set(k, (counts.get(k) || 0) + 1));
    done++;
    if (opts.onProgress && (r % 2 === 1 || r === reps - 1)) opts.onProgress((r + 1) / reps);
  }
  const out = {};
  counts.forEach((v, k) => { out[k] = v; });
  return { counts: out, reps: done };
};
/* Trees up to `delta` longer than the shortest, as the parsimony programs keep
   them for Bremer support: TBR from every tree kept, keeping the
   rearrangements within best + delta, up to maxTrees. */
E.suboptimal = function (P, trees, opts) {
  opts = opts || {};
  const delta = opts.delta == null ? 1 : opts.delta, max = opts.maxTrees || 1000;
  let best = Math.min(...trees.map(t => t.score));
  const keys = new Set(), buf = [];
  trees.forEach(t => { const k = E.treeKey(t.T); if (!keys.has(k)) { keys.add(k); buf.push(t); } });
  const slowNow = slowFloor(P);
  for (let i = 0; i < buf.length && buf.length < max; i++) {
    if (opts.shouldStop && opts.shouldStop()) break;
    const T = buf[i].T;
    const take = (T2, s2) => {
      if (s2 < best - EPS) best = s2;
      if (s2 > best + delta + EPS) return true;
      const k = E.treeKey(T2);
      if (!keys.has(k)) { keys.add(k); buf.push({ T: T2, score: s2 }); if (buf.length >= max) return false; }
      return true;
    };
    if (P.slow.length) boundedMoves(P, T, { bound: best + delta + EPS, slowNow }, take, opts.budget || BUDGET, 0);
    else E.neighbourhood(P, T, { bound: best + delta + EPS, slowNow }, (cut, ea, eb, sc) => {
      const T2 = E.applyTBR(T, cut, ea, eb);
      if (P.constraints.length && !okTree(P, T2)) return true;
      return take(T2, sc);
    });
    if (opts.onProgress && i % 10 === 0) opts.onProgress(Math.min(0.99, buf.length / max));
  }
  return { trees: buf.filter(t => t.score <= best + delta + EPS), best, overflow: buf.length >= max };
};
/* the same from trees given as Newick (the shortest ones), with the groups and
   the steps by character of every tree kept */
E.suboptimalNewicks = function (m, prepOpts, newicks, opts) {
  const P = E.prepare(m, prepOpts);
  const start = newicks.map(nw => { const T = E.fromNodeTree(P, g.Tree.parseNewick(nw, P.names)); return { T, score: E.score(P, T) }; });
  const r = E.suboptimal(P, start, opts);
  return {
    best: r.best, overflow: r.overflow,
    trees: r.trees.map(t => { const ev = E.evaluate(P, t.T); const byChar = {}; P.chars.forEach(rec => { byChar[rec.j] = ev.steps[rec.q]; }); return { score: t.score, keys: E.groupKeys(P, t.T), byChar }; }),
  };
};

function finish(P, trees, info) {
  const out = trees.map(t => {
    const ev = E.evaluate(P, t.T);
    /* steps by character of the matrix (index j), so they survive any weighting */
    const byChar = {};
    P.chars.forEach(rec => { byChar[rec.j] = ev.steps[rec.q]; });
    return { newick: E.toNewick(P, t.T), score: t.score, length: ev.length, steps: Array.from(ev.steps), byChar, keys: E.groupKeys(P, t.T) };
  });
  return Object.assign({ trees: out, score: out.length ? out[0].score : Infinity, length: out.length ? out[0].length : Infinity, criterion: P.crit, n: P.n }, info);
}
function rngOf(seed) {
  let a = 0x9e3779b9, b = 0x243f6a88, c = 0xb7e15162, d = (seed >>> 0) ^ 0xdeadbeef;
  const next = () => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0; a = b ^ (b >>> 9); b = (c + (c << 3)) | 0; c = (c << 21) | (c >>> 11); d = (d + 1) | 0; t = (t + d) | 0; c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
  for (let i = 0; i < 15; i++) next();
  return next;
}
E.rng = rngOf;

g.Engine = E;
return E;
}
if (typeof window !== 'undefined') EngineCore(window);
