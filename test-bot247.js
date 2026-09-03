// Testes do módulo Bot 24/7
// Execute com: node test-bot247.js

const {
  formatarFicha,
  parseMensagemCliente,
  respostaAutomatica,
  ehHorarioComercial,
  respostaInteligente,
} = require('./src/bot247/index.js');

let testesPassaram = 0;
let testesFalharam = 0;

function assert(condicao, mensagem) {
  if (condicao) {
    testesPassaram++;
    console.log(`✅ PASSOU: ${mensagem}`);
  } else {
    testesFalharam++;
    console.log(`❌ FALHOU: ${mensagem}`);
  }
}

// ============================================================
// Dados de teste
// ============================================================

const analiseCompleta = {
  score: 85,
  veredito: 'Ótima oportunidade',
  extracao: {
    preco: 350000,
    area: 85,
    preco_m2: 4118,
    aceita_financiamento: true,
    tem_escritura: true,
    tem_habite_se: false,
  },
  bairro: 'Setor Bueno',
  fonte: 'OLX',
  url: 'https://olx.com.br/imovel/12345',
};

const analiseSemFinanciamento = {
  score: 60,
  veredito: 'Razoável',
  extracao: {
    preco: 200000,
    area: 60,
    preco_m2: 3333,
    aceita_financiamento: false,
    tem_escritura: false,
    tem_habite_se: true,
  },
  bairro: 'Setor Leste',
  fonte: 'VivaReal',
  url: 'https://vivareal.com.br/imovel/67890',
};

// ============================================================
// Testes de formatarFicha
// ============================================================

console.log('\n--- Testes de formatarFicha ---');

const ficha = formatarFicha(analiseCompleta);

assert(ficha.includes('🏠 *Ficha do Imóvel*'), 'formatarFicha contém cabeçalho com emoji');
assert(ficha.includes('📍 Setor Bueno | OLX'), 'formatarFicha contém bairro e fonte');
assert(ficha.includes('R$ 350.000'), 'formatarFicha contém preço formatado');
assert(ficha.includes('85m² = R$ 4.118/m²'), 'formatarFicha contém área e preço/m²');
assert(ficha.includes('Score: 85/100 — Ótima oportunidade'), 'formatarFicha contém score e veredito');
assert(ficha.includes('Financiamento: Sim'), 'formatarFicha mostra financiamento quando aceita');
assert(ficha.includes('Escritura: Sim'), 'formatarFicha mostra escritura quando tem');
assert(ficha.includes('https://olx.com.br/imovel/12345'), 'formatarFicha contém URL');

const fichaSemFin = formatarFicha(analiseSemFinanciamento);
assert(fichaSemFin.includes('Financiamento: Não'), 'formatarFicha mostra Não para financiamento');
assert(fichaSemFin.includes('Escritura: Não'), 'formatarFicha mostra Não para escritura');

// ============================================================
// Testes de parseMensagemCliente
// ============================================================

console.log('\n--- Testes de parseMensagemCliente ---');

const r1 = parseMensagemCliente('Quero ver o imóvel DFM-123');
assert(r1.intencao === 'consulta_imovel', 'Detecta código DFM-123 como consulta_imovel');
assert(r1.dados.codigo === 'DFM-123', 'Extrai código DFM-123');

const r2 = parseMensagemCliente('código ABC456');
assert(r2.intencao === 'consulta_imovel', 'Detecta "código ABC456" como consulta_imovel');
assert(r2.dados.codigo === 'ABC456', 'Extrai código ABC456');

const r3 = parseMensagemCliente('Posso agendar uma visita?');
assert(r3.intencao === 'agendar_visita', 'Detecta "visita" como agendar_visita');

const r4 = parseMensagemCliente('Quanto custa esse imóvel?');
assert(r4.intencao === 'orcamento', 'Detecta "quanto" como orcamento');

const r5 = parseMensagemCliente('O preço é R$ 300.000');
assert(r5.intencao === 'orcamento', 'Detecta "preço" como orcamento');

const r6 = parseMensagemCliente('Como funciona o financiamento?');
assert(r6.intencao === 'duvida', 'Detecta "como" como duvida');

const r7 = parseMensagemCliente('Qual a documents necessária?');
assert(r7.intencao === 'duvida', 'Detecta "qual" como duvida');

const r8 = parseMensagemCliente('Bom dia');
assert(r8.intencao === 'desconhecida', 'Mensagem genérica retorna desconhecida');

