'use strict';

const CANDIDATOS_CONFIG = {
  diasMinimos: 14,
  statusPermitidos: ['novo', 'analisado', 'visitado'],
  excludeStatus: ['fechado', 'descartado'],
  fitMinimo: 30,
};

function classificarLead(lead, agoraMs) {
  const criadoEmMs = new Date(lead.criadoEm).getTime();
  const diffMs = agoraMs - criadoEmMs;
  const diffHoras = diffMs / (1000 * 60 * 60);
  const diffDias = diffHoras / 24;

  let faixa;
  if (diffHoras < 1) {
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

  if (lead.bairro && imovel.bairro && lead.bairro === imovel.bairro) {
    pontos += 30;
    motivos.push('mesmo bairro');
  }

  if (lead.budget && imovel.preco) {
    const diffPercentual = Math.abs(lead.budget - imovel.preco) / lead.budget;
    if (diffPercentual <= 0.10) {
      pontos += 25;
      motivos.push('preço dentro do orçamento');
    } else if (diffPercentual <= 0.20) {
      pontos += 15;
      motivos.push('preço próximo ao orçamento');
    }
  }

  if (lead.aceita_financiamento === imovel.aceita_financiamento && lead.aceita_financiamento) {
    pontos += 15;
    motivos.push('aceita financiamento');
  }

  if (imovel.tem_escritura) {
    pontos += 10;
    motivos.push('com escritura');
  }

  if (imovel.tem_habite_se) {
    pontos += 10;
    motivos.push('com habite-se');
  }

  if (lead.telefone) {
    pontos += 5;
  }

  if (lead.email) {
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
    const criadoEmMs = new Date(lead.criadoEm).getTime();
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

  return `Olá ${lead.nome}! Faz ${dias} dias que analisamos o imóvel em ${imovel.bairro}. Encontrei uma opção parecida com ${motivos}. Quer que eu envie a ficha?`;
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
