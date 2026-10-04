/* Bloque 5: qué árbol, con los árboles de la búsqueda de Dahlia */
(async () => {
  const W = ms => new Promise(r => setTimeout(r, ms));
  const top = n => n.getBoundingClientRect().top + window.scrollY;
  const irA = (n, m = 175) => window.scrollTo({ top: top(n) - m, behavior: "instant" });
  const caja = (nodos, p = 8, maxH) => { const rs = nodos.filter(Boolean).map(n => n.getBoundingClientRect()); const x = Math.max(0, Math.min(...rs.map(r => r.left)) - p), y = Math.max(0, Math.min(...rs.map(r => r.top)) - p); let h = Math.max(...rs.map(r => r.bottom)) + p - y; if (maxH) h = Math.min(h, maxH); window.__recorte = [x, y, Math.max(...rs.map(r => r.right)) + p - x, h].map(Math.round).join(","); return window.__recorte; };
  const q = s => document.querySelector(s);
  { const st = document.createElement("style"); st.textContent = ".lnav-fbtn{visibility:hidden!important}"; document.head.appendChild(st); }
  const dahlia = async () => { goStep(2); Block2.loadExample("dahlia"); await W(1100); };
  const busca = async () => { goStep(3); await W(500); state.search = null; q("#b3Run").click(); const t0 = Date.now(); while (!state.search && Date.now() - t0 < 300000) await W(300); await W(700); };
  const clado = async () => { await dahlia(); await busca(); goStep(5); await W(1200); };
  const elige = async (txt) => { const o = [...q("#b5NodeSel").options].find(o => o.text.includes(txt)); if (o) { q("#b5NodeSel").value = o.value; q("#b5NodeSel").dispatchEvent(new Event("change")); } await W(500); };
  const pinta = async (c) => { q('#b5Mode [data-mode="paint"]').click(); await W(400); q("#b5Char").value = String(c); q("#b5Char").dispatchEvent(new Event("change")); await W(600); };
    await W(900); await clado();
  const c = q("#b5Source"); irA(c); await W(400);
  return caja([c], 6);
})()