const r9 = parseMensagemCliente('Quero marcar para conhecer o imóvel');
assert(r9.intencao === 'agendar_visita', 'Detecta "conhecer" como agendar_visita');

const r10 = parseMensagemCliente('Dúvida sobre o imóvel');
assert(r10.intencao === 'duvida', 'Detecta "dúvida" como duvida');

// ============================================================
// Testes de respostaAutomatica
// ============================================================

console.log('\n--- Testes de respostaAutomatica ---');

assert(
  respostaAutomatica('consulta_imovel', { codigo: 'DFM-123' }).includes('Encontrei o imóvel'),
  'respostaAutomatica para consulta_imovel menciona ficha'
);
assert(
  respostaAutomatica('agendar_visita', {}).includes('disponibilidade'),
  'respostaAutomatica para agendar_visita pergunta disponibilidade'
);
assert(
  respostaAutomatica('orcamento', {}).includes('análise completa'),
  'respostaAutomatica para orcamento pede link'
);
assert(
  respostaAutomatica('duvida', {}).includes('ajudar'),
  'respostaAutomatica para duvida oferece ajuda'
);
assert(
  respostaAutomatica('desconhecida', {}).includes('assistente virtual'),
  'respostaAutomatica para desconhecida apresenta bot'
);

// ============================================================
// Testes de ehHorarioComercial
// ============================================================

console.log('\n--- Testes de ehHorarioComercial ---');

// Segunda-feira 10:00 BRT = Seg 13:00 UTC
const segunda10h = new Date('2026-08-31T13:00:00Z'); // 2026-08-31 é segunda
assert(ehHorarioComercial(segunda10h) === true, 'Segunda 10h BRT é horário comercial');

// Sexta-feira 18:30 BRT = Sex 21:30 UTC
const sexta1830 = new Date('2026-09-04T21:30:00Z'); // 2026-09-04 é sexta
assert(ehHorarioComercial(sexta1830) === true, 'Sexta 18:30 BRT é horário comercial');

// Segunda 19:00 BRT = Seg 22:00 UTC (fechou)
const segunda19h = new Date('2026-08-31T22:00:00Z');
assert(ehHorarioComercial(segunda19h) === false, 'Segunda 19:00 BRT NÃO é horário comercial');

// Sábado 10:00 BRT = Sab 13:00 UTC
const sabado10h = new Date('2026-09-05T13:00:00Z'); // 2026-09-05 é sábado
assert(ehHorarioComercial(sabado10h) === true, 'Sábado 10h BRT é horário comercial');

// Sábado 14:00 BRT = Sab 17:00 UTC (fechou)
const sabado14h = new Date('2026-09-05T17:00:00Z');
assert(ehHorarioComercial(sabado14h) === false, 'Sábado 14:00 BRT NÃO é horário comercial');

// Domingo 10:00 BRT = Dom 13:00 UTC
const domingo10h = new Date('2026-09-06T13:00:00Z'); // 2026-09-06 é domingo
assert(ehHorarioComercial(domingo10h) === false, 'Domingo 10h BRT NÃO é horário comercial');

// Segunda 07:59 BRT = Seg 10:59 UTC (ainda fechado)
const segunda759 = new Date('2026-08-31T10:59:00Z');
assert(ehHorarioComercial(segunda759) === false, 'Segunda 07:59 BRT NÃO é horário comercial');

// ============================================================
// Testes de respostaInteligente
// ============================================================

console.log('\n--- Testes de respostaInteligente ---');

// Segunda 10h (horário comercial)
const respDentro = respostaInteligente('orcamento', {}, segunda10h);
assert(
  respDentro.includes('análise completa') && respDentro.includes('corretor entrará em contato'),
  'respostaInteligente fora do horário avisa que retorno será amanhã'
);

// Segunda 20h (fora do horário)
const respFora = respostaInteligente('orcamento', {}, segunda19h);
assert(
  respFora.includes('fora do horário') && respFora.includes('retorno amanhã'),
  'respostaInteligente fora do horário avisa que retorno será amanhã'
);

// ============================================================
// Resumo
// ============================================================

console.log(`\n========================================`);
console.log(`Total: ${testesPassaram + testesFalharam} testes`);
console.log(`Passaram: ${testesPassaram}`);
console.log(`Falharam: ${testesFalharam}`);
console.log(`========================================`);

if (testesFalharam > 0) {
  process.exit(1);
} else {
  console.log('\nTodos os testes passaram! ✅');
  process.exit(0);
}
