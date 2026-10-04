/* CladisticsPro — morphological cladistics in the browser.
   Copyright (C) 2026  Luis Ángel Barrera-Guzmán

   This program is free software: you can redistribute it and/or modify it under
   the terms of the GNU General Public License as published by the Free Software
   Foundation, either version 3 of the License, or (at your option) any later
   version. It is distributed in the hope that it will be useful, but WITHOUT ANY
   WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
   A PARTICULAR PURPOSE. See the GNU General Public License, in the file LICENSE
   at the root of this program, or <https://www.gnu.org/licenses/>. */

/* CladisticsPro — every character mapped on one cladogram (Blocks 5 and 6).

   The search engine only counts; this module says where each change happened,
   with the same rules, so that the length shown under a cladogram is the
   length the search found:

   · discrete characters (unordered, ordered, step matrices; «–» read as «?»
     when so chosen): the cost-matrix optimization of optimize.js, with its MPR
     sets and its ACCTRAN and DELTRAN reconstructions;
   · characters with «–» under the inapplicable algorithm (Brazeau, Guillerme
     and Smith 2019): the four passes of the algorithm decide which nodes are
     applicable; the applicable nodes form REGIONS (connected parts of the
     tree) and the length is the changes inside every region plus one step for
     each region after the first — checked equal to the algorithm on 5236
     characters of 30 published matrices. Inside each region the ordinary
     reconstruction places the changes. The algorithm is defined on binary
     trees: on a tree with polytomies «–» is read as «?» (and it is said);
   · continuous characters: linear parsimony (Farris 1970), exactly, by the
     cost-matrix method over the values seen at the tips (an optimal
     reconstruction always exists with those values), which also gives each
     node its interval of most parsimonious values (Swofford and Maddison
     1987); scaled as the search scales them.

   Bounds for the indices (CI, RI): the fewest and the most steps a character
   can take on any tree. With «–», the most steps also counts the applicable
   regions that the inapplicable taxa make room for. */
