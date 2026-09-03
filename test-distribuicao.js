// test-distribuicao.js — 100% offline, sem dependências. Rode: node test-distribuicao.js
'use strict';

const {
  proximaVez,
  distribuirLead,
  slaStatus,
  checarFila,
  mensagemCorretor
} = require('./src/distribuicao');

function assert(cond, msg) {
  if (!cond) throw new Error('FAIL: ' + msg);
}
function eq(a, b, msg) {
  if (a !== b) throw new Error('FAIL: ' + msg + ' (esperado ' + JSON.stringify(b) + ', veio ' + JSON.stringify(a) + ')');
}
function inclui(str, parte, msg) {
  if (typeof str !== 'string' || !str.includes(parte)) throw new Error('FAIL: ' + msg + ' (faltou ' + JSON.stringify(parte) + ')');
}

// ── Fixtures ──
const equipe = [
  { id: 'c1', nome: 'Ana', whatsapp: '5511999990001', ativo: true },
  { id: 'c2', nome: 'Beto', whatsapp: '5511999990002', ativo: false },
  { id: 'c3', nome: 'Carol', whatsapp: '5511999990003', ativo: true }
];

const AGORA = Date.parse('2026-09-02T12:00:00.000Z');
const iso = (ms) => new Date(ms).toISOString();
const MIN = 60000;

const leadNovoRecente = { // sem corretor, dentro do SLA -> paraDistribuir
  id: 'l1', fonte: 'zap', origem: 'lead-zap', status: 'novo',
  lead: { nome: 'Joao Silva', telefone: '5511988881111', email: 'joao@ex.com', mensagem: 'Tenho interesse', codigoImovel: 'AP123' },
  codigoImovel: 'AP123', bairro: 'Centro',
  createdAt: iso(AGORA - 2 * MIN)
};
const leadEstourado = { // novo + distribuído há 10min -> slaEstourado
  id: 'l2', fonte: 'vivareal', origem: 'lead-vivareal', status: 'novo', corretorId: 'c1',
  lead: { nome: 'Maria Souza', telefone: '5511977772222', email: 'maria@ex.com', mensagem: 'Quero visitar', codigoImovel: 'AP999' },
  codigoImovel: 'AP999',
  createdAt: iso(AGORA - 10 * MIN), distribuidoEm: iso(AGORA - 10 * MIN)
};
const leadJaAtendido = { // status != novo -> ok + motivo ja-atendido
  id: 'l3', fonte: 'olx', origem: 'lead-olx', status: 'contatado', corretorId: 'c3',
  lead: { nome: 'Pedro', telefone: '5511966663333', mensagem: 'Já falei c/ corretor', codigoImovel: 'CS10' },
  createdAt: iso(AGORA - 60 * MIN), distribuidoEm: iso(AGORA - 60 * MIN)
};
const leadOk = { // novo + distribuído há 1min -> ok
  id: 'l4', fonte: 'zap', origem: 'lead-zap', status: 'novo', corretorId: 'c3',
  lead: { nome: 'Lucas', telefone: '5511955554444', email: 'lucas@ex.com', codigoImovel: 'AP555' },
  createdAt: iso(AGORA - 1 * MIN), distribuidoEm: iso(AGORA - 1 * MIN)
};

// ── 1) proximaVez: round-robin pulando inativo ──
let r = proximaVez(equipe, undefined);
eq(r.corretor.id, 'c1', 'rr inicia em c1');
eq(r.proximoEstado.ultimoIndice, 0, 'rr estado 0');

r = proximaVez(equipe, { ultimoIndice: 0 });
eq(r.corretor.id, 'c3', 'rr pula inativo c2 e vai p/ c3');
eq(r.proximoEstado.ultimoIndice, 2, 'rr estado 2');

r = proximaVez(equipe, { ultimoIndice: 2 });
eq(r.corretor.id, 'c1', 'rr dá a volta p/ c1');

r = proximaVez(equipe, { ultimoIndice: 1 }); // apontava p/ inativo
eq(r.corretor.id, 'c3', 'rr após índice inativo vai p/ c3');

r = proximaVez(equipe, {}); // estado inválido = -1
eq(r.corretor.id, 'c1', 'rr estado inválido recomeça');

r = proximaVez([], { ultimoIndice: 0 });
eq(r.corretor, null, 'rr equipe vazia -> null');

r = proximaVez([{ id: 'x', nome: 'I', whatsapp: 'w', ativo: false }], { ultimoIndice: -1 });
eq(r.corretor, null, 'rr sem ativo -> null');

