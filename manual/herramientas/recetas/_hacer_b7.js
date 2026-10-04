/* Writes the recipes of chapter 7. Run with node from this folder: node _hacer_b7.js */
const fs = require('fs');
const PRE = `const W = ms => new Promise(r => setTimeout(r, ms));
  const top = n => n.getBoundingClientRect().top + window.scrollY;
  const irA = (n, m = 175) => window.scrollTo({ top: top(n) - m, behavior: "instant" });
  const caja = (nodos, p = 8, maxH) => { const rs = nodos.filter(Boolean).map(n => n.getBoundingClientRect()); const x = Math.max(0, Math.min(...rs.map(r => r.left)) - p), y = Math.max(0, Math.min(...rs.map(r => r.top)) - p); let h = Math.max(...rs.map(r => r.bottom)) + p - y; if (maxH) h = Math.min(h, maxH); window.__recorte = [x, y, Math.max(...rs.map(r => r.right)) + p - x, h].map(Math.round).join(","); return window.__recorte; };
  const q = s => document.querySelector(s);
  { const st = document.createElement("style"); st.textContent = ".lnav-fbtn{visibility:hidden!important}"; document.head.appendChild(st); }
  const apoyo = async (calcula) => { goStep(2); Block2.loadExample("dahlia"); await W(1100); goStep(3); await W(500); state.search = null; q("#b3Run").click(); let t0 = Date.now(); while (!state.search && Date.now() - t0 < 300000) await W(300); await W(700); goStep(7); await W(1000);
    if (!calcula) return;
    q("#b7BRun").click(); t0 = Date.now(); while (!(state.support && state.support.bremer) && Date.now() - t0 < 300000) await W(300); await W(600);
    q("#b7RRun").click(); t0 = Date.now(); while (!(state.support && state.support.res && state.support.res.jack) && Date.now() - t0 < 300000) await W(300); await W(800); };`;
const recipes = {
  'b7-ref': ['Bloque 7: sobre qué árbol se mide el apoyo', `  await W(900); await apoyo(false);
  const c = q("#b7Ref"); irA(c); await W(400);
  return caja([c], 6);`],
  'b7-bremer': ['Bloque 7: la tarjeta del apoyo de Bremer', `  await W(900); await apoyo(false);
  const c = q("#b7Bremer"); irA(c); await W(400);
  return caja([c], 6);`],
  'b7-remuestreo': ['Bloque 7: la tarjeta del remuestreo, con el jackknife elegido', `  await W(900); await apoyo(false);
  const c = q("#b7Resample"); irA(c); await W(400);
  return caja([c], 6);`],
  'b7-arbol': ['Bloque 7: el apoyo de cada grupo de Dahlia, Bremer y jackknife, en el árbol', `  await W(900); await apoyo(true);
  q("#b7Show").value = "combo"; q("#b7Show").dispatchEvent(new Event("change")); await W(600);
  const c = q("#b7Results"); irA(c, 150); await W(500);
  const f = q("#b7Tree").closest(".fig-block");
  return caja([q("#b7Results h2"), q("#b7Tiles"), f], 8);`],
  'b7-tabla': ['Bloque 7: la tabla del apoyo de cada grupo de Dahlia', `  await W(900); await apoyo(true);
  const t = q("#b7Table"); irA(t); await W(500);
  return caja([t], 6);`],
};
for (const [name, [desc, body]] of Object.entries(recipes)) {
  fs.writeFileSync(name + '.js', `/* ${desc} */\n(async () => {\n  ${PRE}\n${body}\n})()\n`);
}
console.log(Object.keys(recipes).join(' '));
