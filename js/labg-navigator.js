/* LABG Suite — Navegador LABG v1.1.3 (módulo compartido)
   Copyright (C) 2026  Luis Ángel Barrera-Guzmán

   This program is free software: you can redistribute it and/or modify it under
   the terms of the GNU General Public License as published by the Free Software
   Foundation, either version 3 of the License, or (at your option) any later
   version. It is distributed in the hope that it will be useful, but WITHOUT ANY
   WARRANTY; see the GNU General Public License, in the file LICENSE at the root
   of this program, or <https://www.gnu.org/licenses/>.

   Íconos: dibujados para la suite LABG sobre una cuadrícula de 24 × 24 con
   trazo de 1.5; son parte de este código.

   Qué hace
   --------
   Ordena la navegación de una app de la suite en tres niveles, sin tocar sus
   cálculos ni mover sus nodos:

     1. Bloques   barra lateral a la izquierda con el estado de cada bloque
                  (activo, terminado, con aviso, bloqueado); se contrae con «[».
                  En el teléfono se vuelve una fila de pestañas abajo.
     2. Secciones dentro del bloque, en dos modos que se recuerdan por app:
                  «Documento»: índice fijo a la derecha que sigue la lectura
                  (IntersectionObserver), barra de progreso y la sección actual
                  siempre a la vista en la ruta de arriba;
                  «Enfocado»: una sección a la vez, con Anterior / Siguiente
                  y Alt+← / Alt+→.
                  Si la app tiene pestañas dentro de un bloque (opción tabs),
                  el índice muestra las pestañas y, debajo de la abierta, sus
                  secciones; la ruta y la paleta también las nombran.
     3. Comandos  paleta con Ctrl+K: busca bloques, secciones, controles,
                  figuras y acciones, con los recientes primero.

   Además: ruta (App › Bloque › Sección), contraer y expandir secciones con
   memoria, botón para volver arriba y para volver a lo último que se editó,
   enlaces directos #bN/seccion que respetan Atrás y Adelante, aviso «Ir al
   paso pendiente» cuando un bloque espera un paso anterior, ayuda en contexto
   con «?» y, si el Estudio de figuras LABG está cargado, abrir desde el índice
   las figuras de cada sección.

   Mejora progresiva: si algo falla, la app sigue con su barra de bloques de
   siempre. Funciona con doble clic (file://), sin servidor ni dependencias.

   Uso: una línea, después de labg-core.js:
     <script src="js/labg-navigator.js" defer></script>
   La hoja de estilo se carga sola (css/labg-navigator.css o, si el módulo vive
   en otra carpeta, la .css del mismo nombre a su lado).

   Configuración opcional, antes del script: window.LABG_NAV = { … } (ver DEF).
   API: window.LABGNavigator  (ver al final). */
