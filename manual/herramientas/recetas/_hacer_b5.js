/* Writes the recipes of chapter 5. Run with node from this folder: node _hacer_b5.js */
const fs = require('fs');
/* the stylized flowers of chapter 2, taken from its generator */
const src2 = fs.readFileSync('_hacer_b2.js', 'utf8');
const FLORES = src2.slice(src2.indexOf('const FLORES = `') + 'const FLORES = `'.length, src2.indexOf('`;\nconst recipes'));
const PRE = `const W = ms => new Promise(r => setTimeout(r, ms));
  const top = n => n.getBoundingClientRect().top + window.scrollY;
  const irA = (n, m = 175) => window.scrollTo({ top: top(n) - m, behavior: "instant" });
  const caja = (nodos, p = 8, maxH) => { const rs = nodos.filter(Boolean).map(n => n.getBoundingClientRect()); const x = Math.max(0, Math.min(...rs.map(r => r.left)) - p), y = Math.max(0, Math.min(...rs.map(r => r.top)) - p); let h = Math.max(...rs.map(r => r.bottom)) + p - y; if (maxH) h = Math.min(h, maxH); window.__recorte = [x, y, Math.max(...rs.map(r => r.right)) + p - x, h].map(Math.round).join(","); return window.__recorte; };
  const q = s => document.querySelector(s);
  { const st = document.createElement("style"); st.textContent = ".lnav-fbtn{visibility:hidden!important}"; document.head.appendChild(st); }
  const dahlia = async () => { goStep(2); Block2.loadExample("dahlia"); await W(1100); };
  const busca = async () => { goStep(3); await W(500); state.search = null; q("#b3Run").click(); const t0 = Date.now(); while (!state.search && Date.now() - t0 < 300000) await W(300); await W(700); };
  const clado = async () => { await dahlia(); await busca(); goStep(5); await W(1200); };
  const elige = async (txt) => { const o = [...q("#b5NodeSel").options].find(o => o.text.includes(txt)); if (o) { q("#b5NodeSel").value = o.value; q("#b5NodeSel").dispatchEvent(new Event("change")); } await W(500); };
  const pinta = async (c) => { q('#b5Mode [data-mode="paint"]').click(); await W(400); q("#b5Char").value = String(c); q("#b5Char").dispatchEvent(new Event("change")); await W(600); };`;
const recipes = {
  'b5-fuente': ['Bloque 5: qué árbol, con los árboles de la búsqueda de Dahlia', `  await W(900); await clado();
  const c = q("#b5Source"); irA(c); await W(400);
  return caja([c], 6);`],
  'b5-marcas': ['Bloque 5: el cladograma de Dahlia con las marcas de cambio (ACCTRAN) y el grupo de las dalias arborescentes elegido', `  await W(900); await clado(); await elige("clado de 4 taxones (Dahlia campanulata");
  const c = q("#b5Clado"); irA(c, 150); await W(600);
  return caja([c], 6);`],
  'b5-lado': ['Bloque 5: el panel lateral con el grupo de las dalias arborescentes elegido', `  await W(900); await clado(); await elige("clado de 4 taxones (Dahlia campanulata");
  const s = q("#b5Side"); irA(s); await W(500);
  return caja([s], 6);`],
  'b5-pinta25': ['Bloque 5: pintar el carácter 25, color de la lígula (matriz de pasos)', `  await W(900); await clado(); await pinta(24);
  const f = q("#b5Tree").closest(".fig-block"); irA(f); await W(500);
  return caja([f], 6);`],
  'b5-pinta6': ['Bloque 5: pintar el carácter 6, tipo de tricoma (con inaplicables)', `  await W(900); await clado(); await pinta(5);
  const f = q("#b5Tree").closest(".fig-block"); irA(f); await W(500);
  return caja([f], 6);`],
  'b5-pinta43': ['Bloque 5: pintar el carácter 43, altura de la planta (continuo)', `  await W(900); await clado(); await pinta(42);
  const f = q("#b5Tree").closest(".fig-block"); irA(f); await W(500);
  return caja([f], 6);`],
  'b5-mover': ['Bloque 5: mover el clado de D. linearis, eligiendo la rama de destino', `  await W(900); await clado(); await elige("Dahlia linearis");
  q('#b5Side [data-ed="move"]').click(); await W(500);
  const s = q("#b5Side"); irA(s); await W(400);
  return caja([s], 6);`],
  'b5-editado': ['Bloque 5: los recuadros después de mover D. linearis junto a las dalias arborescentes', `  await W(900); await clado(); await elige("Dahlia linearis");
  q('#b5Side [data-ed="move"]').click(); await W(400);
  const tg = [...q("#b5Target").options].find(o => o.text.includes("clado de 4 taxones (Dahlia campanulata")); q("#b5Target").value = tg.value; q("#b5MoveGo").click(); await W(800);
  const t = q("#b5Tiles"); irA(t); await W(400);
  return caja([t], 6);`],
  'b5-imagenes': ['Bloque 5: el cladograma de Dahlia con las imágenes de los taxones, sin marcas', `  await W(900); await dahlia(); await ponImagenes(); await busca(); goStep(5); await W(1200);
  q("#b5Img").checked = true; q("#b5Img").dispatchEvent(new Event("change"));
  q("#b5Show").value = "none"; q("#b5Show").dispatchEvent(new Event("change")); await W(900);
  const f = q("#b5Tree").closest(".fig-block"); irA(f); await W(600);
  return caja([f], 6);`],
};
for (const [name, [desc, body]] of Object.entries(recipes)) {
  const needsImg = body.includes('ponImagenes');
  fs.writeFileSync(name + '.js', `/* ${desc} */\n(async () => {\n  ${PRE}\n  ${needsImg ? FLORES + '\n' : ''}${body}\n})()\n`);
}
console.log(Object.keys(recipes).join(' '));
