// Teste offline do match lead × imóvel (Missão E3) — `node test-match.js`.
// Fixtures: 1 lead (bairro + orçamento + financiamento na mensagem) e 5 análises variadas.
'use strict';
const assert = require('node:assert/strict');
const { matchLeadImovel, extrairPerfil } = require('./src/match');

const lead = {
  id: 'L1',
  fonte: 'wimoveis',
  status: 'novo',
  lead: {
    nome: 'Maria',
    telefone: '61999999999',
    mensagem: 'Olá! Procuro apê na Asa Sul até R$ 500 mil, com financiamento. Pode me chamar no zap?',
  },
};

const analises = [
  { id: 'A1', score: 85, veredito: 'ÓTIMA OPORTUNIDADE', bairro: 'Asa Sul', fonte: 'wimoveis', status: 'disponivel',
    extracao: { preco: 480000, preco_m2: 8000, aceita_financiamento: true, aceita_permuta: false } },
  { id: 'A2', score: 90, veredito: 'ÓTIMA OPORTUNIDADE', bairro: 'Asa Sul', fonte: 'dfimoveis', status: 'disponivel',
    extracao: { preco: 650000, preco_m2: 9500, aceita_financiamento: true, aceita_permuta: false } },
  { id: 'A3', score: 95, veredito: 'ÓTIMA OPORTUNIDADE', bairro: 'Taguatinga', fonte: 'wimoveis', status: 'disponivel',
    extracao: { preco: 490000, preco_m2: 7000, aceita_financiamento: true, aceita_permuta: false } },
  { id: 'A4', score: 70, veredito: 'BOM, NEGOCIÁVEL', bairro: 'Asa Sul', fonte: 'wimoveis', status: 'descartado',
    extracao: { preco: 470000, preco_m2: 7800, aceita_financiamento: false, aceita_permuta: false } },
  { id: 'A5', score: 60, veredito: 'REGULAR', bairro: 'Asa Norte', fonte: 'dfimoveis', status: 'disponivel',
    extracao: { preco: null, preco_m2: 9000, aceita_financiamento: true, aceita_permuta: true } },
];

// 1) Perfil extraído da mensagem
assert.deepEqual(extrairPerfil(lead, analises), { orcamento: 500000, bairro: 'Asa Sul' });
// 1b) Mensagem sem sinais → perfil vazio
assert.deepEqual(extrairPerfil({ lead: { mensagem: 'oi, ainda disponível?' } }, analises), {});

// 2) Ranking padrão (apenasDisponiveis=true): A4 (descartado) e A5 (sem preço) fora.
// A1 = 34 (score) + 20 (bairro) + 15 (financ) + 13 (preço 4% do orçamento) = 82
// A2 = 36 + 20 + 15 + 0 (preço na borda de +30%) = 71
// A3 = 38 + 0 + 15 + 14 (preço 2% do orçamento) = 67
const ranking = matchLeadImovel(lead, analises);
assert.equal(ranking.length, 3);
assert.deepEqual(ranking.map((r) => r.analiseId), ['A1', 'A2', 'A3']);
assert.deepEqual(ranking.map((r) => r.pontos), [82, 71, 67]);
assert.ok(ranking[0].motivos.some((m) => m.includes('mesmo bairro')));
assert.ok(ranking[0].motivos.some((m) => m.includes('financiamento')));
assert.equal(ranking[0].scoreImovel, 85);

// 3) apenasDisponiveis=false inclui A4: 28 + 20 + 0 (não financia) + 12 = 60
const comDesc = matchLeadImovel(lead, analises, { apenasDisponiveis: false });
assert.deepEqual(comDesc.map((r) => r.analiseId), ['A1', 'A2', 'A3', 'A4']);
assert.deepEqual(comDesc.map((r) => r.pontos), [82, 71, 67, 60]);

// 4) limite respeitado
assert.equal(matchLeadImovel(lead, analises, { limite: 2 }).length, 2);
assert.deepEqual(matchLeadImovel(lead, analises, { limite: 2 }).map((r) => r.analiseId), ['A1', 'A2']);

// 5) Sem elegíveis → []
assert.deepEqual(matchLeadImovel(lead, [{ id: 'X', score: 90, bairro: 'Asa Sul', status: 'disponivel', extracao: {} }]), []);
assert.deepEqual(matchLeadImovel(lead, []), []);

console.log('perfil:', JSON.stringify(extrairPerfil(lead, analises)));
for (const r of ranking) console.log(r.analiseId, r.pontos, '| scoreImovel=' + r.scoreImovel, '|', r.motivos.join('; '));
console.log('OK test-match.js: 6 grupos de asserts passaram (ranking A1=82 > A2=71 > A3=67)');
