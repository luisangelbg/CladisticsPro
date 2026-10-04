/* Writes the recipes of chapter 3. Run with node from this folder: node _hacer_b3.js */
const fs = require('fs');
const PRE = `const W = ms => new Promise(r => setTimeout(r, ms));
  const top = n => n.getBoundingClientRect().top + window.scrollY;
  const irA = (n, m = 175) => window.scrollTo({ top: top(n) - m, behavior: "instant" });
  const caja = (nodos, p = 8, maxH) => { const rs = nodos.filter(Boolean).map(n => n.getBoundingClientRect()); const x = Math.max(0, Math.min(...rs.map(r => r.left)) - p), y = Math.max(0, Math.min(...rs.map(r => r.top)) - p); let h = Math.max(...rs.map(r => r.bottom)) + p - y; if (maxH) h = Math.min(h, maxH); window.__recorte = [x, y, Math.max(...rs.map(r => r.right)) + p - x, h].map(Math.round).join(","); return window.__recorte; };
  const q = s => document.querySelector(s);
  { const st = document.createElement("style"); st.textContent = ".lnav-fbtn{visibility:hidden!important}"; document.head.appendChild(st); }
  const ejemplo = async (id) => { goStep(2); Block2.loadExample(id); await W(1100); goStep(3); await W(700); };
  const busca = async () => { state.search = null; q("#b3Run").click(); const t0 = Date.now(); while (!state.search && Date.now() - t0 < 700000) await W(300); await W(900); };`;
const recipes = {
  'b3-datos': ['Bloque 3: qué se va a analizar, con Dahlia', `  await W(900); await ejemplo("dahlia");
  const c = q("#b3Data"); irA(c); await W(400);
  return caja([c], 6);`],
  'b3-metodo': ['Bloque 3: método y parámetros, con Dahlia (automático elige ratchet)', `  await W(900); await ejemplo("dahlia");
  const c = q("#b3Method"); irA(c); await W(400);
  return caja([c], 6);`],
  'b3-restricciones': ['Bloque 3: restricciones, con un grupo añadido y el formulario abierto', `  await W(900); await ejemplo("dahlia");
  Block3.constraints.push({ name: "Dalias arborescentes", taxa: [3, 4, 5, 6].map(i => i), positive: true, on: true });
  Block3.onMatrix(); await W(300);
  const c = q("#b3Cons"); c.querySelector("details").open = true;
  q("#b3ConsName").value = "merckii y moorei"; q("#b3ConsType").value = "pos";
  [...c.querySelectorAll("#b3ConsTaxa input")].slice(12, 14).forEach(x => { x.checked = true; });
  irA(c); await W(400);
  return caja([c], 6, 700);`],
  'b3-resultados': ['Bloque 3: los resultados de la búsqueda de Dahlia con los valores por omisión', `  await W(900); await ejemplo("dahlia"); await busca();
  const c = q("#b3Results"); irA(c); await W(500);
  const g = c.querySelector(".fig-grid");
  const r = c.getBoundingClientRect(), gb = g.getBoundingClientRect();
  window.__recorte = [r.left - 6, r.top - 6, r.width + 12, gb.bottom - r.top + 16].map(Math.round).join(",");
  return window.__recorte;`],
  'b3-arbol': ['Bloque 3: el consenso estricto de los árboles más cortos de Dahlia', `  await W(900); await ejemplo("dahlia"); await busca();
  const b = q("#b3Tree").closest(".fig-block"); irA(b); await W(500);
  return caja([b, b.nextElementSibling], 6);`],
  'b3-exacta': ['Bloque 3: los recuadros de la búsqueda exacta de Bursera', `  await W(900); await ejemplo("bursera"); await busca();
  const c = q("#b3Tiles"); irA(c); await W(400);
  return caja([c], 6);`],
  'b3-espera': ['Bloque 3: la ventana de espera durante la búsqueda de la matriz grande', `  await W(900); await ejemplo("grande");
  q("#b3Run").click(); await W(9500);
  const d = q(".lw-card");
  return d ? caja([d], 14) : "";`],
};
for (const [name, [desc, body]] of Object.entries(recipes)) {
  fs.writeFileSync(name + '.js', `/* ${desc} */\n(async () => {\n  ${PRE}\n${body}\n})()\n`);
}
console.log(Object.keys(recipes).join(' '));
