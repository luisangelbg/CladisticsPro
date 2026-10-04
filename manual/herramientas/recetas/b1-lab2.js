/* Bloque 1: laboratorio 2, ACCTRAN contra DELTRAN */
(async () => {
  const W = ms => new Promise(r => setTimeout(r, ms));
  const top = n => n.getBoundingClientRect().top + window.scrollY;
  const irA = (n, m = 175) => window.scrollTo({ top: top(n) - m, behavior: "instant" });
  const caja = (nodos, p = 8) => { const rs = nodos.filter(Boolean).map(n => n.getBoundingClientRect()); const x = Math.max(0, Math.min(...rs.map(r => r.left)) - p), y = Math.max(0, Math.min(...rs.map(r => r.top)) - p); window.__recorte = [x, y, Math.max(...rs.map(r => r.right)) + p - x, Math.max(...rs.map(r => r.bottom)) + p - y].map(Math.round).join(","); return window.__recorte; };
  const titulo = (panel, texto) => [...document.querySelectorAll("#panel-" + panel + " h2, #panel-" + panel + " .section-title")].find(h => h.textContent.trim().startsWith(texto));
  await W(900);
  document.getElementById("tabLab2").click(); await W(600);
  const l = document.getElementById("lab2"); irA(document.getElementById("tabLab2")); await W(500);
  return caja([document.getElementById("tabLab2"), l], 8);
})()
