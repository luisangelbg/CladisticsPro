/* Writes the recipes of chapter 6. Run with node from this folder: node _hacer_b6.js */
const fs = require('fs');
const PRE = `const W = ms => new Promise(r => setTimeout(r, ms));
  const top = n => n.getBoundingClientRect().top + window.scrollY;
  const irA = (n, m = 175) => window.scrollTo({ top: top(n) - m, behavior: "instant" });
  const caja = (nodos, p = 8, maxH) => { const rs = nodos.filter(Boolean).map(n => n.getBoundingClientRect()); const x = Math.max(0, Math.min(...rs.map(r => r.left)) - p), y = Math.max(0, Math.min(...rs.map(r => r.top)) - p); let h = Math.max(...rs.map(r => r.bottom)) + p - y; if (maxH) h = Math.min(h, maxH); window.__recorte = [x, y, Math.max(...rs.map(r => r.right)) + p - x, h].map(Math.round).join(","); return window.__recorte; };
  const q = s => document.querySelector(s);
  { const st = document.createElement("style"); st.textContent = ".lnav-fbtn{visibility:hidden!important}"; document.head.appendChild(st); }
  const diag = async () => { goStep(2); Block2.loadExample("dahlia"); await W(1100); goStep(3); await W(500); state.search = null; q("#b3Run").click(); let t0 = Date.now(); while (!state.search && Date.now() - t0 < 300000) await W(300); await W(700); goStep(5); await W(1000); goStep(6); t0 = Date.now(); while (!state.diag && Date.now() - t0 < 60000) await W(300); await W(1500); };`;
const recipes = {
  'b6-resumen': ['Bloque 6: el resumen del diagnóstico de Dahlia', `  await W(900); await diag();
  const c = q("#b6Summary"); irA(c); await W(400);
  return caja([c], 6);`],
  'b6-caracteres': ['Bloque 6: la tabla de cada carácter, el principio', `  await W(900); await diag();
  const c = q("#b6Chars"); irA(c); await W(400);
  return caja([c], 6, 760);`],
  'b6-clados': ['Bloque 6: la diagnosis de cada clado con el cladograma numerado', `  await W(900); await diag();
  const c = q("#b6Clades"); irA(c, 150); await W(500);
  return caja([c], 6, 1060);`],
  'b6-matriz': ['Bloque 6: la matriz ordenada por el árbol, con el clado de las dalias arborescentes resaltado', `  await W(900); await diag();
  const o = [...q("#b6Focus").options].find(o => o.text.startsWith("Clado 11 ")); q("#b6Focus").value = o.value; q("#b6Focus").dispatchEvent(new Event("change")); await W(600);
  const c = q("#b6Ordered"); irA(c, 150); await W(500);
  return caja([c], 6, 1000);`],
  'b6-inestables': ['Bloque 6: lo que cambia entre los seis árboles más cortos', `  await W(900); await diag();
  const c = q("#b6Unstable"); irA(c); await W(400);
  return caja([c], 6);`],
};
for (const [name, [desc, body]] of Object.entries(recipes)) {
  fs.writeFileSync(name + '.js', `/* ${desc} */\n(async () => {\n  ${PRE}\n${body}\n})()\n`);
}
console.log(Object.keys(recipes).join(' '));
