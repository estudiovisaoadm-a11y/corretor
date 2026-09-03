// lead-score.js — LEAD SCORING (probabilidade de fechamento).
// ATENÇÃO: não confundir com src/scoring/score.js, que é o SCORE DO IMÓVEL (oportunidade do anúncio).
// Este módulo é PURO, EXPLICÁVEL e sem ML externo: soma ponderada de 5 fatores + regras de negócio.
// Zero dependências. Uso: const { scoreLead } = require('./src/scoring/lead-score');
//
// TABELA DE PESOS (total = 100 pts):
// | Fator               | Peso | O que mede                                              | Ex. máximo        |
// |---------------------|------|---------------------------------------------------------|-------------------|
// | origem              |  20% | portal quente (dfimoveis/wimoveis/navent/zap/...) vs manual | +20 portal quente |
// | completude contato  |  20% | nome + telefone + email                                 | +20 contato completo |
// | intenção (mensagem) |  25% | visita/proposta/financiamento aprovado/urgente vs curioso/só olhando | +25 intenção alta |
// | fit com estoque     |  20% | codigoImovel vinculado a análise com score alto (ctx.mediaScores) | +20 fit score ≥80 |
// | frescor             |  15% | minutos desde createdAt; decai após 60min               | +15 lead ≤15min   |
//
// FAIXAS (inspiradas no score do imóvel — 80/60/40):
//   score >= 80 → 'QUENTE' (ligar AGORA)
//   score >= 40 → 'MORNO'  (ligar hoje / follow-up)
//   score < 40  → 'FRIO'   (nurturar / descartar fila ativa)
//
// COMO O INTEGRADOR ORDENA A FILA ("ligar primeiro"):
//   1. Filtre/segregue quem tem `observacao: 'já em atendimento'` → vai para fila de FOLLOW-UP,
//      não para a fila de primeira ligação (o score NÃO é zerado, só sai da frente da fila).
//   2. Ordene o restante por `score` DESC (maior primeiro).
//   3. Desempate: leads QUENTE mais novos primeiro (menor tempo desde createdAt).
//   4. FRIO (score < 40) não toca o telefone na primeira onda — entra em nurturing automático.
//   Ex.: fila.sort((a, b) => b.result.score - a.result.score || new Date(a.lead.createdAt) - new Date(b.lead.createdAt))
//
// Regras especiais:
//   - Sem telefone E sem email → teto: score final = min(score, 30) + motivo extra do teto.
//   - Mensagem vazia/ausente → intenção neutra (+10 de 25).
//   - status !== 'novo' (ex.: 'em_atendimento') → calcula normal (sem zerar) e adiciona
//     `observacao: 'já em atendimento'`.

'use strict';

var PORTAIS_QUENTES = [
  'dfimoveis', 'df imoveis', 'wimoveis', 'w imoveis', 'navent',
  'zap', 'vivareal', 'viva real', 'olx', 'quintoandar',
  'imovelweb', 'chavesnamao', 'zapimoveis'
];

var ORIGEM_MEDIA = [
  'site', 'instagram', 'facebook', 'google', 'indicacao',
  'corretor', 'stand', 'plantao', 'anuncio', 'portal', 'landing'
];

var INTENCAO_ALTA = [
  'visita', 'visitar', 'agend', 'proposta', 'oferta',
  'financiamento aprovado', 'credito aprovado', 'crédito aprovado',
  'pre-aprov', 'preaprov', 'aprovado', 'aprovada',
  'urgente', 'urgencia', 'fechar', 'fechamento',
  'sinal', 'entrada', 'quero comprar', 'vou comprar',
  'decidido', 'decidida', 'documenta'
];

var INTENCAO_BAIXA = [
  'curioso', 'curiosa', 'curiosidade', 'so olhando', 'só olhando',
  'somente olhando', 'apenas olhando', 'pesquisando', 'pesquisa',
  'talvez', 'só queria saber', 'so queria saber', 'curios'
];

var INTENCAO_MEDIA = [
  'interesse', 'interessad', 'gostei', 'quero conhecer', 'conhecer',
  'financiamento', 'credito', 'crédito', 'fgts', 'valor', 'preco',
  'preço', 'condi', 'dispon', 'informa', 'detalhe', 'comprar', 'alugar'
];

