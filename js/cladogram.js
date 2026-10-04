/* CladisticsPro — morphological cladistics in the browser.
   Copyright (C) 2026  Luis Ángel Barrera-Guzmán

   This program is free software: you can redistribute it and/or modify it under
   the terms of the GNU General Public License as published by the Free Software
   Foundation, either version 3 of the License, or (at your option) any later
   version. It is distributed in the hope that it will be useful, but WITHOUT ANY
   WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
   A PARTICULAR PURPOSE. See the GNU General Public License, in the file LICENSE
   at the root of this program, or <https://www.gnu.org/licenses/>. */

/* CladisticsPro — the cladogram, drawn as systematists publish it.

   Right-angled, tips aligned on the right, and every change of state drawn on
   its branch as a mark: the number of the character above, the state it
   changes to below. A filled mark is a change into a state that arises only
   once in the tree; an open mark is homoplastic (the state also arises
   elsewhere: a parallelism, a convergence or a reversal). Ambiguous changes —
   those that only one of the two named reconstructions places there — are
   drawn fainter, so a figure never sells an ambiguous synapomorphy as a sure
   one.

   Branches are long enough for their marks: the horizontal unit grows until
   the busiest branch fits. Colours come from CSS variables (the figure follows
   the theme and the figure studio), text from classes.

   render(root, opts) returns an SVG string. Options:
     names(tip) → label · marks: Map(node → [{c, to, homoplastic, unambiguous}])
     charLabel(c) · stateLabel(c, s) · paint: Map(node → state) to colour the
     branches by one character · nodeSets: Map(node → bit mask) to draw MPR
     sets as split dots · selected: node · rowH · minUnit · id (prefix for
     data attributes) · title · legend: true|false */
