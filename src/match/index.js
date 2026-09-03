// match lead × imóvel — MÓDULO PURO, zero dependências (Missão E3).
//
// FÓRMULA (total 0–100 por imóvel):
//   pontos = 40% score do imóvel + 20% mesmo bairro + 15% financ compatível
//          + 10% permuta compatível + 15% faixa de preço
//   - score do imóvel: (score 0–100 da análise) × 0,40. Sem score numérico → neutro 50.
//   - mesmo bairro: +20 se bairro da análise == bairro citado pelo lead (case/acentos-insensível).
//   - financ compatível: +15 se lead menciona financiamento (/financ|fgts/i) E extracao.aceita_financiamento === true.
//   - permuta compatível: +10 se lead menciona permuta (/permut/i) E extracao.aceita_permuta === true.
//   - faixa de preço: se o lead cita valor (orcamento) e |preco − orc|/orc ≤ 30%,
//     +15 × (1 − diff/0,30) (linear: preço exato = +15, borda de ±30% = 0). Fora da faixa = 0.
//   - sem orçamento citado → 0 nesse critério. Máximo teórico = 40+20+15+10+15 = 100.
//
// ELEGIBILIDADE: exige extracao.preco numérico > 0. Com apenasDisponiveis=true (padrão),
//   exclui status "descartado"/"fechado" (e variantes descartada/fechada, case-insensível).
//
// COMO O INTEGRADOR USA (ex.: endpoint GET /api/match?idLead=):
//   const { matchLeadImovel } = require('./src/match');
//   // 1) carrega o lead (ex.: do store/db) e as análises persistidas [{id, score, bairro, extracao, status}]
//   // 2) const ranking = matchLeadImovel(lead, analises, { limite: 5, apenasDisponiveis: true });
//   // 3) responde JSON: { idLead, perfil: extrairPerfil(lead, analises), matches: ranking }
//   // Lead esperado: formato de src/leads.js → { lead: { mensagem, ... }, bairro?, ... }
//   //   (também aceita { mensagem } direto ou string com a mensagem).
'use strict';

const PESO_SCORE = 40;   // score do imóvel (0–100) × 0,40
const PESO_BAIRRO = 20;  // mesmo bairro do lead
const PESO_FINANC = 15;  // lead quer financiar e imóvel aceita
const PESO_PERMUTA = 10; // lead quer permuta e imóvel aceita
const PESO_PRECO = 15;   // proximidade ao orçamento citado (±30%)
const TOL_FAIXA_PRECO = 0.30;
const STATUS_BLOQUEADOS = new Set(['descartado', 'descartada', 'fechado', 'fechada']);

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function round1(v) {
  return Math.round(v * 10) / 10;
}

function getMensagem(lead) {
  if (typeof lead === 'string') return lead;
  if (!lead || typeof lead !== 'object') return '';
  if (lead.lead && typeof lead.lead === 'object') {
    const m = lead.lead.mensagem ?? lead.lead.message ?? lead.lead.texto;
    if (m !== undefined && m !== null) return String(m);
  }
  const m = lead.mensagem ?? lead.message ?? lead.texto;
  return m === undefined || m === null ? '' : String(m);
}

function getBairroCampo(lead) {
  if (!lead || typeof lead !== 'object') return null;
  const b = lead.bairro
    ?? (lead.lead && typeof lead.lead === 'object' ? lead.lead.bairro : undefined);
  return b === undefined || b === null || String(b).trim() === '' ? null : String(b);
}

function mencionaFinanciamento(msg) {
  return /financ|fgts/i.test(msg || '');
}

function mencionaPermuta(msg) {
  return /permut/i.test(msg || '');
}

// "450.000" | "1,2" (pt-BR) → number. Sem vírgula: ponto só é decimal se o último
// grupo não tiver exatamente 3 dígitos ("1.5" → 1,5; "450.000" → 450000).
function toNumBR(s) {
  const t = String(s).trim();
  if (t.includes(',')) return parseFloat(t.replace(/\./g, '').replace(',', '.'));
  if (t.includes('.')) {
    const parts = t.split('.');
    const last = parts[parts.length - 1];
    if (parts.length > 1 && last.length === 3) return parseFloat(parts.join(''));
    return parseFloat(t);
  }
  return parseFloat(t);
}

// Extrai orçamento em R$ da mensagem: "R$ 500 mil" | "R$ 480.000" | "R$ 1,2 milhão"
// | "R$ 500k" | fallback sem "R$" mas com sufixo ("até 500 mil"). "R$ 450" (sem
// sufixo e < 10000) assume milhares ≈ 450 mil.
function parseOrcamento(texto) {
  if (!texto) return undefined;
  const t = String(texto);
  let m = t.match(/R\$\s*(\d[\d.,]*)\s*(milh[õo]es|milh[aã]o|mil|k)?/i);
  let numSuf = null;
  if (m) {
    numSuf = { num: m[1], suf: (m[2] || '').toLowerCase() };
  } else {
    m = t.match(/(\d[\d.,]*)\s*(milh[õo]es|milh[aã]o|mil|k)\b/i);
    if (!m) return undefined;
    numSuf = { num: m[1], suf: m[2].toLowerCase() };
  }
  const num = toNumBR(numSuf.num);
  if (!Number.isFinite(num) || num <= 0) return undefined;
  const suf = numSuf.suf;
  let val;
  if (/milh/.test(suf)) val = num * 1e6;
  else if (suf === 'mil' || suf === 'k') val = num * 1e3;
  else val = num < 10000 ? num * 1e3 : num;
  return Math.round(val);
}

