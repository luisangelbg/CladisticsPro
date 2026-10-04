/* Bloque 4: la sensibilidad a k en Dahlia con los valores por omisión */
(async () => {
  const W = ms => new Promise(r => setTimeout(r, ms));
  const top = n => n.getBoundingClientRect().top + window.scrollY;
  const irA = (n, m = 175) => window.scrollTo({ top: top(n) - m, behavior: "instant" });
  const caja = (nodos, p = 8, maxH) => { const rs = nodos.filter(Boolean).map(n => n.getBoundingClientRect()); const x = Math.max(0, Math.min(...rs.map(r => r.left)) - p), y = Math.max(0, Math.min(...rs.map(r => r.top)) - p); let h = Math.max(...rs.map(r => r.bottom)) + p - y; if (maxH) h = Math.min(h, maxH); window.__recorte = [x, y, Math.max(...rs.map(r => r.right)) + p - x, h].map(Math.round).join(","); return window.__recorte; };
  const q = s => document.querySelector(s);
  { const st = document.createElement("style"); st.textContent = ".lnav-fbtn{visibility:hidden!important}"; document.head.appendChild(st); }
  const dahlia = async () => { goStep(2); Block2.loadExample("dahlia"); await W(1100); };
  const busca = async () => { goStep(3); await W(500); state.search = null; q("#b3Run").click(); const t0 = Date.now(); while (!state.search && Date.now() - t0 < 300000) await W(300); await W(700); };
  const esquema = async (s) => { goStep(4); await W(500); q('#b4Schemes [data-s="' + s + '"]').click(); await W(300); };
  const pesa = async (s) => { await esquema(s); state.weights = null; q("#b4Run").click(); const t0 = Date.now(); while (!(state.weights && state.weights.scheme === s) && Date.now() - t0 < 600000) await W(300); await W(900); };
  await W(900); await dahlia(); await pesa("sens");
  const c = q("#b4Results"); irA(c); await W(500);
  return caja([q("#b4Results h2"), q("#b4SensNote"), q("#b4SensTable"), q("#b4Heat").closest(".fig-block")], 8, 622);
})()
