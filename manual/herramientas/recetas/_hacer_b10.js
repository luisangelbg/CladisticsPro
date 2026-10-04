/* Writes the recipes of chapter 10. Run with node from this folder: node _hacer_b10.js */
const fs = require('fs');
const src2 = fs.readFileSync('_hacer_b2.js', 'utf8');
const FLORES = src2.slice(src2.indexOf('const FLORES = `') + 'const FLORES = `'.length, src2.indexOf('`;\nconst recipes'));
const PRE = `const W = ms => new Promise(r => setTimeout(r, ms));
  const top = n => n.getBoundingClientRect().top + window.scrollY;
  const irA = (n, m = 175) => window.scrollTo({ top: top(n) - m, behavior: "instant" });
  const caja = (nodos, p = 8, maxH) => { const rs = nodos.filter(Boolean).map(n => n.getBoundingClientRect()); const x = Math.max(0, Math.min(...rs.map(r => r.left)) - p), y = Math.max(0, Math.min(...rs.map(r => r.top)) - p); let h = Math.max(...rs.map(r => r.bottom)) + p - y; if (maxH) h = Math.min(h, maxH); window.__recorte = [x, y, Math.max(...rs.map(r => r.right)) + p - x, h].map(Math.round).join(","); return window.__recorte; };
  const q = s => document.querySelector(s);
  { const st = document.createElement("style"); st.textContent = ".lnav-fbtn{visibility:hidden!important}"; document.head.appendChild(st); }
  const espera = async (cond, ms = 300000) => { const t0 = Date.now(); while (!cond() && Date.now() - t0 < ms) await W(300); await W(600); };
  const sesion = async (imagenes) => { goStep(2); Block2.loadExample("dahlia"); await W(1100);
    if (imagenes) await ponImagenes();
    goStep(3); await W(500); state.search = null; q("#b3Run").click(); await espera(() => state.search);
    goStep(5); await W(1000); goStep(7); await W(800);
    q("#b7BRun").click(); await espera(() => state.support && state.support.bremer);
    q("#b7RRun").click(); await espera(() => state.support && state.support.res && state.support.res.jack);
    goStep(8); await W(800); goStep(10); await W(1500); };
  const pon = async (id, v) => { const e = q("#" + id); if (e.type === "checkbox") e.checked = v; else e.value = v; e.dispatchEvent(new Event("change")); await W(400); };`;
const recipes = {
  'b10-figura': ['Bloque 10: el cladograma para publicar, con las marcas y el apoyo de Bremer y jackknife', `  await W(900); await sesion(false);
  await pon("b10Src", "clado"); await pon("b10Sup", "combo"); await W(500);
  const c = q("#b10Fig"); irA(c, 150); await W(600);
  const f = q("#b10Tree").closest(".fig-block");
  return caja([q("#b10Fig h2"), f], 8);`],
  'b10-flores': ['Bloque 10: el cladograma con las imágenes en columna y sin marcas', `  await W(900); await sesion(true);
  await pon("b10Src", "clado"); await pon("b10Marks", "none"); await pon("b10Sup", "combo"); await pon("b10Img", "after"); await pon("b10Len", "equal"); await W(800);
  const f = q("#b10Tree").closest(".fig-block"); irA(f); await W(600);
  return caja([f, q("#b10Credits")], 6);`],
  'b10-estudio': ['Bloque 10: el estudio de figuras abierto con el cladograma para publicar', `  await W(900); await sesion(false);
  await pon("b10Src", "clado"); await pon("b10Sup", "combo"); await W(500);
  const f = q("#b10Tree").closest(".fig-block"); irA(f); await W(400);
  const b = f.querySelector(".lfs-open"); if (b) b.click(); await W(1500);
  const s = document.querySelector(".lfs-studio, .lfs-root, [class*='lfs-studio']");
  return s ? caja([s], 0) : "";`],
  'b10-editor': ['Bloque 10: el editor ✎ abierto sobre el cladograma para publicar', `  await W(900); await sesion(false);
  await pon("b10Src", "clado"); await pon("b10Sup", "combo"); await W(500);
  const f = q("#b10Tree").closest(".fig-block"); irA(f, 120); await W(400);
  const b = f.querySelector(".fig-ed"); if (b) b.click(); await W(1200);
  const p = document.querySelector(".fe-panel, .fe-head") ; const panel = p && (p.closest(".fe-panel") || p.parentElement);
  return caja([panel], 4);`],
  'b10-galeria': ['Bloque 10: todas las figuras de la sesión', `  await W(900); await sesion(false);
  const c = q("#b10Gal"); irA(c); await W(400);
  return caja([c], 6);`],
  'b10-exportar': ['Bloque 10: árboles y matriz para otros programas', `  await W(900); await sesion(false);
  const c = q("#b10Exp"); irA(c); await W(400);
  return caja([c], 6);`],
  'b10-metodos': ['Bloque 10: los métodos redactados, el principio', `  await W(900); await sesion(false);
  const c = q("#b10Rep"); irA(c, 150); await W(400);
  return caja([c], 6, 980);`],
  'b10-paquete': ['Bloque 10: el paquete reproducible armado', `  await W(900); await sesion(false);
  q("#b10ZipRun").click(); await espera(() => q("#b10ZipList tbody tr"), 60000);
  const c = q("#b10Zip"); irA(c, 150); await W(500);
  return caja([c], 6);`],
};
for (const [name, [desc, body]] of Object.entries(recipes)) {
  const needsImg = body.includes('sesion(true)');
  fs.writeFileSync(name + '.js', `/* ${desc} */\n(async () => {\n  ${PRE}\n  ${needsImg ? FLORES + '\n' : ''}${body}\n})()\n`);
}
console.log(Object.keys(recipes).join(' '));
