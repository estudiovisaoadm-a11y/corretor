const test = require('node:test');
const assert = require('node:assert/strict');
const { buildOverview } = require('./src/dashboard');

test('dashboard prioriza leads atrasados e resume oportunidades', () => {
  const now = Date.now();
  const data = buildOverview([
    { id: 'lead-1', origem: 'lead-portal', status: 'novo', createdAt: new Date(now - 10 * 60000).toISOString(), lead: { nome: 'Ana' } },
    { id: 'property-1', origem: 'painel', createdAt: new Date(now).toISOString(), bairro: 'Taguatinga', score: 82, extracao: { preco_m2: 3000, preco: 300000, area_m2: 100 } },
  ], now);
  assert.equal(data.totals.pending, 1);
  assert.equal(data.priorities[0].name, 'Ana');
  assert.equal(data.priorities[0].sla.estourado, true);
  assert.equal(data.totals.properties, 1);
});
