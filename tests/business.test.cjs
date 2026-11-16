const { test } = require('node:test');
const assert = require('node:assert/strict');
const { deposit, productionDueDate, recordDeposit } = require('../assets/business');

test('anticipo del 30%, redondeado a centavos', () => {
  assert.equal(deposit(1000), 300);
  assert.equal(deposit(999.99), 300);
  assert.equal(deposit(123.45), 37.04);
  assert.equal(deposit(0), 0);
  assert.throws(() => deposit(-1));
  assert.throws(() => deposit(NaN));
});

test('suma siete días naturales, incluidos fin de semana y cambio de año', () => {
  assert.equal(productionDueDate('2026-11-20T12:00:00'), '2026-11-27');
  assert.equal(productionDueDate('2026-12-28T12:00:00'), '2027-01-04');
  assert.equal(productionDueDate('2028-02-25T12:00:00'), '2028-03-03');
  assert.throws(() => productionDueDate('invalid'));
});

test('el anticipo inicia el plazo una sola vez y conserva el pedido original', () => {
  const order = { id: 'RN-TEST', amount: 1500, status: 'Recibido', history: [] };
  const paid = recordDeposit(order, '2026-11-16T12:00:00');
  assert.equal(paid.depositAmount, 450);
  assert.equal(paid.productionDue, '2026-11-23');
  assert.equal(paid.status, 'Confirmado');
  assert.equal(paid.history.length, 1);
  assert.equal(order.paidAt, undefined);
  assert.deepEqual(recordDeposit(paid, '2026-11-18T12:00:00'), paid);
});
