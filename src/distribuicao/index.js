/**
 * distribuicao — distribuição automática de leads + SLA (módulo PURO, sem I/O).
 * Zero dependências. Não lê/escreve banco, não faz HTTP, não agenda timers.
 *
 * ── Interface exata que o integrador usará ─────────────────────────────────
 *
 *   const dist = require('./src/distribuicao');
 *   // ou: const { proximaVez, distribuirLead, slaStatus, checarFila, mensagemCorretor } = require('./src/distribuicao');
 *
 *   1) proximaVez(equipe, estado) -> { corretor, proximoEstado }
 *      - equipe: Array<{ id: string, nome: string, whatsapp: string, ativo: boolean }>
 *      - estado: { ultimoIndice: number } | null | undefined  (índice no array `equipe`
 *        do último corretor escolhido; ausente/inválido = -1, ou seja, começa do 0)
 *      - retorna: { corretor: {...}|null, proximoEstado: { ultimoIndice: number } }
 *        . pula membros com `ativo === false` (ausente = ativo, p/ retrocompat)
 *        . sem corretor ativo (ou equipe vazia/inválida) -> { corretor: null, proximoEstado }
 *
 *   2) distribuirLead(lead, equipe, estado) -> sucesso | falha
 *      - lead: registro de lead (formato de src/leads.js: { fonte, origem:'lead-'+portal,
 *        status:'novo', lead:{nome,telefone,email,mensagem,codigoImovel}, codigoImovel?,
 *        bairro?, createdAt }). O `lead` NÃO é mutado; só é lido (ignorado p/ escolha).
 *      - sucesso: { corretorId, corretorNome, whatsapp, distribuidoEm, proximoEstado }
 *          distribuidoEm é ISO string (new Date().toISOString()); única "impureza"
 *          do módulo (relógio). proximoEstado deve ser persistido pelo integrador.
 *      - falha (sem corretor ativo): { corretorId: null, motivo: 'sem-corretor-ativo', proximoEstado }
 *
 *   3) slaStatus(lead, agoraMs, limiteMin = 5) -> { estourado, minutosDecorridos } | { estourado:false, motivo }
 *      - lead: mesmo formato acima; base de tempo = lead.distribuidoEm ?? lead.createdAt
 *        (aceita ISO string ou epoch ms; distribuidoEm tem prioridade quando válido)
 *      - agoraMs: epoch ms (aceita number, Date ou ISO string; inválido = Date.now())
 *      - limiteMin: number (inválido = 5). Estoura quando minutosDecorridos > limiteMin.
 *      - status presente e !== 'novo' (ausente é tratado como 'novo') ->
 *        { estourado: false, minutosDecorridos, motivo: 'ja-atendido' }
 *      - base de tempo ausente/inválida -> { estourado: false, minutosDecorridos: 0, motivo: 'sem-data' }
 *      - caso geral -> { estourado: bool, minutosDecorridos: number }
 *
 *   4) checarFila(leads, equipe, agoraMs, limiteMin) -> { paraDistribuir, slaEstourado, ok }
 *      - leads: Array<lead>; equipe: só validada (reservada p/ uso futuro, não altera
 *        a classificação); agoraMs/limiteMin repassados ao slaStatus (defaults: Date.now()/5)
 *      - partição determinística, cada lead em EXATAMENTE um bucket (prioridade nesta ordem):
 *          a) paraDistribuir: status 'novo' (ou ausente) E sem corretor
 *             (tem corretor = lead.corretorId != null OU lead.corretor != null
 *              OU lead.distribuidoPara != null)
 *          b) slaEstourado: 'novo' E slaStatus(lead, agoraMs, limiteMin).estourado === true
 *             (na prática: já distribuídos mas não atendidos dentro do limite; novos sem
 *              corretor já caíram em (a) e não duplicam aqui)
 *          c) ok: todo o resto (dentro do SLA, já atendidos, sem data, etc.)
 *
 *   5) mensagemCorretor(lead, fichaResumo) -> string
 *      - lead: mesmo formato acima; fichaResumo: string opcional (resumo do imóvel/IA)
 *      - retorna texto PT-BR pronto p/ WhatsApp com nome, contato, portal e imóvel.
 *        Campos ausentes viram "não informado" — nunca quebra (retorna string sempre).
 *
 * ── Formato de corretores no banco (sugestão p/ o integrador) ───────────────
 *   coleção/tabela `equipe`: { id: string (pk), nome: string, whatsapp: string (E.164),
 *                              ativo: boolean }
 *   Ex.: { id: 'c1', nome: 'Ana', whatsapp: '5511999990001', ativo: true }
 *   Estado do round-robin: persistir `{ ultimoIndice }` numa linha/chave dedicada
 *   (ex.: tabela `meta` chave 'distribuicao:rr' -> { ultimoIndice: 2 }) e passar como
 *   `estado` a cada chamada, salvando o `proximoEstado` retornado.
 */

