// Conector oficial de LEITURA NetImóveis (WCF) — V4.2
// Vanilla, zero dependências (usa fetch global do Node >= 20).
//
// Documentação oficial (Swagger 1.2, UI em https://wcfservices.netimoveis.com/docs/):
//   JSON da UI:  GET https://wcfservices.netimoveis.com/swagger/api-docs
//   Recurso:     GET https://wcfservices.netimoveis.com/swagger/api-docs/Imovel
// Operação de leitura usada aqui (nickname "Imovel_Get"):
//   GET /api/imovel/lista
//     query obrigatórias: apiKey, quantidadeRegistro, pagina, transacao, estado, cidade
//     query opcionais: regiao, bairro, tipo, valorMinimo, valorMaximo, quartos,
//       suites, banhos, vagas, idadeMinima, areaMinima, areaMaxima, tipeOrderBy,
//       orderByCollunName, outrasPags, agenciaId, tipoRetornoLocacao,
//       tipoRetornoVenda, semfiador
//     resposta: array de Site_ViewListarImoveisApi (Imovel_Id, ValorImovel,
//       AreaRealPrivativa/AreaConstruida/AreaLote, NomeBairro, NomeCidade,
//       SiglaEstado, Descricao, Quartos, Suites, Banho, VagaGaragem,
//       FlagFinanciamento, FlagHabites, TipoImovel1, ...)
// Convenção de cidade: minúscula, sem acento, com hífen (ex.: "brasilia",
// "sao-paulo", "sao-jose-do-rio-preto") — ver slugCidade() abaixo.
//
// Contrato de erro: NUNCA lança exceção. Falha de rede, timeout, HTTP != 2xx
// ou resposta inesperada retorna { error } — o chamador diferencia com
// Array.isArray(res).
//
// Config via env:
//   NETIMOVEIS_WCF_URL  (default https://wcfservices.netimoveis.com)
//   NETIMOVEIS_API_KEY  (opcional; enviada como query ?apiKey= — exigida pelo
//                        Swagger — e também como header Authorization Bearer,
//                        por convenção)

const { analisar } = require('../../ficha');

const WCF_URL = (process.env.NETIMOVEIS_WCF_URL || 'https://wcfservices.netimoveis.com').replace(/\/+$/, '');
const API_KEY = process.env.NETIMOVEIS_API_KEY || '';

