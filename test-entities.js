const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const file = path.join(__dirname, '.tmp-entities.json');
process.env.DB_PATH = file;
try { fs.unlinkSync(file); } catch {}
const store = require('./src/store');

test('persiste entidades normalizadas no backend JSON', () => {
  const imovel = store.propertyCreate({ titulo: 'Casa', bairro: 'Asa Sul', preco: 500000 });
  const anuncio = store.listingCreate({ imovelId: imovel.id, fonte: 'zap', url: 'https://example.test/1' });
  const contato = store.contactCreate({ nome: 'Ana', whatsapp: '5561999999999' });
  const oportunidade = store.opportunityCreate({ contatoId: contato.id, imovelId: imovel.id, etapa: 'qualificacao' });
  assert.equal(store.propertyFind(imovel.id).titulo, 'Casa');
  assert.equal(store.listingFind(anuncio.id).imovelId, imovel.id);
  assert.equal(store.contactFind(contato.id).whatsapp, '5561999999999');
  assert.equal(store.opportunityFind(oportunidade.id).etapa, 'qualificacao');
});

test('oportunidade exige contato', () => {
  assert.throws(() => store.opportunityCreate({ imovelId: 'x' }), /contatoId/);
});

test.after(() => { try { fs.unlinkSync(file); } catch {} });
