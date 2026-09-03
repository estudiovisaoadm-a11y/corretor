// Conector oficial de LEITURA Navent Open API (cobre WImóveis/ImovelWeb) — V4.3
// Vanilla, zero dependências (usa fetch global do Node >= 20).
//
// ── COMO CONSEGUIR O TOKEN ──────────────────────────────────────────────
// 1. No painel do anunciante (WImóveis/ImovelWeb), vá em integração de
//    anúncios via API e crie/obtenha as credenciais OAuth2 do integrador:
//    CLIENT_ID + CLIENT_SECRET.
// 2. Troque-as por um access token (protocolo OAuth2 client_credentials):
//      POST {BASE}/v1/application/login?grant_type=client_credentials
//           &client_id={CLIENT_ID}&client_secret={CLIENT_SECRET}
//    A resposta é um OAuth2AccessToken: { value, tokenType, expiresIn, ... }.
//    O campo "value" é o token a usar como NAVENT_TOKEN abaixo.
// 3. Exporte NAVENT_TOKEN com esse valor. Tokens expiram (campo expiresIn);
//    renove repetindo o login quando a API responder HTTP 401.
//
// ── AMBIENTES (conforme SDK PHP de referência) ───────────────────────────
// https://github.com/mrprompt/imovelweb-sdk (classe Base\HttpClient)
//   production → http://api-br.open.navent.com/v1/
//   sandbox    → http://api-br.sandbox.open.navent.com/v1/
// NAVENT_ENV seleciona o ambiente (default: sandbox). NAVENT_BASE_URL, se
// definido, sobrescreve o host ("/v1" é acrescentado se ausente).
// Doc interativa (Swagger): http://api-br.open.navent.com/
//
// ── AUTENTICAÇÃO ─────────────────────────────────────────────────────────
// Header `Authorization: Bearer <NAVENT_TOKEN>` em todas as chamadas
// (igual ao SDK: 'Authorization' => 'Bearer ' . $token). A UI Swagger aceita
// ainda o token como query ?access_token=, mas aqui usamos o header Bearer.
//
// ── ENDPOINTS USADOS ─────────────────────────────────────────────────────
//   GET /v1/imobiliarias/{codigoImobiliaria}/anuncios/online/resumo
//       Lista anúncios online (equiv. SDK Anuncios::resumo). Filtros query:
//       titulo, idTipoDePropiedad, operacion (/v1/operacoes), precioDesde,
//       precioHasta, codigoMoneda (/v1/moedas, ex. BRL), idUbicacion
//       (/v1/locais), codigoAviso, idAvisoNavplat, excluirAvisosDuplicados...
//   GET /v1/imobiliarias/{codigoImobiliaria}/anuncios/{codigoAnuncio}
//       Detalhe do anúncio (equiv. SDK Anuncios::info): titulo, descricao,
//       precos[] {moneda, monto, operacion}, caracteristicas[] {nombre,
//       valor} (ex. "Superficie total", "Dormitorios"), localizacao
//       {ubicacion, direccion,...}, tipoDePropiedad {tipo, subTipo}.
//       Usado quando buscarImoveis() recebe { detalhar: true }.
//
// ── CALLBACK DE LEADS (configurar uma única vez por integrador) ──────────
// Aponte a URL pública deste sistema + /webhook/leads/wimoveis (a rota
// POST /webhook/leads/:portal já existe no server.js e aceita portal
// "wimoveis"). Eventos de lead: CONTACTO e CONTACTO_MENSAJE.
//   PUT {BASE}/v1/configuracao/callbacks
//   Authorization: Bearer <NAVENT_TOKEN> — Content-Type: application/json
//   Body (ConfiguracionCallback):
//     {
//       "url": "https://<sua-url-publica>/webhook/leads/wimoveis",
//       "linguagemCallbackBody": "PT",
//       "subscriptions": ["CONTACTO", "CONTACTO_MENSAJE"],
//       "authorizationHeaderKey": "Authorization",
//       "authorizationHeaderValue": "Bearer <segredo-só-seu>"
//     }
// Ou por evento: PUT {BASE}/v1/configuracao/callbacks/{evento}?evento=CONTACTO
// (valores válidos: CONTACTO, CONTACTO_MENSAJE, AVISO_ESTADO_PUBLICACION,
// AVISO_ACTIVIDAD, AVISO_CALIDAD, CREDITO). Confira com:
//   GET {BASE}/v1/configuracao/callbacks
//
// ── CONTRATO DE ERRO ────────────────────────────────────────────────────
// NUNCA lança exceção. Sem NAVENT_TOKEN, sem "imobiliaria", falha de rede,
// timeout, HTTP != 2xx ou resposta inesperada → retorna { error[, status|
// code] }. O chamador diferencia sucesso/falha com Array.isArray(res).
//
// ── CONFIG VIA ENV ──────────────────────────────────────────────────────
//   NAVENT_TOKEN      (obrigatório para buscar; access token OAuth2)
//   NAVENT_ENV        production|sandbox (default: sandbox)
//   NAVENT_BASE_URL   (opcional; default conforme NAVENT_ENV acima)
//   NAVENT_IMOBILIARIA (opcional; código default da imobiliária no integrador)