'use strict';

function _normalizarIndice(estado) {
  if (estado && typeof estado === 'object' && Number.isInteger(estado.ultimoIndice)) {
    return estado.ultimoIndice;
  }
  return -1;
}

function _isAtivo(corretor) {
  if (!corretor || typeof corretor !== 'object') return false;
  // Ausente = ativo (retrocompat); só false/0/'false' desativa de forma explícita.
  // Mantido intencionalmente simples: o contrato oficial é `ativo: boolean`.
  if (corretor.ativo === false) return false;
  if (corretor.ativo === 0) return false;
  if (corretor.ativo === 'false') return false;
  return true;
}

function _equipeValida(equipe) {
  return Array.isArray(equipe) ? equipe : [];
}

/**
 * Round-robin sobre a equipe, pulando inativos.
 */
function proximaVez(equipe, estado) {
  const lista = _equipeValida(equipe);
  const ultimo = _normalizarIndice(estado);
  if (lista.length === 0) {
    return { corretor: null, proximoEstado: { ultimoIndice: ultimo } };
  }
  for (let passo = 1; passo <= lista.length; passo++) {
    const idx = (((ultimo + passo) % lista.length) + lista.length) % lista.length;
    const cand = lista[idx];
    if (_isAtivo(cand)) {
      return { corretor: cand, proximoEstado: { ultimoIndice: idx } };
    }
  }
  return { corretor: null, proximoEstado: { ultimoIndice: ultimo } };
}

/**
 * Escolhe o corretor da vez para um lead (não muta o lead).
 */
function distribuirLead(lead, equipe, estado) {
  void lead; // lead não influencia a escolha atual (round-robin puro); reservado p/ regras futuras.
  const { corretor, proximoEstado } = proximaVez(equipe, estado);
  if (!corretor) {
    return { corretorId: null, motivo: 'sem-corretor-ativo', proximoEstado };
  }
  return {
    corretorId: corretor.id != null ? corretor.id : null,
    corretorNome: corretor.nome != null ? corretor.nome : null,
    whatsapp: corretor.whatsapp != null ? corretor.whatsapp : null,
    distribuidoEm: new Date().toISOString(),
    proximoEstado
  };
}

function _paraMs(valor, fallback) {
  if (typeof valor === 'number' && Number.isFinite(valor)) return valor;
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) return valor.getTime();
  if (typeof valor === 'string' && valor.trim() !== '') {
    const t = Date.parse(valor);
    if (!Number.isNaN(t)) return t;
  }
  return fallback;
}

function _ehNovo(lead) {
  if (!lead || typeof lead !== 'object') return false;
  if (lead.status == null) return true; // ausente = ainda na fila
  return lead.status === 'novo';
}

/**
 * Status do SLA de um lead.
 */
