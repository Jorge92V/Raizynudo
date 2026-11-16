const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRepository } = require('../assets/storage');
function memory() {
  const map = new Map();
  return { getItem: k => map.get(k) ?? null, setItem: (k, v) => map.set(k, v), removeItem: k => map.delete(k) };
}

test('guarda y recupera la matriz exacta de maderas y el pedido', () => {
  const store = memory(), repository = createRepository(store);
  const order = { id: 'RN-1', design: { grid: [['nogal', 'parota'], ['parota', 'nogal']] }, amount: 1000 };
  repository.saveOrders([order]);
  assert.deepEqual(createRepository(store).listOrders(), [order]);
});

test('los borradores se pueden recuperar y limpiar sin borrar pedidos', () => {
  const repository = createRepository(memory());
  repository.saveOrders([{ id: 'RN-1' }]);
  repository.saveDraft({ client: { name: 'Prueba' } });
  assert.equal(repository.readDraft().client.name, 'Prueba');
  repository.clearDraft();
  assert.equal(repository.readDraft(), null);
  assert.equal(repository.listOrders().length, 1);
});

test('tolera datos corruptos y propaga fallos de escritura al checkout', () => {
  const store = memory(); store.setItem('rn-orders', '{invalid');
  assert.deepEqual(createRepository(store).listOrders(), []);
  store.setItem('rn-orders', '{}');
  assert.deepEqual(createRepository(store).listOrders(), []);
  const repository = createRepository({ getItem() { throw Error('disabled'); }, setItem() { throw Error('quota'); } });
  assert.deepEqual(repository.listOrders(), []);
  assert.throws(() => repository.saveOrders([{ id: 'RN-1' }]), /quota/);
});
