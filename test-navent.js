// Teste OFFLINE do conector Navent Open API (V4.3) — sem rede.
// Uso: node test-navent.js
// Cobre: normalizar() com 2 fixtures estilo Navent (OpenNaventAviso),
// buscarEAnalisar() com fetch mockado (injetado via fetchImpl) e falha
// graciosa sem NAVENT_TOKEN (retorna { error }, sem throw).
const assert = require('node:assert/strict');

// Garante cenário "sem token" antes de qualquer chamada.
delete process.env.NAVENT_TOKEN;
delete process.env.NAVENT_IMOBILIARIA;

const { normalizar, buscarImoveis, buscarEAnalisar } = require('./src/integracoes/api/navent-open');

// ── Fixtures MOCK (formato OpenNaventAviso: precos[]/caracteristicas[]) ──
const FIXTURES = [
  {
    codigoAviso: 'NAV-1001',
    titulo: 'Apartamento 3 quartos em Águas Claras',
    descricao: 'Apartamento 3 quartos sendo 1 suíte, aceita financiamento com FGTS, escritura lavrada, condomínio com lazer completo.',
    precos: [{ moneda: 'BRL', monto: '550000', operacion: 'VENTA' }],
    caracteristicas: [
      { nombre: 'Superficie total', valor: '70' },
      { nombre: 'Dormitorios', valor: '3' },
      { nombre: 'Banos', valor: '2' },
      { nombre: 'Cocheras', valor: '1' },
    ],
    localizacao: { ubicacion: 'Águas Claras, Brasília', direccion: 'Rua das Figueiras, Águas Claras' },
    tipoDePropiedad: { idTipo: '1', tipo: 'Apartamento', subTipo: 'Padrão' },
  },
  {
    codigoAviso: 'NAV-2002',
    titulo: 'Casa 4 quartos no Lago Norte',
    descricao: 'Casa em condomínio fechado, 4 quartos, escritura e habite-se averbados. Não aceita permuta.',
    precos: [{ moneda: 'BRL', monto: '2400000', operacion: 'VENTA' }],
    caracteristicas: [
      { nombre: 'Superficie total', valor: '200' },
      { nombre: 'Dormitorios', valor: '4' },
      { nombre: 'Banos', valor: '5' },
      { nombre: 'Cocheras', valor: '4' },
    ],
    localizacao: { ubicacion: 'Lago Norte, Brasília', direccion: 'SHIN QI 10, Lago Norte' },
    tipoDePropiedad: { idTipo: '2', tipo: 'Casa', subTipo: 'Condomínio' },
  },
];

function resumo(ficha) {
  const e = ficha.extracao || {};
  return `score=${ficha.score} veredito=${ficha.veredito} preco=${e.preco} area=${e.area_m2} R$/m2=${e.preco_m2}`;
}

async function main() {
  console.log('== V4.3 Navent Open API — teste mock/offline ==');

  // 1) normalizar() direto nas fixtures
  console.log('\n[1] normalizar()');
  const n1 = normalizar(FIXTURES[0]);
  assert.equal(n1.preco, 550000, 'preco item 1');
  assert.equal(n1.area, 70, 'area item 1');
  assert.ok(n1.texto.includes('70m2'), 'texto tem "70m2"');
  assert.ok(n1.texto.includes('R$ 550.000'), 'texto tem "R$ 550.000"');
  assert.ok(n1.texto.includes('Águas Claras'), 'texto tem bairro');
  assert.ok(/financiamento/i.test(n1.texto), 'texto sinaliza financiamento');
  assert.equal(n1.meta.codigo, 'NAV-1001');
  assert.equal(n1.meta.fonte, 'navent-api');
  console.log('  item 1 OK:', JSON.stringify({ preco: n1.preco, area: n1.area, meta: n1.meta }));
  console.log('  texto 1:', n1.texto.slice(0, 160) + '…');

  const n2 = normalizar(FIXTURES[1]);
  assert.equal(n2.preco, 2400000, 'preco item 2');
  assert.equal(n2.area, 200, 'area item 2');
  assert.ok(n2.texto.includes('200m2'), 'texto tem "200m2"');
  assert.equal(n2.meta.codigo, 'NAV-2002');
  console.log('  item 2 OK:', JSON.stringify({ preco: n2.preco, area: n2.area, meta: n2.meta }));

  // 2) Falha graciosa sem token
  console.log('\n[2] sem NAVENT_TOKEN → { error } (sem throw, sem rede)');
  const semToken = await buscarImoveis({ imobiliaria: 'QUALQUER' });
  assert.ok(semToken && typeof semToken.error === 'string', 'retorna { error }');
  assert.ok(/NAVENT_TOKEN não definido/.test(semToken.error), 'erro explica que NAVENT_TOKEN não definido');
  console.log('  OK:', semToken.error.slice(0, 120) + '…');
  const semToken2 = await buscarEAnalisar({ imobiliaria: 'QUALQUER', fetchImpl: async () => { throw new Error('não deveria chamar rede'); } });
  assert.ok(semToken2 && /NAVENT_TOKEN/.test(semToken2.error), 'buscarEAnalisar propaga { error } sem rede');
  console.log('  buscarEAnalisar sem token OK (não chamou fetch).');

  // 3) buscarEAnalisar() com fetch mockado
  console.log('\n[3] buscarEAnalisar() com fetch mockado');
  process.env.NAVENT_TOKEN = 'token-mock-teste';
  let urlChamada = '';
  let authChamado = '';
  const fetchMock = async (url, opts = {}) => {
    urlChamada = String(url);
    authChamado = (opts.headers && opts.headers.Authorization) || '';
    return { ok: true, status: 200, json: async () => ({ content: FIXTURES }) };
  };
  const fichas = await buscarEAnalisar({ imobiliaria: 'TESTE', fetchImpl: fetchMock });
  assert.ok(Array.isArray(fichas) && fichas.length === 2, 'retorna 2 fichas');
  assert.ok(urlChamada.includes('/imobiliarias/TESTE/anuncios/online/resumo'), 'chamou endpoint de resumo: ' + urlChamada);
  assert.equal(authChamado, 'Bearer token-mock-teste', 'enviou Authorization Bearer');
  for (const f of fichas) {
    assert.equal(typeof f.score, 'number', 'ficha tem score');
    assert.ok(f.veredito, 'ficha tem veredito');
    assert.equal(f.meta.fonte, 'navent-api', 'meta.fonte preservada');
    console.log(`  [${f.meta.codigo}] ${f.meta.titulo} → ${resumo(f)}`);
  }
  // Heurística bateu nos valores estruturados (não inventados pelo texto):
  assert.equal(fichas[0].extracao.preco, 550000);
  assert.equal(fichas[0].extracao.area_m2, 70);
  assert.equal(fichas[1].extracao.preco, 2400000);
  assert.equal(fichas[1].extracao.area_m2, 200);

  console.log('\nPASS: normalizar + buscarEAnalisar(mock) + falha sem token. Tudo offline.');
}

main().catch((e) => { console.error('FAIL:', e); process.exit(1); });