function MappingCore(g) {
const Mp = {};
const INF = 1e15;
const MASK = (1 << 30) - 1;
const bitsOf = m => { const out = []; for (let s = 0; m; s++, m >>>= 1) if (m & 1) out.push(s); return out; };
const popc = m => { let c = 0; while (m) { m &= m - 1; c++; } return c; };

/* ---------------- the characters, as the analysis reads them ----------------
   m: the matrix of matrix.js. o: { inapplicable, continuous, weights } as for
   the search. Taxa: the active ones, in order (tip i of a mapped tree is the
   i-th active taxon). */
Mp.prepare = function (m, o) {
  o = o || {};
  const Mx = g.Mx, Opt = g.Opt;
  const rows = [];
  m.taxa.forEach((t, i) => { if (t.active !== false) rows.push(i); });
  const n = rows.length;
  const inapAlg = o.inapplicable === 'algorithm';
  const contMode = o.continuous || 'scaled';
  const chars = [];
  m.chars.forEach((c, j) => {
    if (c.active === false) return;
    const w0 = o.weights ? o.weights[j] : (c.weight == null ? 1 : c.weight);
    const w = c.type === 'cont' ? +w0 || 0 : Math.round(+w0 || 0);
    const col = rows.map(i => m.cells[i][j]);
    const base = { j, name: c.name || '', w, states: c.states || [], unit: c.unit || '' };
    if (c.type === 'cont') {
      const vals = col.filter(Array.isArray);
      let lo = Infinity, hi = -Infinity;
      vals.forEach(v => { lo = Math.min(lo, v[0]); hi = Math.max(hi, v[1]); });
      const scale = contMode === 'scaled' ? (hi > lo ? 1 / (hi - lo) : 1) : 1;
      const iv = col.map(v => (Array.isArray(v) ? v : null));
      const ch = Object.assign(base, { kind: 'cont', type: 'cont', iv, scale, lo, hi, off: contMode === 'off' || vals.length < 2 });
      /* bounds: the narrowest window that meets every interval, and the bush */
      const given = iv.filter(Boolean);
      ch.min = given.length ? Math.max(0, Math.max(...given.map(v => v[0])) - Math.min(...given.map(v => v[1]))) * scale : 0;
      let mx = given.length ? Infinity : 0;
      given.forEach(a => [a[0], a[1]].forEach(x => { let s = 0; given.forEach(b => { s += x < b[0] ? b[0] - x : x > b[1] ? x - b[1] : 0; }); mx = Math.min(mx, s); }));
      ch.max = mx * scale;
      chars.push(ch);
      return;
    }
    let k = Math.max(2, c.states ? c.states.length : 2);
    col.forEach(v => { if (typeof v === 'number' && v > 0) { const b = bitsOf(v & MASK); if (b.length) k = Math.max(k, b[b.length - 1] + 1); } });
    k = Math.min(30, k);
    const full = (1 << k) - 1;
    const hasGap = col.some(v => v === Mx.GAP);
    const inap = inapAlg && hasGap && c.type !== 'ord';
    const type = c.type === 'ord' ? 'ord' : c.type === 'step' && !inap ? 'step' : 'unord';
    const cost = Opt.costMatrix(type, k, type === 'step' ? c.cost : null);
    const appMask = v => (typeof v === 'number' && v > 0 ? ((v & MASK) & full) || full : full);
    const masks = col.map(appMask);
    const ch = Object.assign(base, { kind: inap ? 'inap' : 'disc', type, k, cost, masks });
    if (inap) {
      const I = 1 << k;
      ch.I = I;
      ch.tips = col.map(v => (v === Mx.GAP ? I : v === Mx.MISSING ? (full | I) : appMask(v)));
      const b = Mp.inapBounds(col.map(v => (v === Mx.GAP ? 'gap' : v === Mx.MISSING ? 'any' : appMask(v))), full);
      ch.min = b.min; ch.max = b.max;
    } else {
      /* «?» and «–» are full masks: they do not bound anything */
      const obs = col.map(v => (typeof v === 'number' && v > 0 ? appMask(v) : 0));
      ch.min = Opt.minSteps(obs, k, type, cost) || 0;
      ch.max = Opt.maxSteps(obs, k, cost);
    }
    chars.push(ch);
  });
  return { rows, n, names: rows.map(i => m.taxa[i].name), chars, opts: o };
};

/* ---------------- bounds with «–» ----------------
   cells: per taxon a mask of applicable states, 'gap' or 'any' («?»). A «?»
   is taken as inapplicable when more than one taxon is plainly «–».

   · The fewest steps: every applicable taxon in a single region, where the
     character needs the fewest states that meet all its cells, minus one
     (optimize.js computes that cover exactly).
   · The most: on a tree, a step of the applicable part is the union of two
     sets of states with nothing in common. So the cells are joined two at a
     time while two of them are disjoint, and each join counts one step. At
     each turn the cell with most states that is still looking for a partner
     is joined to the disjoint cell that gives the largest union (the most
     frequent one, among equals); a cell without any disjoint partner stops
     looking. Then each applicable region beyond the first adds one step: the
     inapplicable taxa make room for one region fewer than their number, and
     there cannot be more regions than cells left. */
Mp.inapBounds = function (cells, full) {
  const nGap = cells.filter(c => c === 'gap').length;
  const asApp = c => (c === 'gap' ? 0 : c === 'any' ? (nGap > 1 ? 0 : full) : c);
  const x = cells.map(asApp);
  const k = Math.max(1, 32 - Math.clz32(full));
  const unord = g.Opt.costMatrix('unord', k);
  const app = x.filter(v => v > 0);
  const min = g.Opt.minSteps(app, k, 'unord', unord) || 0;
  return { min, max: mostSteps(app, x.length - app.length) };
};
function mostSteps(app, nInapp) {
  const room = Math.max(1, nInapp - 1);
  const tally = new Map();
  app.forEach(v => tally.set(v, (tally.get(v) || 0) + 1));
  let joins = 0;
  if (tally.size > 1) {
    const top = Math.max(...app);
    const width = 32 - Math.clz32(top);
    const all = width >= 31 ? MASK : (1 << width) - 1;
    /* the cells that no longer look for a partner; the cell with every state never does */
    const quiet = new Set([all]);
    const live = () => [...tally.keys()].filter(v => tally.get(v) > 0 && !quiet.has(v)).sort((a, b) => a - b);
    let settled = false;
    for (let turn = 0; turn < 100000 && !settled; turn++) {
      const cand = live();
      if (!cand.length) { settled = true; break; }
      const most = Math.max(...cand.map(popc));
      /* the unions to try, the largest first (or, if no union can be larger, the one size there is) */
      const sizes = [];
      if (width > most) for (let u = width; u > most; u--) sizes.push(u);
      else for (let u = width; u <= most + 1; u++) sizes.push(u);
      let joined = false;
      for (const u of sizes) {
        for (const a of live()) {
          if (popc(a) !== most) continue;
          const partners = live().filter(b => (a & b) === 0);
          if (!partners.length) { quiet.add(a); continue; }
          let pick = -1;
          partners.forEach(b => { if (popc(a | b) === u && (pick < 0 || tally.get(b) > tally.get(pick))) pick = b; });
          if (pick < 0) continue;
          tally.set(a, tally.get(a) - 1);
          tally.set(pick, tally.get(pick) - 1);
          tally.set(a | pick, (tally.get(a | pick) || 0) + 1);
          joins++;
          joined = true;
          break;
        }
        if (joined) break;
      }
    }
    if (!settled) return g.Opt.maxSteps(app, width, g.Opt.costMatrix('unord', width)) + Math.max(0, Math.min(app.length, room) - 1);
  }
  let left = 0;
  tally.forEach(c => { left += c; });
  return joins + Math.max(0, Math.min(left, room) - 1);
}

/* ---------------- the four passes of the inapplicable algorithm ----------------
   On a rooted binary tree (tree.js); tip(i) is a mask with bit k = «–».
   Returns the final set of every node (the sets a figure of the character
   draws). The passes are those of the paper: a first down pass and up pass
   decide applicability, a second down pass fixes it. */
Mp.inapSets = function (root, tip, k) {
  const Tree = g.Tree;
  const I = 1 << k, APP = I - 1;
  const post = Tree.postorder(root), pre = Tree.preorder(root);
  const st = new Map();
  for (const v of post) st.set(v, v.children.length ? 0 : (v.tip >= 0 ? tip(v.tip) : (APP | I)));
  for (const v of post) {
    if (!v.children.length) continue;
    const l = st.get(v.children[0]), r = st.get(v.children[1]);
    const c = l & r;
    if (c) st.set(v, (c === I && (l & APP) && (r & APP)) ? (l | r) : c);
    else st.set(v, ((l & APP) && (r & APP)) ? ((l | r) & APP) : (l | r));
  }
  for (const v of pre) {
    if (!v.children.length) continue;
    const nS = st.get(v);
    const a = v === root ? (nS !== I ? nS & APP : nS) : st.get(v.parent);
    const l = st.get(v.children[0]), r = st.get(v.children[1]);
    if (nS & I) {
      if (nS & APP) st.set(v, (a & I) ? I : (nS & APP));
      else if (!(a & I)) st.set(v, ((l & APP) || (r & APP)) ? ((l | r) & APP) : I);
    }
  }
  for (const v of post) {
    if (v.children.length || !v.parent) continue;
    const nS = st.get(v), a = st.get(v.parent);
    if ((nS & I) && (nS & APP)) st.set(v, a === I ? I : (nS & APP));
  }
  for (const v of post) {
    if (!v.children.length) continue;
    if (!(st.get(v) & APP)) continue;
    const l = st.get(v.children[0]), r = st.get(v.children[1]);
    const c = l & r;
    if (c) st.set(v, (c & APP) ? (c & APP) : I);
    else st.set(v, (l | r) & APP);
  }
  return st;
};

/* ---------------- continuous characters: linear parsimony ---------------- */
/* min over y of f(y) + |x − y| on a sorted grid, for every x: two sweeps */
function envelope(f, vals) {
  const G = vals.length, h = Float64Array.from(f);
  for (let i = 1; i < G; i++) h[i] = Math.min(h[i], h[i - 1] + (vals[i] - vals[i - 1]));
  for (let i = G - 2; i >= 0; i--) h[i] = Math.min(h[i], h[i + 1] + (vals[i + 1] - vals[i]));
  return h;
}
function mapCont(ch, root) {
  const Tree = g.Tree;
  const vals = [...new Set(ch.iv.filter(Boolean).flatMap(v => [v[0], v[1]]))].sort((a, b) => a - b);
  const G = vals.length;
  const post = Tree.postorder(root), pre = Tree.preorder(root);
  if (!G || ch.off) return { kind: 'cont', steps: 0, raw: 0, mpr: new Map(), acctran: { states: new Map(), changes: [] }, deltran: { states: new Map(), changes: [] }, off: true };
  const Gd = new Map(), env = new Map();
  for (const v of post) {
    const f = new Float64Array(G);
    if (!v.children.length) {
      const a = v.tip >= 0 ? ch.iv[v.tip] : null;
      if (a) for (let i = 0; i < G; i++) f[i] = vals[i] >= a[0] - 1e-12 && vals[i] <= a[1] + 1e-12 ? 0 : INF;
    } else {
      for (const c of v.children) { const e = env.get(c); for (let i = 0; i < G; i++) f[i] += e[i]; }
    }
    Gd.set(v, f);
    env.set(v, envelope(f, vals));
  }
  const gr = Gd.get(root);
  let length = INF;
  for (let i = 0; i < G; i++) length = Math.min(length, gr[i]);
  /* up pass: F(v, x) = the whole tree with v at x */
  const F = new Map([[root, gr]]);
  for (const v of pre) {
    if (!v.children.length) continue;
    const fv = F.get(v);
    for (const c of v.children) {
      const ec = env.get(c), rest = new Float64Array(G);
      for (let i = 0; i < G; i++) rest[i] = fv[i] - ec[i];
      const er = envelope(rest, vals), gc = Gd.get(c), fc = new Float64Array(G);
      for (let i = 0; i < G; i++) fc[i] = gc[i] + er[i];
      F.set(c, fc);
    }
  }
  const tol = 1e-9 * Math.max(1, length);
  const mpr = new Map();
  for (const v of post) {
    const f = F.get(v);
    let a = -1, b = -1;
    for (let i = 0; i < G; i++) if (f[i] <= length + tol) { if (a < 0) a = i; b = i; }
    mpr.set(v, [vals[a], vals[b]]);
  }
  /* the two named reconstructions: the root at the value of its interval
     nearest the outgroup; each child, among its best values given the parent,
     the nearest (DELTRAN) or the farthest (ACCTRAN) from the parent */
  const build = kind => {
    const st = new Map();
    const rm = mpr.get(root);
    const og = root.children[0];
    const ogv = og && mpr.get(og) ? (mpr.get(og)[0] + mpr.get(og)[1]) / 2 : rm[0];
    st.set(root, Math.min(rm[1], Math.max(rm[0], ogv)));
    for (const v of pre) {
      if (v === root) continue;
      const x = st.get(v.parent), gc = Gd.get(v);
      /* the candidates: the values of the grid and the parent's own value,
         which may fall between two of them (the cost is linear there) */
      const cand = [];
      for (let i = 0; i < G; i++) cand.push([vals[i], gc[i]]);
      if (!vals.includes(x)) {
        const i = vals.findIndex(y => y > x);
        if (i > 0) {
          const a = gc[i - 1], b = gc[i];
          const gx = a >= INF / 2 || b >= INF / 2 ? INF : a + (b - a) * (x - vals[i - 1]) / (vals[i] - vals[i - 1]);
          cand.push([x, gx]);
        }
      }
      let best = INF;
      cand.forEach(([y, gy]) => { best = Math.min(best, gy + Math.abs(y - x)); });
      let pick = null;
      cand.forEach(([y, gy]) => {
        if (gy + Math.abs(y - x) > best + tol) return;
        if (pick == null) pick = y;
        else if (kind === 'deltran' ? Math.abs(y - x) < Math.abs(pick - x) : Math.abs(y - x) > Math.abs(pick - x)) pick = y;
      });
      st.set(v, pick);
    }
    const changes = [];
    for (const v of pre) if (v !== root && Math.abs(st.get(v) - st.get(v.parent)) > tol) changes.push({ node: v, from: st.get(v.parent), to: st.get(v), delta: st.get(v) - st.get(v.parent) });
    return { states: st, changes };
  };
  const acctran = build('acctran'), deltran = build('deltran');
  const key = c => c.from + '>' + c.to;
  const dk = new Map(deltran.changes.map(c => [c.node, key(c)]));
  const ak = new Map(acctran.changes.map(c => [c.node, key(c)]));
  acctran.changes.forEach(c => { c.unambiguous = dk.get(c.node) === key(c); });
  deltran.changes.forEach(c => { c.unambiguous = ak.get(c.node) === key(c); });
  return { kind: 'cont', raw: length, steps: length * ch.scale, mpr, acctran, deltran };
}

/* ---------------- one character on one tree ---------------- */
function mapDisc(ch, root) {
  const r = g.Opt.character(root, i => ch.masks[i], ch.k, ch.cost);
  return { kind: 'disc', steps: r.length, mpr: r.mpr, acctran: r.acctran, deltran: r.deltran, rootCandidates: r.rootCandidates };
}
function mapInap(ch, root) {
  const Tree = g.Tree, Opt = g.Opt;
  const k = ch.k, I = ch.I, APP = I - 1;
  const st = Mp.inapSets(root, i => ch.tips[i], k);
  const app = v => (st.get(v) & APP) !== 0;
  const mpr = new Map(), applicable = new Map();
  const acc = { states: new Map(), changes: [], rootStates: [] }, del = { states: new Map(), changes: [], rootStates: [] };
  Tree.postorder(root).forEach(v => { applicable.set(v, app(v)); if (!app(v)) mpr.set(v, 0); });
  let regions = 0, inside = 0;
  const regionRoots = [];
  for (const v of Tree.preorder(root)) {
    if (!app(v) || (v.parent && app(v.parent))) continue;
    regions++;
    regionRoots.push(v);
    /* the region: a copy of the clade without its inapplicable parts */
    const map = new Map();
    const cp = Tree.clone(v, map);
    const back = new Map();
    map.forEach((b, a) => back.set(b, a));
    for (const u of Tree.postorder(cp)) u.children = u.children.filter(c => app(back.get(c)));
    const r = Opt.character(cp, i => (ch.tips[i] & APP) || APP, k, ch.cost);
    inside += r.length;
    r.mpr.forEach((mk, u) => mpr.set(back.get(u), mk));
    [[r.acctran, acc], [r.deltran, del]].forEach(([src, dst]) => {
      src.states.forEach((s, u) => dst.states.set(back.get(u), s));
      src.changes.forEach(c => dst.changes.push(Object.assign({}, c, { node: back.get(c.node) })));
      dst.rootStates.push(src.rootState);
    });
  }
  /* homoplasy across the whole tree: a state arises at the start of every
     region and with every change into it */
  [acc, del].forEach(rec => {
    const arises = new Int32Array(k);
    rec.rootStates.forEach(s => { if (s != null) arises[s]++; });
    rec.changes.forEach(c => arises[c.to]++);
    rec.changes.forEach(c => { c.homoplastic = arises[c.to] > 1; });
  });
  return { kind: 'inap', steps: inside + Math.max(0, regions - 1), inside, regions, regionRoots, mpr, applicable, acctran: acc, deltran: del };
}

/* M: from Mp.prepare. root: a rooted tree of tree.js whose tips are the
   active taxa. opts.optimization: 'acctran' | 'deltran' | 'unambiguous'
   (the changes common to both). Returns per character its mapping and its
   indices, per node the changes on the branch above it, and the totals. */
Mp.map = function (M, root, opts) {
  opts = opts || {};
  const kind = opts.optimization || 'acctran';
  /* opts.indicesOnly: the length and the indices, without the reconstructions
     of the plain discrete characters (the same steps, much faster; used for
     the lists of trees) */
  const lite = !!opts.indicesOnly;
  const binary = g.Tree.isBinary(root);
  const per = [];
  const byNode = new Map();
  let length = 0, sumM = 0, sumS = 0, sumG = 0, fallback = 0;
  M.chars.forEach((ch, c) => {
    let r;
    if (ch.kind === 'cont') r = mapCont(ch, root);
    else if (ch.kind === 'inap' && binary) r = mapInap(ch, root);
    else if (lite) { r = { kind: 'disc', steps: g.Opt.character(root, i => ch.masks[i], ch.k, ch.cost, { lengthOnly: true }).length }; if (ch.kind === 'inap') { r.fallback = true; fallback++; } }
    else { r = mapDisc(ch, root); if (ch.kind === 'inap') { r.fallback = true; fallback++; } }
    const s = r.steps;
    const min = r.fallback ? g.Opt.minSteps(ch.masks.map(x => (popc(x) < ch.k ? x : 0)), ch.k, 'unord', ch.cost) : ch.min;
    const max = r.fallback ? g.Opt.maxSteps(ch.masks.map(x => (popc(x) < ch.k ? x : 0)), ch.k, ch.cost) : ch.max;
    r.min = min; r.max = max;
    r.ci = s > 1e-12 ? min / s : null;
    r.ri = max != null && max > min + 1e-12 ? (max - s) / (max - min) : null;
    r.rc = r.ci != null && r.ri != null ? r.ci * r.ri : null;
    r.informative = max != null && max > min + 1e-12;
    r.ch = ch; r.c = c;
    per.push(r);
    if (!(ch.kind === 'cont' && r.off)) length += ch.w * s;
    if (ch.kind !== 'cont' && max != null) { sumM += min; sumS += s; sumG += max; }
    if (lite) return;
    /* the changes of the chosen reconstruction, by branch */
    const rec = kind === 'deltran' ? r.deltran : r.acctran;
    rec.changes.forEach(chg => {
      if (kind === 'unambiguous' && !chg.unambiguous) return;
      if (!byNode.has(chg.node)) byNode.set(chg.node, []);
      byNode.get(chg.node).push(Object.assign({ c, j: ch.j, kind: ch.kind }, chg));
    });
  });
  const ci = sumS > 0 ? sumM / sumS : null;
  const ri = sumG > sumM ? (sumG - sumS) / (sumG - sumM) : null;
  return { root, per, byNode, length, ci, ri, rc: ci != null && ri != null ? ci * ri : null, binary, fallback, optimization: kind };
};

g.Mapping = Mp;
return Mp;
}
if (typeof window !== 'undefined') MappingCore(window);
