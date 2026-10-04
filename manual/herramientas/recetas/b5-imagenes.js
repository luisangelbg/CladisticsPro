/* Bloque 5: el cladograma de Dahlia con las imágenes de los taxones, sin marcas */
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
  const FLORES = { "Bidens pilosa": ["#fbfaf5", 5, "#e8b923", 0.42], "Cosmos bipinnatus": ["#e0609a", 8, "#e8b923", 0.6], "Dahlia coccinea": ["#d9473a", 8, "#e8b923", 0.55], "Dahlia imperialis": ["#a58fd6", 8, "#e8b923", 0.5],
    "Dahlia pinnata": ["#c45ca8", 12, "#f0c040", 0.5], "Dahlia merckii": ["#c9b3e6", 8, "#e8b923", 0.45], "Dahlia excelsa": ["#e78fb5", 8, "#e8b923", 0.55], "Dahlia sherffii": ["#f1a7c6", 8, "#e8b923", 0.5],
    "Dahlia rudis": ["#d685b8", 8, "#e8b923", 0.5], "Dahlia scapigera": ["#f3eef8", 8, "#e8b923", 0.45], "Dahlia atropurpurea": ["#7a2350", 8, "#e8b923", 0.5], "Dahlia australis": ["#e98fb0", 8, "#e8b923", 0.5] };
  const flor = async (nombre, [col, n, centro, ancho], k) => {
    const cv = document.createElement("canvas"); cv.width = 480; cv.height = 360; const c = cv.getContext("2d");
    const g = c.createLinearGradient(0, 0, 0, 360); g.addColorStop(0, "#eef4e6"); g.addColorStop(1, "#cfe0bf"); c.fillStyle = g; c.fillRect(0, 0, 480, 360);
    c.strokeStyle = "#4f7f3a"; c.lineWidth = 9; c.beginPath(); c.moveTo(240, 360); c.quadraticCurveTo(225 + k * 3, 260, 240, 180); c.stroke();
    c.fillStyle = "#5c8f44"; c.beginPath(); c.ellipse(195, 285, 46, 16, -0.5, 0, 7); c.fill(); c.beginPath(); c.ellipse(286, 250, 46, 16, 0.5, 0, 7); c.fill();
    const R = 92;
    for (let i = 0; i < n; i++) { c.save(); c.translate(240, 170); c.rotate(i * 2 * Math.PI / n + k * 0.2); c.fillStyle = col; c.strokeStyle = "rgba(0,0,0,0.12)"; c.lineWidth = 2; c.beginPath(); c.ellipse(0, -R * 0.55, R * ancho * 0.5, R * 0.55, 0, 0, 7); c.fill(); c.stroke(); c.restore(); }
    c.fillStyle = centro; c.beginPath(); c.arc(240, 170, 26, 0, 7); c.fill();
    c.fillStyle = "rgba(120,80,20,0.35)"; for (let i = 0; i < 40; i++) { const a = i * 2.4, r = 3 + (i % 9) * 2.4; c.beginPath(); c.arc(240 + Math.cos(a) * r, 170 + Math.sin(a) * r, 1.6, 0, 7); c.fill(); }
    const blob = await new Promise(r => cv.toBlob(r, "image/jpeg", 0.9));
    return new File([blob], nombre.replace(/ /g, "_") + ".jpg", { type: "image/jpeg" });
  };
  const ponImagenes = async () => {
    const files = []; let k = 0;
    for (const n of Object.keys(FLORES)) { if (state.matrix.taxa.some(t => t.name === n)) files.push(await flor(n, FLORES[n], k++)); }
    TaxonImg.bulk(files); await W(400);
    q("#tbOk").checked = true; q("#tbCredit").value = "L. Á. Barrera-Guzmán"; q(".tb-go").click();
    const t0 = Date.now(); while (TaxonImg.count() < files.length && Date.now() - t0 < 20000) await W(200); await W(600);
  };
  await W(900); await dahlia(); await ponImagenes(); await busca(); goStep(5); await W(1200);
  q("#b5Img").checked = true; q("#b5Img").dispatchEvent(new Event("change"));
  q("#b5Show").value = "none"; q("#b5Show").dispatchEvent(new Event("change")); await W(900);
  const f = q("#b5Tree").closest(".fig-block"); irA(f); await W(600);
  return caja([f], 6);
})()