// Perfil do lead: { orcamento?, bairro? }. Bairro = match do texto/campo contra a
// lista de bairros das análises (retorna o canônico da análise; nada achado → ausente).
function extrairPerfil(lead, analises) {
  const perfil = {};
  const msg = getMensagem(lead);
  const orc = parseOrcamento(msg);
  if (orc !== undefined) perfil.orcamento = orc;

  const lista = Array.isArray(analises) ? analises : [];
  const vistos = new Set();
  const bairros = [];
  for (const a of lista) {
    const b = a && typeof a.bairro === 'string' ? a.bairro.trim() : '';
    if (b !== '' && !vistos.has(norm(b))) { vistos.add(norm(b)); bairros.push(b); }
  }
  // Nomes longos primeiro: "Asa Sul" vence "Sul".
  bairros.sort((x, y) => norm(y).length - norm(x).length);

  const campo = getBairroCampo(lead);
  const candidatos = [];
  if (campo) candidatos.push(campo);
  if (msg) candidatos.push(msg);
  for (const texto of candidatos) {
    const tn = norm(texto);
    for (const b of bairros) {
      const bn = norm(b);
      if (!bn) continue;
      if (new RegExp('\\b' + escapeRegExp(bn) + '\\b').test(tn)) {
        perfil.bairro = b;
        break;
      }
    }
    if (perfil.bairro) break;
  }
  return perfil;
}

function clampScore(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 50; // neutro documentado
  return Math.min(100, Math.max(0, n));
}

function isElegivel(a, apenasDisponiveis) {
  if (!a || typeof a !== 'object') return false;
  const preco = a.extracao && a.extracao.preco;
  if (typeof preco !== 'number' || !Number.isFinite(preco) || preco <= 0) return false;
  if (apenasDisponiveis) {
    const st = norm(a.status);
    if (STATUS_BLOQUEADOS.has(st)) return false;
  }
  return true;
}

// matchLeadImovel(lead, analises, opts={limite=5, apenasDisponiveis=true})
// → [{ analiseId, pontos, motivos[], scoreImovel }] ordenado desc, até `limite`. Sem elegíveis → [].
function matchLeadImovel(lead, analises, opts) {
  const o = opts && typeof opts === 'object' ? opts : {};
  let limite = 5;
  if (o.limite !== undefined && o.limite !== null) {
    const n = Number(o.limite);
    limite = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 5;
  }
  const apenasDisponiveis = o.apenasDisponiveis === undefined ? true : !!o.apenasDisponiveis;
  if (!Array.isArray(analises) || analises.length === 0 || limite === 0) return [];

  const msg = getMensagem(lead);
  const perfil = extrairPerfil(lead, analises);
  const querFinanc = mencionaFinanciamento(msg);
  const querPermuta = mencionaPermuta(msg);

  const scored = [];
  analises.forEach((a, idx) => {
    if (!isElegivel(a, apenasDisponiveis)) return;
    const extracao = (a && a.extracao) || {};
    const preco = extracao.preco;
    const scoreImovel = clampScore(a.score);
    let pontos = 0;
    const motivos = [];

    const pScore = scoreImovel * (PESO_SCORE / 100);
    pontos += pScore;
    motivos.push('score ' + scoreImovel + '/100 (+' + round1(pScore) + ')');

    if (perfil.bairro && typeof a.bairro === 'string' && norm(a.bairro) === norm(perfil.bairro)) {
      pontos += PESO_BAIRRO;
      motivos.push('mesmo bairro: ' + a.bairro + ' (+' + PESO_BAIRRO + ')');
    }
    if (querFinanc && extracao.aceita_financiamento === true) {
      pontos += PESO_FINANC;
      motivos.push('aceita financiamento (+' + PESO_FINANC + ')');
    }
    if (querPermuta && extracao.aceita_permuta === true) {
      pontos += PESO_PERMUTA;
      motivos.push('aceita permuta (+' + PESO_PERMUTA + ')');
    }
    if (perfil.orcamento && perfil.orcamento > 0) {
      const diff = Math.abs(preco - perfil.orcamento) / perfil.orcamento;
      if (diff <= TOL_FAIXA_PRECO) {
        const g = PESO_PRECO * (1 - diff / TOL_FAIXA_PRECO);
        if (g > 0) {
          pontos += g;
          motivos.push('preço ' + Math.round(diff * 100) + '% do orçamento (+' + round1(g) + ')');
        }
      }
    }

    const analiseId = (a && (a.id ?? a.codigoImovel ?? a.url)) ?? ('idx-' + idx);
    scored.push({ analiseId, pontos: round1(pontos), motivos, scoreImovel, _preco: preco, _idx: idx });
  });

  scored.sort((x, y) =>
    (y.pontos - x.pontos) ||
    (y.scoreImovel - x.scoreImovel) ||
    (x._preco - y._preco) ||
    (x._idx - y._idx)
  );

  return scored.slice(0, limite).map((r) => ({
    analiseId: r.analiseId,
    pontos: r.pontos,
    motivos: r.motivos,
    scoreImovel: r.scoreImovel,
  }));
}

module.exports = { matchLeadImovel, extrairPerfil };
