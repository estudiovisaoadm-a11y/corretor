'use strict';

const { gerarProposta, validarProposta, resumoProposta, formatarMoeda } = require('./src/proposta/index.js');

let total = 0;
let passaram = 0;

function ok(desc, cond) {
  total++;
  if (cond) {
    passaram++;
    console.log(`  ✓ ${desc}`);
  } else {
    console.log(`  ✗ FALHOU: ${desc}`);
  }
}

function assertEq(desc, actual, expected) {
  total++;
  if (actual === expected) {
    passaram++;
    console.log(`  ✓ ${desc}`);
  } else {
    console.log(`  ✗ FALHOU: ${desc}`);
    console.log(`    esperado: ${JSON.stringify(expected)}`);
    console.log(`    obtido:   ${JSON.stringify(actual)}`);
  }
}

// ─── Dados de teste ────────────────────────────────────────────
const analise = {
  score: 82,
  veredito: 'Ótima oportunidade',
  extracao: {
    preco: 450000,
    area: 120,
    preco_m2: 3750,
    aceita_financiamento: true,
    tem_escritura: true,
    tem_habite_se: false,
    tem_condominio: 850,
    IPTU: 210,
  },
  bairro: 'Moema',
  url: 'https://www.zapimoveis.com.br/imovel/123456',
  ficha: {},
};

const config = {
  corretorNome: 'João Silva',
  corretorCreci: '12345/SP',
  imobiliariaNome: 'Imobiliária Teste LTDA',
  validadeDias: 15,
  comissaoPct: 5,
  observacoes: 'Contato via WhatsApp.',
};

// ─── Testes: formatarMoeda ─────────────────────────────────────
console.log('\n=== formatarMoeda ===');
assertEq('Formata valor inteiro', formatarMoeda(1234567), 'R$ 1.234.567');
assertEq('Formata valor pequeno', formatarMoeda(1500), 'R$ 1.500');
assertEq('Trata null', formatarMoeda(null), 'R$ 0');
assertEq('Trata NaN', formatarMoeda(NaN), 'R$ 0');

// ─── Testes: validarProposta ────────────────────────────────────
console.log('\n=== validarProposta ===');
const vOk = validarProposta(analise);
assertEq('Análise válida retorna ok', vOk.ok, true);
assertEq('Análise válida sem erros', vOk.erros.length, 0);

const vSemPreco = validarProposta({ ...analise, extracao: { ...analise.extracao, preco: null } });
ok('Detecta preço ausente', !vSemPreco.ok && vSemPreco.erros.some(e => e.includes('Preço')));

const vSemBairro = validarProposta({ ...analise, bairro: '' });
ok('Detecta bairro ausente', !vSemBairro.ok && vSemBairro.erros.some(e => e.includes('Bairro')));

const vSemArea = validarProposta({ ...analise, extracao: { ...analise.extracao, area: null } });
ok('Avisa sobre área ausente', vSemArea.erros.some(e => e.includes('Área')));

const vSemEscritura = validarProposta({ ...analise, extracao: { ...analise.extracao, tem_escritura: null } });
ok('Avisa sobre escritura ausente', vSemEscritura.erros.some(e => e.includes('escritura')));

const vNulo = validarProposta(null);
ok('Trata null como erro', !vNulo.ok);

// ─── Testes: gerarProposta ─────────────────────────────────────
console.log('\n=== gerarProposta ===');
const proposta = gerarProposta(analise, config);

ok('Contém PROPOSTA DE INTERMEDIAÇÃO', proposta.includes('PROPOSTA DE INTERMEDIAÇÃO'));
ok('Contém DADOS DO IMÓVEL', proposta.includes('DADOS DO IMÓVEL'));
ok('Contém CONDIÇÕES', proposta.includes('CONDIÇÕES'));
ok('Contém INTERMEDIÁRIO', proposta.includes('INTERMEDIÁRIO(A): João Silva'));
ok('Contém CRECI', proposta.includes('CRECI: 12345/SP'));
ok('Contém imobiliária', proposta.includes('Imobiliária Teste LTDA'));
ok('Contém bairro', proposta.includes('Bairro: Moema'));
ok('Contém área', proposta.includes('Área: 120m²'));
ok('Contém preço formatado', proposta.includes('Preço: R$ 450.000'));
ok('Contém preço/m²', proposta.includes('Preço/m²: R$ 3.750'));
ok('Contém score', proposta.includes('82/100'));
ok('Contém veredito', proposta.includes('Ótima oportunidade'));
ok('Contém financiamento (sim)', proposta.includes('Sim, aceita financiamento'));
ok('Contém escritura registrada', proposta.includes('Escritura: ✓ registrada'));
ok('Contém habite-se pendente', proposta.includes('Habite-se: ✗ pendente'));
ok('Contém IPTU', proposta.includes('IPTU: R$ 210'));
ok('Contém comissão customizada', proposta.includes('5% sobre o valor de venda'));
ok('Contém validade', proposta.includes('15 dias'));
ok('Contém observações', proposta.includes('Contato via WhatsApp'));
ok('Contém rodapé IA', proposta.includes('_Análise gerada por IA'));
ok('Contém data', proposta.includes('DATA:'));

const propostaSemConfig = gerarProposta(analise, { corretorNome: 'Ana', corretorCreci: '99999/SP' });
ok('Funciona com config mínima', propostaSemConfig.includes('Ana') && propostaSemConfig.includes('6%'));

// ─── Testes: resumoProposta ────────────────────────────────────
console.log('\n=== resumoProposta ===');
const resumo = resumoProposta(analise);
ok('Resumo tem emoji casa', resumo.includes('🏠'));
ok('Resumo tem bairro', resumo.includes('Moema'));
ok('Resumo tem preço', resumo.includes('R$ 450.000'));
ok('Resumo tem área', resumo.includes('120m²'));
ok('Resumo tem score', resumo.includes('Score 82/100'));
ok('Resumo tem veredito', resumo.includes('Ótima oportunidade'));
ok('Resumo tem financiamento', resumo.includes('💳'));
ok('Resumo tem docs', resumo.includes('📝'));
ok('Resumo tem escritura status', resumo.includes('Escritura ✓'));
ok('Resumo tem habite-se status', resumo.includes('Habite-se ✗'));

const resumoVazio = resumoProposta(null);
assertEq('Resumo null retorna vazio', resumoVazio, '');

// ─── Resultado ─────────────────────────────────────────────────
console.log(`\n${'═'.repeat(40)}`);
console.log(`Resultado: ${passaram}/${total} testes passaram`);
if (passaram < total) {
  console.log('FALHA');
  process.exit(1);
} else {
  console.log('TODOS OK');
}
