/* CladisticsPro — morphological cladistics in the browser.
   Copyright (C) 2026  Luis Ángel Barrera-Guzmán

   This program is free software: you can redistribute it and/or modify it under
   the terms of the GNU General Public License as published by the Free Software
   Foundation, either version 3 of the License, or (at your option) any later
   version. It is distributed in the hope that it will be useful, but WITHOUT ANY
   WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
   A PARTICULAR PURPOSE. See the GNU General Public License, in the file LICENSE
   at the root of this program, or <https://www.gnu.org/licenses/>. */

/* CladisticsPro — a picture for each taxon (OTU), drawn beside its name in the
   cladograms.

   A taxon keeps `image: id`; the picture lives in the browser's database
   (Store, «images»), with the same record as the pictures of the states
   (stateimg.js) plus how it is framed:
     { data, w, h, file, credit, licence, confirmed, kind: 'taxon',
       frame: { zoom, x, y }, square }
   `square` is the framed picture, a square of 320 px, kept ready so a
   cladogram can be drawn at once and carries the picture inside it: the figure
   exports with it and does not point at files that will not be there tomorrow.
   Nothing is drawn until the user confirms that the picture shows that taxon —
   a photograph pinned to the wrong branch is a claim, not a decoration.

   Changing a picture changes no analysis: the results of the blocks stay. */
