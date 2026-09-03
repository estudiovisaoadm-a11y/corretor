// test-lead-score.js — 5 fixtures offline p/ src/scoring/lead-score.js (zero dependências).
// Roda: node test-lead-score.js  (throw se qualquer assert falhar; imprime scores/faixas).
// Pesos: origem 20% | contato 20% | intenção 25% | fit estoque 20% | frescor 15%.
// Faixas: >=80 QUENTE | >=40 MORNO | <40 FRIO. Teto 30 sem tel+email. status≠novo → observacao, sem zerar.
'use strict';

var assert = require('assert');
var scoreLead = require('./src/scoring/lead-score').scoreLead;

var BASE = Date.parse('2026-09-02T12:00:00.000Z'); // agoraMs fixo → 100% offline e determinístico
function minAgo(min) { return new Date(BASE - min * 60000).toISOString(); }
function ctx() { return { mediaScores: { 'APT-001': 88, 'CASA-007': 65 }, agoraMs: BASE }; }

function checkForma(r, nome) {
  assert.ok(r && typeof r.score === 'number', nome + ': sem score numérico');
  assert.ok(Number.isInteger(r.score) && r.score >= 0 && r.score <= 100, nome + ': score fora de 0-100');
  assert.ok(r.faixa === 'QUENTE' || r.faixa === 'MORNO' || r.faixa === 'FRIO', nome + ': faixa inválida');
  assert.ok(Array.isArray(r.motivos) && r.motivos.length >= 5, nome + ': esperado ≥5 motivos (1 por fator)');
}

// 1. QUENTE: portal quente + contato completo + intenção alta + imóvel bom + fresco.
var quente = {
  fonte: 'dfimoveis', origem: 'lead-dfimoveis', status: 'novo',
  lead: {
    nome: 'Maria Silva', telefone: '61999990000', email: 'maria@email.com',
    mensagem: 'Quero agendar uma visita ainda hoje, tenho financiamento aprovado e quero fazer proposta.',
    codigoImovel: 'APT-001'
  },
  codigoImovel: 'APT-001', createdAt: minAgo(5)
};

// 2. FRIO: sem telefone/email → teto 30.
var frio = {
  fonte: 'manual', origem: 'lead-manual', status: 'novo',
  lead: { nome: 'Visitante', mensagem: 'só olhando por curiosidade' },
  createdAt: minAgo(10)
};

// 3. MORNO: canal médio + contato parcial + intenção média + fit regular + ~40min.
var morno = {
  fonte: 'site', origem: 'lead-site', status: 'novo',
  lead: {
    nome: 'João Souza', telefone: '61988880000',
    mensagem: 'Tenho interesse, gostaria de mais informações sobre valores e financiamento. Ainda avaliando.',
    codigoImovel: 'CASA-007'
  },
  codigoImovel: 'CASA-007', createdAt: minAgo(40)
};

// 4. JÁ ATENDIDO: igual ao quente, mas status ≠ novo → observacao, sem zerar.
var atendido = Object.assign({}, quente, {
  status: 'em_atendimento',
  lead: Object.assign({}, quente.lead)
});

// 5. VELHO 3h: igual ao quente, mas createdAt 180min atrás → frescor decai (após 60min).
var velho = Object.assign({}, quente, {
  lead: Object.assign({}, quente.lead),
  createdAt: minAgo(180)
});

var r1 = scoreLead(quente, ctx());
checkForma(r1, 'quente');
assert.strictEqual(r1.faixa, 'QUENTE', 'quente: faixa esperada QUENTE, veio ' + r1.faixa);
assert.ok(r1.score >= 80, 'quente: score esperado >=80, veio ' + r1.score);
assert.ok(!('observacao' in r1), 'quente: não deve ter observacao');

var r2 = scoreLead(frio, ctx());
checkForma(r2, 'frio');
assert.ok(r2.score <= 30, 'frio: teto 30 esperado, veio ' + r2.score);
assert.strictEqual(r2.faixa, 'FRIO', 'frio: faixa esperada FRIO, veio ' + r2.faixa);
assert.ok(r2.motivos.some(function (m) { return m.indexOf('teto 30') !== -1; }), 'frio: motivo do teto ausente');

var r3 = scoreLead(morno, ctx());
checkForma(r3, 'morno');
assert.ok(r3.score >= 40 && r3.score < 80, 'morno: score esperado em [40,80), veio ' + r3.score);
assert.strictEqual(r3.faixa, 'MORNO', 'morno: faixa esperada MORNO, veio ' + r3.faixa);

var r4 = scoreLead(atendido, ctx());
checkForma(r4, 'atendido');
assert.strictEqual(r4.observacao, 'já em atendimento', 'atendido: observacao exata ausente');
assert.strictEqual(r4.score, r1.score, 'atendido: score não pode zerar (esperado ' + r1.score + ', veio ' + r4.score + ')');
assert.strictEqual(r4.faixa, r1.faixa, 'atendido: faixa deve acompanhar o score cheio');

var r5 = scoreLead(velho, ctx());
checkForma(r5, 'velho');
assert.ok(r5.score < r1.score, 'velho: frescor deve decair após 60min (quente=' + r1.score + ', velho=' + r5.score + ')');
assert.ok(r5.motivos.some(function (m) { return m.indexOf('180min') !== -1; }), 'velho: motivo de frescor deve citar a idade');

// Mensagem vazia → intenção neutra (+10/25), sem quebrar.
var r6 = scoreLead({
  fonte: 'navent', origem: 'lead-navent', status: 'novo',
  lead: { nome: 'Ana', telefone: '61977770000', email: 'ana@email.com', codigoImovel: 'APT-001' },
  codigoImovel: 'APT-001', createdAt: minAgo(5)
}, ctx());
assert.ok(r6.motivos.some(function (m) { return m.indexOf('neutra (mensagem vazia)') !== -1; }), 'msg vazia: intenção neutra ausente');

console.log('quente    :', r1.score, r1.faixa, '|', r1.motivos.join(' ; '));
console.log('frio      :', r2.score, r2.faixa, '|', r2.motivos.join(' ; '));
console.log('morno     :', r3.score, r3.faixa, '|', r3.motivos.join(' ; '));
console.log('atendido  :', r4.score, r4.faixa, '| observacao=' + r4.observacao);
console.log('velho 3h  :', r5.score, r5.faixa, '| fresco caiu de +15 →', r5.motivos[4]);
console.log('msg vazia :', r6.score, r6.faixa, '|', r6.motivos[2]);
console.log('OK — 6/6 asserts de lead-score passaram (offline).');
