'use strict';

const CANDIDATOS_CONFIG = {
  diasMinimos: 14,
  statusPermitidos: ['novo', 'analisado', 'visitado'],
  excludeStatus: ['fechado', 'descartado'],
  fitMinimo: 30,
};

function getDataCriacaoMs(lead) {
  const data = lead?.createdAt || lead?.criadoEm || lead?.lead?.createdAt || lead?.lead?.criadoEm;
  return data ? new Date(data).getTime() : NaN;
}

function classificarLead(lead, agoraMs) {
  const criadoEmMs = getDataCriacaoMs(lead);
  const diffMs = Number.isNaN(criadoEmMs) ? 0 : agoraMs - criadoEmMs;
  const diffHoras = diffMs / (1000 * 60 * 60);
  const diffDias = diffHoras / 24;

  let faixa;
  if (Number.isNaN(criadoEmMs)) {
    faixa = 'NOVO';
  } else if (diffHoras < 1) {
    faixa = 'NOVO';
  } else if (diffHoras < 24) {
    faixa = 'QUENTE';
  } else if (diffDias < 7) {
    faixa = 'MORNO';
  } else if (diffDias < 30) {
    faixa = 'FRIO';
  } else {
    faixa = 'GELADO';
  }

  return {
    faixa,
    diasDesdeCriacao: diffDias,
    horasDesdeCriacao: diffHoras,
  };
}

function calcularFit(lead, imovel) {
  let pontos = 0;
  const motivos = [];

  const lBairro = lead?.bairro || lead?.lead?.bairro;
  const iBairro = imovel?.bairro;
  if (lBairro && iBairro && String(lBairro).toLowerCase() === String(iBairro).toLowerCase()) {
    pontos += 30;
    motivos.push('mesmo bairro');
  }

  const lBudget = lead?.budget || lead?.lead?.budget;
  const iPreco = imovel?.preco || imovel?.extracao?.preco;
  if (lBudget && iPreco) {
    const diffPercentual = Math.abs(lBudget - iPreco) / lBudget;
    if (diffPercentual <= 0.10) {
      pontos += 25;
      motivos.push('preço dentro do orçamento');
    } else if (diffPercentual <= 0.20) {
      pontos += 15;
      motivos.push('preço próximo ao orçamento');
    }
  }

  const lFinanc = lead?.aceita_financiamento ?? lead?.lead?.aceita_financiamento;
  const iFinanc = imovel?.aceita_financiamento ?? imovel?.extracao?.aceita_financiamento;
  if (lFinanc === iFinanc && Boolean(lFinanc)) {
    pontos += 15;
    motivos.push('aceita financiamento');
  }

  const iEscritura = imovel?.tem_escritura ?? imovel?.extracao?.tem_escritura;
  if (iEscritura) {
    pontos += 10;
    motivos.push('com escritura');
  }

  const iHabiteSe = imovel?.tem_habite_se ?? imovel?.extracao?.tem_habite_se;
  if (iHabiteSe) {
    pontos += 10;
    motivos.push('com habite-se');
  }

  const lTel = lead?.telefone || lead?.lead?.telefone;
  if (lTel) {
    pontos += 5;
  }

  const lEmail = lead?.email || lead?.lead?.email;
  if (lEmail) {
    pontos += 5;
  }

  let fit;
  if (pontos >= 70) {
    fit = 'excelente';
  } else if (pontos >= 50) {
    fit = 'bom';
  } else if (pontos >= 30) {
    fit = 'medio';
  } else {
    fit = 'baixo';
  }

  return { pontos, motivos, fit };
}

function candidatosReativacao(leads, imoveis, config) {
  const cfg = { ...CANDIDATOS_CONFIG, ...config };
  const agoraMs = Date.now();

  const filtrados = leads.filter((lead) => {
    const classificacao = classificarLead(lead, agoraMs);
    const diasMinimosMs = cfg.diasMinimos * 24 * 60 * 60 * 1000;
    const criadoEmMs = getDataCriacaoMs(lead);
    if (Number.isNaN(criadoEmMs)) return false;
    const idadeMs = agoraMs - criadoEmMs;

    if (idadeMs < diasMinimosMs) return false;
    if (!cfg.statusPermitidos.includes(lead.status)) return false;
    if (cfg.excludeStatus.includes(lead.status)) return false;

    return true;
  });

  const resultados = [];

  for (const lead of filtrados) {
    let melhorFit = null;
    let melhorImovel = null;
    let melhorPontos = -1;

    for (const imovel of imoveis) {
      const fitResultado = calcularFit(lead, imovel);
      if (fitResultado.pontos > melhorPontos) {
        melhorPontos = fitResultado.pontos;
        melhorFit = fitResultado;
        melhorImovel = imovel;
      }
    }

    if (melhorFit && melhorPontos >= cfg.fitMinimo) {
      const classificacao = classificarLead(lead, agoraMs);
      const dias = Math.floor(classificacao.diasDesdeCriacao);
      const motivoReativacao = melhorFit.motivos.join(', ');

      resultados.push({
        lead,
        imovel: melhorImovel,
        fit: melhorFit.fit,
        pontosFit: melhorFit.pontos,
        motivoReativacao,
        mensagem: gerarMensagemReativacao({
          lead,
          imovel: melhorImovel,
          motivoReativacao,
          dias,
        }),
      });
    }
  }

  resultados.sort((a, b) => b.pontosFit - a.pontosFit);

  return resultados;
}

function gerarMensagemReativacao(candidato) {
  const { lead, imovel, motivoReativacao } = candidato;
  const motivos = motivoReativacao && motivoReativacao.length > 0 ? motivoReativacao.split(',')[0].trim() : 'uma oportunidade';
  const agoraMs = Date.now();
  const classificacao = classificarLead(lead, agoraMs);
  const dias = Math.floor(classificacao.diasDesdeCriacao);
  const nome = lead?.nome || lead?.lead?.nome || 'Cliente';
  const bairro = imovel?.bairro || 'sua região de interesse';

  return `Olá ${nome}! Faz ${dias} dias que analisamos o imóvel em ${bairro}. Encontrei uma opção parecida com ${motivos}. Quer que eu envie a ficha?`;
}

function filtrarPorTemperatura(leads, faixa) {
  const agoraMs = Date.now();
  return leads.filter((lead) => {
    const classificacao = classificarLead(lead, agoraMs);
    return classificacao.faixa === faixa;
  });
}

module.exports = {
  CANDIDATOS_CONFIG,
  classificarLead,
  calcularFit,
  candidatosReativacao,
  gerarMensagemReativacao,
  filtrarPorTemperatura,
};
