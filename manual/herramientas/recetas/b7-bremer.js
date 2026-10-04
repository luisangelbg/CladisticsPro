/* Bloque 7: la tarjeta del apoyo de Bremer */
(async () => {
  const W = ms => new Promise(r => setTimeout(r, ms));
  const top = n => n.getBoundingClientRect().top + window.scrollY;
  const irA = (n, m = 175) => window.scrollTo({ top: top(n) - m, behavior: "instant" });
  const caja = (nodos, p = 8, maxH) => { const rs = nodos.filter(Boolean).map(n => n.getBoundingClientRect()); const x = Math.max(0, Math.min(...rs.map(r => r.left)) - p), y = Math.max(0, Math.min(...rs.map(r => r.top)) - p); let h = Math.max(...rs.map(r => r.bottom)) + p - y; if (maxH) h = Math.min(h, maxH); window.__recorte = [x, y, Math.max(...rs.map(r => r.right)) + p - x, h].map(Math.round).join(","); return window.__recorte; };
  const q = s => document.querySelector(s);
  { const st = document.createElement("style"); st.textContent = ".lnav-fbtn{visibility:hidden!important}"; document.head.appendChild(st); }
  const apoyo = async (calcula) => { goStep(2); Block2.loadExample("dahlia"); await W(1100); goStep(3); await W(500); state.search = null; q("#b3Run").click(); let t0 = Date.now(); while (!state.search && Date.now() - t0 < 300000) await W(300); await W(700); goStep(7); await W(1000);
    if (!calcula) return;
    q("#b7BRun").click(); t0 = Date.now(); while (!(state.support && state.support.bremer) && Date.now() - t0 < 300000) await W(300); await W(600);
    q("#b7RRun").click(); t0 = Date.now(); while (!(state.support && state.support.res && state.support.res.jack) && Date.now() - t0 < 300000) await W(300); await W(800); };
  await W(900); await apoyo(false);
  const c = q("#b7Bremer"); irA(c); await W(400);
  return caja([c], 6);
})()
