/* Bloque 10: los métodos redactados, el principio */
(async () => {
  const W = ms => new Promise(r => setTimeout(r, ms));
  const top = n => n.getBoundingClientRect().top + window.scrollY;
  const irA = (n, m = 175) => window.scrollTo({ top: top(n) - m, behavior: "instant" });
  const caja = (nodos, p = 8, maxH) => { const rs = nodos.filter(Boolean).map(n => n.getBoundingClientRect()); const x = Math.max(0, Math.min(...rs.map(r => r.left)) - p), y = Math.max(0, Math.min(...rs.map(r => r.top)) - p); let h = Math.max(...rs.map(r => r.bottom)) + p - y; if (maxH) h = Math.min(h, maxH); window.__recorte = [x, y, Math.max(...rs.map(r => r.right)) + p - x, h].map(Math.round).join(","); return window.__recorte; };
  const q = s => document.querySelector(s);
  { const st = document.createElement("style"); st.textContent = ".lnav-fbtn{visibility:hidden!important}"; document.head.appendChild(st); }
  const espera = async (cond, ms = 300000) => { const t0 = Date.now(); while (!cond() && Date.now() - t0 < ms) await W(300); await W(600); };
  const sesion = async (imagenes) => { goStep(2); Block2.loadExample("dahlia"); await W(1100);
    if (imagenes) await ponImagenes();
    goStep(3); await W(500); state.search = null; q("#b3Run").click(); await espera(() => state.search);
    goStep(5); await W(1000); goStep(7); await W(800);
    q("#b7BRun").click(); await espera(() => state.support && state.support.bremer);
    q("#b7RRun").click(); await espera(() => state.support && state.support.res && state.support.res.jack);
    goStep(8); await W(800); goStep(10); await W(1500); };
  const pon = async (id, v) => { const e = q("#" + id); if (e.type === "checkbox") e.checked = v; else e.value = v; e.dispatchEvent(new Event("change")); await W(400); };
    await W(900); await sesion(false);
  const c = q("#b10Rep"); irA(c, 150); await W(400);
  return caja([c], 6, 980);
})()