// sequência completa: c1 -> c3 -> c1 (prova que c2 nunca é escolhido)
let est = { ultimoIndice: -1 };
const seq = [];
for (let i = 0; i < 4; i++) { const out = proximaVez(equipe, est); seq.push(out.corretor.id); est = out.proximoEstado; }
eq(seq.join(','), 'c1,c3,c1,c3', 'rr sequência alterna só ativos');

// ── 2) distribuirLead ──
let d = distribuirLead(leadNovoRecente, equipe, { ultimoIndice: -1 });
eq(d.corretorId, 'c1', 'distribui p/ c1');
eq(d.corretorNome, 'Ana', 'distribui nome');
eq(d.whatsapp, '5511999990001', 'distribui whatsapp');
assert(typeof d.distribuidoEm === 'string' && !Number.isNaN(Date.parse(d.distribuidoEm)), 'distribuidoEm ISO válido');
eq(d.proximoEstado.ultimoIndice, 0, 'distribui avança estado');

d = distribuirLead(leadNovoRecente, equipe, { ultimoIndice: 0 });
eq(d.corretorId, 'c3', 'distribui pula inativo');

d = distribuirLead(leadNovoRecente, [{ id: 'x', ativo: false }], { ultimoIndice: -1 });
eq(d.corretorId, null, 'sem ativo -> corretorId null');
eq(d.motivo, 'sem-corretor-ativo', 'sem ativo -> motivo');

// ── 3) slaStatus ──
let s = slaStatus(leadNovoRecente, AGORA, 5);
eq(s.estourado, false, 'lead 2min dentro do SLA');
assert(Math.abs(s.minutosDecorridos - 2) < 0.001, 'minutos ~2');

s = slaStatus(leadEstourado, AGORA, 5);
eq(s.estourado, true, 'lead 10min estoura limite 5');
assert(Math.abs(s.minutosDecorridos - 10) < 0.001, 'minutos ~10');

s = slaStatus(leadEstourado, AGORA, 15);
eq(s.estourado, false, 'limite maior não estoura');

s = slaStatus(leadJaAtendido, AGORA, 5);
eq(s.estourado, false, 'ja-atendido nunca estoura');
eq(s.motivo, 'ja-atendido', 'ja-atendido motivo');

s = slaStatus(leadNovoRecente, AGORA); // default 5
eq(s.estourado, false, 'limite default 5');

// base prioriza distribuidoEm sobre createdAt
const leadBase = { status: 'novo', createdAt: iso(AGORA - 60 * MIN), distribuidoEm: iso(AGORA - 1 * MIN) };
s = slaStatus(leadBase, AGORA, 5);
eq(s.estourado, false, 'usa distribuidoEm como base');

// ── 4) checarFila ──
const fila = checarFila([leadNovoRecente, leadEstourado, leadJaAtendido, leadOk], equipe, AGORA, 5);
eq(fila.paraDistribuir.length, 1, 'fila paraDistribuir=1');
eq(fila.paraDistribuir[0].id, 'l1', 'fila l1 p/ distribuir');
eq(fila.slaEstourado.length, 1, 'fila slaEstourado=1');
eq(fila.slaEstourado[0].id, 'l2', 'fila l2 estourado');
eq(fila.ok.length, 2, 'fila ok=2');
assert(fila.ok.some((x) => x.id === 'l3') && fila.ok.some((x) => x.id === 'l4'), 'fila ok tem l3+l4');
eq(fila.paraDistribuir.length + fila.slaEstourado.length + fila.ok.length, 4, 'fila partição sem duplicar');

// ── 5) mensagemCorretor ──
const txt = mensagemCorretor(leadNovoRecente, '2 quartos, 70m², R$ 350 mil');
assert(typeof txt === 'string' && txt.length > 0, 'mensagem string');
inclui(txt, 'Joao Silva', 'mensagem tem nome');
inclui(txt, '5511988881111', 'mensagem tem contato');
inclui(txt, 'zap', 'mensagem tem portal');
inclui(txt, 'AP123', 'mensagem tem imóvel');
inclui(txt, '2 quartos', 'mensagem tem fichaResumo');

const txt2 = mensagemCorretor({ fonte: 'zap', origem: 'lead-zap', status: 'novo', lead: {}, createdAt: iso(AGORA) });
inclui(txt2, 'não informado', 'mensagem tolera campos ausentes');

console.log('OK test-distribuicao: 30 asserts passaram (4 leads, 3 corretores/1 inativo).');
