// Servidor completo — zero dependências. Painel + API + webhook WhatsApp + CRM leve.
const http = require('http');
const fs = require('fs');
const pathMod = require('path');
const { analisar, analisarComExtracao, fichaMarkdown } = require('./src/ficha');
const { extrairComIA } = require('./src/ia/service');
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
const { distribuirLead, checarFila, slaStatus, mensagemCorretor } = require('./src/distribuicao');
const { scoreLead } = require('./src/scoring/lead-score');
const { matchLeadImovel, extrairPerfil } = require('./src/match');
const { tarefasPendentes, iniciarSequencia, avancarStep, gerarMensagem: msgFollowup } = require('./src/followup');
const { formatarFicha: fichaCliente, parseMensagemCliente, respostaInteligente } = require('./src/bot247');
const { metricasGerais, tempoResposta, velocityFunil, conversaoPorCorretor, conversaoPorPortal } = require('./src/gestor');
const { gerarProposta, validarProposta, resumoProposta } = require('./src/proposta');
const { candidatosReativacao, gerarMensagemReativacao, classificarLead } = require('./src/reativacao');
const { applySecurityHeaders, isAuthorized, rateLimit, readJson, verifyWebhook, idempotencyKey, MAX_BODY_BYTES } = require('./src/security');
const { hashPassword, login, authenticate } = require('./src/auth');
const { PersistentQueue } = require('./src/jobs/queue');
const { assertConfig, publicConfig } = require('./src/config');
const { safeError, log } = require('./src/logger');

assertConfig();

const RR_CHAVE = 'distribuicao:rr';
const { buildOverview } = require('./src/dashboard');
const jobs = new PersistentQueue(store, { handlers: {
  monitor: () => runMonitor(store, fetchTextoAnuncio)
} });
jobs.start({ intervalMs: Number(process.env.JOB_INTERVAL_MS) || 1000 }).catch((e) => console.error('fila não iniciou:', e.message));
async function distribuirESalvar(reg) {
  const equipe = await store.equipeList();
  const estado = (await store.metaGet(RR_CHAVE)) || { ultimoIndice: -1 };
  const d = distribuirLead(reg, equipe, estado);
  if (d.proximoEstado) await store.metaSet(RR_CHAVE, d.proximoEstado);
  const completo = { ...reg, corretorId: d.corretorId || null, corretorNome: d.corretorNome || null, distribuidoEm: d.distribuidoEm || null };
  const saved = await store.addAnalise(completo);
  if (d.corretorId && d.whatsapp) {
    try { await sendText(d.whatsapp, mensagemCorretor(saved)); } catch (e) { console.error('falha ao notificar corretor:', e.message); }
  }
  return { saved, dist: d };
}
function isLead(a) {
  return a && typeof a.origem === 'string' && a.origem.indexOf('lead-') === 0;
}
async function filaQuente() {
  const analises = await store.listAnalises({});
  const mediaScores = {};
  for (const a of analises) {
    const cod = a.lead?.codigoImovel || a.id;
    if (typeof a.score === 'number') mediaScores[cod] = a.score;
  }
  const agora = Date.now();
  return analises
    .filter(isLead)
    .map((l) => ({ ...l, leadScore: scoreLead(l, { mediaScores, agoraMs: agora }), sla: slaStatus(l, agora) }))
    .sort((x, y) => y.leadScore.score - x.leadScore.score);
}

const STATUS_VALIDOS = ['novo', 'analisado', 'visitado', 'proposta', 'fechado', 'descartado'];

function send(res, code, obj, type = 'application/json') {
  const body = typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2);
  applySecurityHeaders(res, res.req?.headers?.origin);
  res.setHeader('Content-Type', type + '; charset=utf-8');
  if (type === 'application/json' || type === 'text/html' || type === 'application/javascript') {
    res.setHeader('Cache-Control', 'no-store');
  } else if (type === 'text/css') {
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
  }
  if (type === 'text/html') {
    res.setHeader('Content-Security-Policy', `default-src 'self'; script-src 'self' 'unsafe-inline' https://unpkg.com https://cdn-icons-png.flaticon.com; script-src-attr 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://unpkg.com; img-src 'self' data: https://cdn-icons-png.flaticon.com https://images.unsplash.com; connect-src 'self' https: http://localhost:*; frame-ancestors 'none'`);
  }
  res.writeHead(code);
  res.end(body);
}
function query(url) {
  const out = {};
  try {
    for (const [k, v] of new URL(url, 'http://localhost').searchParams) out[k] = v;
  } catch { return out; }
  return out;
}
function positiveInt(value, fallback, max = 100) {
  if (value == null || value === '') return fallback;
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? Math.min(n, max) : fallback;
}