(function () {
  const SIDE = 320;
  const MAX = 1400;
  const recs = new Map();         // id → record
  const newId = () => 'tx' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const emit = () => document.dispatchEvent(new CustomEvent('taximgchange'));
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/\.[a-z0-9]{2,5}$/, '').replace(/[_\-.,;()[\]]+/g, ' ').replace(/\s+/g, ' ').trim();

  /* ---------------- the pictures of the matrix ---------------- */
  function load(m) {
    const ids = (m ? m.taxa : []).map(t => t.image).filter(Boolean);
    return Promise.all(ids.map(id => (recs.has(id) ? recs.get(id) : Store.get('images', id).then(r => { if (r) recs.set(id, r); return r; }))))
      .then(() => emit());
  }
  function recOf(t) { return t && t.image ? recs.get(t.image) || null : null; }
  /* the framed picture of a taxon, only if confirmed */
  function urlOfTaxon(t) { const r = recOf(t); return r && r.confirmed && r.square ? r.square : null; }
  /* the same by name, as the tips of a tree carry them */
  function url(name) {
    const m = state.matrix;
    if (!m) return null;
    const k = g_norm(name);
    const t = m.taxa.find(x => g_norm(x.name) === k);
    return urlOfTaxon(t);
  }
  const g_norm = s => (window.Tree && Tree.normName ? Tree.normName(s) : String(s || '').trim());
  function count(m) { m = m || state.matrix; return m ? m.taxa.filter(t => urlOfTaxon(t)).length : 0; }
  /* the credit line a figure has to carry, for the pictures that have one */
  function credits(names) {
    const m = state.matrix;
    if (!m) return [];
    const want = names ? new Set(names.map(g_norm)) : null;
    /* one line per author and licence, with the taxa it covers */
    const groups = new Map();
    m.taxa.forEach(t => {
      if (want && !want.has(g_norm(t.name))) return;
      const r = recOf(t);
      if (!r || !r.confirmed) return;
      const lic = r.licence === 'propia' ? T('imagen propia', 'own picture') : r.licence === 'permiso' ? T('con permiso del autor', 'with the author\'s permission') : r.licence;
      const who = [r.credit, lic].filter(Boolean).join(', ') || T('sin crédito anotado', 'no credit recorded');
      if (!groups.has(who)) groups.set(who, []);
      groups.get(who).push(t.name);
    });
    return [...groups].map(([who, list]) => who + ' (' + list.join(', ') + ')');
  }

  /* ---------------- reading and framing ---------------- */
  function readFile(file) {
    return new Promise((resolve, reject) => {
      if (!/^image\//.test(file.type)) { reject(new Error(T('El archivo no es una imagen.', 'The file is not an image.'))); return; }
      const fr = new FileReader();
      fr.onerror = () => reject(new Error(T('No se pudo leer el archivo.', 'The file could not be read.')));
      fr.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error(T('El navegador no pudo abrir la imagen.', 'The browser could not open the picture.')));
        img.onload = () => {
          const s = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
          const w = Math.max(1, Math.round(img.naturalWidth * s)), h = Math.max(1, Math.round(img.naturalHeight * s));
          const cv = document.createElement('canvas');
          cv.width = w; cv.height = h;
          cv.getContext('2d').drawImage(img, 0, 0, w, h);
          const png = file.type === 'image/png' && file.size < 800000;
          resolve({ data: cv.toDataURL(png ? 'image/png' : 'image/jpeg', 0.9), w, h, file: file.name });
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }
  const loadImg = src => new Promise((ok, bad) => { const im = new Image(); im.onload = () => ok(im); im.onerror = bad; im.src = src; });
  /* the square of side `side`: the picture covers it, enlarged by zoom and moved by x, y ∈ [−1, 1] */
  function drawSquare(img, frame, side, cv) {
    cv = cv || document.createElement('canvas');
    cv.width = side; cv.height = side;
    const cx = cv.getContext('2d');
    const f = frame || { zoom: 1, x: 0, y: 0 };
    const sc = Math.max(side / img.naturalWidth, side / img.naturalHeight) * Math.max(1, f.zoom || 1);
    const w = img.naturalWidth * sc, h = img.naturalHeight * sc;
    const ox = (side - w) / 2 - (f.x || 0) * (w - side) / 2, oy = (side - h) / 2 - (f.y || 0) * (h - side) / 2;
    cx.fillStyle = '#ffffff';
    cx.fillRect(0, 0, side, side);
    cx.imageSmoothingQuality = 'high';
    cx.drawImage(img, ox, oy, w, h);
    return cv;
  }
  function square(rec) {
    return loadImg(rec.data).then(img => drawSquare(img, rec.frame, SIDE).toDataURL('image/jpeg', 0.9));
  }
  function save(id, rec) { recs.set(id, rec); return Store.put('images', id, rec); }
  /* the taxon takes the picture through the editor of the matrix, so it can be undone */
  function assign(list, label) {
    const ops = list.map(([i, id]) => ({ kind: 'taxon', i, patch: { image: id } }));
    if (!ops.length) return;
    if (window.Block2 && Block2.do) Block2.do(ops.length === 1 ? ops[0] : { kind: 'batch', ops }, label);
    else ops.forEach(o => { state.matrix.taxa[o.i].image = o.patch.image; });
    emit();
  }

  /* ---------------- the editor of one picture ---------------- */
  function edit(i) {
    const m = state.matrix, t = m.taxa[i];
    const id0 = t.image || null;
    const dlg = mk('dialog', { class: 'si-dlg ti-dlg', 'aria-labelledby': 'tiTitle' });
    dlg.innerHTML = `
      <h3 id="tiTitle">${T('Imagen del taxón', 'Picture of the taxon')} · <i>${esc(t.name)}</i></h3>
      <div class="ti-body">
        <div class="ti-left">
          <div class="si-drop ti-drop" tabindex="0" role="button" aria-label="${esc(T('Elegir o soltar una imagen', 'Choose or drop a picture'))}">
            <canvas class="ti-prev" width="240" height="240" hidden></canvas>
            <span class="si-msg">${T('Suelta aquí una imagen o haz clic para elegirla', 'Drop a picture here or click to choose it')}</span>
          </div>
          <input type="file" accept="image/*" class="si-file" hidden>
          <p class="hint ti-tip">${T('Arrastra la imagen para encuadrarla; así se verá junto al nombre.', 'Drag the picture to frame it; it will look like this beside the name.')}</p>
          <button type="button" class="btn btn-ghost btn-sm ti-pick">${T('Elegir otra imagen…', 'Choose another picture…')}</button>
        </div>
        <div class="ti-right">
          <div class="field"><label for="tiZoom">${T('Acercar', 'Zoom')}</label><input type="range" id="tiZoom" min="1" max="4" step="0.05" value="1"></div>
          <div class="field"><label for="tiX">${T('Mover a lo ancho', 'Move across')}</label><input type="range" id="tiX" min="-1" max="1" step="0.02" value="0"></div>
          <div class="field"><label for="tiY">${T('Mover a lo alto', 'Move up and down')}</label><input type="range" id="tiY" min="-1" max="1" step="0.02" value="0"></div>
          <div class="field"><label for="tiCredit">${T('Crédito (autor, colección)', 'Credit (author, collection)')}</label><input type="text" id="tiCredit"></div>
          <div class="field"><label for="tiLic">${T('Licencia', 'Licence')}</label><select id="tiLic">${StateImg.LICENCES.map(l => `<option value="${esc(l[0])}">${esc(T(l[1], l[2]))}</option>`).join('')}</select></div>
        </div>
      </div>
      <label class="checkbox-label"><input type="checkbox" id="tiOk"> ${T('Confirmo que la imagen muestra a este taxón', 'I confirm the picture shows this taxon')}</label>
      <div class="si-actions">
        <button type="button" class="btn btn-primary ti-save" disabled>${T('Guardar', 'Save')}</button>
        <button type="button" class="btn btn-secondary ti-del"${id0 ? '' : ' hidden'}>${T('Quitar la imagen', 'Remove the picture')}</button>
        <button type="button" class="btn btn-ghost ti-cancel">${T('Cancelar', 'Cancel')}</button>
      </div>`;
    document.body.appendChild(dlg);
    const q = s => dlg.querySelector(s);
    let rec = null, img = null;
    const frame = () => ({ zoom: +q('#tiZoom').value, x: +q('#tiX').value, y: +q('#tiY').value });
    const paint = () => {
      const cv = q('.ti-prev');
      if (img) { drawSquare(img, frame(), 240, cv); cv.hidden = false; q('.si-msg').textContent = rec.file || ''; }
      q('.ti-save').disabled = !(rec && q('#tiOk').checked);
    };
    const setFrame = f => { q('#tiZoom').value = f.zoom || 1; q('#tiX').value = f.x || 0; q('#tiY').value = f.y || 0; };
    const use = r => loadImg(r.data).then(im => { img = im; paint(); });
    if (id0) Store.get('images', id0).then(r => {
      if (!r) return paint();
      rec = Object.assign({}, r);
      q('#tiCredit').value = r.credit || ''; q('#tiLic').value = r.licence || 'propia'; q('#tiOk').checked = !!r.confirmed;
      setFrame(r.frame || {});
      use(rec);
    });
    else paint();
    const take = file => readFile(file).then(r => { rec = Object.assign(rec || {}, r); setFrame({}); q('#tiOk').checked = false; use(rec); }, e => { q('.si-msg').textContent = e.message; });
    const drop = q('.ti-drop');
    drop.addEventListener('click', e => { if (!img || e.target === q('.si-msg')) q('.si-file').click(); });
    drop.addEventListener('dblclick', () => q('.si-file').click());
    q('.ti-pick').addEventListener('click', () => q('.si-file').click());
    drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); q('.si-file').click(); } });
    q('.si-file').addEventListener('change', e => { if (e.target.files[0]) take(e.target.files[0]); });
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); if (e.dataTransfer.files[0]) take(e.dataTransfer.files[0]); });
    /* framing by dragging the preview */
    let drag = null;
    const cv = q('.ti-prev');
    cv.addEventListener('pointerdown', e => { if (!img) return; drag = { x: e.clientX, y: e.clientY, f: frame() }; cv.setPointerCapture(e.pointerId); e.preventDefault(); });
    cv.addEventListener('pointermove', e => {
      if (!drag) return;
      const k = 2 / 240 / Math.max(0.25, drag.f.zoom - 0.6);
      q('#tiX').value = Math.max(-1, Math.min(1, drag.f.x - (e.clientX - drag.x) * k));
      q('#tiY').value = Math.max(-1, Math.min(1, drag.f.y - (e.clientY - drag.y) * k));
      paint();
    });
    cv.addEventListener('pointerup', () => { drag = null; });
    ['#tiZoom', '#tiX', '#tiY'].forEach(s => q(s).addEventListener('input', paint));
    q('#tiOk').addEventListener('change', paint);
    const close = () => { dlg.close(); dlg.remove(); };
    q('.ti-cancel').addEventListener('click', close);
    dlg.addEventListener('cancel', () => setTimeout(() => dlg.remove(), 0));
    q('.ti-save').addEventListener('click', async () => {
      const id = id0 || newId();
      rec.credit = q('#tiCredit').value.trim();
      rec.licence = q('#tiLic').value;
      rec.confirmed = true;
      rec.kind = 'taxon';
      rec.frame = frame();
      rec.square = await square(rec);
      await save(id, rec);
      close();
      if (id0 === id) emit();
      else assign([[i, id]], T('Imagen del taxón', 'Taxon picture'));
    });
    q('.ti-del').addEventListener('click', () => { close(); assign([[i, null]], T('Quitar la imagen del taxón', 'Remove the taxon picture')); });
    dlg.showModal();
  }

  /* ---------------- several at once, by the name of the file ---------------- */
  /* the taxon each file is named after: the same name, or a name inside the file name (the longest) */
  function match(fileNames, taxa) {
    const tn = taxa.map(t => norm(t.name));
    return fileNames.map(f => {
      const n = norm(f);
      let k = tn.indexOf(n);
      if (k < 0) {
        let best = -1, len = 0;
        tn.forEach((x, q) => { if (x && (n.includes(x) || x.includes(n)) && x.length > len && n.length >= 3) { best = q; len = x.length; } });
        k = best;
      }
      return k;
    });
  }
  function bulk(files) {
    const m = state.matrix;
    files = [...files].filter(f => /^image\//.test(f.type));
    if (!files.length) return;
    const guess = match(files.map(f => f.name), m.taxa);
    const dlg = mk('dialog', { class: 'si-dlg ti-bulk', 'aria-labelledby': 'tbTitle' });
    const opts = sel => `<option value="-1">${T('— ninguno —', '— none —')}</option>` + m.taxa.map((t, i) => `<option value="${i}"${i === sel ? ' selected' : ''}>${esc(t.name)}</option>`).join('');
    dlg.innerHTML = `
      <h3 id="tbTitle">${T('Imágenes de varios taxones', 'Pictures of several taxa')}</h3>
      <p class="hint">${T('Cada archivo se empareja con el taxón de su nombre (por ejemplo, «Dahlia_coccinea.jpg»). Revisa y corrige lo que haga falta.', 'Each file is matched with the taxon of its name (for example, «Dahlia_coccinea.jpg»). Check and correct what is needed.')}</p>
      <div class="table-scroll ti-bulk-list"><table><thead><tr><th>${T('Archivo', 'File')}</th><th>${T('Taxón', 'Taxon')}</th></tr></thead><tbody>
        ${files.map((f, k) => `<tr><td>${esc(f.name)}</td><td><select data-k="${k}" aria-label="${esc(T('Taxón de ', 'Taxon of ') + f.name)}">${opts(guess[k])}</select></td></tr>`).join('')}
      </tbody></table></div>
      <div class="form-grid">
        <div class="field"><label for="tbCredit">${T('Crédito para todas (opcional)', 'Credit for all (optional)')}</label><input type="text" id="tbCredit"></div>
        <div class="field"><label for="tbLic">${T('Licencia', 'Licence')}</label><select id="tbLic">${StateImg.LICENCES.map(l => `<option value="${esc(l[0])}">${esc(T(l[1], l[2]))}</option>`).join('')}</select></div>
      </div>
      <label class="checkbox-label"><input type="checkbox" id="tbOk"> ${T('Confirmo que cada imagen muestra al taxón con el que quedó emparejada', 'I confirm each picture shows the taxon it is matched with')}</label>
      <p class="hint">${T('Sin confirmar, se guardan pero no se dibujan; puedes confirmarlas una por una después.', 'Unconfirmed, they are kept but not drawn; you can confirm them one by one later.')}</p>
      <div class="si-actions">
        <button type="button" class="btn btn-primary tb-go">${T('Guardar las imágenes', 'Save the pictures')}</button>
        <button type="button" class="btn btn-ghost tb-cancel">${T('Cancelar', 'Cancel')}</button>
      </div>
      <div class="ti-bulk-msg" aria-live="polite"></div>`;
    document.body.appendChild(dlg);
    const q = s => dlg.querySelector(s);
    const close = () => { dlg.close(); dlg.remove(); };
    q('.tb-cancel').addEventListener('click', close);
    dlg.addEventListener('cancel', () => setTimeout(() => dlg.remove(), 0));
    q('.tb-go').addEventListener('click', async () => {
      const pick = [...dlg.querySelectorAll('select[data-k]')].map(s => +s.value);
      const ok = q('#tbOk').checked, credit = q('#tbCredit').value.trim(), licence = q('#tbLic').value;
      q('.tb-go').disabled = true;
      const list = [];
      for (let k = 0; k < files.length; k++) {
        const i = pick[k];
        if (i < 0) continue;
        q('.ti-bulk-msg').textContent = T(`Guardando ${k + 1} de ${files.length}…`, `Saving ${k + 1} of ${files.length}…`);
        try {
          const r = await readFile(files[k]);
          const id = m.taxa[i].image || newId();
          const old = recs.get(id) || {};
          const rec = Object.assign({}, r, { credit: credit || old.credit || '', licence, confirmed: ok, kind: 'taxon', frame: { zoom: 1, x: 0, y: 0 } });
          rec.square = await square(rec);
          await save(id, rec);
          list.push([i, id]);
        } catch (e) { /* a file that cannot be read is skipped */ }
      }
      close();
      const fresh = list.filter(([i, id]) => m.taxa[i].image !== id);
      if (fresh.length) assign(fresh, T('Imágenes de los taxones', 'Taxon pictures'));
      else emit();
      if (window.LABG) LABG.toast(T(`${list.length} imágenes guardadas`, `${list.length} pictures saved`) + (ok ? '' : T(' (sin confirmar)', ' (unconfirmed)')));
    });
    dlg.showModal();
  }

  /* ---------------- the gallery ---------------- */
  function gallery(host) {
    const m = state.matrix;
    if (!host || !m) return;
    const n = count(m);
    host.innerHTML = `<div class="ti-bar">
        <span class="hint">${T(`${n} de ${m.taxa.length} taxones con imagen confirmada`, `${n} of ${m.taxa.length} taxa with a confirmed picture`)}</span>
        <button type="button" class="btn btn-secondary btn-sm" data-ti="bulk">${T('Añadir varias (por nombre de archivo)', 'Add several (by file name)')}</button>
        <input type="file" accept="image/*" multiple hidden data-ti="files">
      </div>
      <div class="ti-grid">${m.taxa.map((t, i) => {
        const r = recOf(t);
        const st = !r ? ['', T('sin imagen', 'no picture')] : r.confirmed ? ['ok', T('lista', 'ready')] : ['warn', T('sin confirmar', 'unconfirmed')];
        return `<button type="button" class="ti-tile" data-i="${i}" aria-label="${esc(T('Imagen de ', 'Picture of ') + t.name + ' · ' + st[1])}">
          ${r && r.square ? `<img src="${r.square}" alt="">` : `<span class="ti-empty" aria-hidden="true">+</span>`}
          <i>${esc(t.name)}</i><span class="badge ${st[0]}">${st[1]}</span></button>`;
      }).join('')}</div>`;
    host.querySelectorAll('.ti-tile').forEach(b => b.addEventListener('click', () => edit(+b.dataset.i)));
    const inp = host.querySelector('[data-ti="files"]');
    host.querySelector('[data-ti="bulk"]').addEventListener('click', () => inp.click());
    inp.addEventListener('change', e => { bulk(e.target.files); e.target.value = ''; });
  }
  /* the gallery in a window of its own, from the blocks that draw cladograms */
  function manage() {
    const dlg = mk('dialog', { class: 'si-dlg ti-manage', 'aria-labelledby': 'tmTitle' });
    dlg.innerHTML = `<h3 id="tmTitle">${T('Imágenes de los taxones', 'Pictures of the taxa')}</h3><div class="ti-host"></div>
      <div class="si-actions"><button type="button" class="btn btn-primary tm-close">${T('Listo', 'Done')}</button></div>`;
    document.body.appendChild(dlg);
    const host = dlg.querySelector('.ti-host');
    const paint = () => gallery(host);
    paint();
    document.addEventListener('taximgchange', paint);
    const close = () => { document.removeEventListener('taximgchange', paint); dlg.close(); dlg.remove(); };
    dlg.querySelector('.tm-close').addEventListener('click', close);
    dlg.addEventListener('cancel', () => { document.removeEventListener('taximgchange', paint); setTimeout(() => dlg.remove(), 0); });
    dlg.showModal();
  }

  window.TaxonImg = { load, url, urlOfTaxon, count, credits, edit, bulk, match, gallery, manage, drawSquare, SIDE };
})();