(function () {
  'use strict';
  if (window.LABGNavigator && window.LABGNavigator.version) return;
  const VERSION = '1.1.3';
  const me = document.currentScript;

  /* ---------------- hoja de estilo (se carga sola) ---------------- */
  (function css() {
    if (document.querySelector('link[data-lnav-css]')) return;
    const src = (me && me.src) || '';
    const href = (me && me.dataset.css) || (/\/js\/(?:core\/)?labg-navigator\.js(\?.*)?$/.test(src)
      ? src.replace(/\/js\/(?:core\/)?labg-navigator\.js(\?.*)?$/, '/css/labg-navigator.css')
      : src.replace(/\.js(\?.*)?$/, '.css'));
    if (!href) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = href; l.setAttribute('data-lnav-css', '');
    (document.head || document.documentElement).appendChild(l);
  })();

  /* ---------------- utilidades ---------------- */
  const lang = () => ((document.documentElement.lang || 'es').slice(0, 2) === 'en' ? 'en' : 'es');
  const T = (es, en) => (lang() === 'en' ? en : es);
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const slug = s => fold(s).replace(/^[\s\d.·:\-–—]+(?=[a-z])/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 's';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const mk = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
  const raf = window.requestAnimationFrame || (f => setTimeout(f, 16));
  const reduced = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const shown = el => !!(el && el.getClientRects().length);
  const typing = t => !!(t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)));

  /* íconos propios de la suite: trazos sobre una cuadrícula de 24 × 24, de 1.5 para que se vean finos */
  const ICONOS = {
    'panel-left-close': '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M9 4.5v15"/><path d="M15.5 9.5 13 12l2.5 2.5"/>',
    'panel-left-open': '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M9 4.5v15"/><path d="M13 9.5l2.5 2.5-2.5 2.5"/>',
    'panel-left': '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M9 4.5v15"/>',
    'panel-right': '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M15 4.5v15"/>',
    'panel-top': '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M3.5 9.5h17"/>',
    'columns-2': '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M12 4.5v15"/>',
    'picture-in-picture-2': '<rect x="2.5" y="4.5" width="19" height="15" rx="2.5"/><rect x="12" y="12" width="7" height="5" rx="1"/>',
    'chevron-right': '<path d="M10 6.5l5.5 5.5-5.5 5.5"/>',
    'chevron-down': '<path d="M6.5 10l5.5 5.5 5.5-5.5"/>',
    'chevrons-down-up': '<path d="M8 4.5l4 4 4-4"/><path d="M8 19.5l4-4 4 4"/>',
    'chevrons-up-down': '<path d="M8 8.5l4-4 4 4"/><path d="M8 15.5l4 4 4-4"/>',
    'arrow-up': '<path d="M12 19.5V5"/><path d="M6.5 10.5 12 5l5.5 5.5"/>',
    'arrow-left': '<path d="M19.5 12H5"/><path d="M10.5 6.5 5 12l5.5 5.5"/>',
    'arrow-right': '<path d="M4.5 12H19"/><path d="M13.5 6.5 19 12l-5.5 5.5"/>',
    'corner-down-right': '<path d="M5 4.5v7a3 3 0 0 0 3 3h11"/><path d="M15 10.5l4 4-4 4"/>',
    'move': '<path d="M12 3v18M3 12h18"/><path d="M9.5 5.5 12 3l2.5 2.5M9.5 18.5 12 21l2.5-2.5M5.5 9.5 3 12l2.5 2.5M18.5 9.5 21 12l-2.5 2.5"/>',
    'maximize-2': '<path d="M14 4h6v6M10 20H4v-6"/><path d="M20 4l-6.5 6.5M4 20l6.5-6.5"/>',
    'undo-2': '<path d="M9 14 4.5 9.5 9 5"/><path d="M4.5 9.5H14a5.5 5.5 0 0 1 0 11h-3"/>',
    'redo-2': '<path d="M15 14l4.5-4.5L15 5"/><path d="M19.5 9.5H10a5.5 5.5 0 0 0 0 11h3"/>',
    'rotate-ccw': '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9"/><path d="M4.5 4.5V9H9"/>',
    'history': '<path d="M4 12a8 8 0 1 0 2.3-5.6L4 8.5"/><path d="M4 4.5v4h4"/><path d="M12 8v4.5l3 1.5"/>',
    'search': '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>',
    'zoom-in': '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/><path d="M8 10.5h5M10.5 8v5"/>',
    'zoom-out': '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/><path d="M8 10.5h5"/>',
    'scan': '<path d="M4 8.5V4h4.5M15.5 4H20v4.5M20 15.5V20h-4.5M8.5 20H4v-4.5"/>',
    'focus': '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/><circle cx="12" cy="12" r="2.5"/>',
    'file-text': '<path d="M6.5 3.5H14l4.5 4.5v12.5h-12z"/><path d="M14 3.5V8h4.5"/><path d="M9 12.5h6M9 16h6"/>',
    'file-json': '<path d="M6.5 3.5H14l4.5 4.5v12.5h-12z"/><path d="M14 3.5V8h4.5"/><path d="M10.5 11.5c-1 0-1.5.5-1.5 1.3v.6c0 .5-.4.9-.9.9.5 0 .9.4.9.9v.6c0 .8.5 1.3 1.5 1.3M13.5 11.5c1 0 1.5.5 1.5 1.3v.6c0 .5.4.9.9.9-.5 0-.9.4-.9.9v.6c0 .8-.5 1.3-1.5 1.3"/>',
    'pencil': '<path d="M15 4.5l4.5 4.5L8.5 20H4v-4.5z"/><path d="M12.5 7l4.5 4.5"/>',
    'pencil-line': '<path d="M14.5 5.5l4 4L9 19H5v-4z"/><path d="M12.5 7.5l4 4"/><path d="M13 20h7"/>',
    'pencil-ruler': '<rect x="3" y="14.5" width="18" height="6" rx="1"/><path d="M7 14.5V17M11 14.5v3M15 14.5V17"/><path d="M4.5 10.5 12 3l2.5 2.5L7 13H4.5z"/>',
    'ruler': '<rect x="2.5" y="8" width="19" height="8" rx="1.5"/><path d="M6.5 8v3M10.5 8v4.5M14.5 8v3M18.5 8v4.5"/>',
    'wand-sparkles': '<path d="M4 20 15 9"/><path d="M13.5 7.5l3 3"/><path d="M18 3v3M16.5 4.5h3M20.5 10v2M19.5 11h2M10.5 3.5v2M9.5 4.5h2"/>',
    'type': '<path d="M5 6.5v-2h14v2"/><path d="M12 4.5v15"/><path d="M9 19.5h6"/>',
    'sliders-horizontal': '<path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="17" r="2"/>',
    'grip-vertical': '<path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" stroke-width="2.6"/>',
    'list': '<path d="M4.5 7h.01M4.5 12h.01M4.5 17h.01" stroke-width="2.2"/><path d="M8.5 7h11M8.5 12h11M8.5 17h11"/>',
    'table-of-contents': '<path d="M4 6h10M4 10.5h16M8 15h12M8 19.5h12"/>',
    'layers': '<path d="M12 3.5 21 8l-9 4.5L3 8z"/><path d="M3 12l9 4.5 9-4.5"/><path d="M3 16l9 4.5 9-4.5"/>',
    'image': '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="9.5" r="1.6"/><path d="M3.5 17 9 12l4 3.5 3-2.5 4.5 4"/>',
    'palette': '<path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.1 0 1.8-.7 1.8-1.6 0-.5-.2-.9-.5-1.2-.3-.4-.5-.8-.5-1.3 0-.9.8-1.7 1.7-1.7h2A4.5 4.5 0 0 0 21 10.2c0-3.7-4-6.7-9-6.7z"/><path d="M7.5 11.5h.01M9.5 7.5h.01M14 7h.01M17 10h.01" stroke-width="2.4"/>',
    'eye': '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    'sun': '<circle cx="12" cy="12" r="4"/><path d="M12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.75 1.75M16.95 16.95l1.75 1.75M5.3 18.7l1.75-1.75M16.95 7.05l1.75-1.75"/>',
    'languages': '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5c-2.6 2.3-3.8 5.2-3.8 8.5s1.2 6.2 3.8 8.5M12 3.5c2.6 2.3 3.8 5.2 3.8 8.5s-1.2 6.2-3.8 8.5"/><path d="M3.5 12h17M5.2 7.5h13.6M5.2 16.5h13.6"/>',
    'keyboard': '<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6.5 10h.01M10 10h.01M14 10h.01M17.5 10h.01" stroke-width="2.2"/><path d="M8 14.5h8"/>',
    'link': '<rect x="1.8" y="9" width="12" height="6" rx="3" transform="rotate(-45 7.8 12)"/><rect x="10.2" y="9" width="12" height="6" rx="3" transform="rotate(-45 16.2 12)"/>',
    'lock': '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/><path d="M12 14.5V17"/>',
    'check': '<path d="M5 12.5l5 5L19 7"/>',
    'x': '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
    'triangle-alert': '<path d="M12 3.8 21.2 19.5H2.8z"/><path d="M12 9.5v4"/><path d="M12 16.8h.01" stroke-width="2.2"/>',
    'circle-dashed': '<circle cx="12" cy="12" r="8.5" stroke-dasharray="3.2 2.6"/>',
    'circle-help': '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1 1-1.1 1.8v.5"/><path d="M12 17h.01" stroke-width="2.2"/>',
    'info': '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><path d="M12 7.8h.01" stroke-width="2.2"/>',
    'message-circle-warning': '<path d="M4 12a8 7 0 1 1 3.5 5.8L4 19.5l1.2-3.6A6.8 6.8 0 0 1 4 12z"/><path d="M12 8.5v4"/><path d="M12 15.5h.01" stroke-width="2.2"/>',
    'house': '<path d="M4 11 12 4l8 7"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5h4v5"/>',
    'clock': '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    'zap': '<path d="M13.5 2.5 5.5 13.5H11l-1 8 8-11h-5.5z"/>',
    'download': '<path d="M12 4v11"/><path d="M7.5 10.5 12 15l4.5-4.5"/><path d="M4.5 16v3.5h15V16"/>',
    'upload': '<path d="M12 15V4"/><path d="M7.5 8.5 12 4l4.5 4.5"/><path d="M4.5 16v3.5h15V16"/>',
    'copy': '<rect x="8.5" y="8.5" width="12" height="12" rx="2"/><path d="M15.5 8.5v-3a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3"/>',
    'save': '<path d="M5 3.5h11l3.5 3.5v12a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V5A1.5 1.5 0 0 1 5 3.5z"/><path d="M7.5 3.5v5h7v-5"/><path d="M7.5 20.5v-6h9v6"/>',
    'bookmark-plus': '<path d="M6.5 3.5h11v17l-5.5-4-5.5 4z"/><path d="M12 7.5v5M9.5 10h5"/>',
    'trash-2': '<path d="M4 6.5h16"/><path d="M9.5 6.5v-2h5v2"/><path d="M6.5 6.5l1 13.5h9l1-13.5"/><path d="M10.5 10.5v6M13.5 10.5v6"/>',
  };
  const ico = (n, cls) => '<svg class="lnav-i' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (ICONOS[n] || '') + '</svg>';

  /* el texto visible de un nodo, en el idioma activo, aunque el bloque esté oculto */
  function textOf(el) {
    if (!el) return '';
    const L = lang();
    let out = '';
    const walk = n => {
      if (n.nodeType === 3) { out += n.nodeValue; return; }
      if (n.nodeType !== 1) return;
      const t = n.tagName;
      if (/^(SCRIPT|STYLE|TEMPLATE|SELECT|OPTION|TEXTAREA|OUTPUT)$/.test(t) || t.toLowerCase() === 'svg') return;
      if (n.hidden || n.classList.contains('sr-only') || n.classList.contains('step-state') || n.classList.contains('lnav-own')) return;
      /* los distintivos de ayuda («?», «i») y los botones dentro de un título no son parte del texto */
      if (n !== el && (t === 'BUTTON' || n.hasAttribute('data-help') || /(^|\s)(help-badge|help-btn|help-dot|info-btn|hint-btn)(\s|$)/.test(n.className || ''))) return;
      const dl = n.getAttribute('data-l') || n.getAttribute('lang');
      if (dl && n !== el && dl.slice(0, 2) !== L && /^(es|en)/.test(dl)) return;
      if (n.style && n.style.display === 'none') return;
      /* el otro idioma (o lo que la app esconde con su hoja de estilo) no se lee */
      if (n !== el && getComputedStyle(n).display === 'none') return;
      const blk = /^(DIV|P|LI|SMALL|BR|H[1-6]|SECTION|TD|TH|DT|DD|SUMMARY)$/.test(t);
      if (blk) out += ' ';
      for (let c = n.firstChild; c; c = c.nextSibling) walk(c);
      if (blk) out += ' ';
    };
    walk(el);
    return out.replace(/\s+/g, ' ').trim();
  }

  /* ---------------- identidad de la app y configuración ---------------- */
  const APP = (document.title || 'labg').split(/[\s—–·|:]+/)[0].toLowerCase().replace(/[^a-z0-9]+/g, '') || 'labg';
  const APP_NAME = (document.title || 'LABG').split(/\s+[—–·|-]\s+/)[0].trim();

  const DEF = {
    steps: '.stepper .step-btn[data-step]',     /* los botones de la barra de bloques de la app */
    stepper: '.stepper',                        /* la barra que el navegador reemplaza a la vista */
    topbar: '.topbar',
    main: '#main, main',
    panel: n => document.getElementById('panel-' + n),   /* el panel de cada bloque */
    blockHead: '.panel-title, .blk-title, .blk-head, .block-title, .page-head',
    heads: 'h2, h3',                            /* títulos que abren una sección */
    skip: '.step-footer, .next-bar, .messages, .msg, script, style, template, dialog, .lnav-own, [data-lnav-skip]',
    empty: '.soon-box, .sim-empty, .empty-state, [id$="NoData"], [id$="NoTree"], [id$="NoResults"], [id$="Empty"]',
    sidebar: true,      /* false: la app ya tiene su propio menú lateral */
    hash: true,         /* enlaces #bN/seccion */
    noToc: [],          /* bloques sin índice de secciones (tienen su propio índice) */
    minSections: 2,
    /* pestañas dentro de un bloque (la app dibuja solo la abierta): */
    tabs: null,         /* selector de su lista [role="tablist"] dentro del panel; null: el bloque no tiene pestañas */
    tabsOf: null,       /* n => [{ id, label }]: las pestañas de cualquier bloque, para la paleta (opcional) */
    goTab: null,        /* (n, id) => abre esa pestaña de ese bloque (opcional) */
    tabLink: null,      /* (n, id) => '#…': el enlace directo a una pestaña (opcional) */
  };
  /* lo propio de cada app (lo demás lo encuentra solo) */
  const PERFILES = {
    scimetricspro: {
      sidebar: false, hash: false,
      panel: () => document.getElementById('view'),
      blockHead: '.page-head, .crumb',
      /* cada módulo tiene pestañas; la app da sus nombres, cómo abrirlas y el enlace #/módulo/pestaña */
      tabs: '.module-body [role="tablist"]',
      tabsOf: n => (window.App && App.tabs ? App.tabs(n) : null),
      goTab: (n, id) => { if (window.App && App.goTab) App.goTab(n, id); },
      tabLink: (n, id) => (window.App && App.tabHash ? App.tabHash(n, id) : null),
    },
    leafpro: { noToc: ['5'] },                  /* el atlas ya tiene su índice de categorías */
    biomodellingpro: {},
  };
  const CFG = Object.assign({}, DEF, PERFILES[APP] || {}, window.LABG_NAV || {});
  ['steps', 'stepper', 'heads', 'skip', 'empty'].forEach(k => { if (me && me.dataset[k]) CFG[k] = me.dataset[k]; });

  /* memoria por app */
  const KEY = 'labg-nav:' + APP + ':';
  const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(KEY + k)); return v == null ? d : v; } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch (e) { /* navegación privada */ } };

  /* ---------------- estado ---------------- */
  const S = {
    on: false,
    mode: load('mode', 'doc') === 'focus' ? 'focus' : 'doc',
    rail: load('rail', null),          /* null: lo decide el ancho de la pantalla */
    block: null,                       /* data-step del bloque activo */
    tabs: [],                          /* pestañas del bloque activo (si la app las tiene) */
    tabKey: null,                      /* bloque y pestaña abiertos, para saber cuándo cambian */
    tabScroll: false,                  /* al cambiar de pestaña desde el índice, subir a la lista de pestañas */
    secs: [],                          /* secciones del bloque activo (de su pestaña abierta) */
    cur: 0,                            /* sección activa (índice) */
    focusIdx: {},                      /* sección elegida por bloque en modo enfocado */
    folded: load('fold', {}),          /* { bloque: [id de sección, …] } */
    recents: load('recents', []),
    last: null,                        /* lo último que se editó */
    lastHash: '',
    fromPop: false,
    pendingSec: null,
  };
  const listeners = {};
  const emit = (ev, d) => (listeners[ev] || []).forEach(f => { try { f(d); } catch (e) { console.error(e); } });

  /* ---------------- bloques (leídos de la barra de la app) ---------------- */
  function stepBtns() { return $$(CFG.steps).filter(b => !b.closest('.lnav-own')); }
  function stepInfo(b) {
    const numEl = b.querySelector('.step-num');
    let label = '';
    for (let c = b.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 1 && getComputedStyle(c).display === 'none') continue;
      if (c.nodeType === 1 && (c.classList.contains('step-num') || c.classList.contains('sr-only') || c.classList.contains('step-state') || c.classList.contains('nav-dot'))) continue;
      label += c.nodeType === 1 ? textOf(c) + ' ' : (c.nodeValue || '');
    }
    label = label.replace(/\s+/g, ' ').replace(/^[^\p{L}\p{N}]+/u, '').trim();
    const num = numEl ? numEl.textContent.trim() : '';
    return {
      n: b.dataset.step, btn: b, num, label: label || num,
      active: b.getAttribute('aria-current') === 'step' || b.getAttribute('aria-current') === 'page' || b.classList.contains('active'),
      done: b.classList.contains('done'), warn: b.classList.contains('warn'),
      disabled: !!b.disabled || b.getAttribute('aria-disabled') === 'true' || b.classList.contains('locked'),
      soon: b.classList.contains('soon'),
    };
  }
  const steps = () => stepBtns().map(stepInfo);
  const activeStep = () => { const a = steps().find(s => s.active); return a ? a.n : (S.block || null); };
  function panelOf(n) {
    let p = null;
    try { p = typeof CFG.panel === 'function' ? CFG.panel(n) : document.querySelector(String(CFG.panel).replace('{n}', n)); } catch (e) { p = null; }
    return p || document.querySelector('[data-labg-block="' + n + '"]');
  }
  const activePanel = () => panelOf(S.block) || $('.step-panel.active') || $(CFG.main);

  /* ---------------- secciones ---------------- */
  const isSkip = el => el.matches(CFG.skip) || el.matches(CFG.blockHead) || el.classList.contains('lnav-own');
  const isHead = el => /^H[23]$/.test(el.tagName) || el.classList.contains('section-title');
  const HEAD_IN = [':scope > h2', ':scope > h3', ':scope > header h2', ':scope > header h3', ':scope > .card-head h2', ':scope > .card-head h3',
    ':scope > .results-header h2', ':scope > summary h2', ':scope > summary h3', ':scope > .chart-head h3', ':scope > .chart-head h2',
    ':scope > div:first-child > h2', ':scope > div:first-child > h3', ':scope > .card-head > div > h2'].join(', ');
  /* el título de un envoltorio, si lo tiene arriba (una tarjeta con su h2) */
  function headOf(el) {
    if (/^(H[1-6]|P|SPAN|A|BUTTON|LABEL|INPUT|SELECT|TEXTAREA|TABLE|UL|OL|IMG|CANVAS|svg)$/i.test(el.tagName)) return null;
    let h = null;
    try { h = el.querySelector(HEAD_IN); } catch (e) { h = null; }
    if (!h || !shown(h)) return null;
    const top = el.getBoundingClientRect().top, ht = h.getBoundingClientRect().top;
    return ht - top < 140 ? h : null;
  }
  const hasHeads = el => !!el.querySelector('h2, h3, .section-title');
  const level = h => /^H[1-6]$/.test(h.tagName) ? +h.tagName[1] : 3;
  /* ¿el envoltorio trae dos o más títulos sueltos del mismo rango? Entonces son sus secciones (un cuerpo con
     «1 · …», «2 · …»). Una tarjeta con su h2 arriba y subtítulos h3 sigue siendo una sola sección. */
  function splits(el) {
    if (el.matches('details, table, form, .fig-block, .pg-pane')) return false;
    const hs = Array.from(el.children).filter(c => isHead(c) && !isSkip(c) && shown(c));
    return hs.length >= 2 && level(hs[0]) >= Math.min.apply(null, hs.slice(1).map(level));
  }
  /* ¿trae el envoltorio dos o más tarjetas tituladas como hijos directos? Con «nested», cuenta también los
     envoltorios de tarjetas sin título propio (una tarjeta titulada seguida de un #resultados con las suyas). */
  function isBox(el, nested) {
    let n = 0;
    for (const c of el.children) {
      if (isSkip(c) || !shown(c) || isHead(c)) continue;
      if ((headOf(c) || (nested && !/^(TABLE|UL|OL|SELECT|svg|CANVAS)$/i.test(c.tagName) && isBox(c, false))) && ++n >= 2) return true;
    }
    return false;
  }
  /* ¿tiene título propio? (un h2/h3 suelto arriba o una cabecera; así una tarjeta titulada no se parte) */
  const OWN_HEAD = ':scope > h2, :scope > h3, :scope > header, :scope > .card-head, :scope > .results-header, :scope > .chart-head, :scope > summary';
  const ownHead = el => { let h = null; try { h = el.querySelector(OWN_HEAD); } catch (e) { h = null; } return !!h && shown(h); };
  function collect(root, out, depth) {
    let range = null;
    for (const el of Array.from(root.children)) {
      if (isSkip(el) || !shown(el)) { continue; }
      if (isHead(el)) { range = { head: el, nodes: [el], wrap: null }; out.push(range); continue; }
      /* un envoltorio con varias tarjetas tituladas adentro es un contenedor, no una sección */
      if (depth < 4 && (isBox(el, false) || (!ownHead(el) && isBox(el, true)))) { collect(el, out, depth + 1); range = null; continue; }
      if (depth < 4 && splits(el)) { collect(el, out, depth + 1); range = null; continue; }
      const h = headOf(el);
      if (h) { out.push({ head: h, nodes: [el], wrap: el }); range = null; continue; }
      if (depth < 4 && hasHeads(el) && !el.matches('details, table, form, .fig-block, .pg-pane')) { collect(el, out, depth + 1); range = null; continue; }
      if (range) range.nodes.push(el);
    }
    return out;
  }
  function detect(panel) {
    if (!panel || !shown(panel)) return [];
    let out;
    if (typeof CFG.sections === 'function') out = CFG.sections(panel) || [];
    else {
      out = collect(panel, [], 0);
      /* una sola tarjeta grande con subsecciones: se usan las de adentro */
      if (out.length === 1 && out[0].wrap) {
        const inner = [];
        Array.from(out[0].wrap.children).forEach(ch => { if (!isSkip(ch) && shown(ch) && !ch.contains(out[0].head) && hasHeads(ch)) collect(ch, inner, 1); });
        if (inner.length >= CFG.minSections) out = inner;
      }
    }
    const seen = {};
    return out.map((s, i) => {
      const title = textOf(s.head).replace(/\s*ⓘ\s*$/, '') || T('Sección ', 'Section ') + (i + 1);
      let id = slug(title); if (seen[id]) id += '-' + (++seen[id]); else seen[id] = 1;
      return Object.assign(s, { i, id, title });
    });
  }
  /* estado de una sección: pendiente (espera un paso anterior), con resultados o neutra */
  function stateOf(sec) {
    for (const n of sec.nodes) {
      const e = n.matches(CFG.empty) ? n : n.querySelector(CFG.empty);
      if (e && shown(e)) return 'pending';
    }
    for (const n of sec.nodes) {
      if (n.querySelector('.fig-canvas svg, .pg-pane svg, svg[data-plot], table.results, table.data, table.tbl, .fig-block, img.fig, .fig-card img')) return 'ready';
    }
    return '';
  }
  const figsIn = sec => {
    const F = window.LABGFigureStudio;
    if (!F || !F.figures) return [];
    try { return F.figures().filter(f => sec.nodes.some(n => n.contains(f.el))); } catch (e) { return []; }
  };

  /* ---------------- pestañas dentro del bloque ---------------- */
  /* las pestañas que da la app para un bloque (para nombres y para la paleta) */
  function tabsOf(n) {
    if (typeof CFG.tabsOf !== 'function') return null;
    try { const l = CFG.tabsOf(n); return Array.isArray(l) ? l.filter(x => x && x.id != null) : null; } catch (e) { return null; }
  }
  /* las del bloque activo, leídas de su lista: id (data-tab o el final del id del botón), nombre y la abierta */
  function detectTabs(p) {
    if (!CFG.tabs || !p) return [];
    let list = null;
    try { list = $$(CFG.tabs, p).find(shown) || null; } catch (e) { list = null; }
    if (!list) return [];
    const named = tabsOf(S.block) || [];
    return $$('[role="tab"]', list).filter(shown).map((b, i) => {
      const id = b.dataset.tab || (b.id ? b.id.replace(/^[a-z]*tab-/i, '') : '') || String(i);
      const own = named.find(x => String(x.id) === id);
      return { id, label: (own && own.label) || textOf(b), el: b, on: b.getAttribute('aria-selected') === 'true' };
    });
  }
  const curTab = () => S.tabs.find(x => x.on) || null;
  const hasTabs = () => S.tabs.length >= 2;
  /* ¿hay índice que mostrar? (secciones de sobra, o pestañas) */
  const tocWorthy = () => (hasTabs() || S.secs.length >= CFG.minSections) && CFG.noToc.indexOf(String(S.block)) < 0;
  /* abre una pestaña: la del bloque activo con su propio botón; la de otro bloque, como diga la app */
  function goTab(n, id) {
    n = String(n);
    if (n === String(S.block)) {
      const tb = S.tabs.find(x => x.id === String(id));
      if (tb) {
        if (tb.on) { scrollToTabs(); return true; }
        S.tabScroll = true;
        tb.el.click();
        return true;
      }
    }
    if (typeof CFG.goTab === 'function') { try { CFG.goTab(n, id); return true; } catch (e) { console.error(e); } }
    if (!goBlock(n)) return false;
    setTimeout(() => { const tb = S.tabs.find(x => x.id === String(id)); if (tb && !tb.on) { S.tabScroll = true; tb.el.click(); } }, 420);
    return true;
  }
  /* sube hasta la lista de pestañas si quedó arriba de la vista */
  function scrollToTabs() {
    const tb = curTab() || S.tabs[0];
    const list = tb && tb.el.closest('[role="tablist"]');
    if (!list) return;
    const top = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--lnav-top'), 10) || 0;
    const y = window.scrollY + list.getBoundingClientRect().top - top - (bar ? bar.offsetHeight : 44) - 12;
    if (list.getBoundingClientRect().top < top + (bar ? bar.offsetHeight : 44)) window.scrollTo({ top: Math.max(0, y), behavior: reduced() ? 'auto' : 'smooth' });
  }

  /* ---------------- construcción de la interfaz ---------------- */
  let side, bar, crumbs, toc, tocList, floatBox, tabs, pager, pal, pendingBtn, chips, progress;
  let topbar, stepper, mainEl;

  function build() {
    topbar = $(CFG.topbar);
    stepper = $(CFG.stepper);
    mainEl = $(CFG.main);
    if (!stepBtns().length || !mainEl) return false;
    const root = document.documentElement;
    root.classList.add('lnav-on');

    /* barra lateral de bloques */
    if (CFG.sidebar) {
      side = mk('aside', 'lnav-side lnav-own');
      side.id = 'lnavSide';
      side.setAttribute('aria-label', T('Bloques de la app', 'App blocks'));
      side.innerHTML = '<div class="lnav-side-head"><span class="lnav-side-title"></span><span class="lnav-side-count"></span>' +
        '<button type="button" class="lnav-ibtn lnav-rail-btn" data-lnav="rail"></button></div>' +
        '<nav class="lnav-side-nav"><ol class="lnav-list" role="list"></ol></nav>' +
        '<div class="lnav-side-foot">' +
        /* el espacio antes de la tecla no se ve (el botón es flex): separa «Buscar» de «Ctrl K» para quien lee el texto del botón */
        '<button type="button" class="lnav-sbtn" data-lnav="palette">' + ico('search') + '<span class="lnav-sbtn-t"></span> <kbd>Ctrl K</kbd></button>' +
        '<button type="button" class="lnav-sbtn" data-lnav="mode">' + ico('focus') + '<span class="lnav-sbtn-t"></span></button>' +
        '<button type="button" class="lnav-sbtn" data-lnav="help">' + ico('circle-help') + '<span class="lnav-sbtn-t"></span><kbd>?</kbd></button>' +
        '</div>';
      if (topbar && topbar.parentElement) topbar.after(side); else document.body.appendChild(side);
      side.addEventListener('click', onSideClick);
      side.addEventListener('keydown', e => roving(e, '.lnav-item', 'vertical'));
    }

    /* fila de pestañas en el teléfono */
    if (CFG.sidebar) {
      tabs = mk('nav', 'lnav-tabs lnav-own');
      tabs.setAttribute('aria-label', T('Bloques', 'Blocks'));
      document.body.appendChild(tabs);
      tabs.addEventListener('click', e => { const b = e.target.closest('[data-n]'); if (b) goBlock(b.dataset.n); });
      tabs.addEventListener('keydown', e => roving(e, '.lnav-tab', 'horizontal'));
    }

    /* barra de contexto: ruta, modo, contraer y buscar */
    bar = mk('div', 'lnav-bar lnav-own');
    bar.innerHTML = '<div class="lnav-bar-row">' +
      '<nav class="lnav-crumbs" aria-label="' + esc(T('Ruta', 'Breadcrumb')) + '"><ol></ol></nav>' +
      '<span class="lnav-bar-sp"></span>' +
      '<button type="button" class="lnav-pend" data-lnav="pending" hidden>' + ico('corner-down-right') + '<span></span></button>' +
      '<button type="button" class="lnav-ibtn lnav-secbtn" data-lnav="sections" aria-haspopup="true" aria-expanded="false">' + ico('table-of-contents') + '<span class="lnav-secbtn-t"></span></button>' +
      '<div class="lnav-seg" role="group"><button type="button" data-lnav="doc">' + ico('file-text') + '<span></span></button><button type="button" data-lnav="focus">' + ico('focus') + '<span></span></button></div>' +
      '<button type="button" class="lnav-ibtn" data-lnav="foldall"></button>' +
      '<button type="button" class="lnav-ibtn lnav-k" data-lnav="palette">' + ico('search') + '<kbd>Ctrl K</kbd></button>' +
      '</div><div class="lnav-chips" role="tablist" hidden></div><div class="lnav-prog" aria-hidden="true"><i></i></div>' +
      '<div class="lnav-secmenu" hidden></div>';
    crumbs = $('.lnav-crumbs ol', bar);
    chips = $('.lnav-chips', bar);
    progress = $('.lnav-prog i', bar);
    pendingBtn = $('.lnav-pend', bar);
    const first = steps()[0];
    const anchor = (first && panelOf(first.n)) || $('.step-panel', mainEl) || mainEl.firstElementChild;
    if (anchor && anchor.parentElement) anchor.parentElement.insertBefore(bar, anchor); else mainEl.prepend(bar);
    bar.addEventListener('click', onBarClick);

    /* índice de secciones a la derecha */
    toc = mk('nav', 'lnav-toc lnav-own');
    toc.setAttribute('aria-label', T('En este bloque', 'In this block'));
    toc.innerHTML = '<div class="lnav-toc-head"><span class="lnav-toc-title"></span><span class="lnav-toc-count"></span></div><ol class="lnav-toc-list" role="list"></ol>';
    tocList = $('.lnav-toc-list', toc);
    document.body.appendChild(toc);
    toc.addEventListener('click', onTocClick);

    /* botones flotantes: arriba y lo último que se editó */
    floatBox = mk('div', 'lnav-float lnav-own');
    floatBox.innerHTML = '<button type="button" class="lnav-fbtn" data-lnav="last" hidden>' + ico('pencil-line') + '<span></span></button>' +
      '<button type="button" class="lnav-fbtn lnav-top" data-lnav="top" hidden>' + ico('arrow-up') + '</button>';
    document.body.appendChild(floatBox);
    floatBox.addEventListener('click', e => {
      const b = e.target.closest('[data-lnav]'); if (!b) return;
      if (b.dataset.lnav === 'top') toTop(); else goLast();
    });

    /* Anterior / Siguiente en el modo enfocado */
    pager = mk('div', 'lnav-pager lnav-own');
    pager.innerHTML = '<button type="button" data-lnav="prev">' + ico('arrow-left') + '<span></span></button><b></b><button type="button" data-lnav="next"><span></span>' + ico('arrow-right') + '</button>';
    pager.hidden = true;
    document.body.appendChild(pager);
    pager.addEventListener('click', e => { const b = e.target.closest('[data-lnav]'); if (b) step(b.dataset.lnav === 'next' ? 1 : -1); });

    if (stepper && CFG.sidebar) stepper.setAttribute('data-lnav-replaced', '');
    root.classList.toggle('lnav-has-side', !!CFG.sidebar);
    labels();
    return true;
  }

  /* textos de la interfaz en el idioma activo */
  function labels() {
    if (side) {
      $('.lnav-side-title', side).textContent = T('Bloques', 'Blocks');
      side.setAttribute('aria-label', T('Bloques de la app', 'App blocks'));
      const fb = $$('.lnav-sbtn-t', side);
      fb[0].textContent = T('Buscar', 'Search');
      fb[2].textContent = T('Ayuda', 'Help');
    }
    if (tabs) tabs.setAttribute('aria-label', T('Bloques', 'Blocks'));
    $('.lnav-toc-title', toc).textContent = T('En este bloque', 'In this block');
    toc.setAttribute('aria-label', T('En este bloque', 'In this block'));
    $('.lnav-crumbs', bar).setAttribute('aria-label', T('Ruta', 'Breadcrumb'));
    const seg = $$('.lnav-seg button', bar);
    seg[0].querySelector('span').textContent = T('Documento', 'Document');
    seg[1].querySelector('span').textContent = T('Enfocado', 'Focused');
    seg[0].title = T('Todas las secciones del bloque, una tras otra', 'Every section of the block, one after another');
    seg[1].title = T('Una sección a la vez (Alt+← / Alt+→)', 'One section at a time (Alt+← / Alt+→)');
    $('.lnav-seg', bar).setAttribute('aria-label', T('Modo de lectura', 'Reading mode'));
    /* el nombre lleva el atajo tal como se ve en la tecla del botón: «Ctrl K» (WCAG 2.5.3) */
    const k = $('.lnav-k', bar); k.title = T('Buscar en la app', 'Search the app') + ' (' + $('kbd', k).textContent + ')'; k.setAttribute('aria-label', k.title);
    const sb = $('.lnav-secbtn', bar); sb.title = T('Secciones de este bloque', 'Sections of this block'); sb.setAttribute('aria-label', sb.title);
    $('.lnav-secbtn-t', bar).textContent = T('Secciones', 'Sections');
    const tp = $('.lnav-top', floatBox); tp.title = T('Volver arriba', 'Back to top'); tp.setAttribute('aria-label', tp.title);
    const ls = $('[data-lnav="last"]', floatBox); ls.title = T('Volver a lo último que editaste', 'Back to what you edited last');
    $('span', ls).textContent = T('Último cambio', 'Last change');
    pager.setAttribute('aria-label', T('Secciones', 'Sections'));
    paintMode(); paintRail(); paintFold();
  }

  /* flechas, Inicio y Fin dentro de una lista de botones (un solo punto de tabulación) */
  function roving(e, sel, dir) {
    const list = $$(sel, e.currentTarget);
    const i = list.indexOf(document.activeElement);
    if (i < 0) return;
    const next = dir === 'vertical' ? 'ArrowDown' : 'ArrowRight', prev = dir === 'vertical' ? 'ArrowUp' : 'ArrowLeft';
    let j = -1;
    if (e.key === next) j = Math.min(list.length - 1, i + 1);
    else if (e.key === prev) j = Math.max(0, i - 1);
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = list.length - 1;
    if (j < 0) return;
    e.preventDefault();
    list.forEach((b, k) => { b.tabIndex = k === j ? 0 : -1; });
    list[j].focus();
  }

  /* ---------------- pintar ---------------- */
  function paintSide() {
    const list = steps();
    if (side) {
      const ol = $('.lnav-list', side);
      const html = list.map(s => {
        const st = s.disabled ? 'lock' : s.done ? 'done' : s.warn ? 'warn' : '';
        const icon = s.disabled ? ico('lock', 'lnav-st') : s.warn ? ico('triangle-alert', 'lnav-st') : '';
        const tip = s.label + (s.disabled ? T(' — bloqueado: primero completa un paso anterior', ' — locked: finish an earlier step first') : s.done ? T(' — terminado', ' — done') : s.warn ? T(' — revisar', ' — check') : '');
        return '<li><button type="button" tabindex="' + (s.active ? '0' : '-1') + '" class="lnav-item' + (s.active ? ' on' : '') + (st ? ' is-' + st : '') + '" data-n="' + esc(s.n) + '"' +
          (s.active ? ' aria-current="step"' : '') + (s.disabled ? ' aria-disabled="true"' : '') + ' title="' + esc(tip) + '">' +
          '<span class="lnav-num">' + (s.done && !s.active ? ico('check') : esc(s.num || '·')) + '</span>' +
          '<span class="lnav-lab">' + esc(s.label) + '</span>' + icon + '</button></li>';
      }).join('');
      if (ol.innerHTML !== html) {
        const had = side.contains(document.activeElement) && document.activeElement.dataset ? document.activeElement.dataset.n : null;
        ol.innerHTML = html;
        if (had != null) { const b = ol.querySelector('[data-n="' + had + '"]'); if (b) b.focus(); }
      }
      const done = list.filter(s => s.done).length;
      $('.lnav-side-count', side).textContent = done ? done + '/' + list.length : '';
      $('.lnav-side-count', side).title = T(done + ' de ' + list.length + ' bloques terminados', done + ' of ' + list.length + ' blocks done');
    }
    if (tabs) {
      const html = list.map(s => '<button type="button" tabindex="' + (s.active ? '0' : '-1') + '" class="lnav-tab' + (s.active ? ' on' : '') + (s.done ? ' is-done' : '') + (s.disabled ? ' is-lock' : '') + '" data-n="' + esc(s.n) + '"' +
        (s.active ? ' aria-current="step"' : '') + (s.disabled ? ' aria-disabled="true"' : '') + ' title="' + esc(s.label) + '">' +
        '<span class="lnav-num">' + (s.done && !s.active ? ico('check') : esc(s.num || '·')) + '</span><span class="lnav-lab">' + esc(s.label) + '</span></button>').join('');
      if (tabs.innerHTML !== html) {
        tabs.innerHTML = html;
        const on = $('.lnav-tab.on', tabs);
        if (on) tabs.scrollLeft = Math.max(0, on.offsetLeft - (tabs.clientWidth - on.offsetWidth) / 2);
      }
    }
  }

  function paintCrumbs() {
    const s = steps().find(x => x.n === S.block) || steps().find(x => x.active);
    const sec = S.secs[S.cur];
    const parts = ['<li class="lnav-c-app"><span>' + esc(APP_NAME) + '</span></li>'];
    if (s) parts.push('<li class="lnav-c-block">' + ico('chevron-right', 'lnav-sep') + '<span class="lnav-blocktitle">' + (s.num && /\d/.test(s.num) ? '<em>' + esc(s.num) + '</em> ' : '') + esc(s.label) + '</span></li>');
    const tb = hasTabs() ? curTab() : null;
    if (tb) parts.push('<li class="lnav-c-tab">' + ico('chevron-right', 'lnav-sep') + '<span>' + esc(tb.label) + '</span></li>');
    /* la sección (si no se llama igual que la pestaña) */
    if (sec && S.secs.length > 1 && !(tb && fold(sec.title) === fold(tb.label))) parts.push('<li class="lnav-c-sec" aria-current="location">' + ico('chevron-right', 'lnav-sep') + '<span>' + esc(sec.title) + '</span></li>');
    const html = parts.join('');
    if (crumbs.innerHTML !== html) crumbs.innerHTML = html;
  }

  function paintToc() {
    const secsOk = S.secs.length >= CFG.minSections && CFG.noToc.indexOf(String(S.block)) < 0;
    const many = tocWorthy();
    const folded = S.folded[S.block] || [];
    const secLi = (s, i) => {
      const st = stateOf(s);
      const figs = figsIn(s).length;
      const f = folded.indexOf(s.id) >= 0;
      return '<li class="lnav-ti' + (hasTabs() ? ' lnav-sub' : '') + (i === S.cur ? ' on' : '') + (st ? ' is-' + st : '') + (f ? ' is-folded' : '') + '" data-i="' + i + '">' +
        '<button type="button" class="lnav-tlink" data-act="go"' + (i === S.cur ? ' aria-current="location"' : '') + '><span class="lnav-dot" aria-hidden="true"></span><span class="lnav-tt">' + esc(s.title) + '</span>' +
        (st === 'pending' ? '<span class="sr-only">' + esc(T(' (espera un paso anterior)', ' (waits for an earlier step)')) + '</span>' : '') + '</button>' +
        (figs ? '<button type="button" class="lnav-tbtn" data-act="studio" title="' + esc(T('Abrir en el estudio de figuras', 'Open in the figure studio')) + '" aria-label="' + esc(T('Abrir en el estudio de figuras: ', 'Open in the figure studio: ') + s.title) + '">' + ico('pencil-ruler') + '</button>' : '') +
        '<button type="button" class="lnav-tbtn lnav-tfold" data-act="fold" aria-expanded="' + (!f) + '" title="' + esc(f ? T('Expandir esta sección', 'Expand this section') : T('Contraer esta sección', 'Collapse this section')) + '" aria-label="' + esc((f ? T('Expandir: ', 'Expand: ') : T('Contraer: ', 'Collapse: ')) + s.title) + '">' + ico('chevron-down') + '</button></li>';
    };
    /* con pestañas: cada una en el índice y, debajo de la abierta, sus secciones */
    const tabLi = tb => '<li class="lnav-ti lnav-tab-i' + (tb.on ? ' is-open' : '') + '" data-tab="' + esc(tb.id) + '">' +
      '<button type="button" class="lnav-tlink" data-act="tab"' + (tb.on ? ' aria-current="true"' : '') + ' title="' + esc(tb.on ? T('Pestaña abierta: ', 'Open tab: ') + tb.label : T('Abrir la pestaña ', 'Open the tab ') + tb.label) + '">' +
      ico('panel-top', 'lnav-tab-ico') + '<span class="lnav-tt">' + esc(tb.label) + '</span></button></li>' +
      (tb.on && secsOk ? S.secs.map(secLi).join('') : '');
    const html = !many ? '' : hasTabs() ? S.tabs.map(tabLi).join('') : S.secs.map(secLi).join('');
    if (tocList.innerHTML !== html) tocList.innerHTML = html;
    const cnt = $('.lnav-toc-count', toc);
    cnt.textContent = many ? String(hasTabs() ? S.tabs.length : S.secs.length) : '';
    cnt.title = !many ? '' : hasTabs() ? T(S.tabs.length + ' pestañas', S.tabs.length + ' tabs') : T(S.secs.length + ' secciones', S.secs.length + ' sections');
    document.documentElement.classList.toggle('lnav-has-secs', many);
    /* fichas del modo enfocado y menú de secciones (pantallas angostas) */
    const ch = secsOk ? S.secs.map((s, i) => '<button type="button" role="tab" class="lnav-chip' + (i === S.cur ? ' on' : '') + (stateOf(s) === 'pending' ? ' is-pending' : '') + '" data-i="' + i + '" aria-selected="' + (i === S.cur) + '"><b>' + (i + 1) + '</b>' + esc(s.title.replace(/^\d+(?:[.,]\d+)*[a-z]?\s*[·.:\-–]\s*/i, '')) + '</button>').join('') : '';
    if (chips.innerHTML !== ch) chips.innerHTML = ch;
    chips.setAttribute('aria-label', T('Secciones del bloque', 'Sections of the block'));
    const menu = $('.lnav-secmenu', bar);
    const mSec = (s, i) => '<li' + (hasTabs() ? ' class="lnav-sub"' : '') + '><button type="button" data-i="' + i + '"' + (i === S.cur ? ' aria-current="location"' : '') + '><span class="lnav-dot is-' + (stateOf(s) || 'none') + '"></span>' + esc(s.title) + '</button></li>';
    const mTab = tb => '<li class="lnav-tab-i' + (tb.on ? ' is-open' : '') + '"><button type="button" data-tab="' + esc(tb.id) + '"' + (tb.on ? ' aria-current="true"' : '') + '>' + ico('panel-top', 'lnav-tab-ico') + esc(tb.label) + '</button></li>' +
      (tb.on && secsOk ? S.secs.map(mSec).join('') : '');
    menu.innerHTML = many ? '<ol>' + (hasTabs() ? S.tabs.map(mTab).join('') : S.secs.map(mSec).join('')) + '</ol>' : '';
    const sb = $('.lnav-secbtn', bar);
    sb.hidden = !many;
    $('.lnav-secbtn-t', bar).textContent = hasTabs() ? T('Pestañas', 'Tabs') : T('Secciones', 'Sections');
    sb.title = hasTabs() ? T('Pestañas y secciones de este bloque', 'Tabs and sections of this block') : T('Secciones de este bloque', 'Sections of this block');
    sb.setAttribute('aria-label', sb.title);
    paintFold();
  }

  function paintActive() {
    $$('.lnav-ti[data-i]', tocList).forEach(li => {
      const on = +li.dataset.i === S.cur;
      li.classList.toggle('on', on);
      const a = li.querySelector('.lnav-tlink');
      if (on) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
    });
    $$('.lnav-chip', chips).forEach((c, i) => { c.classList.toggle('on', i === S.cur); c.setAttribute('aria-selected', String(i === S.cur)); });
    const on = $('.lnav-ti.on', tocList) || $('.lnav-tab-i.is-open', tocList);
    if (on && toc.scrollHeight > toc.clientHeight) {
      const r = on.getBoundingClientRect(), tr = toc.getBoundingClientRect();
      if (r.top < tr.top + 40 || r.bottom > tr.bottom - 10) toc.scrollTop += r.top - tr.top - tr.height / 3;
    }
    const oc = $('.lnav-chip.on', chips);
    if (oc && !chips.hidden) chips.scrollLeft = Math.max(0, oc.offsetLeft - (chips.clientWidth - oc.offsetWidth) / 2);
    paintCrumbs();
    paintPager();
  }

  function paintMode() {
    const f = S.mode === 'focus';
    document.documentElement.classList.toggle('lnav-focus', f);
    const seg = $$('.lnav-seg button', bar);
    seg[0].setAttribute('aria-pressed', String(!f)); seg[1].setAttribute('aria-pressed', String(f));
    if (side) {
      const b = $('[data-lnav="mode"]', side);
      b.innerHTML = ico(f ? 'file-text' : 'focus') + '<span class="lnav-sbtn-t">' + esc(f ? T('Modo documento', 'Document mode') : T('Modo enfocado', 'Focused mode')) + '</span>';
      b.title = f ? T('Ver todas las secciones del bloque', 'Show every section of the block') : T('Ver una sección a la vez', 'Show one section at a time');
    }
    chips.hidden = !f || S.secs.length < CFG.minSections;
  }

  function paintRail() {
    if (!side) return;
    const rail = isRail();
    document.documentElement.classList.toggle('lnav-rail', rail);
    const b = $('.lnav-rail-btn', side);
    b.innerHTML = ico(rail ? 'panel-left-open' : 'panel-left-close');
    const t = rail ? T('Mostrar los nombres de los bloques ( [ )', 'Show block names ( [ )') : T('Contraer la barra de bloques ( [ )', 'Collapse the block bar ( [ )');
    b.title = t; b.setAttribute('aria-label', t); b.setAttribute('aria-expanded', String(!rail));
    /* el nombre de cada botón es lo que se ve en él: su texto y, si la tecla lleva letras («Ctrl K»), también la tecla (WCAG 2.5.3) */
    $$('.lnav-sbtn', side).forEach(x => {
      const s = x.querySelector('.lnav-sbtn-t'), k = x.querySelector('kbd');
      if (s) x.setAttribute('aria-label', s.textContent + (k && /[a-z]/i.test(k.textContent) ? ' ' + k.textContent : ''));
    });
  }
  const isRail = () => (S.rail == null ? window.innerWidth < 1280 : !!S.rail);

  function paintFold() {
    const b = $('[data-lnav="foldall"]', bar);
    if (!b) return;
    const fl = S.folded[S.block] || [];
    const all = S.secs.length && S.secs.every(s => fl.indexOf(s.id) >= 0);
    b.innerHTML = ico(all ? 'chevrons-up-down' : 'chevrons-down-up');
    const t = all ? T('Expandir todas las secciones', 'Expand every section') : T('Contraer todas las secciones', 'Collapse every section');
    b.title = t; b.setAttribute('aria-label', t);
    b.hidden = S.secs.length < CFG.minSections || S.mode === 'focus';
  }

  function paintPager() {
    const f = S.mode === 'focus' && S.secs.length >= CFG.minSections;
    pager.hidden = !f;
    if (!f) return;
    const prev = S.secs[S.cur - 1], next = S.secs[S.cur + 1];
    const [bp, bn] = $$('button', pager);
    $('span', bp).textContent = T('Anterior', 'Previous');
    $('span', bn).textContent = T('Siguiente', 'Next');
    bp.title = prev ? prev.title : T('Bloque anterior (Alt+←)', 'Previous block (Alt+←)');
    bn.title = next ? next.title : T('Bloque siguiente (Alt+→)', 'Next block (Alt+→)');
    $('b', pager).textContent = (S.cur + 1) + ' / ' + S.secs.length;
  }

  /* aviso «Ir al paso pendiente» cuando el bloque espera un paso anterior */
  function paintPending() {
    const p = activePanel();
    let target = null, msg = '';
    if (p) {
      const e = $$(CFG.empty, p).find(shown);
      if (e) {
        msg = textOf(e).slice(0, 140);
        const m = /(?:bloque|block|paso|step)\s*(\d+)/i.exec(msg);
        if (m && steps().some(s => s.n === m[1])) target = m[1];
        if (!target) target = pendingStep();
        const first = steps()[0];
        if (target === S.block || (first && target === first.n && !m)) target = null;
      }
    }
    pendingBtn.hidden = !target;
    if (target) {
      const s = steps().find(x => x.n === target);
      $('span', pendingBtn).textContent = T('Ir al paso pendiente', 'Go to the pending step');
      pendingBtn.dataset.n = target;
      pendingBtn.title = (msg ? msg + ' — ' : '') + T('Ir a ', 'Go to ') + (s ? s.label : target);
    }
  }
  /* el primer bloque anterior al activo que no está terminado (o el de datos) */
  function pendingStep(before) {
    const list = steps();
    const i = list.findIndex(s => s.n === (before || S.block));
    const prev = list.slice(0, Math.max(0, i)).filter(s => !s.disabled);
    const p = prev.find(s => !s.done && prev.indexOf(s) > 0) || prev.find(s => !s.done) || prev[1] || prev[0];
    return p ? p.n : null;
  }

  /* ---------------- secciones: aplicar modo y pliegues ---------------- */
  let mo = null;
  function applyLayout() {
    const p = activePanel();
    const f = S.mode === 'focus' && S.secs.length >= CFG.minSections;
    const folded = S.folded[S.block] || [];
    const all = new Set();
    S.secs.forEach(s => s.nodes.forEach(n => all.add(n)));
    $$('.lnav-out, .lnav-hid', p || document).forEach(n => {
      if (!all.has(n) && !(n.parentElement && all.has(n.parentElement))) { n.classList.remove('lnav-out', 'lnav-hid'); n.removeAttribute('inert'); }
    });
    S.secs.forEach((s, i) => {
      s.head.classList.add('lnav-sec-head');
      s.head.setAttribute('data-labg-section', s.id);
      (s.wrap || s.head).setAttribute('data-labg-section', s.id);
      const out = f && i !== S.cur;
      s.nodes.forEach(n => { n.classList.toggle('lnav-out', out); if (out) n.setAttribute('inert', ''); else n.removeAttribute('inert'); });
      /* plegada: queda solo el título (en el modo enfocado no se pliega) */
      const fd = !f && folded.indexOf(s.id) >= 0;
      const kids = s.wrap ? Array.from(s.wrap.children).filter(c => !c.contains(s.head)) : s.nodes.filter(n => n !== s.head);
      kids.forEach(n => n.classList.toggle('lnav-hid', fd));
      s.head.classList.toggle('lnav-folded-head', fd);
      if (s.wrap) s.wrap.classList.toggle('lnav-folded', fd);
    });
    if (p) p.setAttribute('data-labg-block', S.block);
    if (mo) mo.takeRecords();
  }

  /* ---------------- detectar y repintar el bloque activo ---------------- */
  let io = null, detectTimer = null;
  function refresh(keepCur) {
    const p = activePanel();
    const prevId = S.secs[S.cur] && S.secs[S.cur].id;
    S.tabs = detectTabs(p);
    /* otra pestaña: sus secciones empiezan desde la primera */
    const tk = S.block + '|' + (curTab() ? curTab().id : '');
    const tabMoved = S.tabKey != null && S.tabKey !== tk && String(S.tabKey).split('|')[0] === String(S.block);
    S.tabKey = tk;
    if (tabMoved) { keepCur = false; S.focusIdx[S.block] = 0; emit('tab', { block: S.block, tab: curTab() ? curTab().id : null }); }
    S.secs = detect(p);
    let i = keepCur && prevId ? S.secs.findIndex(s => s.id === prevId) : -1;
    if (S.mode === 'focus' && i < 0) i = Math.min(S.focusIdx[S.block] || 0, Math.max(0, S.secs.length - 1));
    S.cur = Math.max(0, i);
    applyLayout();
    paintToc();
    paintMode();
    layout();
    spyAll();
    spy();
    paintPending();
    paintSide();
    if (mo) { mo.disconnect(); }
    if (p && window.MutationObserver) {
      mo = mo || new MutationObserver(recs => {
        if (recs.every(r => r.target.closest && r.target.closest('.lnav-own'))) return;
        clearTimeout(detectTimer); detectTimer = setTimeout(() => refresh(true), 160);
      });
      mo.observe(p, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'hidden', 'open'] });
    }
    if (S.pendingSec) { const id = S.pendingSec; if (gotoSection(id, true)) S.pendingSec = null; }
    if (S.tabScroll && tabMoved) { S.tabScroll = false; scrollToTabs(); }
  }

  function onBlockChange(n) {
    const was = S.block;
    if (was != null && S.mode === 'focus') S.focusIdx[was] = S.cur;
    S.block = n;
    S.cur = 0;
    if (S.mode === 'focus' && S.enterFrom === 'end') S.focusIdx[n] = 999;
    S.enterFrom = null;
    refresh(false);
    paintSide();
    writeHash(was != null && was !== n);
    emit('block', { block: n });
  }

  /* ---------------- disposición según el ancho ---------------- */
  function layout() {
    const root = document.documentElement;
    const w = window.innerWidth;
    const mobile = w < 1024;
    root.classList.toggle('lnav-mobile', mobile);
    const hasToc = !mobile && w >= 1200 && S.mode === 'doc' && tocWorthy();
    root.classList.toggle('lnav-has-toc', hasToc);
    paintRail();
    measure();
  }
  function measure() {
    const root = document.documentElement;
    const tb = topbar && shown(topbar) ? Math.round(topbar.getBoundingClientRect().height) : 0;
    const pos = topbar ? getComputedStyle(topbar).position : '';
    root.style.setProperty('--lnav-top', (pos === 'sticky' || pos === 'fixed' ? tb : 0) + 'px');
    root.style.setProperty('--lnav-bar-h', (bar ? Math.round(bar.getBoundingClientRect().height) : 44) + 'px');
    const z = topbar ? parseInt(getComputedStyle(topbar).zIndex, 10) : NaN;
    root.style.setProperty('--lnav-z', String(isFinite(z) && z > 1 ? z - 1 : 49));
  }

  /* ---------------- lectura: sección activa y progreso ---------------- */
  function spyAll() {
    if (io) io.disconnect();
    if (!('IntersectionObserver' in window) || !S.secs.length) return;
    const top = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--lnav-top'), 10) || 0;
    io = new IntersectionObserver(() => raf(spy), { rootMargin: '-' + (top + 60) + 'px 0px -45% 0px', threshold: [0, 1] });
    S.secs.forEach(s => io.observe(s.head));
  }
  let spyQueued = false;
  function spy() {
    spyQueued = false;
    if (!S.secs.length) { paintActive(); progressBar(); return; }
    if (S.mode === 'doc') {
      const line = (parseInt(getComputedStyle(document.documentElement).getPropertyValue('--lnav-top'), 10) || 0) + (bar ? bar.offsetHeight : 44) + 24;
      let k = 0;
      for (let i = 0; i < S.secs.length; i++) {
        const r = S.secs[i].head.getBoundingClientRect();
        if (r.top - line <= 0) k = i; else break;
      }
      /* al final de la página, la última sección */
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) k = S.secs.length - 1;
      if (k !== S.cur) { S.cur = k; paintActive(); hashSection(); emit('section', { block: S.block, section: S.secs[k].id }); }
      else paintCrumbs();
    }
    progressBar();
  }
  /* los botones flotantes suben por encima del pie del bloque (Anterior / Siguiente)
     cuando éste entra en pantalla, en vez de taparlo */
  function dodgeFloats() {
    if (!floatBox) return;
    const vh = window.innerHeight;
    let up = 0;
    $$('.step-footer, .next-bar').forEach(f => {
      if (!f.offsetParent || f.hidden) return;
      const r = f.getBoundingClientRect();
      if (r.bottom <= 0 || r.top >= vh) return;
      const bottom = parseFloat(getComputedStyle(floatBox).bottom) || 0;
      up = Math.max(up, Math.min(vh * 0.5, (vh - bottom) - (r.top - 10)));
    });
    floatBox.style.transform = up > 0 ? 'translateY(' + (-Math.round(up)) + 'px)' : '';
  }
  function progressBar() {
    dodgeFloats();
    const p = activePanel();
    if (!p || !progress) return;
    const r = p.getBoundingClientRect();
    const total = Math.max(1, r.height - window.innerHeight * 0.6);
    const v = Math.max(0, Math.min(1, (-r.top + (bar ? bar.offsetHeight : 0)) / total));
    progress.style.transform = 'scaleX(' + v.toFixed(4) + ')';
    floatBox.querySelector('.lnav-top').hidden = window.scrollY < 600;
  }
  /* el navegador del sistema puede restaurar el desplazamiento antes del arranque: sin la barra, no hay nada que pintar */
  window.addEventListener('scroll', () => { if (S.on && !spyQueued) { spyQueued = true; raf(spy); } }, { passive: true });

  /* ---------------- moverse ---------------- */
  function goBlock(n, opts) {
    const s = steps().find(x => x.n === String(n));
    if (!s) return false;
    if (s.disabled) {
      const p = pendingStep(s.n);
      const ps = steps().find(x => x.n === p);
      toast(T('«' + s.label + '» se abre cuando terminas un paso anterior.', '“' + s.label + '” opens once an earlier step is done.'),
        ps ? { label: T('Ir a «' + ps.label + '»', 'Go to “' + ps.label + '”'), run: () => goBlock(ps.n) } : null);
      return false;
    }
    if (s.active) { if (opts && opts.section) gotoSection(opts.section); return true; }
    S.pendingSec = opts && opts.section ? opts.section : null;
    s.btn.click();
    return true;
  }
  function gotoSection(id, quiet) {
    const i = S.secs.findIndex(s => s.id === id || String(s.i) === String(id));
    if (i < 0) return false;
    showSection(i, quiet);
    return true;
  }
  function showSection(i, quiet) {
    if (!S.secs[i]) return;
    const sec = S.secs[i];
    /* si estaba plegada, se abre */
    const fl = S.folded[S.block] || [];
    if (fl.indexOf(sec.id) >= 0) { S.folded[S.block] = fl.filter(x => x !== sec.id); save('fold', S.folded); }
    S.cur = i;
    if (S.mode === 'focus') S.focusIdx[S.block] = i;
    applyLayout();
    paintToc(); paintActive();
    const target = S.mode === 'focus' ? (activePanel() || sec.head) : sec.head;
    if (S.mode === 'focus') window.scrollTo({ top: Math.max(0, window.scrollY + sec.head.getBoundingClientRect().top - (parseInt(getComputedStyle(document.documentElement).getPropertyValue('--lnav-top'), 10) || 0) - (bar ? bar.offsetHeight : 44) - 16), behavior: reduced() ? 'auto' : 'smooth' });
    else sec.head.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' });
    if (!quiet) { try { sec.head.setAttribute('tabindex', '-1'); sec.head.focus({ preventScroll: true }); } catch (e) { /* nada */ } }
    hashSection(true);
    void target;
    emit('section', { block: S.block, section: sec.id });
  }
  function step(d) {
    if (!S.secs.length) return false;
    const i = S.cur + d;
    if (i < 0 || i >= S.secs.length) return false;
    showSection(i);
    return true;
  }
  function toTop() {
    const p = activePanel();
    const y = p ? Math.max(0, window.scrollY + p.getBoundingClientRect().top - 140) : 0;
    window.scrollTo({ top: window.scrollY < y + 10 ? 0 : y, behavior: reduced() ? 'auto' : 'smooth' });
  }

  /* lo último que se editó */
  document.addEventListener('change', onEdit, true);
  document.addEventListener('input', onEdit, true);
  function onEdit(e) {
    const t = e.target;
    if (!t || !t.closest || t.closest('.lnav-own, .lfs-studio, dialog')) return;
    if (!/^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName)) return;
    S.last = { el: t, block: S.block, at: Date.now() };
    const b = $('[data-lnav="last"]', floatBox);
    if (b) b.hidden = false;
  }
  function goLast() {
    const L = S.last;
    if (!L || !L.el.isConnected) { $('[data-lnav="last"]', floatBox).hidden = true; return; }
    const go = () => {
      const sec = S.secs.findIndex(s => s.nodes.some(n => n.contains(L.el)));
      if (sec >= 0 && (S.mode === 'focus' || (S.folded[S.block] || []).indexOf(S.secs[sec].id) >= 0)) showSection(sec, true);
      L.el.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' });
      try { L.el.focus({ preventScroll: true }); } catch (e) { /* nada */ }
      pulse(L.el.closest('label, .inline-label, .field, .row') || L.el);
    };
    if (L.block !== S.block) { goBlock(L.block); setTimeout(go, 350); } else go();
  }
  function pulse(el) {
    el.classList.remove('lnav-pulse'); void el.offsetWidth; el.classList.add('lnav-pulse');
    setTimeout(() => el.classList.remove('lnav-pulse'), 1600);
  }

  /* ---------------- plegar ---------------- */
  function toggleFold(i) {
    const s = S.secs[i]; if (!s) return;
    const fl = (S.folded[S.block] || []).slice();
    const k = fl.indexOf(s.id);
    if (k >= 0) fl.splice(k, 1); else fl.push(s.id);
    S.folded[S.block] = fl; save('fold', S.folded);
    applyLayout(); paintToc(); paintActive();
    announce(k >= 0 ? T('Sección expandida: ', 'Section expanded: ') + s.title : T('Sección contraída: ', 'Section collapsed: ') + s.title);
  }
  function foldAll() {
    /* solo las secciones a la vista (con pestañas, las de las otras se quedan como estaban) */
    const ids = S.secs.map(s => s.id);
    const fl = (S.folded[S.block] || []).filter(id => ids.indexOf(id) < 0);
    const all = ids.length && ids.every(id => (S.folded[S.block] || []).indexOf(id) >= 0);
    S.folded[S.block] = all ? fl : fl.concat(ids);
    save('fold', S.folded);
    applyLayout(); paintToc(); paintActive();
    announce(all ? T('Todas las secciones expandidas', 'Every section expanded') : T('Todas las secciones contraídas', 'Every section collapsed'));
  }
  /* un título plegado se abre con un clic */
  document.addEventListener('click', e => {
    const h = e.target.closest && e.target.closest('.lnav-folded-head');
    if (!h || e.target.closest('a, button, input, select, textarea, summary')) return;
    const i = S.secs.findIndex(s => s.head === h);
    if (i >= 0) toggleFold(i);
  });

  /* ---------------- modo ---------------- */
  function setMode(m) {
    if (m !== 'doc' && m !== 'focus') return;
    if (S.mode === m) return;
    S.mode = m; save('mode', m);
    if (m === 'focus') S.focusIdx[S.block] = S.cur;
    applyLayout(); paintMode(); paintToc(); paintActive(); layout();
    if (m === 'focus') showSection(S.cur, true);
    else if (S.secs[S.cur]) S.secs[S.cur].head.scrollIntoView({ block: 'start' });
    announce(m === 'focus' ? T('Modo enfocado: una sección a la vez', 'Focused mode: one section at a time') : T('Modo documento: todas las secciones', 'Document mode: every section'));
    emit('mode', { mode: m });
  }

  /* ---------------- clics en la interfaz ---------------- */
  function onSideClick(e) {
    const it = e.target.closest('.lnav-item');
    if (it) { goBlock(it.dataset.n); return; }
    const b = e.target.closest('[data-lnav]');
    if (!b) return;
    const a = b.dataset.lnav;
    if (a === 'rail') { S.rail = !isRail(); save('rail', S.rail); paintRail(); measure(); }
    else if (a === 'palette') openPalette();
    else if (a === 'mode') setMode(S.mode === 'focus' ? 'doc' : 'focus');
    else if (a === 'help') help();
  }
  function onBarClick(e) {
    const chip = e.target.closest('.lnav-chip');
    if (chip) { showSection(+chip.dataset.i); return; }
    const mi = e.target.closest('.lnav-secmenu [data-i]');
    if (mi) { closeSecMenu(); showSection(+mi.dataset.i); return; }
    const mt = e.target.closest('.lnav-secmenu [data-tab]');
    if (mt) { closeSecMenu(); goTab(S.block, mt.dataset.tab); return; }
    const b = e.target.closest('[data-lnav]');
    if (!b) return;
    const a = b.dataset.lnav;
    if (a === 'doc' || a === 'focus') setMode(a);
    else if (a === 'foldall') foldAll();
    else if (a === 'palette') openPalette();
    else if (a === 'pending') goBlock(b.dataset.n);
    else if (a === 'sections') toggleSecMenu();
  }
  function toggleSecMenu() {
    const m = $('.lnav-secmenu', bar), b = $('.lnav-secbtn', bar);
    const open = m.hidden;
    m.hidden = !open; b.setAttribute('aria-expanded', String(open));
    if (open) { const f = m.querySelector('[aria-current]') || m.querySelector('button'); if (f) f.focus(); }
  }
  function closeSecMenu() { const m = $('.lnav-secmenu', bar); if (m && !m.hidden) { m.hidden = true; $('.lnav-secbtn', bar).setAttribute('aria-expanded', 'false'); } }
  document.addEventListener('click', e => { if (bar && !e.target.closest('.lnav-secmenu, .lnav-secbtn')) closeSecMenu(); });
  function onTocClick(e) {
    const li = e.target.closest('.lnav-ti');
    if (!li) return;
    if (li.dataset.tab != null) { goTab(S.block, li.dataset.tab); return; }
    const i = +li.dataset.i;
    const act = e.target.closest('[data-act]');
    const a = act ? act.dataset.act : 'go';
    if (a === 'fold') toggleFold(i);
    else if (a === 'studio') { const f = figsIn(S.secs[i])[0]; if (f && window.LABGFigureStudio) window.LABGFigureStudio.open(f.el); }
    else showSection(i);
  }

  /* ---------------- enlaces directos #bN/seccion ---------------- */
  const hashFor = (n, sec) => '#b' + n + (sec ? '/' + sec : '');
  function parseHash(h) {
    const m = /^#b([0-9a-z]+)(?:\/([\w-]+))?$/i.exec(h || '');
    return m ? { n: m[1], sec: m[2] || null } : null;
  }
  function writeHash(push) {
    if (!CFG.hash || S.fromPop) return;
    const h = hashFor(S.block, null);
    try {
      if (push) {
        /* si la app ya reescribió la dirección del bloque nuevo, se devuelve la entrada anterior y se agrega una nueva */
        if (S.lastHash && location.hash !== S.lastHash) history.replaceState(history.state, '', S.lastHash);
        history.pushState({ lnav: 1 }, '', h);
      } else if (location.hash !== h && !parseHash(location.hash)) history.replaceState(history.state, '', h);
      S.lastHash = location.hash;
    } catch (e) { /* algunos visores no dejan cambiar la dirección */ }
  }
  let hashTimer = null;
  function hashSection(now) {
    if (!CFG.hash) return;
    clearTimeout(hashTimer);
    hashTimer = setTimeout(() => {
      const sec = S.secs[S.cur];
      const h = hashFor(S.block, sec && S.secs.length > 1 && S.cur > 0 ? sec.id : null);
      try { if (location.hash !== h) history.replaceState(history.state, '', h); S.lastHash = h; } catch (e) { /* nada */ }
    }, now ? 0 : 400);
  }
  window.addEventListener('popstate', () => {
    if (!CFG.hash) return;
    const h = parseHash(location.hash);
    if (!h) return;
    S.fromPop = true;
    const target = location.hash;
    if (h.n !== S.block) goBlock(h.n, { section: h.sec });
    else if (h.sec) gotoSection(h.sec);
    setTimeout(() => { S.fromPop = false; try { if (location.hash !== target) history.replaceState(history.state, '', target); } catch (e) { /* nada */ } S.lastHash = target; }, 60);
  });

  /* ---------------- paleta de comandos (Ctrl+K) ---------------- */
  let palItems = [], palSel = 0;
  function buildPalette() {
    pal = mk('dialog', 'lnav-pal lnav-own');
    pal.innerHTML = '<div class="lnav-pal-box"><div class="lnav-pal-in">' + ico('search') +
      '<input type="text" role="combobox" aria-expanded="true" aria-autocomplete="list" aria-controls="lnavPalList" autocomplete="off" spellcheck="false">' +
      '<kbd>Esc</kbd></div><ul class="lnav-pal-list" id="lnavPalList" role="listbox"></ul><div class="lnav-pal-foot"></div></div>';
    document.body.appendChild(pal);
    const inp = $('input', pal);
    inp.addEventListener('input', () => { palSel = 0; renderPalette(); });
    inp.addEventListener('keydown', e => {
      const opts = $$('[role="option"]', pal);
      if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) { e.preventDefault(); palSel = (palSel + 1) % Math.max(1, opts.length); markSel(); }
      else if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) { e.preventDefault(); palSel = (palSel - 1 + opts.length) % Math.max(1, opts.length); markSel(); }
      else if (e.key === 'Enter') { e.preventDefault(); const o = opts[palSel]; if (o) runItem(o.dataset.k); }
      else if (e.key === 'Home' && e.ctrlKey) { palSel = 0; markSel(); }
    });
    pal.addEventListener('click', e => {
      if (e.target === pal) { pal.close(); return; }
      const o = e.target.closest('[role="option"]'); if (o) runItem(o.dataset.k);
    });
    pal.addEventListener('mousemove', e => { const o = e.target.closest('[role="option"]'); if (o) { const i = $$('[role="option"]', pal).indexOf(o); if (i !== palSel) { palSel = i; markSel(true); } } });
    pal.addEventListener('close', () => { if (S.palReturn && S.palReturn.isConnected) try { S.palReturn.focus(); } catch (e) { /* nada */ } });
  }
  function indexItems() {
    const items = [];
    const add = (o) => { o.k = o.g + ':' + (o.id || o.label); items.push(o); };
    steps().forEach(s => add({ g: 'block', id: s.n, num: s.num && /\d/.test(s.num) ? s.num : '', label: s.label, hint: s.disabled ? T('bloqueado', 'locked') : s.done ? T('terminado', 'done') : '', icon: s.disabled ? 'lock' : 'chevron-right', run: () => goBlock(s.n) }));
    /* pestañas: las de todos los bloques si la app las da; si no, las del bloque activo */
    if (CFG.tabs) {
      steps().forEach(s => {
        const list = String(s.n) === String(S.block) && S.tabs.length ? S.tabs : (tabsOf(s.n) || []);
        if (list.length < 2) return;
        list.forEach(tb => add({ g: 'tab', id: s.n + '/' + tb.id, label: tb.label, hint: s.label + (String(s.n) === String(S.block) && tb.on ? T(' · abierta', ' · open') : ''), icon: 'panel-top', run: () => goTab(s.n, tb.id) }));
      });
    }
    /* secciones y controles de todos los bloques (un panel que comparten varios bloques, una sola vez: el del activo) */
    const seenP = new Set();
    const order = steps().slice().sort((a, b) => (String(b.n) === String(S.block)) - (String(a.n) === String(S.block)));
    order.forEach(s => {
      const p = panelOf(s.n);
      if (!p || seenP.has(p)) return;
      seenP.add(p);
      const seen = {};
      $$('h2, h3, .section-title', p).forEach(h => {
        if (h.closest('.lnav-own, dialog, .fig-editor, .fe-panel, .fs-panel, svg') || h.matches(CFG.blockHead) || h.closest(CFG.blockHead)) return;
        const t = textOf(h).replace(/\s*ⓘ\s*$/, '');
        if (!t || t.length > 120 || seen[t]) return; seen[t] = 1;
        add({ g: 'section', id: s.n + '/' + slug(t) + '/' + items.length, label: t, hint: s.label, icon: 'list', run: () => goToNode(s.n, h) });
      });
      const seenC = {};
      $$('select, input:not([type="hidden"]):not([type="file"]), textarea, button', p).forEach(c => {
        if (c.closest('.lnav-own, dialog, .fe-panel, .fs-panel, .fig-ed, .fig-dl, .lfs-open, .step-footer, .next-bar') || c.matches('.step-btn')) return;
        if (CFG.tabs && c.getAttribute('role') === 'tab') return;   /* las pestañas ya van en su grupo */
        const t = labelOf(c);
        if (!t || t.length < 2 || t.length > 90 || seenC[t]) return; seenC[t] = 1;
        add({ g: 'control', id: s.n + '/' + t, label: t, hint: s.label, icon: c.tagName === 'BUTTON' ? 'zap' : 'pencil-line', run: () => goToNode(s.n, c, true) });
      });
    });
    const F = window.LABGFigureStudio;
    if (F && F.figures) {
      try { F.figures().forEach((f, i) => add({ g: 'figure', id: 'f' + i + ':' + f.key, label: f.title || T('Figura ', 'Figure ') + (i + 1), hint: T('abrir en el estudio', 'open in the studio'), icon: 'pencil-ruler', run: () => F.open(f.el) })); } catch (e) { /* nada */ }
    }
    const A = (id, label, icon, run, hint) => add({ g: 'action', id, label, icon, run, hint });
    A('mode', S.mode === 'focus' ? T('Cambiar al modo documento', 'Switch to document mode') : T('Cambiar al modo enfocado (una sección a la vez)', 'Switch to focused mode (one section at a time)'), S.mode === 'focus' ? 'file-text' : 'focus', () => setMode(S.mode === 'focus' ? 'doc' : 'focus'));
    if (S.secs.length >= CFG.minSections) A('fold', T('Contraer o expandir todas las secciones', 'Collapse or expand every section'), 'chevrons-down-up', foldAll);
    if (side) A('rail', T('Contraer o mostrar la barra de bloques', 'Collapse or show the block bar'), 'panel-left-close', () => { S.rail = !isRail(); save('rail', S.rail); paintRail(); measure(); }, '[');
    A('top', T('Volver arriba', 'Back to top'), 'arrow-up', toTop);
    if (S.last) A('last', T('Volver a lo último que editaste', 'Back to what you edited last'), 'pencil-line', goLast);
    if (window.LABG && LABG.theme && LABG.theme.toggle) A('theme', T('Cambiar entre tema claro y oscuro', 'Switch between light and dark theme'), 'sun', () => LABG.theme.toggle());
    const other = lang() === 'en' ? 'es' : 'en';
    const lb = $$('[data-lang="' + other + '"], #lang' + other.toUpperCase() + ', .lang-' + other).find(x => x.tagName === 'BUTTON' || x.tagName === 'A');
    if (lb) A('lang', other === 'en' ? 'Cambiar el idioma a inglés (English)' : 'Switch the language to Spanish (Español)', 'languages', () => lb.click());
    if (window.LABG && LABG.showShortcuts) A('keys', T('Atajos de teclado y ayuda de esta sección', 'Keyboard shortcuts and help for this section'), 'keyboard', help, '?');
    if (typeof CFG.tabLink === 'function' && hasTabs() && curTab()) A('tablink', T('Copiar el enlace a esta pestaña', 'Copy the link to this tab'), 'link', copyTabLink);
    else if (CFG.hash) A('link', T('Copiar el enlace a esta sección', 'Copy the link to this section'), 'link', copyLink);
    if (window.LABG && LABG.reportUrl) A('report', T('Reportar un problema', 'Report a problem'), 'message-circle-warning', () => window.open(LABG.reportUrl(), '_blank', 'noopener'));
    if (window.LABG && LABG.SUITE_URL) A('suite', T('Ir a la LABG Suite', 'Go to the LABG Suite'), 'house', () => { location.href = LABG.SUITE_URL; });
    return items;
  }
  /* la etiqueta legible de un control */
  function labelOf(c) {
    let t = '';
    if (c.id) { const l = document.querySelector('label[for="' + (window.CSS && CSS.escape ? CSS.escape(c.id) : c.id) + '"]'); if (l) t = textOf(l); }
    if (!t) { const l = c.closest('label'); if (l) t = textOf(l); }
    if (!t) t = c.getAttribute('aria-label') || c.title || '';
    if (!t && c.tagName === 'BUTTON') t = textOf(c);
    if (!t && c.placeholder) t = c.placeholder;
    return t.replace(/[▾▸⬇⤓↻→←✓✕⚙✎]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function goToNode(n, node, focus) {
    const go = () => {
      const i = S.secs.findIndex(s => s.nodes.some(x => x.contains(node)));
      if (i >= 0 && (S.mode === 'focus' || (S.folded[S.block] || []).indexOf(S.secs[i].id) >= 0)) showSection(i, true);
      const d = node.closest('details:not([open])'); if (d) d.open = true;
      if (shown(node)) {
        node.scrollIntoView({ block: focus ? 'center' : 'start', behavior: reduced() ? 'auto' : 'smooth' });
        if (focus) { try { node.focus({ preventScroll: true }); } catch (e) { /* nada */ } }
        else { try { node.setAttribute('tabindex', '-1'); node.focus({ preventScroll: true }); } catch (e) { /* nada */ } }
        pulse(focus ? (node.closest('label, .inline-label') || node) : node);
      }
    };
    if (n !== S.block) { if (goBlock(n)) setTimeout(go, 420); } else go();
  }
  /* parecido difuso: todas las palabras deben aparecer, en orden o como subsecuencia */
  function score(q, text) {
    const t = fold(text);
    let total = 0;
    for (const w of q.split(/\s+/).filter(Boolean)) {
      const i = t.indexOf(w);
      if (i >= 0) { total += 60 - Math.min(40, i) + (i === 0 || /[\s·\-_/(]/.test(t[i - 1]) ? 25 : 0) + w.length * 2; continue; }
      let ti = 0, s = 0, run = 0, first = -1, last = -1;
      for (const ch of w) {
        const j = t.indexOf(ch, ti);
        if (j < 0) return -1;
        run = j === ti ? run + 1 : 0;
        s += 1 + run * 2 + (j === 0 || /[\s·\-_/]/.test(t[j - 1]) ? 4 : 0);
        if (first < 0) first = j; last = j; ti = j + 1;
      }
      if (last - first + 1 > w.length * 3 + 2) return -1;
      total += s - (last - first - w.length) * 0.4;
    }
    return total;
  }
  function marks(text, q) {
    if (!q) return esc(text);
    const t = fold(text), out = [];
    const on = new Array(text.length).fill(false);
    q.split(/\s+/).filter(Boolean).forEach(w => {
      const i = t.indexOf(w);
      if (i >= 0) { for (let k = i; k < i + w.length; k++) on[k] = true; return; }
      let ti = 0; for (const ch of w) { const j = t.indexOf(ch, ti); if (j < 0) break; on[j] = true; ti = j + 1; }
    });
    let open = false;
    for (let i = 0; i < text.length; i++) {
      if (on[i] && !open) { out.push('<mark>'); open = true; }
      if (!on[i] && open) { out.push('</mark>'); open = false; }
      out.push(esc(text[i]));
    }
    if (open) out.push('</mark>');
    return out.join('');
  }
  const GROUPS = () => ({ recent: T('Recientes', 'Recent'), block: T('Bloques', 'Blocks'), tab: T('Pestañas', 'Tabs'), section: T('Secciones', 'Sections'), figure: T('Figuras', 'Figures'), control: T('Controles', 'Controls'), action: T('Acciones', 'Actions') });
  function renderPalette() {
    const inp = $('input', pal);
    const q = fold(inp.value.trim());
    const G = GROUPS();
    let groups = [];
    if (!q) {
      const rec = S.recents.map(k => palItems.find(i => i.k === k)).filter(Boolean).slice(0, 6);
      if (rec.length) groups.push(['recent', rec]);
      groups.push(['block', palItems.filter(i => i.g === 'block')]);
      groups.push(['action', palItems.filter(i => i.g === 'action')]);
    } else {
      const W = { block: 40, tab: 26, section: 12, figure: 10, action: 6, control: 0 };
      const scored = palItems.map(i => { const v = score(q, i.label); return { i, s: v > 0 ? v + (W[i.g] || 0) : v }; }).filter(x => x.s > 0);
      ['block', 'tab', 'section', 'figure', 'control', 'action'].forEach(g => {
        const list = scored.filter(x => x.i.g === g).sort((a, b) => b.s - a.s).slice(0, g === 'control' ? 6 : 8).map(x => x.i);
        if (list.length) groups.push([g, list]);
      });
      const best = g => Math.max.apply(null, scored.filter(x => x.i.g === g[0]).map(x => x.s));
      groups.sort((a, b) => best(b) - best(a));
    }
    let n = 0;
    const html = groups.map(([g, list]) => '<li role="presentation" class="lnav-pal-g">' + esc(G[g]) + '</li>' + list.map(it => {
      const id = 'lnavOpt' + (n++);
      return '<li role="option" id="' + id + '" data-k="' + esc(it.k) + '" aria-selected="false">' + ico(it.icon || 'chevron-right') +
        (it.num ? '<b class="lnav-pal-num">' + esc(it.num) + '</b>' : '') + '<span class="lnav-pal-t">' + marks(it.label, q) + '</span>' + (it.hint ? '<span class="lnav-pal-h">' + esc(it.hint) + '</span>' : '') + '</li>';
    }).join('')).join('');
    const ul = $('.lnav-pal-list', pal);
    ul.innerHTML = html || '<li class="lnav-pal-none" role="presentation">' + esc(T('Sin resultados. Prueba con otra palabra.', 'No results. Try another word.')) + '</li>';
    palSel = Math.min(palSel, Math.max(0, n - 1));
    markSel();
    $('.lnav-pal-foot', pal).innerHTML = '<span><kbd>↑</kbd><kbd>↓</kbd> ' + esc(T('elegir', 'move')) + '</span><span><kbd>Enter</kbd> ' + esc(T('ir', 'go')) + '</span><span><kbd>Esc</kbd> ' + esc(T('cerrar', 'close')) + '</span>';
  }
  function markSel(noScroll) {
    const opts = $$('[role="option"]', pal);
    opts.forEach((o, i) => o.setAttribute('aria-selected', String(i === palSel)));
    const o = opts[palSel];
    const inp = $('input', pal);
    if (o) { inp.setAttribute('aria-activedescendant', o.id); if (!noScroll) o.scrollIntoView({ block: 'nearest' }); }
    else inp.removeAttribute('aria-activedescendant');
  }
  function runItem(k) {
    const it = palItems.find(i => i.k === k);
    if (!it) return;
    S.recents = [k].concat(S.recents.filter(x => x !== k)).slice(0, 8);
    save('recents', S.recents);
    S.palReturn = null;
    pal.close();
    setTimeout(() => it.run(), 10);
  }
  function openPalette() {
    if (!pal) buildPalette();
    if (pal.open) { pal.close(); return; }
    palItems = indexItems();
    S.palReturn = document.activeElement;
    const inp = $('input', pal);
    inp.value = ''; palSel = 0;
    inp.placeholder = T('Busca un bloque, una sección, un control o una acción…', 'Search a block, a section, a control or an action…');
    inp.setAttribute('aria-label', T('Buscar en la app', 'Search the app'));
    pal.setAttribute('aria-label', T('Paleta de comandos', 'Command palette'));
    renderPalette();
    if (pal.showModal) pal.showModal(); else pal.setAttribute('open', '');
    inp.focus();
  }
  function copyLink() { copyUrl(location.href.split('#')[0] + hashFor(S.block, S.secs[S.cur] && S.cur > 0 ? S.secs[S.cur].id : null)); }
  function copyTabLink() {
    let h = null;
    try { h = CFG.tabLink(S.block, curTab().id); } catch (e) { h = null; }
    if (h) copyUrl(location.href.split('#')[0] + h);
  }
  function copyUrl(url) {
    const ok = () => toast(T('Enlace copiado: ', 'Link copied: ') + url);
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(ok, () => toast(url));
    else toast(url);
  }

  /* ---------------- ayuda en contexto («?») ---------------- */
  const NAV_KEYS = () => [
    ['Ctrl + K', T('Buscar bloques, secciones, controles y acciones', 'Search blocks, sections, controls and actions')],
    ['[', T('Contraer o mostrar la barra de bloques', 'Collapse or show the block bar')],
    ['Alt + ← / →', T('En el modo enfocado: sección anterior o siguiente (en los extremos, el bloque)', 'In focused mode: previous or next section (at the ends, the block)')],
  ];
  function help() {
    if (window.LABG && LABG.showShortcuts) LABG.showShortcuts();
  }
  function decorateHelp(dlg) {
    if (!dlg || dlg.querySelector('.lnav-help')) return;
    const body = dlg.querySelector('.dialog-body') || dlg;
    const s = steps().find(x => x.n === S.block);
    const sec = S.secs[S.cur];
    const p = activePanel();
    const head = p && p.querySelector(CFG.blockHead);
    const desc = head ? textOf(head.querySelector('p') || head).slice(0, 240) : '';
    let secDesc = '';
    if (sec) {
      const nx = sec.wrap ? sec.wrap.querySelector('p, .hint, .section-sub') : sec.nodes[1];
      if (nx && !nx.contains(sec.head)) secDesc = textOf(nx).slice(0, 260);
    }
    const st = sec ? stateOf(sec) : '';
    const box = mk('section', 'lnav-help lnav-own');
    box.innerHTML = '<h3>' + esc(T('Dónde estás', 'Where you are')) + '</h3>' +
      '<p class="lnav-help-where">' + (s ? '<b>' + esc((s.num && /\d/.test(s.num) ? s.num + ' · ' : '') + s.label) + '</b>' : '') + (hasTabs() && curTab() ? ' › ' + esc(curTab().label) : '') + (sec && S.secs.length > 1 ? ' › ' + esc(sec.title) : '') + '</p>' +
      (desc ? '<p>' + esc(desc) + '</p>' : '') + (secDesc && secDesc !== desc ? '<p>' + esc(secDesc) + '</p>' : '') +
      (st === 'pending' && !pendingBtn.hidden ? '<p><button type="button" class="lnav-help-go">' + ico('corner-down-right') + esc(T('Ir al paso pendiente', 'Go to the pending step')) + '</button></p>' : '') +
      '<h3>' + esc(T('Navegación', 'Navigation')) + '</h3>';
    body.insertBefore(box, body.firstChild);
    const go = box.querySelector('.lnav-help-go');
    if (go) go.addEventListener('click', () => { dlg.close(); goBlock(pendingBtn.dataset.n); });
    const dl = dlg.querySelector('.shortcut-list');
    if (dl && !dl.querySelector('.lnav-k-row')) {
      NAV_KEYS().forEach(([k, d]) => {
        const dt = mk('dt', 'lnav-k-row', k.split(' + ').map(x => '<kbd>' + esc(x) + '</kbd>').join(' + '));
        const dd = mk('dd', 'lnav-k-row', esc(d));
        dl.appendChild(dt); dl.appendChild(dd);
      });
    }
  }
  function hookHelp() {
    if (!window.LABG || !LABG.showShortcuts || LABG.showShortcuts.__lnav) return;
    const orig = LABG.showShortcuts;
    LABG.showShortcuts = function () {
      const r = orig.apply(this, arguments);
      try { decorateHelp(document.querySelector('dialog.labg-dialog[open]')); } catch (e) { console.error(e); }
      return r;
    };
    LABG.showShortcuts.__lnav = true;
  }

  /* ---------------- teclado ---------------- */
  window.addEventListener('keydown', e => {
    if (!S.on || e.defaultPrevented) return;
    const k = e.key;
    /* Ctrl+K / ⌘K: la paleta, también desde un campo */
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (k === 'k' || k === 'K')) {
      if (document.querySelector('.lfs-studio.on')) return;
      e.preventDefault(); e.stopPropagation(); openPalette(); return;
    }
    if (typing(e.target) || document.querySelector('dialog[open]:not(.lnav-pal)')) return;
    if (k === '[' && !e.ctrlKey && !e.metaKey && !e.altKey && side && !document.querySelector('.lfs-studio.on')) {
      e.preventDefault(); S.rail = !isRail(); save('rail', S.rail); paintRail(); measure(); return;
    }
    /* Alt+←/→ en el modo enfocado: secciones; en los extremos sigue la barra de la app */
    if (e.altKey && !e.ctrlKey && !e.metaKey && (k === 'ArrowLeft' || k === 'ArrowRight') && S.mode === 'focus' && S.secs.length >= CFG.minSections) {
      const d = k === 'ArrowRight' ? 1 : -1;
      if (step(d)) { e.preventDefault(); e.stopImmediatePropagation(); }
      else if (d < 0) { S.enterFrom = 'end'; setTimeout(() => { S.enterFrom = null; }, 1200); }
    }
  }, true);

  /* ---------------- avisos ---------------- */
  function toast(text, action) {
    if (window.LABG && LABG.toast) {
      LABG.toast(text, { type: 'info', timeout: action ? 8000 : 4500 });
      if (action) {
        const last = $$('.toast-stack .toast, .labg-toast').pop();
        if (last && !last.querySelector('.lnav-tact')) {
          const b = mk('button', 'lnav-tact', esc(action.label));
          b.type = 'button';
          b.addEventListener('click', () => { action.run(); last.remove(); });
          last.appendChild(b);
        }
      }
      return;
    }
    announce(text);
  }
  function announce(text) { if (window.LABG && LABG.announce) LABG.announce(text); }

  /* ---------------- arranque ---------------- */
  function sync() {
    const n = activeStep();
    paintSide();
    if (n != null && n !== S.block) onBlockChange(n);
  }
  function start() {
    if (S.on) return;
    try {
      S.block = activeStep();
      if (!build()) return;
      S.on = true;
      hookHelp();
      /* los cambios en la barra de la app (bloque activo, palomitas, candados) */
      const sm = new MutationObserver(() => { clearTimeout(sm.t); sm.t = setTimeout(sync, 30); });
      const host = stepper || (stepBtns()[0] && stepBtns()[0].parentElement);
      if (host) sm.observe(host, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'aria-current', 'disabled', 'aria-disabled'] });
      document.addEventListener('stepchange', () => setTimeout(sync, 0));
      /* el idioma: solo si cambia de verdad (algunas apps vuelven a escribir el mismo lang al traducir un panel) */
      let langNow = document.documentElement.lang;
      new MutationObserver(() => {
        const L = document.documentElement.lang;
        if (L === langNow) return;
        langNow = L;
        labels(); paintSide(); refresh(true);
      }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
      if (window.ResizeObserver && topbar) new ResizeObserver(() => measure()).observe(topbar);
      let rt = null;
      window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { layout(); spy(); }, 120); });
      /* enlace directo al abrir */
      const h = CFG.hash ? parseHash(location.hash) : null;
      if (S.block == null && steps()[0]) S.block = steps()[0].n;
      refresh(false);
      paintSide();
      if (h) {
        if (h.n !== S.block) goBlock(h.n, { section: h.sec });
        else if (h.sec) { S.pendingSec = h.sec; setTimeout(() => { if (S.pendingSec && gotoSection(S.pendingSec, true)) S.pendingSec = null; }, 500); }
      }
      S.lastHash = location.hash;
      document.addEventListener('labg-figure-studio:ready', () => paintToc());
      setTimeout(() => { paintToc(); measure(); }, 1200);
      emit('ready', {});
    } catch (err) {
      /* algo no cuadró: se deshace todo y la app queda como estaba */
      console.error('LABG Navegador', err);
      document.documentElement.classList.remove('lnav-on', 'lnav-has-side', 'lnav-rail', 'lnav-has-toc', 'lnav-focus', 'lnav-mobile', 'lnav-has-secs');
      $$('.lnav-own').forEach(n => n.remove());
      S.on = false;
    }
  }

  window.LABGNavigator = {
    version: VERSION,
    app: APP,
    config: CFG,
    refresh: () => refresh(true),
    go: (block, section) => goBlock(String(block), { section }),
    section: id => gotoSection(id),
    /* muestra la sección (plegada o fuera de vista en el modo enfocado) que contiene un nodo */
    reveal: node => {
      const i = S.secs.findIndex(sc => sc.nodes.some(n => n.contains(node)));
      if (i < 0) return false;
      const fl = S.folded[S.block] || [];
      if (S.mode === 'focus' || fl.indexOf(S.secs[i].id) >= 0) showSection(i, true);
      return true;
    },
    next: () => step(1),
    prev: () => step(-1),
    mode: m => { if (m) setMode(m); return S.mode; },
    palette: openPalette,
    blocks: () => steps().map(s => ({ n: s.n, label: s.label, done: s.done, disabled: s.disabled, active: s.active })),
    sections: () => S.secs.map(s => ({ id: s.id, title: s.title, state: stateOf(s), head: s.head })),
    /* las pestañas del bloque activo (si la app las tiene) y abrir una, de este bloque o de otro */
    tabs: () => S.tabs.map(x => ({ id: x.id, label: x.label, active: x.on })),
    tab: (id, block) => goTab(block == null ? S.block : String(block), String(id)),
    on: (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); },
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(start, 60));
  else setTimeout(start, 60);
})();