function norm(s) {
  return String(s == null ? '' : s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function tem(obj, key) {
  var v = obj && obj[key];
  return v !== undefined && v !== null && String(v).trim() !== '';
}

function interior(lead) {
  // Aceita o registro cheio {fonte, origem, status, lead:{...}} ou o contato direto {nome, telefone, ...}.
  if (lead && typeof lead.lead === 'object' && lead.lead !== null) return lead.lead;
  return (lead && typeof lead === 'object') ? lead : {};
}

function campoContato(rec, inner, key) {
  if (tem(inner, key)) return String(inner[key]);
  if (tem(rec, key)) return String(rec[key]); // tolera contato espalhado no nível do registro
  return null;
}

function notaOrigem(rec) {
  var texto = norm((rec.fonte || '') + ' ' + (rec.origem || ''));
  var i, k;
  for (i = 0; i < PORTAIS_QUENTES.length; i++) {
    k = norm(PORTAIS_QUENTES[i]);
    if (k && texto.indexOf(k) !== -1) {
      return { pts: 20, motivo: '+20 origem portal quente (' + (rec.fonte || rec.origem || 'portal') + ')' };
    }
  }
  for (i = 0; i < ORIGEM_MEDIA.length; i++) {
    k = norm(ORIGEM_MEDIA[i]);
    if (k && texto.indexOf(k) !== -1) {
      return { pts: 12, motivo: '+12 origem intermediária (' + (rec.fonte || rec.origem || 'canal') + ')' };
    }
  }
  return { pts: 5, motivo: '+5 origem manual/desconhecida (' + (rec.fonte || rec.origem || 'n/d') + ')' };
}

function notaContato(rec, inner) {
  var nome = campoContato(rec, inner, 'nome');
  var tel = campoContato(rec, inner, 'telefone');
  var email = campoContato(rec, inner, 'email');
  var n = (nome ? 1 : 0) + (tel ? 1 : 0) + (email ? 1 : 0);
  if (n === 3) return { pts: 20, motivo: '+20 contato completo (nome+telefone+email)' };
  if (n === 2) {
    var falta = !nome ? 'nome' : (!tel ? 'telefone' : 'email');
    return { pts: 13, motivo: '+13 contato parcial (falta ' + falta + ')' };
  }
  if (n === 1) return { pts: 6, motivo: '+6 contato mínimo (só ' + (nome ? 'nome' : (tel ? 'telefone' : 'email')) + ')' };
  return { pts: 0, motivo: '+0 sem dados de contato' };
}

function notaIntencao(rec, inner) {
  var msg = campoContato(rec, inner, 'mensagem');
  if (msg === null || String(msg).trim() === '') {
    return { pts: 10, motivo: '+10 intenção neutra (mensagem vazia)' };
  }
  var texto = norm(msg);
  var i;
  for (i = 0; i < INTENCAO_ALTA.length; i++) {
    if (texto.indexOf(norm(INTENCAO_ALTA[i])) !== -1) {
      return { pts: 25, motivo: '+25 intenção alta ("' + INTENCAO_ALTA[i] + '")' };
    }
  }
  for (i = 0; i < INTENCAO_BAIXA.length; i++) {
    if (texto.indexOf(norm(INTENCAO_BAIXA[i])) !== -1) {
      return { pts: 4, motivo: '+4 intenção baixa ("' + INTENCAO_BAIXA[i] + '")' };
    }
  }
  for (i = 0; i < INTENCAO_MEDIA.length; i++) {
    if (texto.indexOf(norm(INTENCAO_MEDIA[i])) !== -1) {
      return { pts: 16, motivo: '+16 intenção média ("' + INTENCAO_MEDIA[i] + '")' };
    }
  }
  return { pts: 10, motivo: '+10 intenção neutra (mensagem genérica)' };
}

function codigoDoLead(rec, inner) {
  var c = inner.codigoImovel || rec.codigoImovel || inner.codigo || null;
  return (c === null || c === undefined || String(c).trim() === '') ? null : String(c);
}

function notaFit(rec, inner, ctx) {
  var codigo = codigoDoLead(rec, inner);
  var base = (ctx && ctx.mediaScores) || {};
  if (codigo === null || base[codigo] === undefined || base[codigo] === null) {
    return { pts: 8, motivo: '+8 fit neutro (sem vínculo com estoque)' };
  }
  var s = Number(base[codigo]);
  if (!isFinite(s)) return { pts: 8, motivo: '+8 fit neutro (score do estoque inválido p/ ' + codigo + ')' };
  if (s >= 80) return { pts: 20, motivo: '+20 fit alto (imóvel ' + codigo + ' score ' + Math.round(s) + ')' };
  if (s >= 60) return { pts: 14, motivo: '+14 fit bom (imóvel ' + codigo + ' score ' + Math.round(s) + ')' };
  if (s >= 40) return { pts: 9, motivo: '+9 fit regular (imóvel ' + codigo + ' score ' + Math.round(s) + ')' };
  return { pts: 4, motivo: '+4 fit fraco (imóvel ' + codigo + ' score ' + Math.round(s) + ')' };
}

function notaFrescor(rec, ctx) {
  var agora = (ctx && isFinite(ctx.agoraMs)) ? Number(ctx.agoraMs) : Date.now();
  var t = Date.parse(rec && rec.createdAt);
  if (!isFinite(t)) return { pts: 8, motivo: '+8 frescor neutro (createdAt ausente/inválido)' };
  var min = Math.max(0, Math.round((agora - t) / 60000));
  if (min <= 15) return { pts: 15, motivo: '+15 lead fresco (' + min + 'min)' };
  if (min <= 30) return { pts: 13, motivo: '+13 lead recente (' + min + 'min)' };
  if (min <= 60) return { pts: 10, motivo: '+10 lead dentro da 1ª hora (' + min + 'min)' };
  if (min <= 120) return { pts: 6, motivo: '+6 lead esfriando (' + min + 'min, após 60min decai)' };
  if (min <= 180) return { pts: 4, motivo: '+4 lead frio por idade (' + min + 'min, após 60min decai)' };
  return { pts: 2, motivo: '+2 lead velho (' + min + 'min, após 60min decai)' };
}

function faixaDe(score) {
  if (score >= 80) return 'QUENTE';
  if (score >= 40) return 'MORNO';
  return 'FRIO';
}

// scoreLead(lead, ctx) — lead no formato de src/leads.js:
//   { fonte, origem, status, lead: { nome, telefone, email, mensagem, codigoImovel }, bairro?, createdAt }
// ctx = { mediaScores?: { codigo: score }, agoraMs?: number }
// Retorna { score (0-100), faixa, motivos[] } + `observacao` quando status !== 'novo'.
function scoreLead(lead, ctx) {
  var rec = (lead && typeof lead === 'object') ? lead : {};
  var inner = interior(rec);

  var origem = notaOrigem(rec);
  var contato = notaContato(rec, inner);
  var intencao = notaIntencao(rec, inner);
  var fit = notaFit(rec, inner, ctx || {});
  var frescor = notaFrescor(rec, ctx || {});

  var motivos = [origem.motivo, contato.motivo, intencao.motivo, fit.motivo, frescor.motivo]; // 1 por fator
  var score = origem.pts + contato.pts + intencao.pts + fit.pts + frescor.pts;
  score = Math.max(0, Math.min(100, Math.round(score)));

  // Regra: sem telefone E sem email → teto 30 + motivo.
  var tel = campoContato(rec, inner, 'telefone');
  var email = campoContato(rec, inner, 'email');
  if (!tel && !email && score > 30) {
    score = 30;
    motivos.push('teto 30: sem telefone e sem email');
  }

  var out = { score: score, faixa: faixaDe(score), motivos: motivos };

  // Regra: status ≠ novo → sinaliza, sem zerar.
  var status = norm(rec.status || 'novo');
  if (status !== '' && status !== 'novo') {
    out.observacao = 'já em atendimento';
  }
  return out;
}

module.exports = { scoreLead };
