/* CladisticsPro — morphological cladistics in the browser.
   Copyright (C) 2026  Luis Ángel Barrera-Guzmán

   This program is free software: you can redistribute it and/or modify it under
   the terms of the GNU General Public License as published by the Free Software
   Foundation, either version 3 of the License, or (at your option) any later
   version. It is distributed in the hope that it will be useful, but WITHOUT ANY
   WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
   A PARTICULAR PURPOSE. See the GNU General Public License, in the file LICENSE
   at the root of this program, or <https://www.gnu.org/licenses/>. */

/* CladisticsPro — a picture for each state of a character.

   A character keeps `images: { state: id }`; the picture itself lives in the
   browser's database (Store, «images») as { data, w, h, credit, licence,
   confirmed, file }. Pictures are reduced to at most 1200 px on the longer side
   before they are kept. Nothing is shown in the character list or the report
   until the user ticks that the picture really shows that state: a picture of
   the wrong structure would mislead more than no picture at all. */
(function () {
  const cache = new Map();
  const MAX = 1200;
  const LICENCES = [
    ['propia', 'Fotografía o dibujo propio', 'My own photo or drawing'],
    ['CC BY 4.0', 'CC BY 4.0', 'CC BY 4.0'],
    ['CC BY-SA 4.0', 'CC BY-SA 4.0', 'CC BY-SA 4.0'],
    ['CC BY-NC 4.0', 'CC BY-NC 4.0', 'CC BY-NC 4.0'],
    ['CC0', 'CC0 (dominio público)', 'CC0 (public domain)'],
    ['permiso', 'Con permiso del autor', 'With the author\'s permission'],
  ];
  const newId = () => 'img' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  function get(id) {
    if (!id) return Promise.resolve(null);
    if (cache.has(id)) return Promise.resolve(cache.get(id));
    return Store.get('images', id).then(v => { if (v) cache.set(id, v); return v || null; });
  }
  function put(id, rec) { cache.set(id, rec); return Store.put('images', id, rec); }

  /* reads a file into a reduced data URL */
  function shrink(file) {
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
          const cx = cv.getContext('2d');
          cx.drawImage(img, 0, 0, w, h);
          const png = file.type === 'image/png' && file.size < 600000;
          resolve({ data: cv.toDataURL(png ? 'image/png' : 'image/jpeg', 0.88), w, h, file: file.name });
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }

  /* the dialog for one state; onDone(id | null) is called when the user saves or removes */
  function edit(ch, s, onDone) {
    const id0 = ch.images && ch.images[s];
    const dlg = mk('dialog', { class: 'si-dlg', 'aria-labelledby': 'siTitle' });
    dlg.innerHTML = `
      <h3 id="siTitle">${T('Imagen del estado', 'Picture of the state')} ${Mx.SYMBOLS[s]} · ${esc(ch.states[s] || '')}</h3>
      <p class="hint">${esc(ch.name || '')}</p>
      <div class="si-drop" tabindex="0" role="button" aria-label="${esc(T('Elegir o soltar una imagen', 'Choose or drop a picture'))}">
        <img class="si-prev" alt="" hidden>
        <span class="si-msg">${T('Suelta aquí una imagen o haz clic para elegirla', 'Drop a picture here or click to choose it')}</span>
      </div>
      <input type="file" accept="image/*" class="si-file" hidden>
      <div class="form-grid">
        <div class="field"><label for="siCredit">${T('Crédito (autor, colección)', 'Credit (author, collection)')}</label><input type="text" id="siCredit"></div>
        <div class="field"><label for="siLic">${T('Licencia', 'Licence')}</label><select id="siLic">${LICENCES.map(l => `<option value="${esc(l[0])}">${esc(T(l[1], l[2]))}</option>`).join('')}</select></div>
      </div>
      <label class="checkbox-label"><input type="checkbox" id="siOk"> ${T('Confirmo que la imagen muestra este estado de este carácter', 'I confirm the picture shows this state of this character')}</label>
      <div class="si-actions">
        <button type="button" class="btn btn-primary si-save" disabled>${T('Guardar', 'Save')}</button>
        <button type="button" class="btn btn-secondary si-del"${id0 ? '' : ' hidden'}>${T('Quitar la imagen', 'Remove the picture')}</button>
        <button type="button" class="btn btn-ghost si-cancel">${T('Cancelar', 'Cancel')}</button>
      </div>`;
    document.body.appendChild(dlg);
    const q = sel => dlg.querySelector(sel);
    let rec = null;
    const paint = () => {
      const img = q('.si-prev');
      if (rec) { img.src = rec.data; img.hidden = false; q('.si-msg').textContent = rec.file || ''; }
      q('.si-save').disabled = !(rec && q('#siOk').checked);
    };
    get(id0).then(r => { if (r) { rec = Object.assign({}, r); q('#siCredit').value = r.credit || ''; q('#siLic').value = r.licence || 'propia'; q('#siOk').checked = !!r.confirmed; } paint(); });
    const take = file => shrink(file).then(r => { rec = Object.assign(rec || {}, r); q('#siOk').checked = false; paint(); }, e => { q('.si-msg').textContent = e.message; });
    q('.si-drop').addEventListener('click', () => q('.si-file').click());
    q('.si-drop').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); q('.si-file').click(); } });
    q('.si-file').addEventListener('change', e => { if (e.target.files[0]) take(e.target.files[0]); });
    q('.si-drop').addEventListener('dragover', e => { e.preventDefault(); q('.si-drop').classList.add('over'); });
    q('.si-drop').addEventListener('dragleave', () => q('.si-drop').classList.remove('over'));
    q('.si-drop').addEventListener('drop', e => { e.preventDefault(); q('.si-drop').classList.remove('over'); if (e.dataTransfer.files[0]) take(e.dataTransfer.files[0]); });
    q('#siOk').addEventListener('change', paint);
    const close = () => { dlg.close(); dlg.remove(); };
    q('.si-cancel').addEventListener('click', close);
    dlg.addEventListener('cancel', () => setTimeout(() => dlg.remove(), 0));
    q('.si-save').addEventListener('click', () => {
      const id = id0 || newId();
      rec.credit = q('#siCredit').value.trim();
      rec.licence = q('#siLic').value;
      rec.confirmed = true;
      put(id, rec).then(() => { close(); onDone(id); });
    });
    q('.si-del').addEventListener('click', () => { close(); onDone(null); });
    dlg.showModal();
  }

  /* small thumbnails for a list of states; resolves to { state: dataURL } */
  function thumbs(ch) {
    const ids = ch.images || {};
    return Promise.all(Object.keys(ids).map(s => get(ids[s]).then(r => [s, r && r.confirmed ? r : null])))
      .then(list => Object.fromEntries(list.filter(x => x[1])));
  }
  /* every picture of a matrix (states and taxa), for the project file */
  function collect(m) {
    const ids = [];
    m.chars.forEach(c => { if (c.images) Object.values(c.images).forEach(id => ids.push(id)); });
    m.taxa.forEach(t => { if (t.image) ids.push(t.image); });
    return Promise.all(ids.map(id => get(id).then(r => [id, r]))).then(l => Object.fromEntries(l.filter(x => x[1])));
  }
  function restore(images) {
    if (!images) return Promise.resolve();
    return Promise.all(Object.keys(images).map(id => put(id, images[id])));
  }

  window.StateImg = { edit, get, put, thumbs, collect, restore, LICENCES };
})();