const { analisar } = require('../../ficha');

const BASES = {
  production: 'http://api-br.open.navent.com',
  sandbox: 'http://api-br.sandbox.open.navent.com',
};
const USER_AGENT = 'navent-open-node (sistema-ia-imoveis)';

// Lê o env a cada chamada (não no load) para facilitar testes e rotação de token.
function getConfig() {
  const env = String(process.env.NAVENT_ENV || 'sandbox').toLowerCase().trim();
  const baseRaw = (process.env.NAVENT_BASE_URL || BASES[env] || BASES.sandbox).replace(/\/+$/, '');
  const baseUrl = /\/v1$/.test(baseRaw) ? baseRaw : `${baseRaw}/v1`;
  return {
    token: process.env.NAVENT_TOKEN || '',
    env: BASES[env] ? env : 'sandbox',
    baseUrl,
    imobiliaria: process.env.NAVENT_IMOBILIARIA || '',
  };
}

function num(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? v : null;
  let s = String(v).trim();
  if (!s) return null;
  if (/,\d{1,2}\s*$/.test(s)) s = s.replace(/\./g, '').replace(',', '.'); // "70,5" → 70.5
  else s = s.replace(/[^\d.-]/g, ''); // "550.000" / "R$ 550000" → dígitos
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function inteiro(v) {
  const n = num(v);
  return n == null ? null : Math.round(n);
}

function brl(n) {
  return n == null ? null : 'R$ ' + Math.round(n).toLocaleString('pt-BR');
}

function unwrapLista(json) {
  if (Array.isArray(json)) return json;
  if (json && typeof json === 'object') {
    for (const k of ['content', 'avisos', 'anuncios', 'items', 'data', 'results', 'lista']) {
      if (Array.isArray(json[k])) return json[k];
    }
    if (json.codigoAviso != null || json.titulo != null) return [json]; // detalhe único
  }
  return null;
}

// Mapeia filtros amigáveis → query oficial do resumo (extras passam verbatim,
// ex.: codigoAviso, idAvisoNavplat, excluirAvisosDuplicados, titulo).
const FILTRO_PARA_QUERY = {
  operacao: 'operacion',
  precoMin: 'precioDesde',
  precoMax: 'precioHasta',
  moeda: 'codigoMoneda',
  tipoPropriedade: 'idTipoDePropiedad',
  ubicacao: 'idUbicacion',
};
const RESERVADAS = new Set([
  'imobiliaria', 'detalhar', 'fetchImpl', 'timeoutMs',
  ...Object.keys(FILTRO_PARA_QUERY), ...Object.values(FILTRO_PARA_QUERY),
]);

async function getJson(fetchFn, url, headers, timeoutMs, rotulo) {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  try {
    const res = await fetchFn(url, { method: 'GET', headers, signal: ctrl ? ctrl.signal : undefined });
    if (!res.ok) {
      let corpo = '';
      try { corpo = String(await res.text()).slice(0, 300); } catch { /* ignora */ }
      if (res.status === 401 || res.status === 403) {
        return { error: `Navent API: credencial inválida/expirada (HTTP ${res.status}) em ${rotulo}. Renove o NAVENT_TOKEN via POST /v1/application/login (grant_type=client_credentials). ${corpo}`, status: res.status };
      }
      return { error: `Navent API HTTP ${res.status} em ${rotulo}. ${corpo}`, status: res.status };
    }
    try {
      return { json: await res.json() };
    } catch (e) {
      return { error: `Navent API: resposta não-JSON em ${rotulo} (${e.message}).` };
    }
  } catch (e) {
    const timeout = e && (e.name === 'AbortError' || /abort/i.test(String((e && e.message) || '')));
    return {
      error: timeout
        ? `Navent API: timeout após ${timeoutMs}ms em ${rotulo}.`
        : `Navent API: falha de rede/credencial em ${rotulo} (${(e && e.message) || e}).`,
      code: (e && e.cause && e.cause.code) || (e && e.code) || undefined,
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Busca anúncios online no endpoint oficial de resumo.
 * @returns {Promise<Array>} array bruto Navent em sucesso, ou { error[, status|code] } em falha (sem throw).
 */
async function buscarImoveis({
  imobiliaria,
  detalhar = false,
  fetchImpl = null,
  timeoutMs = 15000,
  ...filtros
} = {}) {
  const cfg = getConfig();
  if (!cfg.token) {
    return { error: 'buscarImoveis: NAVENT_TOKEN não definido. Obtenha CLIENT_ID/CLIENT_SECRET no painel do anunciante (integração de anúncios via API), troque por um access token via POST /v1/application/login?grant_type=client_credentials e exporte NAVENT_TOKEN=<access_token>.' };
  }
  const imob = imobiliaria || cfg.imobiliaria;
  if (!imob) {
    return { error: 'buscarImoveis: "imobiliaria" é obrigatória (código da imobiliária no integrador, path do resumo) — passe { imobiliaria } ou defina NAVENT_IMOBILIARIA.' };
  }
  const fetchFn = fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
  if (!fetchFn) return { error: 'buscarImoveis: fetch indisponível neste runtime (exija Node >= 20 ou injete fetchImpl).' };

  const params = new URLSearchParams();
  for (const [amigavel, oficial] of Object.entries(FILTRO_PARA_QUERY)) {
    if (filtros[amigavel] !== undefined && filtros[amigavel] !== null && filtros[amigavel] !== '') {
      params.set(oficial, String(filtros[amigavel]));
    }
  }
  for (const [k, v] of Object.entries(filtros)) {
    if (RESERVADAS.has(k) || v === undefined || v === null || v === '') continue;
    params.set(k, String(v));
  }
  const qs = params.toString();
  const resumoPath = `imobiliarias/${encodeURIComponent(imob)}/anuncios/online/resumo`;
  const url = `${cfg.baseUrl}/${resumoPath}${qs ? `?${qs}` : ''}`;
  const headers = { Accept: 'application/json', 'User-Agent': USER_AGENT, Authorization: `Bearer ${cfg.token}` };

  const r = await getJson(fetchFn, url, headers, timeoutMs, `GET /${resumoPath}`);
  if (r.error) return { error: r.error, status: r.status, code: r.code };
  const lista = unwrapLista(r.json);
  if (!lista) return { error: 'Navent API: formato de resposta inesperado no resumo (esperado array ou { content: [...] } de OpenNaventAvisoResumen).' };

  if (!detalhar) return lista;
  // Enriquece cada item do resumo com o detalhe (descricao/precos/caracteristicas).
  const saidas = [];
  for (const item of lista) {
    const codigo = item && (item.codigoAviso ?? item.claveInterna ?? null);
    if (codigo == null) { saidas.push(item); continue; }
    const detPath = `imobiliarias/${encodeURIComponent(imob)}/anuncios/${encodeURIComponent(String(codigo))}`;
    const d = await getJson(fetchFn, `${cfg.baseUrl}/${detPath}`, headers, timeoutMs, `GET /${detPath}`);
    saidas.push(d.error ? item : { ...item, ...(d.json && typeof d.json === 'object' ? d.json : {}) });
  }
  return saidas;
}

function carac(item, re) {
  const lista = Array.isArray(item.caracteristicas) ? item.caracteristicas : [];
  const achada = lista.find((c) => c && re.test(String(c.nombre ?? c.nome ?? c.name ?? '')));
  return achada ? String(achada.valor ?? achada.value ?? '') : '';
}

function extrairPreco(item) {
  const precos = Array.isArray(item.precos) ? item.precos : [];
  const comValor = precos.filter((p) => p && num(p.monto) != null);
  const venda = comValor.find((p) => /VENDA|VENTA/i.test(String(p.operacion || '')));
  const escolhido = venda || comValor[0] || null;
  if (escolhido) return { preco: num(escolhido.monto), moeda: escolhido.moneda || 'BRL', operacao: escolhido.operacion || null };
  const avulso = num(item.preco ?? item.price ?? item.valor ?? null);
  return avulso != null ? { preco: avulso, moeda: 'BRL', operacao: null } : { preco: null, moeda: null, operacao: null };
}

function extrairArea(item) {
  const total = carac(item, /superf[ií]cie total|area total|[aá]rea total/i);
  if (num(total) != null) return num(total);
  const util = carac(item, /superf[ií]cie cubierta|cubierta|util|[uú]til|constru[ií]da/i);
  if (num(util) != null) return num(util);
  const qualquer = carac(item, /superf[ií]cie|[aá]rea|metragem|\bm2\b/i);
  if (num(qualquer) != null) return num(qualquer);
  return num(item.area ?? item.areaM2 ?? item.metragem ?? item.superficie ?? null);
}

function localDe(item) {
  const loc = item.localizacao && typeof item.localizacao === 'object' ? item.localizacao : {};
  const res = item.ubicacion && typeof item.ubicacion === 'object' ? item.ubicacion : {};
  const nome = loc.ubicacion || res.ubicacion || loc.direccion || item.bairro || '';
  const cidade = item.cidade || '';
  const onde = [nome, cidade].filter(Boolean).join(', ') || 'local a confirmar';
  return { nome: nome || null, cidade: cidade || null, onde };
}

function tipoDe(item) {
  const t = item.tipoDePropiedad ?? item.tipo ?? null;
  if (t && typeof t === 'object') return t.tipo || t.subTipo || t.nome || 'Imóvel';
  if (typeof t === 'number') return `Imóvel (tipo ${t})`; // id — ver nomes em GET /v1/tipopropriedade
  if (typeof t === 'string' && t.trim()) return t.trim();
  return 'Imóvel';
}

/**
 * Converte um item Navent (OpenNaventAviso detalhe ou OpenNaventAvisoResumen)
 * para a entrada do analisar(). O texto sintético usa termos que a extração
 * heurística entende ("R$ 550.000", "70m2", bairro, "aceita financiamento",
 * "escritura", "habite-se", "matrícula", "permuta") — só inclui documento/
 * financiamento quando há menção na descrição/título (nunca inventa).
 * @returns {{url, texto, preco, area, meta:{codigo, fonte, titulo, operacao}}}
 */
function normalizar(item = {}) {
  const codigo = item.codigoAviso ?? item.claveInterna ?? item.idAvisoNavplat ?? null;
  const url = item.url || item.link || null; // resumo/detalhe não trazem link público
  const { preco, operacao } = extrairPreco(item);
  const area = extrairArea(item);

  const tipo = tipoDe(item);
  const { onde } = localDe(item);
  const operAmigavel = operacao
    ? (/VENDA|VENTA/i.test(operacao) ? 'venda' : /ALUGUEL|ALQUILER|LOC/i.test(operacao) ? 'aluguel' : String(operacao).toLowerCase())
    : 'venda';

  const quartos = inteiro(carac(item, /dormit[oó]rio|quarto|bedroom|cuarto/i)) ?? inteiro(item.quartos);
  const suites = inteiro(carac(item, /su[ií]te/i)) ?? inteiro(item.suites);
  const banhos = inteiro(carac(item, /banheiro|banho|ba[ñn]o/i)) ?? inteiro(item.banheiros);
  const vagas = inteiro(carac(item, /garagem|vaga|cochera|estacionamiento/i)) ?? inteiro(item.vagas);
  const titulo = String(item.titulo || '').trim().replace(/\s+/g, ' ');
  const desc = String(item.descricao || item.descripcion || '').trim().replace(/\s+/g, ' ');

  const partes = [`${tipo} ${operAmigavel} em ${onde}`, preco != null ? brl(preco) : 'preço a consultar'];
  if (area != null) partes.push(`${area}m2`);
  if (quartos) partes.push(`${quartos} quarto${quartos > 1 ? 's' : ''}${suites ? ` sendo ${suites} suíte${suites > 1 ? 's' : ''}` : ''}`);
  if (banhos) partes.push(`${banhos} banheiro${banhos > 1 ? 's' : ''}`);
  if (vagas) partes.push(`${vagas} vaga${vagas > 1 ? 's' : ''}`);

  const flags = [];
  if (/financi|fgts/i.test(`${titulo} ${desc}`)) flags.push('Aceita financiamento');
  if (/habite-se|habitese/i.test(`${titulo} ${desc}`)) flags.push('habite-se averbado');
  if (/escritura/i.test(`${titulo} ${desc}`)) flags.push('com escritura');
  if (/matr[íi]cula/i.test(`${titulo} ${desc}`)) flags.push('matrícula atualizada');
  if (/permuta|troca por|aceita troca/i.test(`${titulo} ${desc}`)) flags.push('aceita permuta');
  if (flags.length) partes.push(flags.join('. '));
  if (titulo) partes.push(`Anúncio: ${titulo.slice(0, 200)}`);
  if (desc) partes.push(desc.slice(0, 500));
  partes.push(`Anúncio Navent${codigo != null ? ` cód. ${codigo}` : ''}.`);

  return {
    url,
    texto: partes.join('. ') + '.',
    preco,
    area,
    meta: { codigo, fonte: 'navent-api', titulo: titulo || null, operacao: operAmigavel },
  };
}

/**
 * Busca na Navent Open API + analisa cada item com analisar() (src/ficha.js).
 * @returns {Promise<Array>} fichas (cada uma com .score/.veredito/.extracao + .meta),
 *          ou { error } em falha (passthrough de buscarImoveis, sem throw).
 */
async function buscarEAnalisar({ localizacaoNota = 6, ...busca } = {}) {
  const res = await buscarImoveis(busca);
  if (!Array.isArray(res)) return res; // { error }
  return res.map((item) => {
    const n = normalizar(item);
    try {
      const ficha = analisar({ url: n.url, texto: n.texto, preco: n.preco, area: n.area, localizacaoNota });
      return { ...ficha, meta: n.meta };
    } catch (e) {
      return { error: `Navent: falha ao analisar item ${n.meta.codigo ?? '?'} (${(e && e.message) || e}).`, meta: n.meta };
    }
  });
}

module.exports = { buscarImoveis, normalizar, buscarEAnalisar, getConfig };
