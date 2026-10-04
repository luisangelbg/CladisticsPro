/* Writes the recipes of chapter 8. Run with node from this folder: node _hacer_b8.js */
const fs = require('fs');
const PRE = `const W = ms => new Promise(r => setTimeout(r, ms));
  const top = n => n.getBoundingClientRect().top + window.scrollY;
  const irA = (n, m = 175) => window.scrollTo({ top: top(n) - m, behavior: "instant" });
  const caja = (nodos, p = 8, maxH) => { const rs = nodos.filter(Boolean).map(n => n.getBoundingClientRect()); const x = Math.max(0, Math.min(...rs.map(r => r.left)) - p), y = Math.max(0, Math.min(...rs.map(r => r.top)) - p); let h = Math.max(...rs.map(r => r.bottom)) + p - y; if (maxH) h = Math.min(h, maxH); window.__recorte = [x, y, Math.max(...rs.map(r => r.right)) + p - x, h].map(Math.round).join(","); return window.__recorte; };
  const q = s => document.querySelector(s);
  { const st = document.createElement("style"); st.textContent = ".lnav-fbtn{visibility:hidden!important}"; document.head.appendChild(st); }
  /* comodin: D. moorei with only its first two characters known (an exercise of the manual) */
  const consensos = async (comodin) => { goStep(2); Block2.loadExample("dahlia"); await W(1100);
    if (comodin) { const m = state.matrix, i = m.taxa.findIndex(t => t.name === "Dahlia moorei"); const list = []; m.chars.forEach((c, j) => { if (j > 1) list.push([i, j, Mx.MISSING]); }); Block2.do({ kind: "cells", list }, "comodín"); await W(800); }
    goStep(3); await W(500); state.search = null; q("#b3Run").click(); const t0 = Date.now(); while (!state.search && Date.now() - t0 < 300000) await W(300); await W(700); goStep(8); await W(1200); };`;
const recipes = {
  'b8-arboles': ['Bloque 8: qué árboles, con los árboles colapsados de Dahlia', `  await W(900); await consensos(false);
  const c = q("#b8Trees"); irA(c); await W(400);
  return caja([c], 6);`],
  'b8-consensos': ['Bloque 8: los consensos de Dahlia, con el estricto elegido', `  await W(900); await consensos(false);
  const c = q("#b8Cons"); irA(c, 150); await W(500);
  return caja([c], 6);`],
  'b8-roto': ['Bloque 8: el consenso estricto de Dahlia con D. moorei casi sin datos', `  await W(900); await consensos(true);
  const c = q("#b8Cons"); irA(c, 150); await W(500);
  return caja([q("#b8Tiles"), q("#b8Tree").closest(".fig-grid")], 8);`],
  'b8-comodin': ['Bloque 8: la búsqueda de comodines con D. moorei casi sin datos', `  await W(900); await consensos(true);
  q("#b8WildRun").click(); const t0 = Date.now(); while (!(state.consensus && state.consensus.wild) && Date.now() - t0 < 120000) await W(300); await W(900);
  const c = q("#b8Wild"); irA(c, 150); await W(500);
  return caja([c], 6);`],
};
for (const [name, [desc, body]] of Object.entries(recipes)) {
  fs.writeFileSync(name + '.js', `/* ${desc} */\n(async () => {\n  ${PRE}\n${body}\n})()\n`);
}
console.log(Object.keys(recipes).join(' '));
