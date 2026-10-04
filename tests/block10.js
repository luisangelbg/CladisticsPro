/* CladisticsPro — Copyright (C) 2026 Luis Ángel Barrera-Guzmán.
   Free software under the GNU General Public License, version 3 or later; see LICENSE. */

/* Unit tests for Block 10: the methods written from the state, the
   bibliography, the ZIP writer and the trees in NEXUS and xread. */
sec('30 · Los métodos redactados (report.js)');
{
  const m = exM('bursera');
  const only = Report.methods({ matrix: m }, 'es', { version: '1.0.0' });
  t('con sólo la matriz, el informe tiene la matriz y el programa', only.sections.map(s => s.id).join() === 'matrix,program');
  const ex = Engine.search(m, {}, { method: 'exact' });
  const st = { matrix: m, search: Object.assign({}, ex, { opts: { method: 'exact' }, prep: {}, length: ex.score, hits: null }) };
  const rep = Report.methods(st, 'es', { version: '1.0.0' });
  const txt = rep.sections.map(s => s.paras.join(' ')).join(' ');
  t('con la búsqueda, aparece su párrafo con la rama y cota y la longitud', rep.sections.some(s => s.id === 'search') && /rama y cota/.test(txt) && txt.indexOf(Report.num(ex.score)) >= 0);
  t('no aparece lo que no se corrió (pesos, apoyo, hipótesis)', !rep.sections.some(s => ['weights', 'support', 'hypotheses'].includes(s.id)));
  const en = Report.methods(st, 'en', { version: '1.0.0' });
  t('en inglés: «and» en las citas y el mismo número de secciones', en.sections.length === rep.sections.length && !/ y [A-Z][a-z]+ \d{4}/.test(en.sections.map(s => s.paras.join(' ')).join(' ')));
  const refs = Report.references(rep.cited, Home.REFS, 'es', '1.0.0');
  t('cada obra citada tiene su entrada completa y se cita el programa', refs.length === rep.cited.length + 1 && refs.every(r => r.text !== r.key || r.key === 'Barrera-Guzmán 2026') && refs.some(r => /CladisticsPro 1\.0\.0/.test(r.text)));
  const missing = Object.keys(Report.WORKS).filter(k => !Home.REFS.some(r => r[0].replace(/<[^>]+>/g, '').indexOf(Report.WORKS[k]) === 0));
  t('todas las obras que el informe puede citar están en la bibliografía de la app', missing.length === 0, missing.join('; '));
  const ord = Report.references(['Goloboff et al. 2003', 'Farris et al. 1996', 'Goloboff y Farris 2001', 'Farris 1989', 'Goloboff 1993', 'Farris 1970'], Home.REFS, 'es').map(r => r.key);
  t('referencias en orden: un autor, luego dos, luego más; y por año', ord.join() === 'Barrera-Guzmán 2026,Farris 1970,Farris 1989,Farris et al. 1996,Goloboff 1993,Goloboff y Farris 2001,Goloboff et al. 2003', ord.join(' | '));
  /* only what the text cites goes to the references: one consensus, one reference */
  const stc = Object.assign({}, st, { consensus: { tree: {}, method: 'strict' } });
  const repc = Report.methods(stc, 'es', { version: '1.0.0' });
  const txtc = repc.sections.map(s => s.paras.join(' ')).join(' ');
  t('con el consenso estricto, las referencias no traen las de los otros consensos (Adams, Bremer 1990, Margush y McMorris)', repc.cited.includes('Sokal y Rohlf 1981') && !repc.cited.some(k => ['Adams 1972', 'Bremer 1990', 'Margush y McMorris 1981'].includes(k)) && repc.cited.every(k => txtc.indexOf(k.replace(/ (\d{4})$/, '')) >= 0), repc.cited.join('; '));
  const html = Report.asHtml(rep, refs, { title: 'Métodos' });
  t('la página de métodos es un documento completo con su bibliografía', /^<!doctype html>/.test(html) && /<ol class="refs">/.test(html) && /<\/html>\s*$/.test(html));
}

sec('31 · El paquete ZIP (report.js)');
{
  const enc = s => new TextEncoder().encode(s);
  t('CRC-32 de «123456789» = CBF43926', Report.crc32(enc('123456789')) === 0xCBF43926);
  t('CRC-32 de nada = 0', Report.crc32(new Uint8Array(0)) === 0);
  const z = Report.zipBytes([{ name: 'a.txt', content: 'hola' }, { name: 'carpeta/ñandú.txt', content: 'árbol' }, { name: 'vacío', content: '' }]);
  const dv = new DataView(z.buffer);
  const end = z.length - 22;
  t('firmas del ZIP: cabecera local al principio y registro final al cierre', dv.getUint32(0, true) === 0x04034b50 && dv.getUint32(end, true) === 0x06054b50);
  t('el registro final cuenta 3 archivos y apunta al directorio central', dv.getUint16(end + 10, true) === 3 && dv.getUint32(dv.getUint32(end + 16, true), true) === 0x02014b50);
  t('nombres en UTF-8 (bandera 0x0800) y guardados tal cual', dv.getUint16(6, true) === 0x0800 && dv.getUint16(8, true) === 0);
  later(Report.zip([{ name: 'texto.txt', content: 'abc '.repeat(500) }]).then(b => {
    const d = new DataView(b.buffer);
    t('el texto largo se comprime (método 8) y queda más chico', d.getUint16(8, true) === 8 && b.length < 2000 + 100, b.length);
  }));
}