function slugCidade(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // sem acento
    .toLowerCase()
    .trim()
    .replace(/[_\s]+/g, '-') // espaço/underline → hífen
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function clampQtd(q) {
  const n = Number(q);
  if (!Number.isFinite(n)) return 10;
  return Math.min(50, Math.max(4, Math.floor(n))); // paginação WCF: 4–50
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function unwrapLista(json) {
  if (Array.isArray(json)) return json;
  if (json && typeof json === 'object') {
    for (const k of ['lista', 'data', 'result', 'results', 'items', 'imoveis']) {
      if (Array.isArray(json[k])) return json[k];
    }
  }
  return null;
}

/**
 * Busca imóveis na operação oficial GET /api/imovel/lista.
 * @returns {Promise<Array>} array bruto WCF em sucesso, ou { error[, status|code] } em falha (sem throw).
 */
async function buscarImoveis({
  estado,
  cidade,
  pagina = 1,
  quantidade = 10,
  transacao = 'venda',
  fetchImpl = null,
  timeoutMs = 12000,
  ...filtros
} = {}) {
  if (!estado || !cidade) {
    return { error: 'buscarImoveis: "estado" e "cidade" são obrigatórios (ex.: { estado: "distrito-federal", cidade: "brasilia" }).' };
  }
  const fetchFn = fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
  if (!fetchFn) return { error: 'buscarImoveis: fetch indisponível neste runtime (exija Node >= 20 ou injete fetchImpl).' };

  const params = new URLSearchParams({
    apiKey: API_KEY,
    quantidadeRegistro: String(clampQtd(quantidade)),
    pagina: String(Math.max(1, Number(pagina) || 1)),
    transacao: String(transacao),
    estado: slugCidade(estado),
    cidade: slugCidade(cidade),
  });
  for (const [k, v] of Object.entries(filtros)) {
    if (v === undefined || v === null || v === '') continue;
    params.set(k, String(v));
  }
  const url = `${WCF_URL}/api/imovel/lista?${params.toString()}`;

  const headers = { Accept: 'application/json' };
  if (API_KEY) headers.Authorization = `Bearer ${API_KEY}`;

  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  try {
    const res = await fetchFn(url, { method: 'GET', headers, signal: ctrl ? ctrl.signal : undefined });
    if (!res.ok) {
      let corpo = '';
      try { corpo = String(await res.text()).slice(0, 300); } catch { /* ignora */ }
      return { error: `NetImóveis WCF HTTP ${res.status} em GET /api/imovel/lista. ${corpo}`, status: res.status };
    }
    let json;
    try {
      json = await res.json();
    } catch (e) {
      return { error: `NetImóveis WCF: resposta não-JSON em GET /api/imovel/lista (${e.message}).` };
    }
    const lista = unwrapLista(json);
    if (!lista) return { error: 'NetImóveis WCF: formato de resposta inesperado (esperado array de imóveis).' };
    return lista;
  } catch (e) {
    const timeout = e && (e.name === 'AbortError' || /abort/i.test(e.message || ''));
    return {
      error: timeout
        ? `NetImóveis WCF: timeout após ${timeoutMs}ms em GET /api/imovel/lista.`
        : `NetImóveis WCF: falha de rede/credencial (${(e && e.message) || e}).`,
      code: (e && e.cause && e.cause.code) || (e && e.code) || undefined,
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function brl(n) {
  return n == null ? null : 'R$ ' + Math.round(n).toLocaleString('pt-BR');
}

/**
 * Converte um item WCF (Site_ViewListarImoveisApi) para a entrada do analisar().
 * O texto sintético usa termos que a extração heurística entende
 * ("R$ 550.000", "70m2", bairro, "aceita financiamento", "escritura",
 * "habite-se", "matrícula", "permuta") — só inclui documento/financiamento
 * quando há flag ou menção na descrição (nunca inventa).
 * @returns {{url, texto, preco, area, meta:{codigo, fonte}}}
 */
function normalizar(item = {}) {
  const codigo = item.Imovel_Id ?? item.ImovelSan_Id ?? item.CodigoMigracao ?? null;
  const url = codigo != null
    ? `https://www.netimoveis.com/imovel/${codigo}`
    : 'https://www.netimoveis.com/';
  const preco = num(item.ValorImovel) ?? num(item.ValorLocacao) ?? num(item.ValorTemporada) ?? null;
  const area = num(item.AreaRealPrivativa) || num(item.AreaConstruida) || num(item.AreaLote) || null;

  const tipo = item.TipoImovel1 || item.TipoImovel2 || 'Imóvel';
  const bairro = item.NomeBairro || item.NomeBairro2 || null;
  const cidade = item.NomeCidade || null;
  const uf = item.SiglaEstado || null;
  const onde = [bairro, cidade && uf ? `${cidade}/${uf}` : (cidade || uf)].filter(Boolean).join(', ') || 'local a confirmar';

  const quartos = num(item.Quartos);
  const suites = num(item.Suites);
  const banhos = num(item.Banho);
  const vagas = num(item.VagaGaragem);
  const desc = String(item.Descricao || item.TextoComplementar || '').trim().replace(/\s+/g, ' ');

  const partes = [`${tipo} em ${onde}`, preco != null ? brl(preco) : 'preço a consultar'];
  if (area != null) partes.push(`${area}m2`);
  if (quartos) partes.push(`${quartos} quarto${quartos > 1 ? 's' : ''}${suites ? ` sendo ${suites} suíte${suites > 1 ? 's' : ''}` : ''}`);
  if (banhos) partes.push(`${banhos} banheiro${banhos > 1 ? 's' : ''}`);
  if (vagas) partes.push(`${vagas} vaga${vagas > 1 ? 's' : ''}`);

  const flags = [];
  if (item.FlagFinanciamento === true || /financi|fgts/i.test(desc)) flags.push('Aceita financiamento');
  if (item.FlagHabites === true || /habite-se|habitese/i.test(desc)) flags.push('habite-se averbado');
  if (/escritura/i.test(desc)) flags.push('com escritura');
  if (/matr[íi]cula/i.test(desc)) flags.push('matrícula atualizada');
  if (/permuta|troca por|aceita troca/i.test(desc)) flags.push('aceita permuta');
  if (flags.length) partes.push(flags.join('. '));
  if (desc) partes.push(desc.slice(0, 500));
  partes.push(`Anúncio NetImóveis${codigo != null ? ` cód. ${codigo}` : ''}.`);

  return {
    url,
    texto: partes.join('. ') + '.',
    preco,
    area,
    meta: { codigo, fonte: 'netimoveis-api' },
  };
}

/**
 * Busca no WCF + analisa cada item com analisar() (src/ficha.js).
 * @returns {Promise<Array>} fichas (cada uma com .score/.veredito/.extracao + .meta),
 *          ou { error } em falha (passthrough de buscarImoveis, sem throw).
 */
async function buscarEAnalisar({ localizacaoNota = 6, ...busca } = {}) {
  const res = await buscarImoveis(busca);
  if (!Array.isArray(res)) return res; // { error }
  return res.map((item) => {
    const n = normalizar(item);
    const ficha = analisar({ url: n.url, texto: n.texto, preco: n.preco, area: n.area, localizacaoNota });
    return { ...ficha, meta: n.meta };
  });
}

module.exports = { buscarImoveis, normalizar, buscarEAnalisar, slugCidade };
