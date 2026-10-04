/* CladisticsPro — morphological cladistics in the browser.
   Copyright (C) 2026  Luis Ángel Barrera-Guzmán

   This program is free software: you can redistribute it and/or modify it under
   the terms of the GNU General Public License as published by the Free Software
   Foundation, either version 3 of the License, or (at your option) any later
   version. It is distributed in the hope that it will be useful, but WITHOUT ANY
   WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
   A PARTICULAR PURPOSE. See the GNU General Public License, in the file LICENSE
   at the root of this program, or <https://www.gnu.org/licenses/>. */

/* CladisticsPro — hand-drawn SVG illustrations.
   Every picture is generated here with CSS-variable colours, so the whole app
   follows the light/dark theme and nothing depends on external images. Each
   function returns an SVG string. The pictures are built from a few
   primitives — a cladogram with marks, a matrix, a curve, plant glyphs — and
   every one of them draws a true thing: the marks of the hero are the real
   optimization of the matrix drawn beside it. */
(function () {
  const f1 = v => (+v).toFixed(1);
  let uid = 0;
  const wrap = (vb, inner, extra) => `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" ${extra || ''}>${inner}</svg>`;
  const txt = (x, y, s, cls, size, anchor, extra) =>
    `<text x="${f1(x)}" y="${f1(y)}" class="${cls || 'art-mut'}" font-size="${size || 8}" text-anchor="${anchor || 'start'}" ${extra || ''}>${s}</text>`;
  const line = (x1, y1, x2, y2, stroke, w, extra) => `<line x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}" stroke="${stroke}" stroke-width="${w || 1}" stroke-linecap="round" ${extra || ''}/>`;
  const circ = (cx, cy, r, fill, extra) => `<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(r)}" fill="${fill}" ${extra || ''}/>`;
  const rect = (x, y, w, h, fill, extra) => `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(Math.max(0, w))}" height="${f1(Math.max(0, h))}" fill="${fill}" ${extra || ''}/>`;
  const path = (d, stroke, w, extra) => `<path d="${d}" stroke="${stroke}" stroke-width="${w || 1}" fill="none" stroke-linecap="round" stroke-linejoin="round" ${extra || ''}/>`;
  const ST = s => `var(--st${s % 8})`;
  const R = seed => rng(seed || 7);

  /* ============================================================
     PLANT GLYPHS — the tips of the hero are plants, drawn here
     ============================================================ */
  function leaf(x, y, s, rot, fill) {
    const t = `translate(${f1(x)} ${f1(y)}) rotate(${rot || 0}) scale(${s})`;
    return `<g transform="${t}"><path d="M0 0C6 -6 14 -6 20 0C14 6 6 6 0 0Z" fill="${fill || 'var(--leaf)'}"/>` +
      `<path d="M1 0H18" stroke="var(--card-bg)" stroke-width=".7" opacity=".7"/></g>`;
  }
  function compoundLeaf(x, y, s) {
    let o = `<g transform="translate(${f1(x)} ${f1(y)}) scale(${s})">` + path('M0 0H26', 'var(--leaf)', 1.2);
    for (let i = 0; i < 4; i++) {
      o += leaf(5 + i * 6, -0.5, 0.42, -48, 'var(--leaf)') + leaf(5 + i * 6, 0.5, 0.42, 48, 'var(--leaf)');
    }
    return o + leaf(25, 0, 0.5, 0, 'var(--leaf)') + '</g>';
  }
  function flower(x, y, s, petals, col) {
    let o = `<g transform="translate(${f1(x)} ${f1(y)}) scale(${s})">`;
    const n = petals || 5;
    for (let i = 0; i < n; i++) {
      const a = i * 360 / n;
      o += `<ellipse cx="0" cy="-6" rx="3.4" ry="6" fill="${col || 'var(--primary)'}" opacity=".88" transform="rotate(${f1(a)})"/>`;
    }
    return o + circ(0, 0, 2.6, 'var(--gold)') + '</g>';
  }
  function zygoFlower(x, y, s) {
    /* a two-lipped flower: the bilateral symmetry of a classic character */
    return `<g transform="translate(${f1(x)} ${f1(y)}) scale(${s})">` +
      `<path d="M-2 0C-10 -4 -12 -12 -4 -12C0 -12 0 -6 0 -3C0 -6 0 -12 4 -12C12 -12 10 -4 2 0Z" fill="var(--accent)" opacity=".9"/>` +
      `<path d="M-6 1C-12 6 -6 12 0 8C6 12 12 6 6 1Z" fill="var(--accent)"/>` + circ(0, 1, 1.6, 'var(--gold)') + '</g>';
  }
  function fruit(x, y, s) {
    return `<g transform="translate(${f1(x)} ${f1(y)}) scale(${s})">` +
      circ(0, 2, 6, 'var(--primary)') + circ(-2, 0, 1.6, 'var(--card-bg)', 'opacity=".5"') +
      path('M0 -4C0 -7 2 -9 4 -10', 'var(--leaf)', 1.2) + leaf(1, -7, 0.3, -30) + '</g>';
  }
  function pod(x, y, s) {
    return `<g transform="translate(${f1(x)} ${f1(y)}) scale(${s})">` +
      `<path d="M-10 2C-6 -5 6 -5 12 -2C6 4 -4 6 -10 2Z" fill="var(--leaf)"/>` +
      circ(-4, 0, 1.6, 'var(--card-bg)', 'opacity=".55"') + circ(1, -0.6, 1.6, 'var(--card-bg)', 'opacity=".55"') + circ(6, -0.8, 1.5, 'var(--card-bg)', 'opacity=".55"') + '</g>';
  }
  function cone(x, y, s) {
    let o = `<g transform="translate(${f1(x)} ${f1(y)}) scale(${s})">`;
    for (let r = 0; r < 4; r++) for (let c = -1; c <= 1; c += 2) {
      o += `<ellipse cx="${c * 2.6}" cy="${-7 + r * 4.4}" rx="3" ry="2.6" fill="var(--c9)" opacity="${f1(0.75 + r * 0.06)}"/>`;
    }
    return o + `<ellipse cx="0" cy="-9" rx="2.4" ry="2.4" fill="var(--c9)"/>` + '</g>';
  }
  function frond(x, y, s) {
    let o = `<g transform="translate(${f1(x)} ${f1(y)}) scale(${s})">` + path('M0 8C2 0 2 -6 0 -12', 'var(--leaf)', 1.1);
    for (let i = 0; i < 5; i++) {
      const yy = 6 - i * 3.6, w = 7 - i * 1.1;
      o += path(`M${f1(1.2 - i * 0.2)} ${f1(yy)}Q${f1(w * 0.6)} ${f1(yy - 2.5)} ${f1(w)} ${f1(yy - 1.5)}`, 'var(--leaf)', 1.4) +
        path(`M${f1(0.6 - i * 0.2)} ${f1(yy)}Q${f1(-w * 0.6)} ${f1(yy - 2.5)} ${f1(-w)} ${f1(yy - 1.5)}`, 'var(--leaf)', 1.4);
    }
    return o + '</g>';
  }
  const GLYPHS = [leaf, flower, zygoFlower, fruit, pod, cone, frond, compoundLeaf];

  /* ============================================================
     CLADOGRAM WITH MARKS — the primitive of this app
     ============================================================ */
  /* A small rooted tree from a nested array of tip indices; returns positions. */
  function lay(nested, x0, x1, y0, y1) {
    const tips = [];
    const walk = a => Array.isArray(a) ? a.forEach(walk) : tips.push(a);
    walk(nested);
    const n = tips.length;
    const yOf = new Map(tips.map((t, i) => [t, y0 + (n === 1 ? 0 : i * (y1 - y0) / (n - 1))]));
    const height = a => Array.isArray(a) ? 1 + Math.max(...a.map(height)) : 0;
    const H = height(nested);
    const nodes = [];
    const place = (a, parentX) => {
      const h = height(a);
      const x = x0 + (H - h) / H * (x1 - x0);
      let y;
      if (Array.isArray(a)) {
        const kids = a.map(c => place(c, x));
        y = (Math.min(...kids.map(k => k.y)) + Math.max(...kids.map(k => k.y))) / 2;
        const me = { x, y, kids, px: parentX, tip: null };
        nodes.push(me);
        return me;
      }
      y = yOf.get(a);
      const me = { x: x1, y, kids: [], px: parentX, tip: a };
      nodes.push(me);
      return me;
    };
    const root = place(nested, x0 - 10);
    return { root, nodes };
  }
  /* draws the tree; marks: [{node predicate by tip set or index, t (0..1 along branch), open, n}] */
  function clado(nested, o) {
    o = o || {};
    const { root, nodes } = lay(nested, o.x0, o.x1, o.y0, o.y1);
    const stroke = o.stroke || 'var(--clado-line)';
    let s = '';
    nodes.forEach(nd => {
      nd.kids.forEach(k => { s += line(nd.x, nd.y, nd.x, k.y, o.color ? o.color(k) : stroke, o.w || 1.6); });
      s += line(nd.px == null ? nd.x - 8 : nd.px, nd.y, nd.x, nd.y, o.color ? o.color(nd) : stroke, o.w || 1.6);
    });
    return { svg: s, root, nodes };
  }
  function mark(x, y, open, num, st, size, fs) {
    const r = size || 3.6, f = fs || 6.5;
    return `<g class="clado-mark${open ? ' open' : ''}">` + circ(x, y, r, open ? 'var(--card-bg)' : 'var(--clado-mark)', `stroke="var(--clado-mark)" stroke-width="1.1"`) +
      (num != null ? txt(x, y - r - 2.6, num, 'art-txt', f, 'middle', 'font-weight="700"') : '') +
      (st != null ? txt(x, y + r + f + 0.5, st, 'art-mut', f, 'middle') : '') + '</g>';
  }

  /* ============================================================
     HERO — the matrix on the left is optimised on the tree on the
     right; the marks are the result, not a decoration
     ============================================================ */
  function hero() {
    const taxa = [0, 1, 2, 3, 4, 5];
    /* six taxa, eight characters: an outgroup and five ingroup taxa */
    const M = [
      '00000000',
      '10100000',
      '11100100',
      '11011010',
      '11011011',
      '11011111',
    ];
    const nested = [0, [1, [2, [3, [4, 5]]]]];
    const W = 478, H = 318;
    let s = '';
    /* matrix panel */
    const mx = 20, my = 52, cw = 17, ch = 37;
    s += rect(mx - 12, my - 42, 8 * cw + 24, 6 * ch + 52, 'var(--card-bg)', 'rx="14" stroke="var(--border)"');
    s += txt(mx - 2, my - 22, T('MATRIZ', 'MATRIX'), 'art-mut', 10.5, 'start', 'font-weight="700" letter-spacing="1.3"');
    for (let c = 0; c < 8; c++) s += txt(mx + c * cw + cw / 2, my - 6, String(c + 1), 'art-mut', 9, 'middle');
    taxa.forEach(t => {
      for (let c = 0; c < 8; c++) {
        const v = +M[t][c];
        s += rect(mx + c * cw + 1.5, my + t * ch + 6, cw - 3, ch - 12, v ? ST(1) : ST(0),
          v ? `rx="3.5" class="site-pulse" style="animation-delay:${f1((t * 8 + c) * 0.07)}s"` : 'rx="3.5" opacity=".28"');
        s += txt(mx + c * cw + cw / 2, my + t * ch + ch / 2 + 3.6, String(v), v ? 'art-on' : 'art-mut', 10.5, 'middle', 'font-weight="700"');
      }
    });
    /* the flow from matrix to tree */
    const fx = mx + 8 * cw + 14;
    for (let t = 0; t < 6; t++) {
      const y = my + t * ch + ch / 2;
      s += path(`M${fx} ${f1(y)}C${fx + 18} ${f1(y)} ${fx + 14} ${f1(my + 2.5 * ch + 10)} ${fx + 32} ${f1(my + 2.5 * ch + 10)}`, 'var(--border-strong)', 1, 'opacity=".6" stroke-dasharray="2 3"');
    }
    /* cladogram with the true optimization of M on `nested` (ACCTRAN; the
       tests recompute these changes with optimize.js). Each branch is as long
       as its marks need, and the names are aligned with dotted leaders. */
    const changes = Art.HERO_CHANGES;
    const x0 = fx + 34, y0 = my + ch / 2;
    const keyOf = a => (Array.isArray(a) ? a.map(keyOf).join('') : String(a)).split('').sort().join('');
    let tipRow = 0;
    const nodes = [];
    const place = (a, px) => {
      const key = keyOf(a);
      const nm = (changes[key] || []).length;
      const x = px == null ? x0 : px + Math.max(20, nm * 15 + 9);
      const nd = { key, x, px, kids: [], tip: Array.isArray(a) ? null : a };
      if (Array.isArray(a)) { nd.kids = a.map(c => place(c, x)); nd.y = (Math.min(...nd.kids.map(k => k.y)) + Math.max(...nd.kids.map(k => k.y))) / 2; }
      else nd.y = y0 + (tipRow++) * ch;
      nodes.push(nd);
      return nd;
    };
    place(nested, null);
    const x1 = Math.max(...nodes.filter(n => n.tip != null).map(n => n.x));
    let br = '';
    nodes.forEach(nd => {
      nd.kids.forEach(k => { br += line(nd.x, nd.y, nd.x, k.y, 'var(--clado-line)', 2.2); });
      br += line(nd.px == null ? nd.x - 12 : nd.px, nd.y, nd.x, nd.y, 'var(--clado-line)', 2.2);
      if (nd.tip != null && nd.x < x1) br += line(nd.x + 4, nd.y, x1 + 4, nd.y, 'var(--border-strong)', 1, 'stroke-dasharray="1.5 3"');
    });
    s += `<g class="branch-grow-g">${br}</g>`;
    nodes.forEach(nd => {
      const list = changes[nd.key];
      if (!list || nd.px == null) return;
      list.forEach((m, i) => {
        const x = nd.px + (nd.x - nd.px) * (i + 1) / (list.length + 1);
        s += mark(x, nd.y, m.open, String(m.c + 1), String(m.to), 4.2, 8.5);
      });
    });
    /* plants at the tips */
    const glyph = [cone, frond, leaf, compoundLeaf, flower, zygoFlower];
    nodes.filter(nd => nd.tip != null).forEach(nd => {
      const gx = x1 + 20, gy = nd.y;
      if (nd.tip === 2) s += leaf(gx - 9, gy, 0.95, -10);
      else if (nd.tip === 3) s += compoundLeaf(gx - 12, gy, 0.7);
      else s += glyph[nd.tip](gx, gy, nd.tip === 0 ? 1.05 : 1.0);
      s += txt(gx + 18, gy + 4, [T('externo', 'outgroup'), 'A', 'B', 'C', 'D', 'E'][nd.tip], 'art-txt', 11.5, 'start', nd.tip === 0 ? 'font-style="italic"' : 'font-weight="700"');
    });
    /* legend */
    const ly = H - 16;
    s += mark(x0 + 4, ly, false, null, null, 4) + txt(x0 + 13, ly + 3.6, T('cambio único', 'unique change'), 'art-mut', 10);
    s += mark(x0 + 104, ly, true, null, null, 4) + txt(x0 + 113, ly + 3.6, T('homoplasia', 'homoplasy'), 'art-mut', 10);
    s += txt(x0 - 6, my - 22, T('CLADOGRAMA', 'CLADOGRAM'), 'art-mut', 10.5, 'start', 'font-weight="700" letter-spacing="1.3"');
    return wrap(`0 0 ${W} ${H}`, s);
  }

  /* ============================================================
     BLOCK CARDS — one picture per block
     ============================================================ */
  function cardMatrix(seed) {
    const r = R(seed || 11);
    let s = '';
    const cols = 12, rows = 6, cw = 15, ch = 13, x0 = 22, y0 = 18;
    for (let i = 0; i < rows; i++) {
      s += rect(4, y0 + i * ch + 3, 13, 6, 'var(--border-strong)', 'rx="2" opacity=".6"');
      for (let j = 0; j < cols; j++) {
        const u = r();
        const x = x0 + j * cw, y = y0 + i * ch;
        if (u < 0.08) s += txt(x + cw / 2, y + 9.5, '?', 'art-mut', 9, 'middle', 'font-weight="700"');
        else if (u < 0.13) s += txt(x + cw / 2, y + 9.5, '–', 'art-mut', 9, 'middle', 'font-weight="700"');
        else s += rect(x + 1.5, y + 1.5, cw - 3, ch - 3, ST(u < 0.5 ? 0 : u < 0.86 ? 1 : 2), `rx="2.5" opacity="${u < 0.5 ? 0.3 : 0.85}"`);
      }
    }
    for (let j = 0; j < cols; j++) s += rect(x0 + j * cw + 3, 6, cw - 6, 5, 'var(--border-strong)', 'rx="2" opacity=".6"');
    return wrap('0 0 210 104', s);
  }
  function cardClado(seed, opts) {
    opts = opts || {};
    const nested = opts.nested || [0, [[1, 2], [3, [4, [5, 6]]]]];
    const { svg, nodes } = clado(nested, { x0: 22, x1: 182, y0: 12, y1: 92, w: 1.7, color: opts.color });
    let s = svg;
    const r = R(seed || 3);
    if (opts.marks !== false) {
      nodes.forEach(nd => {
        if (nd.px == null || r() < 0.35) return;
        const n = 1 + Math.floor(r() * 2);
        for (let i = 0; i < n; i++) s += mark(nd.px + (nd.x - nd.px) * (i + 1) / (n + 1), nd.y, r() < 0.3, null, null, 3);
      });
    }
    nodes.filter(nd => nd.tip != null).forEach(nd => { s += circ(nd.x + 8, nd.y, 3, ST(nd.tip % 3)); });
    return wrap('0 0 210 104', s);
  }
  function cardSearch() {
    /* a rugged landscape of tree lengths; the ratchet jumps between islands */
    let s = '';
    const pts = [];
    for (let i = 0; i <= 60; i++) {
      const x = 8 + i * 3.25;
      const y = 62 + 18 * Math.sin(i * 0.36) + 9 * Math.sin(i * 1.13 + 1) - (i > 38 && i < 52 ? 14 * Math.sin((i - 38) / 14 * Math.PI) : 0);
      pts.push([x, y]);
    }
    s += `<path d="M8 100L${pts.map(p => f1(p[0]) + ' ' + f1(p[1])).join('L')}L203 100Z" fill="var(--primary)" opacity=".13"/>`;
    s += path('M' + pts.map(p => f1(p[0]) + ' ' + f1(p[1])).join('L'), 'var(--primary)', 1.6);
    /* jumps */
    const hops = [6, 19, 31, 45];
    for (let k = 0; k < hops.length - 1; k++) {
      const a = pts[hops[k]], b = pts[hops[k + 1]];
      s += path(`M${f1(a[0])} ${f1(a[1] - 4)}Q${f1((a[0] + b[0]) / 2)} ${f1(Math.min(a[1], b[1]) - 30)} ${f1(b[0])} ${f1(b[1] - 4)}`, 'var(--accent)', 1.3, 'stroke-dasharray="3 3"');
    }
    hops.forEach((h, k) => { s += circ(pts[h][0], pts[h][1] - 4, k === hops.length - 1 ? 4.4 : 3, k === hops.length - 1 ? 'var(--gold)' : 'var(--accent)'); });
    s += txt(12, 14, T('longitud', 'length'), 'art-mut', 7.5) + txt(196, 98, T('árboles', 'trees'), 'art-mut', 7.5, 'end');
    return wrap('0 0 210 104', s);
  }
  function cardWeights() {
    /* implied weights: the weight k/(k + h) of a character falls with its homoplasy h */
    let s = line(20, 90, 200, 90, 'var(--border-strong)', 1) + line(20, 90, 20, 10, 'var(--border-strong)', 1);
    [1, 3, 10, 30].forEach((k, i) => {
      const pts = [];
      for (let h = 0; h <= 20; h += 0.5) pts.push([20 + h * 9, 90 - 76 * k / (k + h)]);
      s += path('M' + pts.map(p => f1(p[0]) + ' ' + f1(p[1])).join('L'), ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)'][i], 1.8);
      s += txt(200, 90 - 76 * k / (k + 20) - 3, 'k=' + k, 'art-mut', 7, 'end');
    });
    s += txt(24, 14, T('peso', 'weight'), 'art-mut', 7.5) + txt(198, 100, T('homoplasia', 'homoplasy'), 'art-mut', 7.5, 'end');
    return wrap('0 0 210 104', s);
  }
  function cardMapping() {
    const nested = [0, [[1, 2], [3, [4, [5, 6]]]]];
    /* branches coloured by a character: state 1 arises on the (3,(4,(5,6))) clade */
    const st = new Set(['3456', '3', '456', '4', '56', '5', '6']);
    let s = '';
    const { nodes } = lay(nested, 22, 182, 12, 92);
    const key = nd => { const a = []; const w = k => k.tip != null ? a.push(k.tip) : k.kids.forEach(w); w(nd); return a.sort().join(''); };
    nodes.forEach(nd => {
      const c = st.has(key(nd)) ? ST(1) : ST(0);
      nd.kids.forEach(k => { s += line(nd.x, nd.y, nd.x, k.y, st.has(key(k)) ? ST(1) : ST(0), 3); });
      s += line(nd.px == null ? nd.x - 8 : nd.px, nd.y, nd.x, nd.y, c, 3);
    });
    const tgt = nodes.find(nd => key(nd) === '3456');
    s += mark((tgt.px + tgt.x) / 2, tgt.y, false, '4', '1', 3.4);
    nodes.filter(nd => nd.tip != null).forEach(nd => { s += circ(nd.x + 8, nd.y, 3.4, st.has(String(nd.tip)) ? ST(1) : ST(0)); });
    return wrap('0 0 210 104', s);
  }
  function cardDiagnosis() {
    let s = '';
    const vals = [1, 0.5, 1, 0.33, 0.67, 1, 0.25, 0.5, 1, 0.75, 0.4, 1];
    vals.forEach((v, i) => {
      const x = 16 + i * 15.5, h = v * 64;
      s += rect(x, 84 - h, 10, h, v === 1 ? 'var(--primary)' : 'var(--accent)', `rx="2" opacity="${v === 1 ? 0.9 : 0.75}"`);
      s += txt(x + 5, 95, String(i + 1), 'art-mut', 6.5, 'middle');
    });
    s += line(12, 84, 200, 84, 'var(--border-strong)', 1) + txt(14, 13, T('CI por carácter', 'CI per character'), 'art-mut', 7.5);
    return wrap('0 0 210 104', s);
  }
  function cardSupport() {
    const nested = [0, [[1, 2], [3, [4, [5, 6]]]]];
    const { svg, nodes } = clado(nested, { x0: 22, x1: 182, y0: 12, y1: 92, w: 1.7 });
    let s = svg;
    const vals = { 3456: 98, 456: 71, 56: 100, 12: 54, 123456: 100 };
    const key = nd => { const a = []; const w = k => k.tip != null ? a.push(k.tip) : k.kids.forEach(w); w(nd); return a.sort().join(''); };
    nodes.forEach(nd => {
      const v = vals[key(nd)];
      if (v == null) return;
      s += rect(nd.x - 22, nd.y - 13, 20, 9, 'var(--card-bg)', 'rx="2"') + txt(nd.x - 12, nd.y - 6, String(v), v >= 70 ? 'art-txt' : 'art-mut', 7.5, 'middle', 'font-weight="700"');
    });
    return wrap('0 0 210 104', s);
  }
  function cardConsensus() {
    let s = '';
    const small = (nested, x0, y0, w, h) => clado(nested, { x0, x1: x0 + w, y0, y1: y0 + h, w: 1.3 }).svg;
    s += small([0, [1, [2, [3, 4]]]], 12, 10, 44, 32) + small([0, [[1, 2], [3, 4]]], 12, 58, 44, 32);
    s += small([0, [1, [3, [2, 4]]]], 74, 10, 44, 32) + small([0, [2, [1, [3, 4]]]], 74, 58, 44, 32);
    s += path('M130 50L148 50', 'var(--border-strong)', 1.4) + path('M143 45L149 50L143 55', 'var(--border-strong)', 1.4);
    /* the strict consensus: a polytomy */
    s += line(158, 50, 168, 50, 'var(--primary)', 2) + line(168, 22, 168, 78, 'var(--primary)', 2);
    [22, 36, 50, 64, 78].forEach((y, i) => { s += line(i === 0 ? 162 : 168, y, 200, y, 'var(--primary)', 2); });
    s += line(162, 22, 162, 50, 'var(--primary)', 2);
    return wrap('0 0 210 104', s);
  }
  function cardHypothesis() {
    let s = '';
    s += clado([0, [[1, 2], [3, 4]]], { x0: 14, x1: 80, y0: 16, y1: 74, w: 1.5 }).svg;
    s += clado([0, [1, [2, [3, 4]]]], { x0: 120, x1: 186, y0: 16, y1: 74, w: 1.5, stroke: 'var(--accent)' }).svg;
    s += txt(52, 96, 'L = 41', 'art-txt', 9, 'middle', 'font-weight="700"') + txt(156, 96, 'L = 44', 'art-txt', 9, 'middle', 'font-weight="700"');
    s += txt(104, 50, '+3', 'art-mut', 10, 'middle', 'font-weight="700"');
    return wrap('0 0 210 104', s);
  }
  function cardReport() {
    let s = rect(52, 6, 106, 94, 'var(--card-bg)', 'rx="6" stroke="var(--border)"');
    s += rect(62, 16, 56, 5, 'var(--text-muted)', 'rx="2" opacity=".6"');
    for (let i = 0; i < 3; i++) s += rect(62, 26 + i * 6, 86 - i * 9, 3, 'var(--border-strong)', 'rx="1.5"');
    s += clado([0, [1, [2, [3, 4]]]], { x0: 70, x1: 132, y0: 52, y1: 88, w: 1.3 }).svg;
    s += mark(98, 63, false, null, null, 2.4) + mark(112, 72, true, null, null, 2.4);
    return wrap('0 0 210 104', s);
  }
  function cardHome() { return cardClado(5); }

  /* ============================================================
     CHARACTER TYPES
     ============================================================ */
  function typeArt(kind) {
    let s = '';
    if (kind === 'unord') {
      const P = [[40, 18], [18, 52], [62, 52]];
      for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) s += line(P[i][0], P[i][1], P[j][0], P[j][1], 'var(--border-strong)', 1.3);
      P.forEach((p, i) => { s += circ(p[0], p[1], 9, ST(i)) + txt(p[0], p[1] + 3.4, String(i), 'art-on', 9.5, 'middle', 'font-weight="700"'); });
      s += txt(96, 30, T('cualquier cambio', 'any change'), 'art-mut', 8) + txt(96, 42, T('cuesta 1', 'costs 1'), 'art-mut', 8);
    } else if (kind === 'ord') {
      [0, 1, 2].forEach(i => { s += circ(20 + i * 34, 35, 9, ST(i)) + txt(20 + i * 34, 38.4, String(i), 'art-on', 9.5, 'middle', 'font-weight="700"'); });
      s += line(29, 35, 45, 35, 'var(--border-strong)', 1.5) + line(63, 35, 79, 35, 'var(--border-strong)', 1.5);
      s += path('M20 22Q54 2 88 22', 'var(--accent)', 1.2, 'stroke-dasharray="3 2"') + txt(54, 12, '0→2 = 2', 'art-mut', 8, 'middle');
      s += txt(110, 38, T('por escalones', 'step by step'), 'art-mut', 8);
    } else if (kind === 'step') {
      const P = [[24, 18], [24, 54], [80, 36]];
      s += path('M30 22L74 33', 'var(--border-strong)', 1.3) + txt(52, 22, '1', 'art-mut', 8, 'middle');
      s += path('M30 51L74 39', 'var(--border-strong)', 1.3) + txt(52, 56, '3', 'art-mut', 8, 'middle');
      s += path('M24 27L24 45', 'var(--border-strong)', 1.3) + txt(15, 39, '2', 'art-mut', 8, 'middle');
      P.forEach((p, i) => { s += circ(p[0], p[1], 8.5, ST(i)) + txt(p[0], p[1] + 3.4, String(i), 'art-on', 9.5, 'middle', 'font-weight="700"'); });
      s += txt(104, 30, T('costos que', 'costs that'), 'art-mut', 8) + txt(104, 42, T('tú decides', 'you decide'), 'art-mut', 8);
    } else if (kind === 'cont') {
      s += line(12, 40, 168, 40, 'var(--border-strong)', 1.2);
      [[20, 52], [44, 70], [88, 118], [126, 150]].forEach((iv, i) => { s += rect(iv[0], 32 - i * 0 , iv[1] - iv[0], 16, ST(i), 'rx="8" opacity=".75"'); });
      s += txt(12, 64, '2.1', 'art-mut', 8) + txt(168, 64, '9.8 mm', 'art-mut', 8, 'end');
    } else if (kind === 'inap') {
      s += rect(10, 10, 74, 22, ST(0), 'rx="6" opacity=".25"') + txt(47, 25, T('tricomas: no', 'trichomes: no'), 'art-txt', 8, 'middle');
      s += rect(10, 40, 74, 22, ST(1), 'rx="6" opacity=".35"') + txt(47, 55, T('tricomas: sí', 'trichomes: yes'), 'art-txt', 8, 'middle');
      s += path('M86 51L104 51', 'var(--border-strong)', 1.3);
      s += rect(106, 40, 70, 22, ST(2), 'rx="6" opacity=".35"') + txt(141, 55, T('tipo: estrellado', 'type: stellate'), 'art-txt', 7.5, 'middle');
      s += path('M86 21L104 21', 'var(--border-strong)', 1.3, 'stroke-dasharray="2 2"') + txt(141, 25, T('tipo: –', 'type: –'), 'art-mut', 9, 'middle', 'font-weight="700"');
    } else if (kind === 'poly') {
      s += rect(14, 20, 40, 30, 'var(--bg-soft)', 'rx="6" stroke="var(--border)"') + txt(34, 40, '{01}', 'art-txt', 11, 'middle', 'font-weight="700"');
      s += rect(70, 20, 40, 30, 'var(--bg-soft)', 'rx="6" stroke="var(--border)"') + txt(90, 41, '?', 'art-txt', 14, 'middle', 'font-weight="700"');
      s += txt(126, 32, T('incertidumbre,', 'uncertainty,'), 'art-mut', 8) + txt(126, 44, T('no un estado', 'not a state'), 'art-mut', 8);
    }
    return wrap('0 0 180 72', s);
  }

  /* ============================================================
     THEORY FIGURES
     ============================================================ */
  function theoryApomorphy() {
    let s = '';
    const { svg, nodes } = clado([0, [1, [2, [3, 4]]]], { x0: 24, x1: 210, y0: 26, y1: 146, w: 2 });
    s += svg;
    const key = nd => { const a = []; const w = k => k.tip != null ? a.push(k.tip) : k.kids.forEach(w); w(nd); return a.sort().join(''); };
    const at = k => nodes.find(nd => key(nd) === k);
    const n1 = at('1234'), n2 = at('234'), n3 = at('34'), t4 = at('4');
    s += mark((n1.px + n1.x) / 2, n1.y, false, 'a', null, 4);
    s += mark((n3.px + n3.x) / 2, n3.y, false, 'b', null, 4);
    s += mark((t4.px + t4.x) / 2, t4.y, false, 'c', null, 4);
    nodes.filter(nd => nd.tip != null).forEach(nd => { s += txt(nd.x + 8, nd.y + 3.5, [T('grupo externo', 'outgroup'), 'A', 'B', 'C', 'D'][nd.tip], 'art-txt', 10, 'start', nd.tip ? 'font-weight="700"' : 'font-style="italic"'); });
    void n2;
    s += txt(24, 176, T('a: sinapomorfía de A–D (frente a C+D es plesiomorfía)', 'a: synapomorphy of A–D (a plesiomorphy when C+D are compared)'), 'art-mut', 9);
    s += txt(24, 190, T('b: sinapomorfía de C+D · c: autapomorfía de D (no agrupa)', 'b: synapomorphy of C+D · c: autapomorphy of D (groups nobody)'), 'art-mut', 9);
    return wrap('0 0 330 200', s);
  }
  function theoryGroups() {
    let s = '';
    const nested = [0, [1, [2, [3, 4]]]];
    const draw = (x0, title, set, col) => {
      const { svg, nodes } = clado(nested, { x0, x1: x0 + 70, y0: 30, y1: 120, w: 1.5 });
      let o = svg;
      nodes.filter(nd => nd.tip != null).forEach(nd => {
        o += circ(nd.x + 8, nd.y, 5, set.includes(nd.tip) ? col : 'var(--border-strong)', set.includes(nd.tip) ? '' : 'opacity=".5"');
      });
      return o + txt(x0 + 35, 146, title, 'art-txt', 10, 'middle', 'font-weight="700"');
    };
    s += draw(14, T('monofilético', 'monophyletic'), [3, 4], 'var(--primary)');
    s += draw(120, T('parafilético', 'paraphyletic'), [1, 2, 3], 'var(--accent)');
    s += draw(226, T('polifilético', 'polyphyletic'), [1, 4], 'var(--rose)');
    s += txt(14, 166, T('todos los descendientes · le faltan descendientes · sin el antepasado común', 'all the descendants · some descendants missing · without the common ancestor'), 'art-mut', 8.5);
    return wrap('0 0 330 176', s);
  }
  function theoryHomoplasy() {
    let s = '';
    const nested = [0, [1, [2, [3, 4]]]];
    const draw = (x0, title, ms) => {
      const { svg, nodes } = clado(nested, { x0, x1: x0 + 110, y0: 26, y1: 116, w: 1.6 });
      let o = svg;
      const key = nd => { const a = []; const w = k => k.tip != null ? a.push(k.tip) : k.kids.forEach(w); w(nd); return a.sort().join(''); };
      ms.forEach(m => { const nd = nodes.find(n => key(n) === m.k); o += mark((nd.px + nd.x) / 2, nd.y, m.open, null, m.st, 4); });
      return o + txt(x0 + 55, 140, title, 'art-txt', 10, 'middle', 'font-weight="700"');
    };
    s += draw(18, T('paralelismo (DELTRAN)', 'parallelism (DELTRAN)'), [{ k: '2', open: true, st: '1' }, { k: '4', open: true, st: '1' }]);
    s += draw(180, T('ganancia y reversión (ACCTRAN)', 'gain and reversal (ACCTRAN)'), [{ k: '234', open: false, st: '1' }, { k: '3', open: true, st: '0' }]);
    s += txt(18, 162, T('Las dos historias miden 2 pasos en el mismo árbol: la parsimonia no elige entre ellas.', 'Both stories take 2 steps on the same tree: parsimony does not choose between them.'), 'art-mut', 8.5);
    return wrap('0 0 330 172', s);
  }
  function theoryIndices() {
    let s = '';
    const bar = (y, label, m, sObs, gMax) => {
      const x0 = 70, sc = 26;
      let o = txt(10, y + 10, label, 'art-txt', 9, 'start', 'font-weight="700"');
      o += rect(x0, y, gMax * sc, 14, 'var(--bg-soft)', 'rx="3" stroke="var(--border)"');
      o += rect(x0, y, sObs * sc, 14, 'var(--accent)', 'rx="3" opacity=".55"');
      o += rect(x0, y, m * sc, 14, 'var(--primary)', 'rx="3"');
      o += txt(x0 + gMax * sc + 6, y + 10, `m=${m} · s=${sObs} · g=${gMax}`, 'art-mut', 8.5);
      return o;
    };
    s += bar(18, T('carácter 1', 'character 1'), 1, 1, 5);
    s += bar(44, T('carácter 2', 'character 2'), 1, 2, 5);
    s += bar(70, T('carácter 3', 'character 3'), 2, 4, 6);
    s += txt(10, 112, 'CI = m / s  ·  RI = (g − s) / (g − m)', 'art-txt', 10, 'start', 'font-weight="700"');
    s += txt(10, 128, T('m: mínimo posible · s: observado · g: en el árbol estrella', 'm: fewest possible · s: observed · g: on the star tree'), 'art-mut', 8.5);
    return wrap('0 0 330 140', s);
  }
  function theoryInapplicable() {
    let s = '';
    /* the tail-colour problem of Maddison (1993): colour of a tail where there is no tail */
    const nested = [0, [1, [2, [3, 4]]]];
    const { svg, nodes } = clado(nested, { x0: 20, x1: 150, y0: 24, y1: 124, w: 1.8 });
    s += svg;
    const tails = [T('sin cola', 'no tail'), T('cola roja', 'red tail'), T('sin cola', 'no tail'), T('cola azul', 'blue tail'), T('cola azul', 'blue tail')];
    nodes.filter(nd => nd.tip != null).forEach(nd => {
      s += txt(nd.x + 8, nd.y + 3.5, tails[nd.tip], 'art-txt', 9.5);
    });
    s += txt(220, 44, T('Si «–» se lee como «?»,', 'If «–» is read as «?»,'), 'art-mut', 9, 'middle') + txt(220, 58, T('el antepasado sin cola', 'the tailless ancestor'), 'art-mut', 9, 'middle') + txt(220, 72, T('recibe un color de cola', 'gets a tail colour'), 'art-mut', 9, 'middle');
    s += txt(220, 98, T('El algoritmo de 2019 no', 'The 2019 algorithm does not'), 'art-txt', 9, 'middle', 'font-weight="700"') + txt(220, 112, T('inventa colores sin cola', 'invent colours without tails'), 'art-txt', 9, 'middle', 'font-weight="700"');
    return wrap('0 0 330 140', s);
  }
  function theoryConsensus() {
    let s = '';
    s += clado([0, [1, [2, [3, 4]]]], { x0: 12, x1: 70, y0: 16, y1: 76, w: 1.4 }).svg;
    s += clado([0, [2, [1, [3, 4]]]], { x0: 96, x1: 154, y0: 16, y1: 76, w: 1.4 }).svg;
    s += txt(41, 94, T('árbol 1', 'tree 1'), 'art-mut', 8.5, 'middle') + txt(125, 94, T('árbol 2', 'tree 2'), 'art-mut', 8.5, 'middle');
    /* strict: ((1,2,(3,4))) */
    s += clado([0, [1, 2, [3, 4]]], { x0: 186, x1: 240, y0: 16, y1: 76, w: 1.8, stroke: 'var(--primary)' }).svg;
    s += txt(213, 94, T('estricto', 'strict'), 'art-txt', 8.5, 'middle', 'font-weight="700"');
    s += clado([0, [1, 2, [3, 4]]], { x0: 266, x1: 320, y0: 16, y1: 76, w: 1.8, stroke: 'var(--accent)' }).svg;
    s += txt(293, 94, T('mayoría 50 %', 'majority 50 %'), 'art-txt', 8.5, 'middle', 'font-weight="700"');
    s += txt(12, 116, T('Lo que comparten todos (estricto) o la mayoría (mayoría); una politomía es «no sé».', 'What all share (strict) or most share (majority); a polytomy means «don\'t know».'), 'art-mut', 8.5);
    return wrap('0 0 330 126', s);
  }

  /* method gallery: small pictures by family, varied by seed */
  function methodArt(fam, seed) {
    switch (fam) {
      case 'mat': return cardMatrix(seed);
      case 'bus': return cardSearch();
      case 'pes': return cardWeights();
      case 'opt': return cardMapping();
      case 'idx': return cardDiagnosis();
      case 'apo': return cardSupport();
      case 'con': return cardConsensus();
      case 'hip': return cardHypothesis();
      default: return cardReport();
    }
  }

  const Art = {
    hero, leaf, flower, zygoFlower, fruit, pod, cone, frond, compoundLeaf, GLYPHS,
    cards: {
      1: cardHome, 2: cardMatrix, 3: cardSearch, 4: cardWeights, 5: cardMapping, 6: cardDiagnosis,
      7: cardSupport, 8: cardConsensus, 9: cardHypothesis, 10: cardReport,
    },
    typeArt, methodArt,
    theory: { apomorphy: theoryApomorphy, groups: theoryGroups, homoplasy: theoryHomoplasy, indices: theoryIndices, inapplicable: theoryInapplicable, consensus: theoryConsensus },
    /* the hero's changes (ACCTRAN) of its matrix on its tree, keyed by the tip
       set of the branch; tests/block1.js recomputes them with optimize.js */
    HERO_MATRIX: ['00000000', '10100000', '11100100', '11011010', '11011011', '11011111'],
    HERO_TREE: '(G,(A,(B,(C,(D,E)))));',
    HERO_CHANGES: null,
  };
  /* characters of the hero, 0-based; arrival state; open = homoplastic */
  /* character 3 is gained and then reversed; character 6 is gained twice, in
     B and in E (a parallelism): both kinds of homoplasy in one picture */
  Art.HERO_CHANGES = {
    '12345': [{ c: 0, to: 1 }, { c: 2, to: 1 }],
    '2345': [{ c: 1, to: 1 }],
    '2': [{ c: 5, to: 1, open: true }],
    '345': [{ c: 2, to: 0, open: true }, { c: 3, to: 1 }, { c: 4, to: 1 }, { c: 6, to: 1 }],
    '45': [{ c: 7, to: 1 }],
    '5': [{ c: 5, to: 1, open: true }],
  };
  void uid;
  window.Art = Art;
})();