sec('32 · Árboles para otros programas (matio.js)');
{
  const m = exM('dahlia');
  const names = m.taxa.map(x => x.name);
  const nw = '(' + names.slice(0, -1).reduce((a, b) => a ? `(${a},'${b}')` : `'${b}'`, '') + ",'" + names[names.length - 1] + "');";
  const nex = MatIO.writeNexus(m, { trees: [{ name: 'oruga', newick: nw }] });
  t('NEXUS: los árboles van con tabla TRANSLATE (números)', /TRANSLATE/.test(nex) && /TREE oruga = \[&R\] \(\(\(/.test(nex));
  const back = MatIO.read(nex, 'x.nex');
  const key = s => Tree.cladeKey(Tree.parseNewick(s, names), names.length);
  t('NEXUS: el árbol vuelve con los mismos grupos y los mismos nombres', back.trees.length === 1 && key(back.trees[0].newick) === key(nw));
  const ss = MatIO.writeXread(m, { trees: [{ name: 'oruga', newick: nw }] });
  t('xread: los árboles van en tread, por número de taxón', /\ntread \(/.test(ss));
  t('xread: un número nunca sigue a «)»', !/\)\s*\d/.test(ss.slice(ss.indexOf('tread'))));
  const back2 = MatIO.read(ss, 'x.ss');
  t('xread: el árbol vuelve con los mismos grupos', back2.trees.length === 1 && key(back2.trees[0].newick) === key(nw));
  t('Newick con su nombre entre corchetes (el .tre del Bloque 10) se lee de vuelta', key('[mpt_1] ' + nw) === key(nw) && Tree.cladeKey(Tree.parseNewick(' [a] [b] ((A,B),(C,D));', ['A', 'B', 'C', 'D']), 4) === Tree.cladeKey(Tree.parseNewick('((A,B),(C,D));', ['A', 'B', 'C', 'D']), 4));
  t('tread con números tras «)» también se lee (taxón hermano)', Tree.cladeKey(Tree.parseNewick(MatIO.treadToNewick('((0 1) 2 (3 4))', ['A', 'B', 'C', 'D', 'E']), ['A', 'B', 'C', 'D', 'E']), 5) === Tree.cladeKey(Tree.parseNewick('((A,B),C,(D,E));', ['A', 'B', 'C', 'D', 'E']), 5));
  t('los diez bloques están listos', STEPS.every(s => s.ready === true) && typeof APP_VERSION === 'string');
}

sec('33 · Imágenes de los taxones (taxonimg.js, cladogram.js)');
{
  const taxa = ['Dahlia coccinea', 'Dahlia pinnata', 'Bursera simaruba', 'Cosmos bipinnatus'].map(n => ({ name: n }));
  const k = TaxonImg.match(['Dahlia_coccinea.jpg', 'dahlia-pinnata (2).png', 'IMG_Bursera simaruba_herbario.JPG', 'foto123.jpg', 'Cosmos_bipinnatus.tif'], taxa);
  t('el nombre del archivo encuentra su taxón (guiones, mayúsculas, extensión, texto de más)', k.join() === '0,1,2,-1,3', k.join());
  const nm = ['A', 'B', 'C', 'D'];
  const r = Tree.parseNewick('((A,B),(C,D));', nm);
  const px = 'data:image/png;base64,iVBORw0KGgo=';
  const svg = Clado.render(r, { tipImg: v => (v.name === 'C' ? null : px), imgSize: 40, legend: false });
  t('una imagen por taxón que la tiene; el que no, queda sin ella', (svg.match(/<image /g) || []).length === 3);
  const vb = +/viewBox="0 0 [\d.]+ ([\d.]+)"/.exec(svg)[1];
  t('las filas crecen para la imagen (46 px por taxón) y el SVG declara xlink', Math.abs(vb - (16 + 4 * 46 + 6)) < 0.11 && /xmlns:xlink=/.test(svg), vb);
  const svg2 = Clado.render(r, { tipImg: () => px, imgSize: 40, imgPlace: 'after', imgShape: 'circle', legend: false });
  t('en columna: línea punteada desde el nombre y recorte en círculo', /stroke-dasharray="1.5 3"/.test(svg2) && /<clipPath[^>]*><circle/.test(svg2));
  const plain = Clado.render(r, { legend: false });
  t('sin imágenes el cladograma queda como antes', !/<image/.test(plain) && !/xlink/.test(plain) && /viewBox="0 0 [\d.]+ 118(\.0)?"/.test(plain), /viewBox="[^"]+"/.exec(plain)[0]);
  const m = exM('bursera');
  m.taxa[0].image = 'txPRUEBA';
  later(StateImg.put('txPRUEBA', { data: px, w: 1, h: 1, confirmed: true, kind: 'taxon', square: px }).then(() => StateImg.collect(m)).then(all => {
    t('el archivo de proyecto lleva también las imágenes de los taxones', !!all.txPRUEBA);
  }));
}
