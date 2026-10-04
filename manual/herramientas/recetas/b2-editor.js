/* Bloque 2: el editor con un carácter dependiente seleccionado */
(async () => {
  const W = ms => new Promise(r => setTimeout(r, ms));
  const top = n => n.getBoundingClientRect().top + window.scrollY;
  const irA = (n, m = 175) => window.scrollTo({ top: top(n) - m, behavior: "instant" });
  const caja = (nodos, p = 8, maxH) => { const rs = nodos.filter(Boolean).map(n => n.getBoundingClientRect()); const x = Math.max(0, Math.min(...rs.map(r => r.left)) - p), y = Math.max(0, Math.min(...rs.map(r => r.top)) - p); let h = Math.max(...rs.map(r => r.bottom)) + p - y; if (maxH) h = Math.min(h, maxH); window.__recorte = [x, y, Math.max(...rs.map(r => r.right)) + p - x, h].map(Math.round).join(","); return window.__recorte; };
  const q = s => document.querySelector(s);
  { const st = document.createElement("style"); st.textContent = ".lnav-fbtn{visibility:hidden!important}"; document.head.appendChild(st); }
  const dahlia = async () => { goStep(2); Block2.loadExample("dahlia"); await W(1100); };
    await W(900); await dahlia();
  Block2.grid.select(3, 5); await W(500);
  const c = q("#b2EditorCard"); irA(c); await W(500);
  return caja([c], 6);
})()
