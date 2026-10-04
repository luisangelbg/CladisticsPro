/* Bloque 9: los caracteres que cambian y todas las hipótesis probadas */
(async () => {
  const W = ms => new Promise(r => setTimeout(r, ms));
  const top = n => n.getBoundingClientRect().top + window.scrollY;
  const irA = (n, m = 175) => window.scrollTo({ top: top(n) - m, behavior: "instant" });
  const caja = (nodos, p = 8, maxH) => { const rs = nodos.filter(Boolean).map(n => n.getBoundingClientRect()); const x = Math.max(0, Math.min(...rs.map(r => r.left)) - p), y = Math.max(0, Math.min(...rs.map(r => r.top)) - p); let h = Math.max(...rs.map(r => r.bottom)) + p - y; if (maxH) h = Math.min(h, maxH); window.__recorte = [x, y, Math.max(...rs.map(r => r.right)) + p - x, h].map(Math.round).join(","); return window.__recorte; };
  const q = s => document.querySelector(s);
  { const st = document.createElement("style"); st.textContent = ".lnav-fbtn{visibility:hidden!important}"; document.head.appendChild(st); }
  const ARB = ["Dahlia campanulata", "Dahlia excelsa", "Dahlia tenuicaulis", "Dahlia imperialis"];
  const prepara = async () => { goStep(2); Block2.loadExample("dahlia"); await W(1100); goStep(3); await W(500); state.search = null; q("#b3Run").click(); const t0 = Date.now(); while (!state.search && Date.now() - t0 < 300000) await W(300); await W(700); goStep(9); await W(1000); };
  const grupo = async (nm, type, taxa) => { const names = state.matrix.taxa.map(t => t.name); q("#b9GName").value = nm; q("#b9GType").value = type; q("#b9GTaxa").querySelectorAll("input").forEach(x => { x.checked = taxa.includes(names[+x.value]); }); };
  const prueba = async () => { const n0 = (state.hypotheses && state.hypotheses.list.length) || 0; q("#b9Run").click(); const t = Date.now(); while (!(state.hypotheses && state.hypotheses.list.length > n0) && Date.now() - t < 200000) await W(300); await W(900); };
  const tres = async () => {
    await grupo("D. linearis con las arborescentes", "pos", ["Dahlia linearis", ...ARB]); q("#b9GAdd").click(); await W(300); await prueba();
    q("#b9Groups").querySelectorAll("[data-del]").forEach(b => b.click()); await W(300);
    await grupo("Sin el grupo de las arborescentes", "neg", ARB); q("#b9GAdd").click(); await W(300); await prueba();
    q('#b9Modes [data-mode="tree"]').click(); await W(400);
    const o = [...q("#b9TreeSrc").options].find(o => /archivo/i.test(o.text)); q("#b9TreeSrc").value = o.value; q("#b9TreeSrc").dispatchEvent(new Event("change")); await W(300); await prueba();
    q("#b9Which").value = q("#b9Which").options[0].value; q("#b9Which").dispatchEvent(new Event("change")); await W(600); };
  await W(900); await prepara(); await tres();
  const a = q("#b9Chars"); irA(a.previousElementSibling); await W(500);
  return caja([a.previousElementSibling, a, q("#b9All"), q("#b9ExpCsv").closest(".btn-row")], 8);
})()
