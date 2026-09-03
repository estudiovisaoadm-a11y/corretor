// Servidor completo — zero dependências. Painel + API + webhook WhatsApp + CRM leve.
const http = require('http');
const fs = require('fs');
const pathMod = require('path');
const { analisar, fichaMarkdown } = require('./src/ficha');
const { handleIncoming } = require('./src/bot/handler');
const { sendText } = require('./src/bot/evolution');
const store = require('./src/db');
const { fetchTextoAnuncio } = require('./src/fetchAnuncio');
const { runMonitor, ensureSeed } = require('./src/monitor');
const { mapaData } = require('./src/mapa');
const { prever } = require('./src/ia/valorizacao');
const { comparar } = require('./src/comparar');
const { gerarLegenda } = require('./src/ia/legenda');
const { alertasOportunidade } = require('./src/alertas');
const { gerarFeedXml, contentType: feedContentType } = require('./src/feed/xml');
const { normalizarLead } = require('./src/leads');

const STATUS_VALIDOS = ['novo', 'analisado', 'visitado', 'proposta', 'fechado', 'descartado'];

function send(res, code, obj, type = 'application/json') {
  const body = typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2);
  res.writeHead(code, { 'Content-Type': `${type}; charset=utf-8`, 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': '*', 'Access-Control-Allow-Headers': '*' });
  res.end(body);
}
async function readJson(req) {
  let raw = '';
  for await (const c of req) raw += c;
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return { _raw: raw }; }
}
function query(url) {
  const i = url.indexOf('?');
  const out = {};
  if (i < 0) return out;
  for (const p of url.slice(i + 1).split('&')) {
    const [k, v] = p.split('=');
    out[decodeURIComponent(k)] = decodeURIComponent(v || '');
  }
  return out;
}

function painelHtml() {
  return fs.readFileSync(pathMod.join(__dirname, 'public', 'index.html'), 'utf8');
}

