'use strict';

const {
  CANDIDATOS_CONFIG,
  classificarLead,
  calcularFit,
  candidatosReativacao,
  gerarMensagemReativacao,
  filtrarPorTemperatura,
} = require('./src/reativacao/index');

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.error(`  ✗ ${msg}`);
  }
}

function assertEqual(actual, expected, msg) {
  if (actual === expected) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.error(`  ✗ ${msg} — esperado "${expected}", obtido "${actual}"`);
  }
}

function assertIncludes(str, sub, msg) {
  if (str.includes(sub)) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.error(`  ✗ ${msg} — "${str}" não contém "${sub}"`);
  }
}

// === Tests ===

console.log('\n--- classificarLead ---');

const agora = Date.now();

const leadNovo = classificarLead({ criadoEm: new Date(agora - 30 * 60 * 1000).toISOString() }, agora);
assertEqual(leadNovo.faixa, 'NOVO', 'Lead com 30 min → NOVO');

const leadQuente = classificarLead({ criadoEm: new Date(agora - 12 * 60 * 60 * 1000).toISOString() }, agora);
assertEqual(leadQuente.faixa, 'QUENTE', 'Lead com 12h → QUENTE');

const leadMorno = classificarLead({ criadoEm: new Date(agora - 3 * 24 * 60 * 60 * 1000).toISOString() }, agora);
assertEqual(leadMorno.faixa, 'MORNO', 'Lead com 3 dias → MORNO');

const leadFrio = classificarLead({ criadoEm: new Date(agora - 15 * 24 * 60 * 60 * 1000).toISOString() }, agora);
assertEqual(leadFrio.faixa, 'FRIO', 'Lead com 15 dias → FRIO');

const leadGelado = classificarLead({ criadoEm: new Date(agora - 45 * 24 * 60 * 60 * 1000).toISOString() }, agora);
assertEqual(leadGelado.faixa, 'GELADO', 'Lead com 45 dias → GELADO');

assert(typeof leadNovo.diasDesdeCriacao === 'number', 'Retorna diasDesdeCriacao numérico');
assert(typeof leadNovo.horasDesdeCriacao === 'number', 'Retorna horasDesdeCriacao numérico');

console.log('\n--- calcularFit ---');

const leadBase = {
  nome: 'João',
  bairro: 'Centro',
  budget: 300000,
  aceita_financiamento: true,
  telefone: '11999999999',
  email: 'joao@test.com',
};

const imovelPerfeito = {
  bairro: 'Centro',
  preco: 290000,
  aceita_financiamento: true,
  tem_escritura: true,
  tem_habite_se: true,
};

const fitPerfeito = calcularFit(leadBase, imovelPerfeito);
assertEqual(fitPerfeito.pontos, 100, 'Fit perfeito = 100 pontos');
assertEqual(fitPerfeito.fit, 'excelente', 'Fit perfeito = excelente');
assert(fitPerfeito.motivos.includes('mesmo bairro'), 'Motivo inclui "mesmo bairro"');
assert(fitPerfeito.motivos.includes('preço dentro do orçamento'), 'Motivo inclui "preço dentro do orçamento"');
assert(fitPerfeito.motivos.includes('aceita financiamento'), 'Motivo inclui "aceita financiamento"');
assert(fitPerfeito.motivos.includes('com escritura'), 'Motivo inclui "com escritura"');
assert(fitPerfeito.motivos.includes('com habite-se'), 'Motivo inclui "com habite-se"');

const imovelDistante = {
  bairro: 'OutroBairro',
  preco: 500000,
  aceita_financiamento: false,
  tem_escritura: false,
  tem_habite_se: false,
};

const fitBaixo = calcularFit(leadBase, imovelDistante);
assertEqual(fitBaixo.pontos, 10, 'Fit ruim = 10 pontos (só telefone + email)');
assertEqual(fitBaixo.fit, 'baixo', 'Fit ruim = baixo');

const imovelPrecoProximo = {
  bairro: 'Outro',
  preco: 350000,
  aceita_financiamento: false,
  tem_escritura: false,
  tem_habite_se: false,
};

const fitProximo = calcularFit(leadBase, imovelPrecoProximo);
assertEqual(fitProximo.pontos, 25, 'Preço 16% acima = 15pts (próximo) + 10pts contato');
assert(fitProximo.motivos.includes('preço próximo ao orçamento'), 'Motivo inclui "preço próximo ao orçamento"');

console.log('\n--- calcularFit edge cases ---');

const leadSemBudget = { nome: 'Maria', bairro: 'Centro' };
const fitSemBudget = calcularFit(leadSemBudget, imovelPerfeito);
assertEqual(fitSemBudget.pontos, 50, 'Lead sem budget = 30 bairro + 10 escritura + 10 habite-se');

const leadVazio = {};
const fitVazio = calcularFit(leadVazio, { bairro: 'X', preco: 100 });
assertEqual(fitVazio.pontos, 0, 'Lead vazio = 0 pontos');

console.log('\n--- candidatosReativacao ---');