function CladogramCore(g) {
const Clado = {};
const f1 = v => (+v).toFixed(1);
const escX = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* the colours of the states: the Okabe–Ito palette (Okabe and Ito 2008),
   readable with the three common kinds of colour blindness */
Clado.STATE_VARS = ['st0', 'st1', 'st2', 'st3', 'st4', 'st5', 'st6', 'st7'];
Clado.stateColor = s => s == null || s < 0 ? 'var(--text-muted)' : `var(--${Clado.STATE_VARS[s % 8]})`;

Clado.layout = function (root, opts) {
  opts = opts || {};
  const Tree = g.Tree;
  const post = Tree.postorder(root);
  const height = new Map(), y = new Map();
  let row = 0;
  for (const v of post) {
    if (!v.children.length) { height.set(v, 0); y.set(v, row++); continue; }
    height.set(v, 1 + Math.max(...v.children.map(c => height.get(c))));
    const ys = v.children.map(c => y.get(c));
    y.set(v, (Math.min(...ys) + Math.max(...ys)) / 2);
  }
  const H = height.get(root);
  return { post, height, y, H, nTips: row };
};

Clado.render = function (root, opts) {
  opts = opts || {};
  const Tree = g.Tree;
  const L = Clado.layout(root, opts);
  /* a picture of each taxon beside its name (taxonimg.js): tipImg(tip) → data URL or null.
     Before the name (imgPlace 'before') or in a column after the names ('after') */
  const imgOf = new Map();
  if (opts.tipImg) Tree.tips(root).forEach(v => { const u = opts.tipImg(v); if (u) imgOf.set(v, u); });
  const imgS = imgOf.size ? Math.max(14, Math.min(200, +opts.imgSize || 40)) : 0;
  const imgAfter = opts.imgPlace === 'after';
  const imgW = imgS ? imgS + 8 : 0;
  const rowH = Math.max(opts.rowH || 24, imgS ? imgS + 6 : 0);
  const markGap = opts.markGap || 15;
  const marks = opts.marks || new Map();
  /* a branch that carries a text at its node keeps room for it at that end,
     so the text never sits on a mark nor runs over the next branch */
  const ntext = opts.nodeText;
  const room = v => (ntext && ntext.get(v) != null && ntext.get(v) !== '' ? String(ntext.get(v)).length * 5.8 + 8 : 0);
  /* the unit: the branch with most marks must fit them */
  let unit = opts.minUnit || 34;
  for (const v of L.post) {
    if (v === root) continue;
    const span = L.height.get(v.parent) - L.height.get(v);
    const m = (marks.get(v) || []).length;
    if (m || room(v)) unit = Math.max(unit, (m * markGap + 14 + room(v)) / span);
  }
  if (opts.maxUnit) unit = Math.min(unit, opts.maxUnit);
  /* a fixed width for the tree part, so that thumbnails of trees of different
     depth line up at the same size */
  if (opts.treeWidth) unit = opts.treeWidth / Math.max(1, L.H);
  const names = opts.names || (v => v.name);
  const fs = opts.fontSize || 12;
  /* room for the names: measured approximately (0.58 em per character) */
  const longest = Math.max(...Tree.tips(root).map(v => String(names(v)).length), 1);
  const nameW = Math.ceil(longest * fs * 0.58) + 10;
  /* the text of the root sits left of its stem: room for it */
  const padL = 14 + Math.max(0, room(root) - 16), padT = opts.title ? 28 : 16, stemW = opts.stem === false ? 0 : 16;
  let treeW, X;
  if (opts.fitMarks) {
    /* every branch as long as its own marks need (at least the unit), the
       tips aligned on the right: a tree with many changes stays compact */
    const base = opts.minUnit || 34;
    const need = v => Math.max(base, (marks.get(v) || []).length * markGap + 14 + room(v));
    const px = new Map();
    Tree.preorder(root).forEach(v => px.set(v, v === root ? 0 : px.get(v.parent) + (v.children.length ? need(v) : 0)));
    let tipX = 0;
    Tree.tips(root).forEach(v => { tipX = Math.max(tipX, v === root ? 0 : px.get(v.parent) + need(v)); });
    treeW = tipX;
    X = v => padL + stemW + (v.children.length ? px.get(v) : tipX);
  } else {
    treeW = L.H * unit;
    X = v => padL + stemW + (L.H - L.height.get(v)) * unit;
  }
  const W = padL + stemW + treeW + 8 + nameW + 6 + imgW;
  const legendH = opts.legend === false ? 0 : 30;
  const Hh = padT + L.nTips * rowH + legendH + 6;
  const Y = v => padT + L.y.get(v) * rowH + rowH / 2;
  const paint = opts.paint, paintColor = opts.paintColor, dashed = opts.dashed;
  const col = v => (paintColor ? (paintColor(v) || 'var(--clado-line)') : paint && paint.has(v) ? Clado.stateColor(paint.get(v)) : 'var(--clado-line)');
  const wBr = paint || paintColor ? 3.2 : 1.6;
  /* a branch where the character does not apply is drawn dashed */
  const dash = v => (dashed && dashed.has(v) ? ' stroke-dasharray="5 4"' : '');
  const pre = opts.id ? opts.id + '-' : '';
  let out = '';
  const nodeIds = new Map();
  L.post.forEach((v, i) => nodeIds.set(v, i));
  /* branches: vertical connectors first, then horizontals, so a coloured
     horizontal is drawn over a neutral connector */
  let conn = '', horiz = '', hits = '', marksSvg = '', labels = '', dots = '';
  for (const v of L.post) {
    if (v.children.length) {
      const ys = v.children.map(Y);
      /* a connector is coloured piecewise, each half like the child it leads to */
      v.children.forEach(c => {
        conn += `<line x1="${f1(X(v))}" y1="${f1(Y(v))}" x2="${f1(X(v))}" y2="${f1(Y(c))}" stroke="${col(c)}" stroke-width="${wBr}" stroke-linecap="round"${dash(c)}/>`;
      });
      void ys;
    }
    const x1 = v === root ? X(v) - stemW : X(v.parent), x2 = X(v), yy = Y(v);
    if (v === root && stemW === 0) continue;
    horiz += `<line x1="${f1(x1)}" y1="${f1(yy)}" x2="${f1(x2)}" y2="${f1(yy)}" stroke="${col(v)}" stroke-width="${wBr}" stroke-linecap="round"${dash(v)}/>`;
    /* an invisible, generous target for clicks on the branch */
    if (opts.clickable) hits += `<line class="clado-hit" data-node="${pre}${nodeIds.get(v)}" x1="${f1(x1)}" y1="${f1(yy)}" x2="${f1(x2)}" y2="${f1(yy)}" stroke="transparent" stroke-width="14"/>`;
    const ms = marks.get(v) || [];
    if (ms.length) {
      const span = x2 - x1 - room(v);
      const step = span / (ms.length + 1);
      ms.forEach((m, k) => {
        const mx = x1 + step * (k + 1);
        const cls = 'clado-mark' + (m.homoplastic ? ' open' : '') + (m.unambiguous === false ? ' ambig' : '');
        const lab = opts.charLabel ? opts.charLabel(m.c) : String(m.c + 1);
        const st = opts.stateLabel ? opts.stateLabel(m.c, m.to) : String(m.to);
        marksSvg += `<g class="${cls}" data-char="${m.c}"><circle cx="${f1(mx)}" cy="${f1(yy)}" r="4.3"/>` +
          `<text x="${f1(mx)}" y="${f1(yy - 7)}" text-anchor="middle" class="clado-mnum" font-size="9">${escX(lab)}</text>` +
          `<text x="${f1(mx)}" y="${f1(yy + 15)}" text-anchor="middle" class="clado-mst" font-size="9">${escX(st)}</text></g>`;
      });
    }
  }
  /* MPR sets as small split dots on the nodes */
  if (opts.nodeSets) {
    for (const v of L.post) {
      const m = opts.nodeSets.get(v);
      if (m == null) continue;
      const st = g.Opt ? g.Opt.bits(m) : [];
      const cx = X(v), cy = Y(v), r = v.children.length ? 5.5 : 4.5;
      if (st.length === 1) dots += `<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${r}" fill="${Clado.stateColor(st[0])}" stroke="var(--card-bg)" stroke-width="1.2"/>`;
      else if (st.length > 1) {
        const a = 2 * Math.PI / st.length;
        st.forEach((s, k) => {
          const t0 = -Math.PI / 2 + k * a, t1 = t0 + a;
          const p0 = [cx + r * Math.cos(t0), cy + r * Math.sin(t0)], p1 = [cx + r * Math.cos(t1), cy + r * Math.sin(t1)];
          dots += `<path d="M${f1(cx)} ${f1(cy)}L${f1(p0[0])} ${f1(p0[1])}A${r} ${r} 0 ${a > Math.PI ? 1 : 0} 1 ${f1(p1[0])} ${f1(p1[1])}Z" fill="${Clado.stateColor(s)}" stroke="var(--card-bg)" stroke-width="0.8"/>`;
        });
      }
    }
  }
  /* tip names, and the picture of each taxon */
  const nameX = v => X(v) + 7 + (imgS && !imgAfter ? imgW : 0);
  for (const v of Tree.tips(root)) {
    const sel = opts.selectedTips && opts.selectedTips.has(v.tip);
    labels += `<text x="${f1(nameX(v))}" y="${f1(Y(v) + fs * 0.35)}" class="clado-name${sel ? ' sel' : ''}" font-size="${fs}">${escX(names(v))}</text>`;
  }
  let pics = '', clips = '';
  if (imgS) {
    Clado._n = (Clado._n || 0) + 1;
    const cid = 'clado-ti' + Clado._n;
    const shape = opts.imgShape || 'round';
    const r = shape === 'circle' ? imgS / 2 : shape === 'round' ? imgS * 0.18 : 0;
    const body = shape === 'circle' ? `<circle cx="${f1(imgS / 2)}" cy="${f1(imgS / 2)}" r="${f1(imgS / 2)}"/>` : `<rect width="${f1(imgS)}" height="${f1(imgS)}" rx="${f1(r)}"/>`;
    clips = `<defs><clipPath id="${cid}" clipPathUnits="userSpaceOnUse">${body}</clipPath></defs>`;
    const frame = opts.imgFrame === false ? '' : shape === 'circle'
      ? `<circle cx="${f1(imgS / 2)}" cy="${f1(imgS / 2)}" r="${f1(imgS / 2)}" fill="none" stroke="var(--clado-line)" stroke-width="0.8" opacity="0.55"/>`
      : `<rect width="${f1(imgS)}" height="${f1(imgS)}" rx="${f1(r)}" fill="none" stroke="var(--clado-line)" stroke-width="0.8" opacity="0.55"/>`;
    imgOf.forEach((u, v) => {
      const x = imgAfter ? X(v) + 7 + nameW + 2 : X(v) + 5;
      const y = Y(v) - imgS / 2;
      /* in a column after the names, a dotted leader from the end of the name */
      if (imgAfter) {
        const x0 = nameX(v) + String(names(v)).length * fs * 0.58 + 4;
        if (x - 3 > x0 + 4) pics += `<line x1="${f1(x0)}" y1="${f1(Y(v))}" x2="${f1(x - 3)}" y2="${f1(Y(v))}" stroke="var(--clado-line)" stroke-width="0.8" stroke-dasharray="1.5 3" opacity="0.6"/>`;
      }
      pics += `<g transform="translate(${f1(x)},${f1(y)})"><image xlink:href="${u}" width="${f1(imgS)}" height="${f1(imgS)}" preserveAspectRatio="xMidYMid slice"${shape === 'square' && opts.imgFrame === false ? '' : ` clip-path="url(#${cid})"`}/>${frame}</g>`;
    });
    pics = `<g class="clado-pics" data-role="taxon-pictures">${pics}</g>`;
  }
  if (opts.selected) {
    const v = opts.selected;
    dots += `<circle cx="${f1(X(v))}" cy="${f1(Y(v))}" r="7" fill="none" stroke="var(--accent)" stroke-width="2"/>`;
  }
  /* short texts next to the nodes (a clade's number, an interval of values) */
  if (opts.nodeText) {
    opts.nodeText.forEach((txt, v) => {
      if (!L.y.has(v) || txt == null || txt === '') return;
      dots += `<text x="${f1(X(v) - 4)}" y="${f1(Y(v) - 6)}" text-anchor="end" class="clado-ntext" font-size="9.5">${escX(txt)}</text>`;
    });
  }
  let legend = '';
  if (legendH && opts.paintLegend) {
    /* the states of the painted character, in a row */
    const ly = padT + L.nTips * rowH + 18;
    let x = padL;
    legend = `<g class="clado-legend" data-role="legend">` + opts.paintLegend.map((it, i) => {
      const w = 28 + String(it.label).length * 5.6;
      const s = `<g data-li="${i}"><line x1="${f1(x)}" x2="${f1(x + 18)}" y1="${ly}" y2="${ly}" stroke="${it.color}" stroke-width="3.2" stroke-linecap="round"${it.dashed ? ' stroke-dasharray="5 4"' : ''}/>` +
        `<text x="${f1(x + 23)}" y="${ly + 3.5}" class="clado-leg" font-size="10">${escX(it.label)}</text></g>`;
      x += w;
      return s;
    }).join('') + `</g>`;
  } else if (legendH) {
    const ly = padT + L.nTips * rowH + 18;
    legend = `<g class="clado-legend" data-role="legend">` +
      `<g data-li="0"><g class="clado-mark"><circle cx="${padL + 6}" cy="${ly}" r="4.3"/></g><text x="${padL + 15}" y="${ly + 3.5}" class="clado-leg" font-size="10">${escX(opts.legendUnique || 'única')}</text></g>` +
      `<g data-li="1"><g class="clado-mark open"><circle cx="${padL + 84}" cy="${ly}" r="4.3"/></g><text x="${padL + 93}" y="${ly + 3.5}" class="clado-leg" font-size="10">${escX(opts.legendHomo || 'homoplásica')}</text></g>` +
      (opts.showAmbig !== false ? `<g data-li="2"><g class="clado-mark ambig"><circle cx="${padL + 184}" cy="${ly}" r="4.3"/></g><text x="${padL + 193}" y="${ly + 3.5}" class="clado-leg" font-size="10">${escX(opts.legendAmbig || 'ambigua')}</text></g>` : '') +
      `</g>`;
  }
  const title = opts.title ? `<text x="${padL}" y="17" class="clado-title" font-size="12.5" font-weight="700">${escX(opts.title)}</text>` : '';
  out = `<svg class="clado" viewBox="0 0 ${f1(W)} ${f1(Hh)}" width="${f1(W)}" height="${f1(Hh)}" xmlns="http://www.w3.org/2000/svg"${imgS ? ' xmlns:xlink="http://www.w3.org/1999/xlink"' : ''} data-plot="cladogram"${opts.ariaLabel ? ` role="img" aria-label="${escX(opts.ariaLabel)}"` : ''}>` +
    clips + title + `<g class="clado-branches">${conn}${horiz}</g>${dots}<g class="clado-marks">${marksSvg}</g>${labels}${pics}${hits}${legend}</svg>`;
  return out;
};

/* the node behind a data-node attribute, for click handlers */
Clado.nodeById = function (root, idStr, prefix) {
  const post = g.Tree.postorder(root);
  const k = Number(String(idStr).replace(prefix ? prefix + '-' : '', ''));
  return post[k] || null;
};

g.Clado = Clado;
return Clado;
}
if (typeof window !== 'undefined') CladogramCore(window);
