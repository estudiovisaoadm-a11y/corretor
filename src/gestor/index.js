'use strict';

/**
 * Módulo de métricas do dashboard de gestão
 * Funções puras que recebem arrays de análises e retornam objetos de métricas
 * Zero dependências externas — apenas Node.js puro
 */

function formatarDataLocal(d) {
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

/**
 * Calcula métricas gerais a partir de um array de análises
 * @param {Array} analises - Lista de objetos de análise
 * @returns {Object} Métricas gerais consolidadas
 */
function metricasGerais(analises) {
  if (!analises || analises.length === 0) {
    return {
      total: 0,
      novosHoje: 0,
      taxaConversao: 0,
      ticketMedio: 0,
      scoreMedio: 0,
      porStatus: {},
      porFonte: {}
    };
  }

  var hojeStr = formatarDataLocal(new Date());
  var total = analises.length;
  var novosHoje = 0;
  var fechados = 0;
  var somaPrecos = 0;
  var countPrecos = 0;
  var somaScores = 0;
  var countScores = 0;
  var porStatus = {};
  var porFonte = {};

  for (var i = 0; i < analises.length; i++) {
    var a = analises[i];

    if (a.status === 'novo' && a.createdAt) {
      var d = new Date(a.createdAt);
      if (formatarDataLocal(d) === hojeStr) {
        novosHoje++;
      }
    }

    if (a.status === 'fechado') {
      fechados++;
    }

    if (a.preco != null && !isNaN(a.preco)) {
      somaPrecos += Number(a.preco);
      countPrecos++;
    }

    if (a.score != null && !isNaN(a.score)) {
      somaScores += Number(a.score);
      countScores++;
    }

    var st = a.status || 'desconhecido';
    porStatus[st] = (porStatus[st] || 0) + 1;

    var fonte = a.fonte || a.portal || 'desconhecido';
    porFonte[fonte] = (porFonte[fonte] || 0) + 1;
  }

  var taxaConversao = total > 0 ? (fechados / total * 100) : 0;
  var ticketMedio = countPrecos > 0 ? somaPrecos / countPrecos : 0;
  var scoreMedio = countScores > 0 ? somaScores / countScores : 0;

  return {
    total: total,
    novosHoje: novosHoje,
    taxaConversao: Math.round(taxaConversao * 100) / 100,
    ticketMedio: Math.round(ticketMedio * 100) / 100,
    scoreMedio: Math.round(scoreMedio * 100) / 100,
    porStatus: porStatus,
    porFonte: porFonte
  };
}

/**
 * Calcula métricas de tempo de resposta para leads
 * @param {Array} analises - Lista de objetos de análise
 * @returns {Object} Métricas de tempo de resposta
 */
function tempoResposta(analises) {
  if (!analises || analises.length === 0) {
    return {
      medioMinutos: 0,
      medianoMinutos: 0,
      estourados: 0,
      porCorretor: {}
    };
  }

  var leads = [];
  for (var i = 0; i < analises.length; i++) {
    if (analises[i].distribuidoEm && analises[i].createdAt) {
      leads.push(analises[i]);
    }
  }

  if (leads.length === 0) {
    return {
      medioMinutos: 0,
      medianoMinutos: 0,
      estourados: 0,
      porCorretor: {}
    };
  }

  var tempos = [];
  for (var j = 0; j < leads.length; j++) {
    var criacao = new Date(leads[j].createdAt).getTime();
    var distribuicao = new Date(leads[j].distribuidoEm).getTime();
    tempos.push((distribuicao - criacao) / (1000 * 60));
  }

  var somaTempos = 0;
  for (var k = 0; k < tempos.length; k++) {
    somaTempos += tempos[k];
  }
  var medioMinutos = somaTempos / tempos.length;

  var ordenados = tempos.slice().sort(function(a, b) { return a - b; });
  var meio = Math.floor(ordenados.length / 2);
  var medianoMinutos;
  if (ordenados.length % 2 === 0) {
    medianoMinutos = (ordenados[meio - 1] + ordenados[meio]) / 2;
  } else {
    medianoMinutos = ordenados[meio];
  }

  var estourados = 0;
  for (var m = 0; m < tempos.length; m++) {
    if (tempos[m] > 30) {
      estourados++;
    }
  }

  var porCorretor = {};
  for (var n = 0; n < leads.length; n++) {
    var nome = leads[n].corretor || leads[n].responsavel || 'sem_corretor';
    if (!porCorretor[nome]) {
      porCorretor[nome] = { total: 0, medioMin: 0, estourados: 0, _tempos: [] };
    }
    porCorretor[nome].total += 1;
    porCorretor[nome]._tempos.push(tempos[n]);
    if (tempos[n] > 30) {
      porCorretor[nome].estourados += 1;
    }
  }

  var nomes = Object.keys(porCorretor);
  for (var p = 0; p < nomes.length; p++) {
    var dados = porCorretor[nomes[p]];
    var soma = 0;
    for (var q = 0; q < dados._tempos.length; q++) {
      soma += dados._tempos[q];
    }
    dados.medioMin = Math.round((soma / dados._tempos.length) * 100) / 100;
    delete dados._tempos;
  }

  return {
    medioMinutos: Math.round(medioMinutos * 100) / 100,
    medianoMinutos: Math.round(medianoMinutos * 100) / 100,
    estourados: estourados,
    porCorretor: porCorretor
  };
}

/**
 * Calcula velocidade do funil de conversão
 * @param {Array} analises - Lista de objetos de análise
 * @returns {Object} Métricas de velocidade do funil
 */
function velocityFunil(analises) {
  if (!analises || analises.length === 0) {
    return {
      novoParaVisitado: { medio: 0, mediano: 0 },
      visitadoParaProposta: { medio: 0, mediano: 0 },
      propostaParaFechado: { medio: 0, mediano: 0 },
      tempoTotalFechamento: { medio: 0, mediano: 0 }
    };
  }

  var porImovel = {};
  for (var i = 0; i < analises.length; i++) {
    var id = analises[i].imovelId || analises[i].id;
    if (!porImovel[id]) {
      porImovel[id] = [];
    }
    porImovel[id].push(analises[i]);
  }

  var MS_POR_DIA = 1000 * 60 * 60 * 24;

  function tempoParaDias(ms) {
    return ms / MS_POR_DIA;
  }

  function calcularMetricas(tempos) {
    if (tempos.length === 0) {
      return { medio: 0, mediano: 0 };
    }
    var soma = 0;
    for (var i = 0; i < tempos.length; i++) {
      soma += tempos[i];
    }
    var medio = soma / tempos.length;
    var ordenados = tempos.slice().sort(function(a, b) { return a - b; });
    var meio = Math.floor(ordenados.length / 2);
    var mediano;
    if (ordenados.length % 2 === 0) {
      mediano = (ordenados[meio - 1] + ordenados[meio]) / 2;
    } else {
      mediano = ordenados[meio];
    }
    return {
      medio: Math.round(medio * 100) / 100,
      mediano: Math.round(mediano * 100) / 100
    };
  }

  var transicoes = {
    novo_para_visitado: [],
    visitado_para_proposta: [],
    proposta_para_fechado: [],
    novo_para_fechado: []
  };

  var ids = Object.keys(porImovel);
  for (var j = 0; j < ids.length; j++) {
    var analisesImovel = porImovel[ids[j]];

    var comData = [];
    for (var k = 0; k < analisesImovel.length; k++) {
      if (analisesImovel[k].createdAt) {
        comData.push(analisesImovel[k]);
      }
    }
    comData.sort(function(a, b) {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    if (comData.length < 2) continue;

    var dataNulo = null;
    var dataVisitado = null;
    var dataProposta = null;
    var dataFechado = null;

    for (var m = 0; m < comData.length; m++) {
      var dataMs = new Date(comData[m].createdAt).getTime();
      var status = (comData[m].status || '').toLowerCase();

      if (status === 'novo' && dataNulo === null) dataNulo = dataMs;
      if (status === 'visitado' && dataVisitado === null) dataVisitado = dataMs;
      if (status === 'proposta' && dataProposta === null) dataProposta = dataMs;
      if (status === 'fechado' && dataFechado === null) dataFechado = dataMs;
    }

    if (dataNulo !== null && dataVisitado !== null && dataVisitado > dataNulo) {
      transicoes.novo_para_visitado.push(tempoParaDias(dataVisitado - dataNulo));
    }
    if (dataVisitado !== null && dataProposta !== null && dataProposta > dataVisitado) {
      transicoes.visitado_para_proposta.push(tempoParaDias(dataProposta - dataVisitado));
    }
    if (dataProposta !== null && dataFechado !== null && dataFechado > dataProposta) {
      transicoes.proposta_para_fechado.push(tempoParaDias(dataFechado - dataProposta));
    }
    if (dataNulo !== null && dataFechado !== null && dataFechado > dataNulo) {
      transicoes.novo_para_fechado.push(tempoParaDias(dataFechado - dataNulo));
    }
  }

  return {
    novoParaVisitado: calcularMetricas(transicoes.novo_para_visitado),
    visitadoParaProposta: calcularMetricas(transicoes.visitado_para_proposta),
    propostaParaFechado: calcularMetricas(transicoes.proposta_para_fechado),
    tempoTotalFechamento: calcularMetricas(transicoes.novo_para_fechado)
  };
}

/**
 * Calcula conversão por corretor
 * @param {Array} analises - Lista de objetos de análise
 * @returns {Object} Métricas de conversão por corretor
 */
function conversaoPorCorretor(analises) {
  if (!analises || analises.length === 0) {
    return {};
  }

  var agrupado = {};
  for (var i = 0; i < analises.length; i++) {
    var a = analises[i];
    var nome = a.corretor || a.responsavel || 'sem_corretor';
    if (!agrupado[nome]) {
      agrupado[nome] = {
        total: 0,
        fechados: 0,
        scoreSoma: 0,
        scoreCount: 0,
        temposResposta: []
      };
    }
    agrupado[nome].total += 1;
    if (a.status === 'fechado') {
      agrupado[nome].fechados += 1;
    }
    if (a.score != null && !isNaN(a.score)) {
      agrupado[nome].scoreSoma += Number(a.score);
      agrupado[nome].scoreCount += 1;
    }
    if (a.distribuidoEm && a.createdAt) {
      var tempo = (new Date(a.distribuidoEm).getTime() - new Date(a.createdAt).getTime()) / (1000 * 60);
      agrupado[nome].temposResposta.push(tempo);
    }
  }

  var resultado = {};
  var nomes = Object.keys(agrupado);
  for (var j = 0; j < nomes.length; j++) {
    var dados = agrupado[nomes[j]];
    var taxaConversao = dados.total > 0 ? (dados.fechados / dados.total * 100) : 0;
    var scoreMedio = dados.scoreCount > 0 ? dados.scoreSoma / dados.scoreCount : 0;
    var tempoMedioResposta = 0;
    if (dados.temposResposta.length > 0) {
      var somaT = 0;
      for (var k = 0; k < dados.temposResposta.length; k++) {
        somaT += dados.temposResposta[k];
      }
      tempoMedioResposta = somaT / dados.temposResposta.length;
    }

    resultado[nomes[j]] = {
      total: dados.total,
      fechados: dados.fechados,
      taxaConversao: Math.round(taxaConversao * 100) / 100,
      scoreMedio: Math.round(scoreMedio * 100) / 100,
      tempoMedioResposta: Math.round(tempoMedioResposta * 100) / 100
    };
  }

  return resultado;
}

/**
 * Calcula conversão por portal/fonte
 * @param {Array} analises - Lista de objetos de análise
 * @returns {Object} Métricas de conversão por portal
 */
function conversaoPorPortal(analises) {
  if (!analises || analises.length === 0) {
    return {};
  }

  var agrupado = {};
  for (var i = 0; i < analises.length; i++) {
    var a = analises[i];
    var fonte = a.fonte || a.portal || 'desconhecido';
    if (!agrupado[fonte]) {
      agrupado[fonte] = {
        total: 0,
        leads: 0,
        fechados: 0,
        scoreSoma: 0,
        scoreCount: 0
      };
    }
    agrupado[fonte].total += 1;
    if (a.tipo === 'lead' || a.isLead) {
      agrupado[fonte].leads += 1;
    }
    if (a.status === 'fechado') {
      agrupado[fonte].fechados += 1;
    }
    if (a.score != null && !isNaN(a.score)) {
      agrupado[fonte].scoreSoma += Number(a.score);
      agrupado[fonte].scoreCount += 1;
    }
  }

  var resultado = {};
  var fontes = Object.keys(agrupado);
  for (var j = 0; j < fontes.length; j++) {
    var dados = agrupado[fontes[j]];
    var taxaConversao = dados.total > 0 ? (dados.fechados / dados.total * 100) : 0;
    var scoreMedio = dados.scoreCount > 0 ? dados.scoreSoma / dados.scoreCount : 0;

    resultado[fontes[j]] = {
      total: dados.total,
      leads: dados.leads,
      fechados: dados.fechados,
      taxaConversao: Math.round(taxaConversao * 100) / 100,
      scoreMedio: Math.round(scoreMedio * 100) / 100
    };
  }

  return resultado;
}

module.exports = {
  metricasGerais: metricasGerais,
  tempoResposta: tempoResposta,
  velocityFunil: velocityFunil,
  conversaoPorCorretor: conversaoPorCorretor,
  conversaoPorPortal: conversaoPorPortal
};