const leads = [
  {
    id: 1,
    nome: 'Ana',
    bairro: 'Centro',
    budget: 300000,
    aceita_financiamento: true,
    telefone: '11999999999',
    email: 'ana@test.com',
    status: 'analisado',
    criadoEm: new Date(agora - 20 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 2,
    nome: 'Bruno',
    bairro: 'Jardins',
    budget: 200000,
    aceita_financiamento: false,
    telefone: '11988888888',
    email: 'bruno@test.com',
    status: 'fechado',
    criadoEm: new Date(agora - 25 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 3,
    nome: 'Carlos',
    bairro: 'Centro',
    budget: 300000,
    aceita_financiamento: true,
    telefone: '11977777777',
    email: 'carlos@test.com',
    status: 'novo',
    criadoEm: new Date(agora - 20 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 4,
    nome: 'Diana',
    bairro: 'Centro',
    budget: 300000,
    aceita_financiamento: true,
    telefone: '11966666666',
    email: 'diana@test.com',
    status: 'descartado',
    criadoEm: new Date(agora - 40 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 5,
    nome: 'Eva',
    bairro: 'Centro',
    budget: 300000,
    aceita_financiamento: true,
    telefone: '11955555555',
    email: 'eva@test.com',
    status: 'visitado',
    criadoEm: new Date(agora - 20 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

const imoveis = [
  { bairro: 'Centro', preco: 290000, aceita_financiamento: true, tem_escritura: true, tem_habite_se: true },
  { bairro: 'Jardins', preco: 210000, aceita_financiamento: false, tem_escritura: false, tem_habite_se: false },
];

const candidatos = candidatosReativacao(leads, imoveis);

assertEqual(candidatos.length, 3, 'Retorna 3 candidatos (Ana, Carlos, Eva)');
assert(candidatos.every((c) => c.lead.id !== 2), 'Exclude Bruno (fechado)');
assert(candidatos.every((c) => c.lead.id !== 4), 'Exclude Diana (descartado)');

for (const c of candidatos) {
  assert(typeof c.pontosFit === 'number', `Candidato ${c.lead.nome} tem pontosFit numérico`);
  assert(typeof c.mensagem === 'string', `Candidato ${c.lead.nome} tem mensagem`);
  assert(c.pontosFit >= CANDIDATOS_CONFIG.fitMinimo, `Candidato ${c.lead.nome} ≥ fitMinimo`);
}

assert(candidatos[0].pontosFit >= candidatos[candidatos.length - 1].pontosFit, 'Ordenação decrescente por fit');

console.log('\n--- candidatosReativacao empty ---');

const candidatosVazio = candidatosReativacao([], imoveis);
assertEqual(candidatosVazio.length, 0, 'Leads vazios → 0 candidatos');

const candidatosSemImoveis = candidatosReativacao(leads, []);
assertEqual(candidatosSemImoveis.length, 0, 'Imóveis vazios → 0 candidatos');

console.log('\n--- gerarMensagemReativacao ---');

const candidato = candidatos[0];
const msg = gerarMensagemReativacao(candidato);
assertIncludes(msg, `Olá ${candidato.lead.nome}!`, 'Mensagem tem saudação com nome');
assertIncludes(msg, 'dias que analisamos', 'Mensagem menciona dias');
assertIncludes(msg, candidato.imovel.bairro, 'Mensagem menciona bairro');
assertIncludes(msg, 'ficha', 'Mensagem termina com convite');

console.log('\n--- filtrarPorTemperatura ---');

const todosLeads = [
  { criadoEm: new Date(agora - 30 * 60 * 1000).toISOString() },
  { criadoEm: new Date(agora - 12 * 60 * 60 * 1000).toISOString() },
  { criadoEm: new Date(agora - 3 * 24 * 60 * 60 * 1000).toISOString() },
  { criadoEm: new Date(agora - 15 * 24 * 60 * 60 * 1000).toISOString() },
  { criadoEm: new Date(agora - 45 * 24 * 60 * 60 * 1000).toISOString() },
];

assertEqual(filtrarPorTemperatura(todosLeads, 'NOVO').length, 1, '1 lead NOVO');
assertEqual(filtrarPorTemperatura(todosLeads, 'QUENTE').length, 1, '1 lead QUENTE');
assertEqual(filtrarPorTemperatura(todosLeads, 'MORNO').length, 1, '1 lead MORNO');
assertEqual(filtrarPorTemperatura(todosLeads, 'FRIO').length, 1, '1 lead FRIO');
assertEqual(filtrarPorTemperatura(todosLeads, 'GELADO').length, 1, '1 lead GELADO');
assertEqual(filtrarPorTemperatura(todosLeads, 'INEXISTENTE').length, 0, 'Faixa inexistente → 0');
assertEqual(filtrarPorTemperatura([], 'NOVO').length, 0, 'Array vazio → 0');

console.log('\n--- CANDIDATOS_CONFIG ---');

assertEqual(CANDIDATOS_CONFIG.diasMinimos, 14, 'diasMinimos = 14');
assertEqual(CANDIDATOS_CONFIG.fitMinimo, 30, 'fitMinimo = 30');
assert(CANDIDATOS_CONFIG.statusPermitidos.includes('novo'), 'statusPermitidos inclui novo');
assert(CANDIDATOS_CONFIG.excludeStatus.includes('fechado'), 'excludeStatus inclui fechado');

console.log('\n--- custom config ---');

const candidatosCustom = candidatosReativacao(leads, imoveis, { diasMinimos: 5, fitMinimo: 0 });
assert(candidatosCustom.length >= 3, 'Custom diasMinimos=5 inclui mais leads');

console.log(`\n${'='.repeat(40)}`);
console.log(`Resultados: ${passed} passed, ${failed} failed`);
console.log(`${'='.repeat(40)}\n`);

process.exit(failed > 0 ? 1 : 0);
