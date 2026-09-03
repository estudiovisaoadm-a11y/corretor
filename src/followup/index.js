'use strict';

const SEQUENCIAS = {
  QUENTE: [
    { step: 1, nome: 'Apresentação ficha', dias: 0, mensagem: 'Olá {nome}, analisei o imóvel {codigo} no bairro {bairro} e acredito que pode ser uma ótima oportunidade para você. Vamos conversar?' },
    { step: 2, nome: 'Lembrete visita', dias: 1, mensagem: 'Olá {nome}, tudo bem? Estava pensando no imóvel {codigo} que comentei. Que tal agendarmos uma visita rápida para você conhecer?' },
    { step: 3, nome: 'Última chance', dias: 3, mensagem: 'Olá {nome}, o imóvel {codigo} no {bairro} está com alta procura. Não queremos que você perca essa oportunidade por {preco}. O que acha de finalizarmos?' },
  ],
  MORNO: [
    { step: 1, nome: 'Apresentação', dias: 0, mensagem: 'Olá {nome}, sou especialista em imóveis na região. Vi que o imóvel {codigo} chamou sua atenção. Posso te ajudar com mais informações?' },
    { step: 2, nome: 'Conteúdo valor', dias: 3, mensagem: 'Olá {nome}, separei algumas informações sobre o mercado imobiliário no {bairro} que podem te ajudar na sua decisão. Quer receber?' },
    { step: 3, nome: 'Convida visita', dias: 7, mensagem: 'Olá {nome}, já pensou em conhecer o imóvel {codigo} pessoalmente? Posso agendar uma visita em um horário que seja conveniente para você.' },
    { step: 4, nome: 'Reativação', dias: 14, mensagem: 'Olá {nome}, faz um tempo que conversamos. O mercado no {bairro} está em movimento e tenho novidades que podem te interessar. Podemos retomar a conversa?' },
  ],
  FRIO: [
    { step: 1, nome: 'Boas-vindas', dias: 0, mensagem: 'Olá {nome}, seja bem-vindo(a)! Fico feliz com seu interesse em imóveis. Sou {nome} e estou à disposição para o que precisar.' },
    { step: 2, nome: 'Mercado atualizado', dias: 14, mensagem: 'Olá {nome}, passando para atualizar você sobre o mercado imobiliário. Preços no {bairro} estão bem competitivos. Quer receber um resumo?' },
    { step: 3, nome: 'Oportunidade nova', dias: 30, mensagem: 'Olá {nome}, temos uma nova oportunidade que pode se encaixar no que você procura. O imóvel {codigo} está disponível por {preco}. Quer saber mais?' },
  ],
};

const SEQUENCIA_MAP = {
  QUENTE: SEQUENCIAS.QUENTE,
  MORNO: SEQUENCIAS.MORNO,
  FRIO: SEQUENCIAS.FRIO,
};

const SCORE_PARA_SEQUENCIA = {
  QUENTE: 'QUENTE',
  MORNO: 'MORNO',
  FRIO: 'FRIO',
};

function tarefasPendentes(lead, agoraMs) {
  const faixa = lead && lead.leadScore && lead.leadScore.faixa;
  const sequenciaNome = SCORE_PARA_SEQUENCIA[faixa] || 'FRIO';
  const sequencia = SEQUENCIA_MAP[sequenciaNome];
  if (!sequencia || sequencia.length === 0) return [];

  if (!lead.followup) {
    const primeiro = sequencia[0];
    const criadoEm = lead.createdAt || agoraMs;
    const diasDesdeCriacao = Math.floor((agoraMs - criadoEm) / 86400000);
    const overdue = diasDesdeCriacao > primeiro.dias;
    return [{ ...primeiro, sequencia: sequenciaNome, overdue, mensagem: primeiro.mensagem }];
  }

  const fu = lead.followup;
  const seq = SEQUENCIA_MAP[fu.sequencia] || sequencia;
  const inicioEm = lead.followup.inicioEm || lead.createdAt || agoraMs;
  const diasDesdeInicio = Math.floor((agoraMs - inicioEm) / 86400000);
  const resultado = [];

  for (let i = 0; i < seq.length; i++) {
    const s = seq[i];
    if (s.step <= (fu.ultimoStep || 0)) continue;

    if (diasDesdeInicio >= s.dias) {
      resultado.push({ ...s, sequencia: fu.sequencia, overdue: diasDesdeInicio > s.dias });
    }
  }

  return resultado;
}

function proximoStep(lead) {
  if (!lead || !lead.followup) return null;
  const fu = lead.followup;
  const seq = SEQUENCIA_MAP[fu.sequencia];
  if (!seq) return null;
  const idx = (fu.proximoStep || 1) - 1;
  if (idx >= seq.length) return null;
  return { ...seq[idx] };
}

function iniciarSequencia(lead) {
  const faixa = lead && lead.leadScore && lead.leadScore.faixa;
  const sequenciaNome = SCORE_PARA_SEQUENCIA[faixa] || 'FRIO';
  const now = Date.now();
  return {
    followup: {
      sequencia: sequenciaNome,
      ultimoStep: 0,
      proximoStep: 1,
      inicioEm: now,
    },
  };
}

function avancarStep(lead, agoraMs) {
  if (!lead || !lead.followup) return null;
  const fu = { ...lead.followup };
  const seq = SEQUENCIA_MAP[fu.sequencia];
  if (!seq) return null;

  const atual = fu.proximoStep || 1;
  const idx = atual - 1;

  if (idx >= seq.length - 1) {
    return { followup: { ...fu, completo: true } };
  }

  return {
    followup: {
      ...fu,
      ultimoStep: atual,
      proximoStep: atual + 1,
    },
  };
}

function gerarMensagem(step, lead) {
  let msg = step.mensagem || '';
  const nome = (lead && lead.nome) || '';
  const codigo = (lead && lead.codigo) || '';
  const bairro = (lead && lead.bairro) || '';
  const preco = (lead && lead.preco) || '';
  const score = (lead && lead.leadScore && lead.leadScore.faixa) || '';

  msg = msg.replace(/\{nome\}/g, nome);
  msg = msg.replace(/\{codigo\}/g, codigo);
  msg = msg.replace(/\{bairro\}/g, bairro);
  msg = msg.replace(/\{preco\}/g, preco);
  msg = msg.replace(/\{score\}/g, score);

  return msg;
}

module.exports = {
  SEQUENCIAS,
  tarefasPendentes,
  proximoStep,
  iniciarSequencia,
  avancarStep,
  gerarMensagem,
};
