/* CladisticsPro — morphological cladistics in the browser.
   Copyright (C) 2026  Luis Ángel Barrera-Guzmán

   This program is free software: you can redistribute it and/or modify it under
   the terms of the GNU General Public License as published by the Free Software
   Foundation, either version 3 of the License, or (at your option) any later
   version. It is distributed in the hope that it will be useful, but WITHOUT ANY
   WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
   A PARTICULAR PURPOSE. See the GNU General Public License, in the file LICENSE
   at the root of this program, or <https://www.gnu.org/licenses/>. */

/* CladisticsPro — rooted trees for display, optimization and editing.

   A node is a plain object:
     { tip: i (index of the taxon in the matrix) or -1, name, children: [], parent }
   A cladogram has no branch lengths of its own: the lengths that matter are the
   numbers of changes, and those come from the optimization (optimize.js). The
   search engine keeps its own compact unrooted form; `fromSplits`, `toNewick`
   and `parseNewick` are the bridges.

   Wrapped in a named function so that a Web Worker can be built from its own
   source text, as every engine module of the app. Nothing here touches the DOM. */
function TreeCore(g) {
const Tree = {};

function node(tip, name) { return { tip: tip == null ? -1 : tip, name: name || '', children: [], parent: null }; }
function add(p, c) { c.parent = p; p.children.push(c); return c; }
Tree.node = node;
Tree.add = add;

/* ---------------- traversal ---------------- */
Tree.postorder = function (root) {
  const out = [], stack = [[root, 0]];
  while (stack.length) {
    const top = stack[stack.length - 1];
    const [v, i] = top;
    if (i < v.children.length) { top[1]++; stack.push([v.children[i], 0]); }
    else { out.push(v); stack.pop(); }
  }
  return out;
};
Tree.preorder = function (root) {
  const out = [], stack = [root];
  while (stack.length) {
    const v = stack.pop(); out.push(v);
    for (let i = v.children.length - 1; i >= 0; i--) stack.push(v.children[i]);
  }
  return out;
};
Tree.tips = root => Tree.preorder(root).filter(v => !v.children.length);
Tree.isTip = v => !v.children.length;
Tree.depth = function (v) { let d = 0; while (v.parent) { d++; v = v.parent; } return d; };

/* deep copy; `map` (optional) receives old → new */
Tree.clone = function (root, map) {
  const copy = v => {
    const n = node(v.tip, v.name);
    if (v.label != null) n.label = v.label;
    if (map) map.set(v, n);
    v.children.forEach(c => add(n, copy(c)));
    return n;
  };
  return copy(root);
};

/* ---------------- Newick ----------------
   Names with spaces or punctuation are written between single quotes; on
   reading, an underscore outside quotes means a space, as the format says.
   Branch lengths and comments are read and kept (`len`, `comment`) but a
   cladogram ignores the lengths. */
Tree.parseNewick = function (text, taxa) {
  const s = String(text).trim();
  let i = 0;
  const err = msg => { throw new Error(msg + ' (pos. ' + i + ')'); };
  const skip = () => { while (i < s.length && /\s/.test(s[i])) i++; };
  function readName() {
    skip();
    if (s[i] === "'") {
      let out = ''; i++;
      while (i < s.length) {
        if (s[i] === "'" && s[i + 1] === "'") { out += "'"; i += 2; continue; }
        if (s[i] === "'") { i++; break; }
        out += s[i++];
      }
      return out;
    }
    let out = '';
    while (i < s.length && !/[(),:;\[\s]/.test(s[i])) out += s[i++];
    return out.replace(/_/g, ' ');
  }
  function readMeta(n) {
    skip();
    while (s[i] === '[') {
      const j = s.indexOf(']', i);
      if (j < 0) err('comentario sin cerrar');
      n.comment = (n.comment || '') + s.slice(i + 1, j);
      i = j + 1; skip();
    }
    if (s[i] === ':') {
      i++; skip();
      let num = '';
      while (i < s.length && /[0-9eE+\-.]/.test(s[i])) num += s[i++];
      n.len = parseFloat(num);
      skip();
      while (s[i] === '[') { const j = s.indexOf(']', i); n.comment = (n.comment || '') + s.slice(i + 1, j); i = j + 1; skip(); }
    }
  }
  function readNode() {
    skip();
    let n;
    if (s[i] === '(') {
      i++;
      n = node(-1, '');
      for (;;) {
        add(n, readNode());
        skip();
        if (s[i] === ',') { i++; continue; }
        if (s[i] === ')') { i++; break; }
        err('se esperaba «,» o «)»');
      }
      const lab = readName();
      if (lab) n.label = lab;
    } else {
      const name = readName();
      if (!name) err('nombre vacío');
      n = node(-1, name);
    }
    readMeta(n);
    return n;
  }
  /* a comment before the tree, like the «[mpt_1]» name the exports write */
  skip();
  while (s[i] === '[') {
    const j = s.indexOf(']', i);
    if (j < 0) err('comentario sin cerrar');
    i = j + 1; skip();
  }
  const root = readNode();
  skip();
  if (s[i] === ';') i++;
  if (taxa) Tree.attachTaxa(root, taxa);
  return root;
};

/* Matches the tip names with the taxa of the matrix. Comparison ignores case,
   underscores against spaces and surrounding blanks. Unknown names are an error
   the caller shows. */
/* underscores become spaces BEFORE trimming: «Owenia_sp_» written without
   quotes is read back as «Owenia sp » and must still match itself */
Tree.normName = s => String(s || '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
Tree.attachTaxa = function (root, taxa) {
  const idx = new Map(taxa.map((t, k) => [Tree.normName(t), k]));
  const missing = [];
  Tree.tips(root).forEach(v => {
    const k = idx.get(Tree.normName(v.name));
    if (k == null) missing.push(v.name); else { v.tip = k; v.name = taxa[k]; }
  });
  if (missing.length) {
    const e = new Error('Taxones del árbol que no están en la matriz: ' + missing.join(', '));
    e.missing = missing;
    throw e;
  }
  return root;
};

function quote(name) {
  const s = String(name);
  if (/^[A-Za-z0-9_.\-]+$/.test(s)) return s;
  if (/^[A-Za-z0-9_.\- ]+$/.test(s) && !/^\s|\s$/.test(s)) return s.replace(/ /g, '_');
  return "'" + s.replace(/'/g, "''") + "'";
}
Tree.toNewick = function (root, opts) {
  opts = opts || {};
  const write = v => {
    if (!v.children.length) return quote(v.name) + (opts.lengths && v.len != null ? ':' + v.len : '');
    let lab = '';
    if (opts.labels && v.label != null && v.label !== '') lab = quote(String(v.label));
    return '(' + v.children.map(write).join(',') + ')' + lab + (opts.lengths && v.len != null ? ':' + v.len : '');
  };
  return write(root) + ';';
};

/* ---------------- shape ---------------- */
/* puts the smaller clade first (or last), as cladograms are usually drawn */
Tree.ladderize = function (root, bigFirst) {
  const size = new Map();
  Tree.postorder(root).forEach(v => size.set(v, v.children.length ? v.children.reduce((a, c) => a + size.get(c), 0) : 1));
  Tree.preorder(root).forEach(v => {
    v.children.sort((a, b) => bigFirst ? size.get(b) - size.get(a) : size.get(a) - size.get(b));
  });
  return root;
};

/* removes nodes with a single child (left behind by rerooting or pruning) */
Tree.cleanUnary = function (root) {
  let r = root;
  while (r.children.length === 1 && r.children[0].children.length) { r = r.children[0]; r.parent = null; }
  Tree.postorder(r).forEach(v => {
    if (v !== r && v.children.length === 1) {
      const c = v.children[0], p = v.parent;
      const k = p.children.indexOf(v);
      p.children[k] = c; c.parent = p;
    }
  });
  return r;
};

/* Reroots on the branch above `target`: the new root has two children, the
   target clade and everything else. Used to root on an outgroup. */
Tree.rerootAbove = function (root, target) {
  if (target === root) return root;
  const path = [];
  for (let v = target; v; v = v.parent) path.push(v);   // target … root
  const nr = node(-1, '');
  /* walk from the old root down to the target's parent, reversing edges */
  for (let k = path.length - 1; k >= 1; k--) {
    const p = path[k], c = path[k - 1];
    p.children.splice(p.children.indexOf(c), 1);
    if (k - 1 >= 1) { c.children.push(p); p.parent = c; }
  }
  const tp = path[1];
  /* tp now holds the rest of the tree, with its remaining children */
  tp.parent = null;
  add(nr, target);
  add(nr, tp);
  return Tree.cleanUnary(nr);
};
/* roots on the smallest clade that contains all the given taxa (or on the
   single tip). If the outgroup is not monophyletic on this tree, it roots on
   the first of them and says so. */
Tree.rootOn = function (root, tipIdx) {
  const set = new Set(tipIdx);
  const tips = Tree.tips(root).filter(v => set.has(v.tip));
  if (!tips.length) return { root, ok: false };
  if (tips.length === 1) return { root: Tree.rerootAbove(root, tips[0]), ok: true };
  /* reroot on the first outgroup tip, then look for the clade */
  let r = Tree.rerootAbove(root, tips[0]);
  const below = new Map();
  Tree.postorder(r).forEach(v => {
    below.set(v, v.children.length ? v.children.reduce((a, c) => a + below.get(c), 0) : (set.has(v.tip) ? 1 : 0));
  });
  const leaves = new Map();
  Tree.postorder(r).forEach(v => leaves.set(v, v.children.length ? v.children.reduce((a, c) => a + leaves.get(c), 0) : 1));
  /* with the tree hanging from one outgroup tip, the outgroup is monophyletic
     exactly when the ingroup is a clade of it: some node with no outgroup tip
     below and every ingroup tip */
  const ingroup = Tree.postorder(r).find(c => below.get(c) === 0 && leaves.get(c) === leaves.get(r) - tips.length);
  if (ingroup) {
    const r2 = Tree.rerootAbove(r, ingroup);
    /* the outgroup goes first, the ingroup last */
    r2.children.sort((a, b) => (a === ingroup) - (b === ingroup));
    return { root: r2, ok: true };
  }
  return { root: r, ok: false };
};

/* ---------------- editing by hand ----------------
   Each returns the (possibly new) root. They change the tree in place: the
   caller keeps a copy for undoing. */
/* is `a` inside the clade of `v` (or `v` itself)? */
Tree.within = function (a, v) { for (let x = a; x; x = x.parent) if (x === v) return true; return false; };
/* takes the clade of `v` out and puts it on the branch above `target` (a new
   node joins them). Not allowed into its own clade. */
Tree.moveClade = function (root, v, target) {
  if (v === root || Tree.within(target, v)) return root;
  const p = v.parent;
  p.children.splice(p.children.indexOf(v), 1);
  v.parent = null;
  /* the parent may be left with a single child: it disappears */
  let r = root;
  if (p.children.length === 1) {
    const only = p.children[0];
    if (p === r) { only.parent = null; r = only; }
    else { const gp = p.parent; gp.children[gp.children.indexOf(p)] = only; only.parent = gp; }
    if (target === p) target = only;
  }
  const w = node(-1, '');
  if (target === r) { add(w, r); add(w, v); return w; }
  const tp = target.parent;
  tp.children[tp.children.indexOf(target)] = w; w.parent = tp;
  add(w, target); add(w, v);
  return r;
};
/* removes the branch above an internal node: its children join its parent */
Tree.collapseNode = function (root, v) {
  if (v === root || !v.children.length) return root;
  const p = v.parent, k = p.children.indexOf(v);
  p.children.splice(k, 1, ...v.children);
  v.children.forEach(c => { c.parent = p; });
  return root;
};
/* inside a polytomy, joins two of its children in a new clade */
Tree.resolvePair = function (root, v, a, b) {
  if (v.children.length < 3 || a.parent !== v || b.parent !== v || a === b) return root;
  const w = node(-1, '');
  const k = Math.min(v.children.indexOf(a), v.children.indexOf(b));
  v.children = v.children.filter(c => c !== a && c !== b);
  v.children.splice(k, 0, w); w.parent = v;
  add(w, a); add(w, b);
  return root;
};
/* turns a node over: its children in the opposite order */
Tree.rotate = function (root, v) { v.children.reverse(); return root; };
Tree.isBinary = root => Tree.postorder(root).every(v => !v.children.length || v.children.length === 2);

/* ---------------- splits ----------------
   A clade is identified by the set of taxa below it, written as a string of
   0/1 over the taxa of the matrix (`n` positions). Rooted clades, not
   unrooted bipartitions: in a cladogram the outgroup fixes the root. */
Tree.clades = function (root, n) {
  const out = new Map(), sets = new Map();
  Tree.postorder(root).forEach(v => {
    if (!v.children.length) { const a = new Uint8Array(n); if (v.tip >= 0) a[v.tip] = 1; sets.set(v, a); return; }
    const a = new Uint8Array(n);
    v.children.forEach(c => { const b = sets.get(c); for (let i = 0; i < n; i++) a[i] |= b[i]; });
    sets.set(v, a);
  });
  sets.forEach((a, v) => {
    if (!v.children.length) return;
    let k = 0; for (let i = 0; i < n; i++) k += a[i];
    if (k < 2) return;
    out.set(String.fromCharCode(...a.map(x => 48 + x)), v);
  });
  return out;   // key → node (root included)
};

/* ---------------- enumeration ----------------
   Every unrooted binary tree of n taxa (n ≤ 9: 135 135 trees at n = 9), each
   returned rooted on taxon 0. Built by adding taxon k to every branch of every
   tree of k taxa — the classic proof that there are (2n−5)!! of them. */
Tree.allTrees = function (n, names) {
  if (n < 3) throw new Error('hacen falta al menos 3 taxones');
  if (n > 9) throw new Error('demasiados árboles para enumerarlos');
  const nm = k => (names ? names[k] : 'T' + k);
  /* a tree here is a Newick-like nested array of tip indices, rooted on 0 */
  let trees = [[0, [1, 2]]];
  for (let k = 3; k < n; k++) {
    const next = [];
    trees.forEach(t => {
      /* each subtree (except the whole tree) is a branch where k can go */
      const insert = (sub) => {
        const res = [];
        res.push([sub, k]);   // k becomes sister of `sub`
        if (Array.isArray(sub)) {
          for (let c = 0; c < sub.length; c++) {
            insert(sub[c]).forEach(r => { const s2 = sub.slice(); s2[c] = r; res.push(s2); });
          }
        }
        return res;
      };
      /* the root is [0, rest]: k can go next to the rest or inside it */
      insert(t[1]).forEach(r => next.push([0, r]));
    });
    trees = next;
  }
  const build = a => {
    if (!Array.isArray(a)) return node(a, nm(a));
    const v = node(-1, '');
    a.forEach(c => add(v, build(c)));
    return v;
  };
  return trees.map(build);
};
/* ---------------- consensus by clades ----------------
   Trees rooted the same way (on the outgroup), with tips attached to the
   taxa. A clade enters when it is in at least `threshold` of the trees
   (1: strict consensus, Sokal and Rohlf 1981; > 0.5: majority rule, Margush and
   McMorris 1981). Returns the tree and the frequency of each clade. */
Tree.consensus = function (roots, n, names, threshold) {
  const th = threshold == null ? 1 : threshold;
  const count = new Map();
  roots.forEach(r => Tree.clades(r, n).forEach((v, k) => count.set(k, (count.get(k) || 0) + 1)));
  const L = roots.length;
  /* strict: in every tree; otherwise at least the threshold and more than half
     (only clades in more than half the trees are sure to be compatible) */
  const keep = [...count.entries()].filter(([k, c]) => (th >= 1 ? c === L : c / L >= th - 1e-12 && c / L > 0.5)).map(([k, c]) => ({ k, c }));
  const root = Tree.fromClades(keep.map(x => x.k), n, names, Tree.present(roots));
  const freq = new Map(keep.map(x => [x.k, x.c / L]));
  Tree.postorder(root).forEach(v => {
    if (!v.children.length || v === root) return;
    const a = new Array(n).fill('0');
    Tree.tips(v).forEach(t => { if (t.tip >= 0) a[t.tip] = '1'; });
    const key = a.join('');
    if (freq.has(key)) v.freq = freq.get(key);
  });
  return root;
};
/* builds a tree from compatible clades (strings of 0/1 over the n taxa) */
Tree.fromClades = function (keys, n, names, present) {
  const root = node(-1, '');
  /* only the taxa the trees have (pruned taxa stay out) */
  const taxa = present || [...Array(n).keys()];
  taxa.forEach(i => add(root, node(i, names ? names[i] : 'T' + i)));
  const cl = keys.map(k => ({ k, size: k.split('').filter(c => c === '1').length })).filter(c => c.size >= 2 && c.size < taxa.length).sort((a, b) => b.size - a.size);
  for (const c of cl) {
    /* the smallest node that holds every member: walk down while one child holds them all */
    const members = new Set();
    for (let i = 0; i < n; i++) if (c.k[i] === '1') members.add(i);
    let v = root;
    for (;;) {
      const next = v.children.find(ch => { const t = Tree.tips(ch).map(x => x.tip); return t.length >= members.size && [...members].every(m => t.includes(m)); });
      if (!next || !next.children.length) break;
      v = next;
    }
    const inside = v.children.filter(ch => Tree.tips(ch).every(x => members.has(x.tip)));
    const covered = inside.reduce((a, ch) => a + Tree.tips(ch).length, 0);
    if (covered !== members.size || inside.length === v.children.length) continue;   // incompatible or already there
    const nv = node(-1, '');
    inside.forEach(ch => { v.children.splice(v.children.indexOf(ch), 1); add(nv, ch); });
    add(v, nv);
  }
  return root;
};
/* the taxa of a set of trees (those of the first one), in order */
Tree.present = roots => [...new Set(Tree.tips(roots[0]).map(v => v.tip))].filter(i => i >= 0).sort((a, b) => a - b);
/* two clades (strings of 0/1) can live in one tree when one holds the other
   or they share no taxon */
Tree.compatibleClades = function (a, b) {
  let ab = false, aNotB = false, bNotA = false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] === '1', y = b[i] === '1';
    if (x && y) ab = true; else if (x) aNotB = true; else if (y) bNotA = true;
    if (ab && aNotB && bNotA) return false;
  }
  return true;
};
const keySize = k => { let c = 0; for (let i = 0; i < k.length; i++) if (k[i] === '1') c++; return c; };
function withFreq(root, n, freq) {
  Tree.postorder(root).forEach(v => {
    if (!v.children.length || v === root) return;
    const a = new Array(n).fill('0');
    Tree.tips(v).forEach(t => { if (t.tip >= 0) a[t.tip] = '1'; });
    const key = a.join('');
    if (freq.has(key)) v.freq = freq.get(key);
  });
  return root;
}
/* Semistrict consensus (combinable components, Bremer 1990): every clade
   found in some tree that no tree contradicts. */
Tree.semistrict = function (roots, n, names) {
  const m = Tree.present(roots).length;
  const lists = roots.map(r => [...Tree.clades(r, n).keys()].filter(k => keySize(k) < m));
  const all = [...new Set(lists.flat())];
  const keep = all.filter(k => lists.every(list => list.every(o => Tree.compatibleClades(k, o))));
  const count = new Map();
  lists.forEach(l => l.forEach(k => count.set(k, (count.get(k) || 0) + 1)));
  return withFreq(Tree.fromClades(keep, n, names, Tree.present(roots)), n, new Map(keep.map(k => [k, count.get(k) / roots.length])));
};
/* Extended majority rule (greedy): the majority clades, then every other clade
   in order of frequency (ties: by its string) that fits with those chosen. */
Tree.majorityExtended = function (roots, n, names) {
  const count = new Map();
  const m = Tree.present(roots).length;
  roots.forEach(r => Tree.clades(r, n).forEach((v, k) => { if (keySize(k) < m) count.set(k, (count.get(k) || 0) + 1); }));
  const order = [...count.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const chosen = [];
  order.forEach(([k]) => { if (chosen.every(c => Tree.compatibleClades(c, k))) chosen.push(k); });
  return withFreq(Tree.fromClades(chosen, n, names, Tree.present(roots)), n, new Map(chosen.map(k => [k, count.get(k) / roots.length])));
};
/* Adams consensus (Adams 1972), for rooted trees: the taxa are split by the
   intersection of the clades that hang from the root of every tree, and each
   part is solved again with the trees restricted to it. It keeps the
   nestings shared by all the trees even when no clade is. */
Tree.adams = function (roots, n, names) {
  const R = roots.map(r => {
    const below = new Map();
    Tree.postorder(r).forEach(v => below.set(v, v.children.length ? v.children.flatMap(c => below.get(c)) : (v.tip >= 0 ? [v.tip] : [])));
    return { r, below };
  });
  /* the parts of `set` hanging from its smallest common node in one tree */
  const parts = (T, set) => {
    let v = T.r;
    for (;;) {
      const next = v.children.find(c => T.below.get(c).filter(x => set.has(x)).length === set.size);
      if (!next) break;
      v = next;
    }
    return v.children.map(c => T.below.get(c).filter(x => set.has(x))).filter(b => b.length);
  };
  const build = taxa => {
    if (taxa.length === 1) return node(taxa[0], names ? names[taxa[0]] : 'T' + taxa[0]);
    const set = new Set(taxa);
    let blocks = [taxa.slice()];
    R.forEach(T => {
      const label = new Map();
      parts(T, set).forEach((b, i) => b.forEach(x => label.set(x, i)));
      const next = [];
      blocks.forEach(b => { const by = new Map(); b.forEach(x => { const l = label.get(x); if (!by.has(l)) by.set(l, []); by.get(l).push(x); }); by.forEach(v => next.push(v)); });
      blocks = next;
    });
    const v = node(-1, '');
    if (blocks.length < 2) { taxa.forEach(x => add(v, node(x, names ? names[x] : 'T' + x))); return v; }
    blocks.forEach(b => add(v, build(b)));
    return v;
  };
  const taxa = [...new Set(Tree.tips(roots[0]).map(v => v.tip))].filter(i => i >= 0).sort((a, b) => a - b);
  return build(taxa);
};
/* a copy of the tree without some taxa (tip numbers), single-child nodes removed */
Tree.prune = function (root, remove) {
  const out = new Set(remove);
  const copy = Tree.clone(root);
  Tree.postorder(copy).forEach(v => {
    if (v === copy) return;
    if ((!v.children.length && out.has(v.tip)) || (v.children.length === 0 && v.tip < 0)) { const p = v.parent; p.children.splice(p.children.indexOf(v), 1); }
  });
  /* internal nodes left without children go too */
  for (let again = true; again;) {
    again = false;
    Tree.postorder(copy).forEach(v => { if (v !== copy && v.tip < 0 && !v.children.length) { const p = v.parent; p.children.splice(p.children.indexOf(v), 1); again = true; } });
  }
  return Tree.cleanUnary(copy);
};

/* the same tree written canonically (for telling trees apart) */
Tree.cladeKey = function (root, n) { return [...Tree.clades(root, n).keys()].sort().join('|'); };

/* (2n − 5)!! */
Tree.countUnrooted = function (n) { let r = 1; for (let k = 3; k <= 2 * n - 5; k += 2) r *= k; return n < 3 ? 0 : r; };

g.Tree = Tree;
return Tree;
}
if (typeof window !== 'undefined') TreeCore(window);