function painelHtml() {
  return fs.readFileSync(pathMod.join(__dirname, 'public', 'index.html'), 'utf8');
}
function landingHtml() {
  return fs.readFileSync(pathMod.join(__dirname, 'public', 'landing.html'), 'utf8');
}

const server = http.createServer(async (req, res) => {
  try {
    const requestId = String(req.headers['x-request-id'] || '').slice(0, 80) || require('crypto').randomUUID();
    res.setHeader('X-Request-Id', requestId);
    const path = req.url.split('?')[0];
    if (Number(req.headers['content-length'] || 0) > MAX_BODY_BYTES) return send(res, 413, { error: 'payload muito grande' });
    if (!rateLimit(req)) return send(res, 429, { error: 'limite de requisições excedido' });
    if (req.method === 'OPTIONS') return send(res, 204, '');
    if (path === '/healthz' && req.method === 'GET') return send(res, 200, { ok: true });
    if (path === '/readyz' && req.method === 'GET') {
      try { await store.healthcheck(); return send(res, 200, { ok: true, backend: store.backend, ...publicConfig() }); }
      catch (error) { log('error', 'readiness check failed', { requestId, error: safeError(error) }); return send(res, 503, { ok: false, backend: store.backend, error: 'dependência indisponível' }); }
    }
    if (req.method === 'POST' && path === '/api/auth/login') {
      const input = await readJson(req);
      if (!input.email || !input.password) return send(res, 400, { error: 'email e senha são obrigatórios' });
      const result = await login(input.email, input.password);
      return result ? send(res, 200, result) : send(res, 401, { error: 'credenciais inválidas' });
    }
    if (path === '/api/auth/bootstrap' && req.method === 'POST') {
      if (await store.userCount()) return send(res, 409, { error: 'bootstrap já realizado' });
      const input = await readJson(req);
      if (!input.email || !input.password || String(input.password).length < 10) return send(res, 400, { error: 'email e senha (mínimo 10 caracteres) são obrigatórios' });
      const user = await store.userCreate({ email: input.email, nome: input.nome, role: 'admin', passwordHash: hashPassword(input.password) });
      return send(res, 201, { user: { id: user.id, email: user.email, nome: user.nome, role: user.role } });
    }
    if (path.startsWith('/api/') && !isAuthorized(req) && !(await authenticate(req))) return send(res, 401, { error: 'autenticação necessária' });
    if (req.method === 'GET' && path === '/api/dashboard') {
      return send(res, 200, buildOverview(await store.listAnalises({})));
    }
  if (req.method === 'GET' && path === '/styles.css') {
    try { return send(res, 200, fs.readFileSync(pathMod.join(__dirname, 'public', 'styles.css'), 'utf8'), 'text/css'); }
    catch { return send(res, 404, { error: 'não encontrado' }); }
  }
  if (req.method === 'GET' && path === '/landing.css') {
    try { return send(res, 200, fs.readFileSync(pathMod.join(__dirname, 'public', 'landing.css'), 'utf8'), 'text/css'); }
    catch { return send(res, 404, { error: 'não encontrado' }); }
  }
  if (req.method === 'GET' && path === '/landing.js') {
    try { return send(res, 200, fs.readFileSync(pathMod.join(__dirname, 'public', 'landing.js'), 'utf8'), 'application/javascript'); }
    catch { return send(res, 404, { error: 'não encontrado' }); }
  }
  if (req.method === 'GET' && path === '/manifest.json') {
    try { return send(res, 200, fs.readFileSync(pathMod.join(__dirname, 'public', 'manifest.json'), 'utf8'), 'application/json'); }
    catch { return send(res, 404, { error: 'não encontrado' }); }
  }
  if (req.method === 'GET' && path === '/sw.js') {
    try { return send(res, 200, fs.readFileSync(pathMod.join(__dirname, 'public', 'sw.js'), 'utf8'), 'application/javascript'); }
    catch { return send(res, 404, { error: 'não encontrado' }); }
  }
  if (req.method === 'GET' && path === '/offline.html') {
    try { return send(res, 200, fs.readFileSync(pathMod.join(__dirname, 'public', 'offline.html'), 'utf8'), 'text/html'); }
    catch { return send(res, 404, { error: 'não encontrado' }); }
  }
  if (req.method === 'GET' && path === '/') {
    try { return send(res, 200, landingHtml(), 'text/html'); }
    catch { return send(res, 500, { error: 'frontend não encontrado' }); }
  }
  if (req.method === 'GET' && path === '/dashboard') {
    try { return send(res, 200, painelHtml(), 'text/html'); }
    catch { return send(res, 500, { error: 'frontend não encontrado' }); }
  }

  if (req.method === 'POST' && path === '/api/analisar') {
    const input = await readJson(req);
    let texto = input.texto || input._raw || '';
    if (input.url && !texto) texto = await fetchTextoAnuncio(input.url);
    else if (input.url && texto.length < 8000) texto = texto + '\n' + await fetchTextoAnuncio(input.url);
    const entrada = { url: input.url, texto, preco: input.preco ?? null, area: input.area ?? null, localizacaoNota: input.localizacaoNota ?? 6 };
    let r = analisar(entrada);
    if (input.usarIA !== false && texto) {
      try { const ia = await extrairComIA(texto); r = analisarComExtracao(entrada, ia.extraction); r.ia = { provider: ia.provider, model: ia.model, status: 'ok' }; }
      catch (e) { r.ia = { status: 'local', motivo: e.message }; }
    } else r.ia = { status: 'local' };
    r.ficha = fichaMarkdown(r);
    const saved = await store.addAnalise({ ...r, origem: 'painel' });
    return send(res, 200, saved);
  }

  if (req.method === 'GET' && path === '/api/historico') {
    const q = query(req.url);
    const filters = { fonte: q.fonte || undefined, status: q.status || undefined, q: q.q || undefined, minScore: q.minScore ? Number(q.minScore) : undefined, financiavel: q.financiavel === '1', comEscritura: q.comEscritura === '1' };
    // Only opt into the new envelope when pagination is requested, preserving old clients.
    if (q.page != null || q.perPage != null) {
      filters.page = positiveInt(q.page, 1, 1000000);
      filters.perPage = positiveInt(q.perPage, 25, 100);
    }
    return send(res, 200, await store.listAnalises(filters));
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
    const rawBody = body && body.__rawBody || '';
    if (!verifyWebhook(req, rawBody)) return send(res, 401, { error: 'assinatura inválida' });
    const eventKey = idempotencyKey(req, rawBody);
    if (await store.metaGet('webhook:' + eventKey)) return send(res, 200, { ok: true, duplicate: true });
    const evento = body?.event || body?.type || '';
    if (evento && !String(evento).toUpperCase().includes('MESSAGES')) {
      await store.metaSet('webhook:' + eventKey, { recebidoEm: new Date().toISOString() });
      return send(res, 200, { ignored: true, evento });
    }
    const out = await handleIncoming(body, fetchTextoAnuncio);
    if (out.ignored) return send(res, 200, { ignored: true });
    if (out.analise) await store.addAnalise({ ...out.analise, origem: 'whatsapp', whatsapp: out.number });
    for (const reply of out.replies) {
      try { await sendText(out.number, reply); } catch (e) { console.error('falha ao enviar WhatsApp:', e.message); }
    }
    await store.metaSet('webhook:' + eventKey, { recebidoEm: new Date().toISOString() });
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
  if (req.method === 'POST' && path === '/api/monitor/enqueue') {
    return send(res, 202, await jobs.enqueue('monitor'));
  }
  if (req.method === 'GET' && path === '/api/jobs') {
    const q = query(req.url);
    return send(res, 200, await jobs.list({ state: q.state, type: q.type }));
  }
  if (req.method === 'POST' && path === '/api/jobs/retry') {
    const input = await readJson(req);
    const job = await jobs.retry(input.id);
    return job ? send(res, 200, job) : send(res, 404, { error: 'tarefa não encontrada' });
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
    const rawBody = payload && payload.__rawBody || '';
    if (!verifyWebhook(req, rawBody, portal)) return send(res, 401, { error: 'assinatura inválida' });
    const eventKey = idempotencyKey(req, rawBody, portal);
    if (await store.metaGet('webhook:' + eventKey)) return send(res, 200, { ok: true, duplicate: true });
    const reg = normalizarLead(portal, payload);
    if (reg.error) return send(res, 400, { error: reg.error });
    const { saved, dist } = await distribuirESalvar(reg);
    await store.metaSet('webhook:' + eventKey, { recebidoEm: new Date().toISOString() });
    return send(res, 200, { ok: true, id: saved.id, corretor: dist.corretorNome || null });
  }
  // E1 equipe
  if (req.method === 'GET' && path === '/api/equipe') return send(res, 200, await store.equipeList());
  if (req.method === 'POST' && path === '/api/equipe') {
    const { nome, whatsapp, id, toggle } = await readJson(req);
    if (toggle && id) {
      const rec = await store.equipeToggle(id);
      return rec ? send(res, 200, rec) : send(res, 404, { error: 'não encontrado' });
    }
    if (!nome) return send(res, 400, { error: 'informe nome' });
    return send(res, 200, await store.equipeAdd(nome, whatsapp));
  }
  if (req.method === 'DELETE' && path === '/api/equipe') {
    await store.equipeRemove(query(req.url).id);
    return send(res, 200, { ok: true });
  }
  // E1 SLA + E2 fila quente
  if (req.method === 'GET' && path === '/api/sla') {
    const leads = (await store.listAnalises({})).filter(isLead);
    return send(res, 200, checarFila(leads, await store.equipeList(), Date.now()));
  }
  if (req.method === 'GET' && path === '/api/fila') return send(res, 200, await filaQuente());
  // E3 match
  if (req.method === 'GET' && path === '/api/match') {
    const lead = await store.getAnalise(query(req.url).id);
    if (!lead || !isLead(lead)) return send(res, 404, { error: 'lead não encontrado' });
    const analises = await store.listAnalises({});
    return send(res, 200, { idLead: lead.id, perfil: extrairPerfil(lead, analises), matches: matchLeadImovel(lead, analises, {}) });
  }
  // E4 follow-up
  if (req.method === 'GET' && path === '/api/followup') {
    const lead = await store.getAnalise(query(req.url).id);
    if (!lead) return send(res, 404, { error: 'lead não encontrado' });
    return send(res, 200, { tarefas: tarefasPendentes(lead, Date.now()), proximo: lead.followup?.completo ? null : require('./src/followup').proximoStep(lead) });
  }
  if (req.method === 'POST' && path === '/api/followup/iniciar') {
    const { id } = await readJson(req);
    const lead = await store.getAnalise(id);
    if (!lead) return send(res, 404, { error: 'lead não encontrado' });
    const patch = iniciarSequencia(lead);
    await store.updateAnalise(id, patch);
    return send(res, 200, { ok: true, ...patch });
  }
  if (req.method === 'POST' && path === '/api/followup/avancar') {
    const { id } = await readJson(req);
    const lead = await store.getAnalise(id);
    if (!lead) return send(res, 404, { error: 'lead não encontrado' });
    const patch = avancarStep(lead, Date.now());
    await store.updateAnalise(id, patch);
    return send(res, 200, { ok: true, ...patch });
  }
  // E5 bot 24/7
  if (req.method === 'POST' && path === '/api/bot247') {
    const { mensagem, analiseId } = await readJson(req);
    const parsed = parseMensagemCliente(mensagem || '');
    let resposta = respostaInteligente(parsed.intencao, parsed.dados, new Date());
    if (parsed.intencao === 'consulta_imovel' && analiseId) {
      const a = await store.getAnalise(analiseId);
      if (a) resposta = fichaCliente(a) + '\n\n' + resposta;
    }
    return send(res, 200, { intencao: parsed.intencao, dados: parsed.dados, resposta });
  }
  // E7 gestor
  if (req.method === 'GET' && path === '/api/gestor') {
    const todas = await store.listAnalises({});
    return send(res, 200, {
      gerais: metricasGerais(todas),
      tempoResposta: tempoResposta(todas),
      velocity: velocityFunil(todas),
      porCorretor: conversaoPorCorretor(todas),
      porPortal: conversaoPorPortal(todas)
    });
  }
  // E8 proposta
  if (req.method === 'POST' && path === '/api/proposta') {
    const { id, config } = await readJson(req);
    const a = await store.getAnalise(id);
    if (!a) return send(res, 404, { error: 'análise não encontrada' });
    return send(res, 200, { proposta: gerarProposta(a, config || {}), validacao: validarProposta(a), resumo: resumoProposta(a) });
  }
  // E9 reativação
  if (req.method === 'GET' && path === '/api/reativacao') {
    const todas = await store.listAnalises({});
    const leads = todas.filter(isLead);
    const imoveis = todas.filter(a => !isLead(a) && a.extracao?.preco);
    return send(res, 200, candidatosReativacao(leads, imoveis, {}));
  }

  send(res, 404, { error: 'rota não encontrada' });
} catch (err) {
  log('error', 'request failed', { requestId: res.getHeader('X-Request-Id') || req.headers['x-request-id'], error: safeError(err), path: req.url, method: req.method });
  send(res, err.statusCode || 500, { error: err.statusCode === 413 ? 'payload muito grande' : 'erro interno do servidor' });
}
});

const PORT = process.env.PORT || 3000;
const httpServer = server.listen(PORT, () => console.log(`Sistema rodando em http://localhost:${PORT}`));
let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Encerrando por ${signal}...`);
  jobs.stop();
  await new Promise((resolve) => httpServer.close(resolve));
  if (store.pool?.end) await store.pool.end().catch(() => {});
}
process.once('SIGTERM', () => shutdown('SIGTERM').then(() => process.exit(0)));
process.once('SIGINT', () => shutdown('SIGINT').then(() => process.exit(0)));
process.on('uncaughtException', (error) => { console.error('Erro não tratado:', error); shutdown('uncaughtException').then(() => process.exit(1)); });
process.on('unhandledRejection', (error) => { console.error('Promise rejeitada:', error); });
