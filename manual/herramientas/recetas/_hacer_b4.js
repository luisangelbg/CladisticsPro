/* Writes the recipes of chapter 4. Run with node from this folder: node _hacer_b4.js */
const fs = require('fs');
const PRE = `const W = ms => new Promise(r => setTimeout(r, ms));
  const top = n => n.getBoundingClientRect().top + window.scrollY;
  const irA = (n, m = 175) => window.scrollTo({ top: top(n) - m, behavior: "instant" });
  const caja = (nodos, p = 8, maxH) => { const rs = nodos.filter(Boolean).map(n => n.getBoundingClientRect()); const x = Math.max(0, Math.min(...rs.map(r => r.left)) - p), y = Math.max(0, Math.min(...rs.map(r => r.top)) - p); let h = Math.max(...rs.map(r => r.bottom)) + p - y; if (maxH) h = Math.min(h, maxH); window.__recorte = [x, y, Math.max(...rs.map(r => r.right)) + p - x, h].map(Math.round).join(","); return window.__recorte; };
  const q = s => document.querySelector(s);
  { const st = document.createElement("style"); st.textContent = ".lnav-fbtn{visibility:hidden!important}"; document.head.appendChild(st); }
  const dahlia = async () => { goStep(2); Block2.loadExample("dahlia"); await W(1100); };
  const busca = async () => { goStep(3); await W(500); state.search = null; q("#b3Run").click(); const t0 = Date.now(); while (!state.search && Date.now() - t0 < 300000) await W(300); await W(700); };
  const esquema = async (s) => { goStep(4); await W(500); q('#b4Schemes [data-s="' + s + '"]').click(); await W(300); };
  const pesa = async (s) => { await esquema(s); state.weights = null; q("#b4Run").click(); const t0 = Date.now(); while (!(state.weights && state.weights.scheme === s) && Date.now() - t0 < 600000) await W(300); await W(900); };`;
const recipes = {
  'b4-esquema': ['Bloque 4: el esquema de pesos implícitos con k = 3 y su curva', `  await W(900); await dahlia(); await esquema("iw");
  const c = q("#b4Scheme"); irA(c); await W(400);
  return caja([c], 6);`],
  'b4-iw': ['Bloque 4: los resultados con pesos implícitos (k = 3) en Dahlia, después de la búsqueda con pesos iguales', `  await W(900); await dahlia(); await busca(); await pesa("iw");
  const c = q("#b4Results"); irA(c); await W(500);
  const g = c.querySelector("#b4ResSingle .fig-grid");
  const r = c.getBoundingClientRect(), gb = g.getBoundingClientRect();
  window.__recorte = [r.left - 6, r.top - 6, r.width + 12, gb.bottom - r.top + 16].map(Math.round).join(",");
  return window.__recorte;`],
  'b4-tabla': ['Bloque 4: la tabla de pesos por carácter con pesos implícitos (k = 3), el principio', `  await W(900); await dahlia(); await busca(); await pesa("iw");
  const b = q("#b4Table").closest(".fig-block"); irA(b); await W(500);
  return caja([b], 6, 620);`],
  'b4-eiw': ['Bloque 4: los parámetros de los pesos implícitos extendidos', `  await W(900); await dahlia(); await esquema("eiw");
  const c = q("#b4Scheme"); irA(c); await W(400);
  return caja([q("#b4Schemes"), q("#b4KRow"), q("#b4EiwRowM")], 8);`],
  'b4-sw': ['Bloque 4: los resultados de los pesos sucesivos en Dahlia', `  await W(900); await dahlia(); await busca(); await pesa("sw");
  const c = q("#b4Results"); irA(c); await W(500);
  return caja([q("#b4Results h2"), q("#b4Tiles"), q("#b4LogBox")], 8);`],
  'b4-sens': ['Bloque 4: la sensibilidad a k en Dahlia con los valores por omisión', `  await W(900); await dahlia(); await pesa("sens");
  const c = q("#b4Results"); irA(c); await W(500);
  return caja([q("#b4Results h2"), q("#b4SensNote"), q("#b4SensTable"), q("#b4Heat").closest(".fig-block")], 8, 622);`],
  'b4-swpar': ['Bloque 4: los parámetros de los pesos sucesivos y de la sensibilidad a k', `  await W(900); await dahlia(); await esquema("sw");
  const g = q("#b4Scheme .form-grid"); irA(q("#b4Scheme")); await W(400);
  return caja([q("#b4Schemes"), g], 8);`],
  'b4-curvas': ['Bloque 4: las curvas de pesos de los k que se van a probar en la sensibilidad', `  await W(900); await dahlia(); await esquema("sens");
  const b = q("#b4Curve").closest(".fig-block"); irA(q("#b4Scheme")); await W(400);
  return caja([b], 6);`],
};
for (const [name, [desc, body]] of Object.entries(recipes)) {
  fs.writeFileSync(name + '.js', `/* ${desc} */\n(async () => {\n  ${PRE}\n${body}\n})()\n`);
}
console.log(Object.keys(recipes).join(' '));
