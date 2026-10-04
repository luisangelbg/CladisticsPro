/* CladisticsPro — morphological cladistics in the browser.
   Copyright (C) 2026  Luis Ángel Barrera-Guzmán

   This program is free software: you can redistribute it and/or modify it under
   the terms of the GNU General Public License as published by the Free Software
   Foundation, either version 3 of the License, or (at your option) any later
   version. It is distributed in the hope that it will be useful, but WITHOUT ANY
   WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
   A PARTICULAR PURPOSE. See the GNU General Public License, in the file LICENSE
   at the root of this program, or <https://www.gnu.org/licenses/>. */

/* CladisticsPro — local storage in the browser's own database (IndexedDB).
   Two stores: «session» (the matrix being edited, saved a moment after every
   change, so closing the tab loses nothing) and «images» (the pictures of the
   states). Nothing here leaves the computer. When the browser refuses the
   database (some private browsing modes), every call resolves to null and the app
   simply works without memory. */
(function () {
  const NAME = 'cladisticspro', VERSION = 1;
  let dbp = null;
  function open() {
    if (dbp) return dbp;
    dbp = new Promise(resolve => {
      try {
        const rq = indexedDB.open(NAME, VERSION);
        rq.onupgradeneeded = () => {
          const db = rq.result;
          if (!db.objectStoreNames.contains('session')) db.createObjectStore('session');
          if (!db.objectStoreNames.contains('images')) db.createObjectStore('images');
        };
        rq.onsuccess = () => resolve(rq.result);
        rq.onerror = () => resolve(null);
        rq.onblocked = () => resolve(null);
      } catch (e) { resolve(null); }
    });
    return dbp;
  }
  function tx(store, mode, fn) {
    return open().then(db => new Promise(resolve => {
      if (!db) { resolve(null); return; }
      try {
        const t = db.transaction(store, mode);
        const st = t.objectStore(store);
        const rq = fn(st);
        t.oncomplete = () => resolve(rq && 'result' in rq ? rq.result : true);
        t.onerror = () => resolve(null);
        t.onabort = () => resolve(null);
      } catch (e) { resolve(null); }
    }));
  }
  const Store = {
    get: (store, key) => tx(store, 'readonly', st => st.get(key)),
    put: (store, key, val) => tx(store, 'readwrite', st => st.put(val, key)),
    del: (store, key) => tx(store, 'readwrite', st => st.delete(key)),
    keys: store => tx(store, 'readonly', st => st.getAllKeys()),
    clear: store => tx(store, 'readwrite', st => st.clear()),
  };
  window.Store = Store;
})();
