'use strict';

/**
 * Testes do módulo de métricas do dashboard de gestão
 * Executa com: node test-gestor.js
 */

var gestor = require('./src/gestor/index');

var metricasGerais = gestor.metricasGerais;
var tempoResposta = gestor.tempoResposta;
var velocityFunil = gestor.velocityFunil;
var conversaoPorCorretor = gestor.conversaoPorCorretor;
var conversaoPorPortal = gestor.conversaoPorPortal;

var totalAsserts = 0;
var passedAsserts = 0;
var failedAsserts = [];

function assert(condicao, mensagem) {
  totalAsserts++;
  if (condicao) {
    passedAsserts++;
    console.log('  OK ' + mensagem);
  } else {
    failedAsserts.push(mensagem);
    console.log('  FALHA ' + mensagem);
  }
}

function assertNum(recebido, esperado, mensagem) {
  var ok = Math.abs(recebido - esperado) < 0.01;
  assert(ok, mensagem + ' (esperado: ' + esperado + ', recebido: ' + recebido + ')');
}

console.log('=== Testes do modulo gestor ===');
console.log('');

// --- Helpers de data usando componentes locais (igual ao modulo) ---
function fmtLocal(d) {
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

var hoje = new Date();
var hojeStr = fmtLocal(hoje);

function diasAtras(n) {
  var d = new Date(hoje);
  d.setDate(d.getDate() - n);
  return fmtLocal(d);
}

// ==============================
// Mock de analises (10 registros)
// ==============================
// imo1: cadeia completa novo→visitado→proposta→fechado (4 dias)
// imo2: cadeia novo→visitado→fechado (4 dias)
// imo3: apenas novo (hoje)
// imo4: apenas fechado (ontem)
// imo5: apenas visitado (ontem)

var analisesMock = [
  {
    id: 1, imovelId: 'imo1', status: 'novo', fonte: 'dfimoveis', corretor: 'Joao',
    preco: 500000, score: 80,
    createdAt: diasAtras(4) + 'T08:00:00Z',
    distribuidoEm: diasAtras(4) + 'T08:15:00Z'
  },
  {
    id: 2, imovelId: 'imo1', status: 'visitado', fonte: 'dfimoveis', corretor: 'Joao',
    preco: 500000, score: 80,
    createdAt: diasAtras(2) + 'T08:00:00Z'
  },
  {
    id: 3, imovelId: 'imo1', status: 'proposta', fonte: 'dfimoveis', corretor: 'Joao',
    preco: 500000, score: 80,
    createdAt: diasAtras(1) + 'T08:00:00Z'
  },
  {
    id: 4, imovelId: 'imo1', status: 'fechado', fonte: 'dfimoveis', corretor: 'Joao',
    preco: 500000, score: 80,
    createdAt: hojeStr + 'T08:00:00Z'
  },
  {
    id: 5, imovelId: 'imo2', status: 'novo', fonte: 'wimoveis', corretor: 'Maria',
    preco: 300000, score: 70,
    createdAt: diasAtras(3) + 'T10:00:00Z',
    distribuidoEm: diasAtras(3) + 'T10:30:00Z'
  },
  {
    id: 6, imovelId: 'imo2', status: 'visitado', fonte: 'wimoveis', corretor: 'Maria',
    preco: 300000, score: 70,
    createdAt: diasAtras(2) + 'T10:00:00Z'
  },
  {
    id: 7, imovelId: 'imo2', status: 'fechado', fonte: 'wimoveis', corretor: 'Maria',
    preco: 300000, score: 70,
    createdAt: hojeStr + 'T10:00:00Z'
  },
  {
    id: 8, imovelId: 'imo3', status: 'novo', fonte: 'zapimoveis', corretor: 'Carlos',
    preco: 600000, score: 90,
    createdAt: hojeStr + 'T07:00:00Z',
    distribuidoEm: hojeStr + 'T07:10:00Z'
  },
  {
    id: 9, imovelId: 'imo4', status: 'fechado', fonte: 'zapimoveis', corretor: 'Carlos',
    preco: 600000, score: 90,
    createdAt: diasAtras(1) + 'T13:00:00Z'
  },
  {
    id: 10, imovelId: 'imo5', status: 'visitado', fonte: 'dfimoveis', corretor: 'Maria',
    preco: 350000, score: 65,
    createdAt: diasAtras(1) + 'T08:00:00Z'
  }
];

// Esperados calculados a partir do mock acima:
// total: 10
// novosHoje: 1 (id=8, status novo + hoje)
// fechados: 3 (id=4,7,9) → taxaConversao = 30%
// precos: 500k*4 + 300k*3 + 600k*2 + 350k = 4.450.000 / 10 = 445.000
// scores: 80*4 + 70*3 + 90*2 + 65 = 775 / 10 = 77.5
// porStatus: novo=3, visitado=3, proposta=1, fechado=3
// porFonte: dfimoveis=5, wimoveis=3, zapimoveis=2
//
// tempoResposta (leads com distribuidoEm): id=1(15min), id=5(30min), id=8(10min)
//   medio = 55/3 = 18.33, mediano = 15, estourados = 0
//
// velocityFunil:
//   imo1: novo(d-4) → visitado(d-2) = 2d, visitado(d-2) → proposta(d-1) = 1d,
//         proposta(d-1) → fechado(hoje) = 1d, novo→fechado = 4d
//   imo2: novo(d-3) → visitado(d-2) = 1d, novo(d-3) → fechado(hoje) = 3d
//   novo→visitado: [2, 1] → medio=1.5, mediano=1.5
//   visitado→proposta: [1] → medio=1, mediano=1
//   proposta→fechado: [1] → medio=1, mediano=1
//   tempoTotalFechamento: [4, 3] → medio=3.5, mediano=3.5

// ==============================
// 1. metricasGerais
// ==============================
console.log('1. metricasGerais');
var mg = metricasGerais(analisesMock);

assert(mg.total === 10, 'total = 10');
assert(mg.novosHoje === 1, 'novosHoje = 1');
assertNum(mg.taxaConversao, 30, 'taxaConversao = 30%');
assertNum(mg.ticketMedio, 445000, 'ticketMedio = 445000');
assertNum(mg.scoreMedio, 77.5, 'scoreMedio = 77.5');
assert(mg.porStatus.novo === 3, 'porStatus.novo = 3');
assert(mg.porStatus.visitado === 3, 'porStatus.visitado = 3');
assert(mg.porStatus.fechado === 3, 'porStatus.fechado = 3');
assert(mg.porStatus.proposta === 1, 'porStatus.proposta = 1');
assert(mg.porFonte.dfimoveis === 5, 'porFonte.dfimoveis = 5');
assert(mg.porFonte.wimoveis === 3, 'porFonte.wimoveis = 3');
assert(mg.porFonte.zapimoveis === 2, 'porFonte.zapimoveis = 2');
console.log('');

// ==============================
// 2. tempoResposta
// ==============================
console.log('2. tempoResposta');
var tr = tempoResposta(analisesMock);

assertNum(tr.medioMinutos, 18.33, 'medioMinutos = 18.33');
assertNum(tr.medianoMinutos, 15, 'medianoMinutos = 15');
assert(tr.estourados === 0, 'estourados = 0');
assert(tr.porCorretor.Joao.total === 1, 'Joao tem 1 lead');
assert(tr.porCorretor.Maria.total === 1, 'Maria tem 1 lead');
assert(tr.porCorretor.Carlos.total === 1, 'Carlos tem 1 lead');
assertNum(tr.porCorretor.Joao.medioMin, 15, 'media resposta Joao = 15min');
assertNum(tr.porCorretor.Maria.medioMin, 30, 'media resposta Maria = 30min');
assertNum(tr.porCorretor.Carlos.medioMin, 10, 'media resposta Carlos = 10min');
assert(tr.porCorretor.Joao.estourados === 0, 'Joao 0 estourados');
console.log('');

// ==============================
// 3. velocityFunil
// ==============================
console.log('3. velocityFunil');
var vf = velocityFunil(analisesMock);

assertNum(vf.novoParaVisitado.medio, 1.5, 'novoParaVisitado medio = 1.5');
assertNum(vf.novoParaVisitado.mediano, 1.5, 'novoParaVisitado mediano = 1.5');
assertNum(vf.visitadoParaProposta.medio, 1, 'visitadoParaProposta medio = 1');
assertNum(vf.visitadoParaProposta.mediano, 1, 'visitadoParaProposta mediano = 1');
assertNum(vf.propostaParaFechado.medio, 1, 'propostaParaFechado medio = 1');
assertNum(vf.propostaParaFechado.mediano, 1, 'propostaParaFechado mediano = 1');
assertNum(vf.tempoTotalFechamento.medio, 3.5, 'tempoTotalFechamento medio = 3.5');
assertNum(vf.tempoTotalFechamento.mediano, 3.5, 'tempoTotalFechamento mediano = 3.5');
console.log('');

// ==============================
// 4. conversaoPorCorretor
// ==============================
console.log('4. conversaoPorCorretor');
var cpc = conversaoPorCorretor(analisesMock);

assert(cpc.Joao.total === 4, 'Joao tem 4 analises');
assert(cpc.Joao.fechados === 1, 'Joao fechou 1');
assertNum(cpc.Joao.taxaConversao, 25, 'taxa conversao Joao = 25%');
assertNum(cpc.Joao.scoreMedio, 80, 'score medio Joao = 80');
assertNum(cpc.Joao.tempoMedioResposta, 15, 'tempo medio resposta Joao = 15min');

assert(cpc.Maria.total === 4, 'Maria tem 4 analises');
assert(cpc.Maria.fechados === 1, 'Maria fechou 1');
assertNum(cpc.Maria.taxaConversao, 25, 'taxa conversao Maria = 25%');
assertNum(cpc.Maria.scoreMedio, 68.75, 'score medio Maria = 68.75');
assertNum(cpc.Maria.tempoMedioResposta, 30, 'tempo medio resposta Maria = 30min');

assert(cpc.Carlos.total === 2, 'Carlos tem 2 analises');
assert(cpc.Carlos.fechados === 1, 'Carlos fechou 1');
assertNum(cpc.Carlos.taxaConversao, 50, 'taxa conversao Carlos = 50%');
assertNum(cpc.Carlos.scoreMedio, 90, 'score medio Carlos = 90');
assertNum(cpc.Carlos.tempoMedioResposta, 10, 'tempo medio resposta Carlos = 10min');
console.log('');

// ==============================
// 5. conversaoPorPortal
// ==============================
console.log('5. conversaoPorPortal');
var cpp = conversaoPorPortal(analisesMock);

assert(cpp.dfimoveis.total === 5, 'dfimoveis tem 5 analises');
assert(cpp.dfimoveis.fechados === 1, 'dfimoveis fechou 1');
assertNum(cpp.dfimoveis.taxaConversao, 20, 'taxa conversao dfimoveis = 20%');
assertNum(cpp.dfimoveis.scoreMedio, 77, 'score medio dfimoveis = 77');

assert(cpp.wimoveis.total === 3, 'wimoveis tem 3 analises');
assert(cpp.wimoveis.fechados === 1, 'wimoveis fechou 1');
assertNum(cpp.wimoveis.taxaConversao, 33.33, 'taxa conversao wimoveis = 33.33%');
assertNum(cpp.wimoveis.scoreMedio, 70, 'score medio wimoveis = 70');

assert(cpp.zapimoveis.total === 2, 'zapimoveis tem 2 analises');
assert(cpp.zapimoveis.fechados === 1, 'zapimoveis fechou 1');
assertNum(cpp.zapimoveis.taxaConversao, 50, 'taxa conversao zapimoveis = 50%');
assertNum(cpp.zapimoveis.scoreMedio, 90, 'score medio zapimoveis = 90');
console.log('');

// ==============================
// 6. Casos de borda: array vazio
// ==============================
console.log('6. Casos de borda - array vazio');

var mgVazio = metricasGerais([]);
assert(mgVazio.total === 0, 'metricasGerais([]).total = 0');
assert(mgVazio.taxaConversao === 0, 'metricasGerais([]).taxaConversao = 0');
assert(mgVazio.ticketMedio === 0, 'metricasGerais([]).ticketMedio = 0');
assert(mgVazio.scoreMedio === 0, 'metricasGerais([]).scoreMedio = 0');
assert(JSON.stringify(mgVazio.porStatus) === '{}', 'metricasGerais([]).porStatus vazio');

var trVazio = tempoResposta([]);
assert(trVazio.medioMinutos === 0, 'tempoResposta([]).medioMinutos = 0');
assert(trVazio.estourados === 0, 'tempoResposta([]).estourados = 0');
assert(JSON.stringify(trVazio.porCorretor) === '{}', 'tempoResposta([]).porCorretor vazio');

var vfVazio = velocityFunil([]);
assert(vfVazio.novoParaVisitado.medio === 0, 'velocityFunil([]).novoVisitado medio = 0');
assert(vfVazio.tempoTotalFechamento.medio === 0, 'velocityFunil([]).totalFechamento medio = 0');

var cpcVazio = conversaoPorCorretor([]);
assert(Object.keys(cpcVazio).length === 0, 'conversaoPorCorretor([]) retorna vazio');

var cppVazio = conversaoPorPortal([]);
assert(Object.keys(cppVazio).length === 0, 'conversaoPorPortal([]) retorna vazio');
console.log('');

// ==============================
// 7. Casos de borda: analise unica
// ==============================
console.log('7. Casos de borda - analise unica');

var unica = [{
  id: 99, imovelId: 'imo99', status: 'novo', fonte: 'dfimoveis',
  corretor: 'Ana', preco: 700000, score: 92,
  createdAt: hojeStr + 'T14:00:00Z'
}];

var mgUnica = metricasGerais(unica);
assert(mgUnica.total === 1, '1 analise: total = 1');
assertNum(mgUnica.ticketMedio, 700000, '1 analise: ticketMedio = 700000');
assertNum(mgUnica.scoreMedio, 92, '1 analise: scoreMedio = 92');
assert(mgUnica.porStatus.novo === 1, '1 analise: porStatus.novo = 1');
assert(mgUnica.novosHoje === 1, '1 analise novo hoje: novosHoje = 1');

var cpcUnica = conversaoPorCorretor(unica);
assert(cpcUnica.Ana.total === 1, '1 analise corretor: Ana = 1');
assert(cpcUnica.Ana.fechados === 0, '1 analise corretor: Ana fechados = 0');

var cppUnica = conversaoPorPortal(unica);
assert(cppUnica.dfimoveis.total === 1, '1 analise portal: dfimoveis = 1');

var vfUnica = velocityFunil(unica);
assert(vfUnica.novoParaVisitado.medio === 0, '1 analise velocity: medio = 0');
console.log('');

// ==============================
// 8. Analise com distribuidoEm no futuro (estouro)
// ==============================
console.log('8. Tempo de resposta com estouro');

var comEstouro = [{
  id: 100, imovelId: 'imoX', status: 'novo', fonte: 'dfimoveis',
  corretor: 'Pedro', preco: 400000, score: 50,
  createdAt: '2026-01-01T08:00:00Z',
  distribuidoEm: '2026-01-01T09:00:00Z'
}, {
  id: 101, imovelId: 'imoY', status: 'novo', fonte: 'wimoveis',
  corretor: 'Pedro', preco: 350000, score: 60,
  createdAt: '2026-01-02T08:00:00Z',
  distribuidoEm: '2026-01-02T08:45:00Z'
}];

var trEstouro = tempoResposta(comEstouro);
assert(trEstouro.medioMinutos === 52.5, '2 leads: medio = 52.5 min');
assert(trEstouro.medianoMinutos === 52.5, '2 leads: mediano = 52.5 min');
assert(trEstouro.estourados === 2, '2 leads: 2 estourados (>30min)');
assert(trEstouro.porCorretor.Pedro.total === 2, 'Pedro tem 2 leads');
assert(trEstouro.porCorretor.Pedro.estourados === 2, 'Pedro tem 2 estourados');
console.log('');

// ==============================
// Resultado
// ==============================
console.log('========================================');
console.log('Total de asserts: ' + totalAsserts);
console.log('Passaram: ' + passedAsserts);
console.log('Falharam: ' + failedAsserts.length);

if (failedAsserts.length > 0) {
  console.log('');
  console.log('Falhas:');
  for (var f = 0; f < failedAsserts.length; f++) {
    console.log('  - ' + failedAsserts[f]);
  }
  process.exit(1);
} else {
  console.log('');
  console.log('Todos os testes passaram!');
  process.exit(0);
}