const server = http.createServer(async (req, res) => {
  const path = req.url.split('?')[0];
  if (req.method === 'OPTIONS') return send(res, 204, '');
  if (req.method === 'GET' && path === '/styles.css') {
    try { return send(res, 200, fs.readFileSync(pathMod.join(__dirname, 'public', 'styles.css'), 'utf8'), 'text/css'); }
    catch { return send(res, 404, { error: 'não encontrado' }); }
  }
  if (req.method === 'GET' && path === '/') {
    try { return send(res, 200, painelHtml(), 'text/html'); }
    catch { return send(res, 500, { error: 'frontend não encontrado' }); }
  }

  if (req.method === 'POST' && path === '/api/analisar') {
    const input = await readJson(req);
    let texto = input.texto || input._raw || '';
    if (input.url && !texto) texto = await fetchTextoAnuncio(input.url);
    else if (input.url && texto.length < 8000) texto = texto + '\n' + await fetchTextoAnuncio(input.url);
    const r = analisar({ url: input.url, texto, preco: input.preco ?? null, area: input.area ?? null, localizacaoNota: input.localizacaoNota ?? 6 });
    r.ficha = fichaMarkdown(r);
    const saved = await store.addAnalise({ ...r, origem: 'painel' });
    return send(res, 200, saved);
  }

  if (req.method === 'GET' && path === '/api/historico') {
    const q = query(req.url);
    return send(res, 200, await store.listAnalises({ fonte: q.fonte || undefined, status: q.status || undefined, q: q.q || undefined, minScore: q.minScore ? Number(q.minScore) : undefined, financiavel: q.financiavel === '1', comEscritura: q.comEscritura === '1' }));
  }
  if (req.method === 'GET' && path === '/api/analise') {
    const rec = await store.getAnalise(query(req.url).id);
    return rec ? send(res, 200, rec) : send(res, 404, { error: 'não encontrada' });
  }
  if (req.method === 'POST' && path === '/api/status') {
    const { id, status } = await readJson(req);
    if (!STATUS_VALIDOS.includes(status)) return send(res, 400, { error: 'status inválido: ' + STATUS_VALIDOS.join(',') });
    const rec = await store.setStatus(id, status);
    return rec ? send(res, 200, rec) : send(res, 404, { error: 'não encontrada' });
  }
  if (req.method === 'GET' && path === '/api/comparar') {
    const ids = (query(req.url).ids || '').split(',').filter(Boolean);
    return send(res, 200, comparar(await Promise.all(ids.map((id) => store.getAnalise(id)))));
  }
  if (req.method === 'POST' && path === '/api/legenda') {
    const { id, analise } = await readJson(req);
    const a = analise || (id ? await store.getAnalise(id) : null);
    if (!a) return send(res, 404, { error: 'informe id ou analise' });
    return send(res, 200, gerarLegenda(a));
  }
  if (req.method === 'GET' && path === '/api/medias') return send(res, 200, await store.mediasPorBairro());
  if (req.method === 'GET' && path === '/api/funil') return send(res, 200, await store.funil());
  if (req.method === 'GET' && path === '/api/alertas') return send(res, 200, alertasOportunidade(await store.listAnalises({})));

  if (req.method === 'POST' && path === '/webhook/evolution') {
    const body = await readJson(req);
    const evento = body?.event || body?.type || '';
    if (evento && !String(evento).toUpperCase().includes('MESSAGES')) return send(res, 200, { ignored: true, evento });
    const out = await handleIncoming(body, fetchTextoAnuncio);
    if (out.ignored) return send(res, 200, { ignored: true });
    if (out.analise) await store.addAnalise({ ...out.analise, origem: 'whatsapp', whatsapp: out.number });
    for (const reply of out.replies) {
      try { await sendText(out.number, reply); } catch (e) { console.error('falha ao enviar WhatsApp:', e.message); }
    }
    return send(res, 200, { ok: true, number: out.number, score: out.analise?.score, veredito: out.analise?.veredito });
  }

  if (req.method === 'GET' && path === '/api/mapa') return send(res, 200, mapaData(await store.mediasPorBairro()));
  if (req.method === 'GET' && path === '/api/valorizacao') {
    const a = await store.getAnalise(query(req.url).id);
    if (!a) return send(res, 404, { error: 'análise não encontrada' });
    return send(res, 200, prever(a, await store.listSnapshots(10)));
  }
  if (req.method === 'GET' && path === '/api/watchlist') return send(res, 200, await ensureSeed(store));
  if (req.method === 'POST' && path === '/api/watchlist') {
    const { url, rotulo } = await readJson(req);
    if (!url) return send(res, 400, { error: 'informe url' });
    return send(res, 200, await store.watchAdd(url, rotulo));
  }
  if (req.method === 'DELETE' && path === '/api/watchlist') {
    await store.watchRemove(query(req.url).id);
    return send(res, 200, { ok: true });
  }
  if (req.method === 'POST' && path === '/api/monitor/run') {
    return send(res, 200, await runMonitor(store, fetchTextoAnuncio));
  }

  if (req.method === 'GET' && path === '/feed/xml') {
    const todas = await store.listAnalises({});
    const validas = todas.filter((a) => a.status !== 'descartado' && a.extracao && a.extracao.preco);
    return send(res, 200, gerarFeedXml(validas), feedContentType);
  }
  if (req.method === 'POST' && path.startsWith('/webhook/leads/')) {
    const portal = path.slice('/webhook/leads/'.length).split('/')[0].trim().toLowerCase();
    const PORTAIS_VALIDOS = ['dfimoveis', 'wimoveis', 'netimoveis', 'zap', 'vivareal', 'olx'];
    if (!PORTAIS_VALIDOS.includes(portal)) return send(res, 400, { error: 'portal inválido: ' + PORTAIS_VALIDOS.join(',') });
    const payload = await readJson(req);
    const reg = normalizarLead(portal, payload);
    if (reg.error) return send(res, 400, { error: reg.error });
    const saved = await store.addAnalise(reg);
    return send(res, 200, { ok: true, id: saved.id });
  }

  send(res, 404, { error: 'rota não encontrada' });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Sistema rodando em http://localhost:${PORT}`));
