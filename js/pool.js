/* CladisticsPro — morphological cladistics in the browser.
   Copyright (C) 2026  Luis Ángel Barrera-Guzmán

   This program is free software: you can redistribute it and/or modify it under
   the terms of the GNU General Public License as published by the Free Software
   Foundation, either version 3 of the License, or (at your option) any later
   version. It is distributed in the hope that it will be useful, but WITHOUT ANY
   WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
   A PARTICULAR PURPOSE. See the GNU General Public License, in the file LICENSE
   at the root of this program, or <https://www.gnu.org/licenses/>. */

/* CladisticsPro — searches in background threads (Web Workers).

   A worker is built from the source text of the engine's own modules
   (TreeCore, OptimizeCore, EngineCore: named functions that install themselves
   on the object they receive), so there is no second implementation to keep
   in step and it works when the app is opened with a double click. If the
   browser refuses workers, the same code runs on the page, in the waiting
   window.

   Pool.run(task, payload, onProgress) → a promise of the result, with
   .cancel(). Tasks: 'search', 'collect', 'successive', 'resample',
   'suboptimal'. */
(function () {
  const CORES = ['TreeCore', 'OptimizeCore', 'EngineCore'];
  let url = null;
  function source() {
    return CORES.map(n => window[n].toString()).join('\n\n') + `
const g = self;
TreeCore(g); OptimizeCore(g); EngineCore(g);
self.onmessage = function (e) {
  const d = e.data;
  const deadline = d.maxTime ? Date.now() + d.maxTime : Infinity;
  const opts = Object.assign({}, d.opts, {
    shouldStop: function () { return Date.now() > deadline; },
    onProgress: function (f, msg, best) { self.postMessage({ type: 'progress', f: f, best: best }); },
  });
  try {
    let res;
    if (d.task === 'search') res = g.Engine.search(d.matrix, d.prep, opts);
    else if (d.task === 'collect') res = g.Engine.collectNewicks(d.matrix, d.prep, d.newicks, opts);
    else if (d.task === 'successive') res = g.Engine.successive(d.matrix, d.prep, opts, d.sw);
    else if (d.task === 'resample') res = g.Engine.resample(d.matrix, d.prep, opts);
    else if (d.task === 'suboptimal') res = g.Engine.suboptimalNewicks(d.matrix, d.prep, d.newicks, opts);
    self.postMessage({ type: 'done', res: res });
  } catch (err) { self.postMessage({ type: 'error', message: err && err.message ? err.message : String(err) }); }
};`;
  }
  function blobUrl() {
    if (!url) url = URL.createObjectURL(new Blob([source()], { type: 'text/javascript' }));
    return url;
  }
  /* how many threads: what the computer offers, minus one for the page */
  function threads() {
    const hc = navigator.hardwareConcurrency || 4;
    return Math.max(1, Math.min(16, hc - 1));
  }
  let workersOK = null;
  function canUseWorkers() {
    if (workersOK != null) return workersOK;
    try { const w = new Worker(blobUrl()); w.terminate(); workersOK = true; } catch (e) { workersOK = false; }
    return workersOK;
  }
  /* one task on one worker (or on the page) */
  function runOne(payload, onProgress) {
    let worker = null, cancelled = false;
    const p = new Promise((resolve, reject) => {
      if (!canUseWorkers()) {
        /* on the page: after a paint, so the waiting window is visible */
        setTimeout(() => {
          try {
            const deadline = payload.maxTime ? Date.now() + payload.maxTime : Infinity;
            const opts = Object.assign({}, payload.opts, { shouldStop: () => cancelled || Date.now() > deadline, onProgress: (f, m, b) => onProgress && onProgress({ f, best: b }) });
            let res;
            if (payload.task === 'search') res = Engine.search(payload.matrix, payload.prep, opts);
            else if (payload.task === 'collect') res = Engine.collectNewicks(payload.matrix, payload.prep, payload.newicks, opts);
            else if (payload.task === 'resample') res = Engine.resample(payload.matrix, payload.prep, opts);
            else if (payload.task === 'suboptimal') res = Engine.suboptimalNewicks(payload.matrix, payload.prep, payload.newicks, opts);
            else res = Engine.successive(payload.matrix, payload.prep, opts, payload.sw);
            resolve(res);
          } catch (e) { reject(e); }
        }, 40);
        return;
      }
      worker = new Worker(blobUrl());
      worker.onmessage = e => {
        const d = e.data;
        if (d.type === 'progress') { if (onProgress) onProgress(d); return; }
        worker.terminate(); worker = null;
        if (d.type === 'done') resolve(d.res); else reject(new Error(d.message));
      };
      worker.onerror = e => { if (worker) worker.terminate(); worker = null; reject(new Error(e.message || 'error en el hilo')); };
      worker.postMessage(payload);
    });
    p.cancel = () => { cancelled = true; if (worker) { worker.terminate(); worker = null; } };
    return p;
  }
  /* a search with its replicates spread over several threads, then the
     equally short trees collected from all of them */
  function search(payload, onProgress) {
    const reps = payload.opts.replicates || 1;
    const nT = payload.opts.method === 'exact' ? 1 : Math.max(1, Math.min(threads(), reps));
    const jobs = [];
    const prog = new Array(nT).fill(0);
    let best = Infinity;
    const per = Math.ceil(reps / nT);
    for (let t = 0; t < nT; t++) {
      const r = Math.min(per, reps - t * per);
      if (r <= 0) break;
      const pl = Object.assign({}, payload, { task: 'search', opts: Object.assign({}, payload.opts, { replicates: r, seed: (payload.opts.seed || 1) * 7919 + t * 104729 }) });
      jobs.push(runOne(pl, d => {
        prog[t] = d.f || 0;
        if (d.best != null && d.best < best) best = d.best;
        if (onProgress) onProgress({ f: prog.reduce((a, b) => a + b, 0) / jobs.length * 0.9, best });
      }));
    }
    let cancelled = false;
    const all = Promise.all(jobs).then(results => {
      if (cancelled) throw new Error('cancelado');
      const bestScore = Math.min(...results.map(r => r.score));
      const hits = results.reduce((a, r) => a + (r.history || []).filter(h => h.found != null && Math.abs(h.found - bestScore) < 1e-9).length, 0);
      const reps2 = results.reduce((a, r) => a + (r.reps || 0), 0);
      const history = [];
      let run = Infinity, step = 0;
      /* the history of all replicates, in the order they would have run */
      const maxLen = Math.max(...results.map(r => (r.history || []).length));
      for (let i = 0; i < maxLen; i++) results.forEach(r => { const h = (r.history || [])[i]; if (h && h.found != null) { run = Math.min(run, h.found); history.push({ step: ++step, best: run, found: h.found }); } });
      /* an exact search has no replicates: its result says so (hits = null) and must not be counted as one */
      if (payload.opts.method === 'exact') return Object.assign(results[0], { threads: 1 });
      if (results.length === 1) return Object.assign(results[0], { hits, reps: reps2, history: history.length ? history : results[0].history, threads: jobs.length });
      const newicks = [];
      results.forEach(r => { if (Math.abs(r.score - bestScore) < 1e-9) r.trees.forEach(t => newicks.push(t.newick)); });
      const time = Math.max(...results.map(r => r.time || 0));
      const fin = runOne(Object.assign({}, payload, { task: 'collect', newicks }), d => onProgress && onProgress({ f: 0.9 + 0.1 * (d.f || 0), best: bestScore }));
      return fin.then(c => Object.assign(c, { hits, reps: reps2, history, method: payload.opts.method, time: time + c.time, threads: jobs.length }));
    });
    all.cancel = () => { cancelled = true; jobs.forEach(j => j.cancel()); };
    return all;
  }
  /* resampling with its replicates shared among threads; the counts of the
     groups are added up */
  function resample(payload, onProgress) {
    const reps = payload.opts.reps;
    const nT = Math.max(1, Math.min(threads(), reps));
    const per = Math.ceil(reps / nT);
    const jobs = [], prog = [];
    for (let t = 0; t < nT; t++) {
      const first = t * per, r = Math.min(per, reps - first);
      if (r <= 0) break;
      prog.push(0);
      const k = prog.length - 1;
      jobs.push(runOne(Object.assign({}, payload, { task: 'resample', opts: Object.assign({}, payload.opts, { reps: r, first }) }), d => {
        prog[k] = (d.f || 0) * r;
        if (onProgress) onProgress({ f: prog.reduce((a, b) => a + b, 0) / reps });
      }));
    }
    const all = Promise.all(jobs).then(results => {
      const counts = {};
      let done = 0;
      results.forEach(res => { done += res.reps; Object.keys(res.counts).forEach(key => { counts[key] = (counts[key] || 0) + res.counts[key]; }); });
      return { counts, reps: done, threads: jobs.length };
    });
    all.cancel = () => jobs.forEach(j => j.cancel());
    return all;
  }
  window.Pool = { search, runOne, resample, threads, canUseWorkers, source };
})();