function slaStatus(lead, agoraMs, limiteMin) {
  const agora = _paraMs(agoraMs, Date.now());
  let limite = typeof limiteMin === 'number' && Number.isFinite(limiteMin) ? limiteMin : 5;

  const l = (lead && typeof lead === 'object') ? lead : {};
  const baseMs =
    _paraMs(l.distribuidoEm, NaN) !== undefined && !Number.isNaN(_paraMs(l.distribuidoEm, NaN))
      ? _paraMs(l.distribuidoEm, NaN)
      : _paraMs(l.createdAt, NaN);

  if (typeof baseMs !== 'number' || Number.isNaN(baseMs)) {
    if (l.status != null && l.status !== 'novo') {
      return { estourado: false, minutosDecorridos: 0, motivo: 'ja-atendido' };
    }
    return { estourado: false, minutosDecorridos: 0, motivo: 'sem-data' };
  }

  const minutosDecorridos = (agora - baseMs) / 60000;

  if (l.status != null && l.status !== 'novo') {
    return { estourado: false, minutosDecorridos, motivo: 'ja-atendido' };
  }
  // status ausente tratado como 'novo' (ver _ehNovo)
  return { estourado: minutosDecorridos > limite, minutosDecorridos };
}

function _temCorretor(lead) {
  if (!lead || typeof lead !== 'object') return false;
  return lead.corretorId != null || lead.corretor != null || lead.distribuidoPara != null;
}

/**
 * Classifica a fila em paraDistribuir / slaEstourado / ok (partição, sem duplicar).
 */
function checarFila(leads, equipe, agoraMs, limiteMin) {
  void equipe; // reservado: classificação independe da equipe hoje; mantido na assinatura p/ o integrador.
  const lista = Array.isArray(leads) ? leads : [];
  const agora = _paraMs(agoraMs, Date.now());
  const limite = typeof limiteMin === 'number' && Number.isFinite(limiteMin) ? limiteMin : 5;

  const paraDistribuir = [];
  const slaEstourado = [];
  const ok = [];

  for (const lead of lista) {
    const novo = _ehNovo(lead);
    if (novo && !_temCorretor(lead)) {
      paraDistribuir.push(lead);
      continue;
    }
    if (novo) {
      const st = slaStatus(lead, agora, limite);
      if (st.estourado) {
        slaEstourado.push(lead);
        continue;
      }
    }
    ok.push(lead);
  }

  return { paraDistribuir, slaEstourado, ok };
}

function _texto(valor) {
  if (valor === undefined || valor === null) return null;
  const s = String(valor).trim();
  return s !== '' ? s : null;
}

/**
 * Texto PT-BR p/ WhatsApp avisando o corretor do novo lead.
 */
function mensagemCorretor(lead, fichaResumo) {
  const l = (lead && typeof lead === 'object') ? lead : {};
  const inner = (l.lead && typeof l.lead === 'object') ? l.lead : {};

  const nome = _texto(inner.nome) || 'não informado';
  const telefone = _texto(inner.telefone) || null;
  const email = _texto(inner.email) || null;
  const contato = telefone && email
    ? telefone + ' / ' + email
    : (telefone || email || 'não informado');
  const portal = _texto(l.fonte) || _texto(l.origem) || 'não informado';
  const cod = _texto(inner.codigoImovel) || _texto(l.codigoImovel) || null;
  const bairro = _texto(inner.bairro) || _texto(l.bairro) || null;
  const imovel = cod && bairro
    ? 'código ' + cod + ' (' + bairro + ')'
    : (cod || bairro || 'não informado');
  const mensagem = _texto(inner.mensagem) || null;
  const ficha = _texto(fichaResumo) || null;

  const linhas = [];
  linhas.push('🔔 Novo lead para você!');
  linhas.push('');
  linhas.push('Nome: ' + nome);
  linhas.push('Contato: ' + contato);
  linhas.push('Portal: ' + portal);
  linhas.push('Imóvel de interesse: ' + imovel);
  if (mensagem) linhas.push('Mensagem do cliente: ' + mensagem);
  if (ficha) linhas.push('Resumo do imóvel: ' + ficha);
  linhas.push('');
  linhas.push('Entre em contato em até 5 minutos para não perder o SLA.');

  return linhas.join('\n');
}

module.exports = { proximaVez, distribuirLead, slaStatus, checarFila, mensagemCorretor };
