/* Rules shared by the prototype and its future server implementation. */
(function (root) {
  'use strict';
  const DEPOSIT_PERCENT = 30;
  const PRODUCTION_DAYS = 7;
  const STATUSES = ['Recibido', 'En revisión', 'Pendiente de anticipo', 'Confirmado', 'En producción', 'Listo', 'Enviado', 'Entregado'];

  function deposit(amount) {
    if (!Number.isFinite(amount) || amount < 0) throw new Error('Importe inválido');
    const cents = Math.round(amount * 100);
    return Math.round(cents * DEPOSIT_PERCENT / 100) / 100;
  }

  // Calendar date, rather than 168 elapsed hours: preserve the payment's local
  // calendar day across DST boundaries. Transit time is deliberately excluded.
  function productionDueDate(paidAt) {
    const date = new Date(paidAt);
    if (!Number.isFinite(date.getTime())) throw new Error('Fecha inválida');
    date.setDate(date.getDate() + PRODUCTION_DAYS);
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  }

  function recordDeposit(order, paidAt = new Date().toISOString()) {
    // A second click must not restart the production deadline.
    if (order.paidAt) return order;
    return {
      ...order,
      paidAt,
      depositAmount: deposit(order.amount),
      productionDue: productionDueDate(paidAt),
      payment: 'Anticipo simulado',
      status: 'Confirmado',
      history: [...(order.history || []), { status: 'Confirmado', at: paidAt, note: 'Anticipo del 30% simulado' }],
    };
  }

  const api = Object.freeze({ DEPOSIT_PERCENT, PRODUCTION_DAYS, STATUSES, deposit, productionDueDate, recordDeposit });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RNBusiness = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
