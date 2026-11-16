/* Browser-local adapter. No external requests or database credentials. */
(function (root) {
  'use strict';
  function createRepository(storage) {
    function read(key, fallback) {
      try {
        const value = storage.getItem(key);
        return value === null ? fallback : JSON.parse(value);
      } catch { return fallback; }
    }
    return Object.freeze({
      listOrders() { const orders = read('rn-orders', []); return Array.isArray(orders) ? orders : []; },
      saveOrders(orders) { storage.setItem('rn-orders', JSON.stringify(orders)); },
      readDraft() { return read('rn-draft', null); },
      saveDraft(draft) { storage.setItem('rn-draft', JSON.stringify(draft)); },
      clearDraft() { storage.removeItem('rn-draft'); },
    });
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { createRepository };
  else {
    // Access can fail in browsers with storage disabled. Reads still work with
    // empty state; writes throw and are surfaced by the checkout.
    const storage = {
      getItem(key) { return root.localStorage.getItem(key); },
      setItem(key, value) { root.localStorage.setItem(key, value); },
      removeItem(key) { root.localStorage.removeItem(key); },
    };
    root.RNRepository = createRepository(storage);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
