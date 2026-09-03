// Teste V4.2 do conector NetImóveis WCF — 100% MOCK, sem rede (exceto demo live opcional).
//   node test-wcf.js
// Parte 1: normalizar() em 2 fixtures simulando Site_ViewListarImoveisApi.
// Parte 2: buscarEAnalisar() com fetch mockado (injetado via fetchImpl).
// Parte 3 (esperada sem credencial): chamada live com timeout curto deve
//          retornar { error } graciosamente, sem lançar exceção.

const { buscarImoveis, normalizar, buscarEAnalisar } = require('./src/integracoes/api/netimoveis-wcf');

// --- Fixtures MOCK (formato Site_ViewListarImoveisApi do Swagger /Imovel) ---
const MOCK_WCF = [
  {
    Imovel_Id: 101,
    TipoImovel1: 'Apartamento',
    ValorImovel: 550000,
    AreaRealPrivativa: 70,
    Quartos: 3,
    Suites: 1,
    Banho: 2,
    VagaGaragem: 1,
    NomeBairro: 'Águas Claras',
    NomeCidade: 'Brasília',
    SiglaEstado: 'DF',
    FlagFinanciamento: true,
    FlagHabites: true,
    Descricao: 'Apartamento com escritura definitiva, aceita financiamento e permuta, matrícula atualizada.',
  },
  {
    Imovel_Id: 202,
    TipoImovel1: 'Apartamento',
    ValorImovel: 900000,
    AreaRealPrivativa: 60,
    Quartos: 2,
    Suites: 0,
    Banho: 1,
    VagaGaragem: 1,
    NomeBairro: 'Samambaia',
    NomeCidade: 'Brasília',
    SiglaEstado: 'DF',
    FlagFinanciamento: false,
    FlagHabites: false,
    Descricao: 'Apartamento bem localizado, próximo ao metrô. Documentação a regularizar.',
  },
];

function mockFetchCapturando(urlCapturada) {
  return async (url) => {
    urlCapturada.url = String(url);
    return {
      ok: true,
      status: 200,
      json: async () => MOCK_WCF,
    };
  };
}

(async () => {
  let falhas = 0;
  const ok = (cond, msg) => {
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`);
    if (!cond) falhas += 1;
  };

  console.log('--- [1] normalizar() (mock, sem rede) ---');
  const n1 = normalizar(MOCK_WCF[0]);
  const n2 = normalizar(MOCK_WCF[1]);
  console.log('n1:', JSON.stringify({ url: n1.url, preco: n1.preco, area: n1.area, meta: n1.meta }));
  console.log('n1.texto:', n1.texto);
  console.log('n2:', JSON.stringify({ url: n2.url, preco: n2.preco, area: n2.area, meta: n2.meta }));
  console.log('n2.texto:', n2.texto);
  ok(n1.preco === 550000 && n1.area === 70, 'n1 preco/area extraídos do WCF');
  ok(n1.meta.codigo === 101 && n1.meta.fonte === 'netimoveis-api', 'n1 meta {codigo, fonte}');
  ok(/R\$ 550\.000/.test(n1.texto) && /70m2/.test(n1.texto) && /Águas Claras/.test(n1.texto), 'n1 texto sintético com R$/m2/bairro');
  ok(/financiamento/i.test(n1.texto) && /escritura/i.test(n1.texto), 'n1 texto com termos de doc/financiamento');
  ok(n2.preco === 900000 && n2.area === 60 && n2.meta.codigo === 202, 'n2 preco/area/meta');

  console.log('\n--- [2] buscarEAnalisar() com fetch mockado (sem rede) ---');
  const urlCapturada = {};
  const fichas = await buscarEAnalisar({
    estado: 'distrito-federal',
    cidade: 'brasilia',
    pagina: 1,
    quantidade: 10,
    fetchImpl: mockFetchCapturando(urlCapturada),
  });
  ok(Array.isArray(fichas) && fichas.length === 2, 'buscarEAnalisar retorna 2 fichas');
  for (const f of fichas) {
    console.log(`cód. ${f.meta.codigo} | R$/m² ${f.extracao.preco_m2} | score ${f.score} | veredito ${f.veredito}`);
  }
  ok(typeof fichas[0].score === 'number' && typeof fichas[0].veredito === 'string', 'ficha 101 tem score/veredito');
  ok(fichas[0].score > fichas[1].score, 'ficha documentada+financiável pontua acima da sem documentos');
  ok(/apiKey=/.test(urlCapturada.url) && /quantidadeRegistro=10/.test(urlCapturada.url), `query WCF montada (${urlCapturada.url.slice(0, 120)}...)`);

  console.log('\n--- [3] erro de rede simulado retorna { error } sem throw ---');
  const rErr = await buscarImoveis({
    estado: 'distrito-federal',
    cidade: 'brasilia',
    fetchImpl: async () => { throw new Error('getaddrinfo ENOTFOUND wcfservices.netimoveis.com'); },
  });
  console.log('resposta:', JSON.stringify(rErr));
  ok(rErr && typeof rErr.error === 'string', 'falha de rede vira { error }');

  console.log('\n--- [4] demo live (sem credencial real: esperado { error } gracioso) ---');
  try {
    const live = await buscarImoveis({ estado: 'distrito-federal', cidade: 'brasilia', quantidade: 4, timeoutMs: 3000 });
    if (Array.isArray(live)) {
      console.log(`live OK (inesperado sem apiKey): ${live.length} imóveis.`);
    } else {
      console.log('live falhou graciosamente (ESPERADO sem credencial):', JSON.stringify(live).slice(0, 300));
    }
    ok(true, 'chamada live não lançou exceção');
  } catch (e) {
    ok(false, `chamada live LANÇOU (não deveria): ${e.message}`);
  }

  console.log(falhas === 0 ? '\nOK: test-wcf.js passou.' : `\nFALHOU: ${falhas} asserção(ões).`);
  process.exitCode = falhas === 0 ? 0 : 1;
})().catch((e) => {
  console.error('ERRO FATAL (não deveria acontecer):', e);
  process.exitCode = 1;
});
