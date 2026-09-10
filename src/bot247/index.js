// Bot 24/7 - Assistente Virtual para WhatsApp
// Módulo puro, sem dependências externas, sem chamadas a banco de dados
// Gerencia atendimento ao cliente final (comprador)

/**
 * Formata a ficha do imóvel para exibição no WhatsApp
 * @param {Object} analise - Objeto com dados da análise do imóvel
 * @returns {String} Ficha formatada
 */
function formatarFicha(analise) {
  if (!analise || !analise.extracao) {
    return '🏠 Ficha indisponível — dados insuficientes';
  }
  const precoFormatado = Number(analise.extracao.preco).toLocaleString('pt-BR');
  const precoM2Formatado = Number(analise.extracao.preco_m2).toLocaleString('pt-BR');
  const financiamento = analise.extracao.aceita_financiamento ? 'Sim' : 'Não';
  const escritura = analise.extracao.tem_escritura ? 'Sim' : 'Não';

  return (
    `🏠 *Ficha do Imóvel*\n` +
    `📍 ${analise.bairro} | ${analise.fonte}\n` +
    `💰 R$ ${precoFormatado} | ${analise.extracao.area}m² = R$ ${precoM2Formatado}/m²\n` +
    `📊 Score: ${analise.score}/100 — ${analise.veredito}\n` +
    `💳 Financiamento: ${financiamento}\n` +
    `📝 Escritura: ${escritura}\n` +
    `🔗 ${analise.url}`
  );
}

/**
 * Analisa a mensagem do cliente e identifica a intenção
 * @param {String} texto - Texto recebido do cliente
 * @returns {Object} { intencao, dados }
 */
function parseMensagemCliente(texto) {
  if (!texto) return { intencao: 'desconhecida', dados: {} };
  const textoLower = texto.toLowerCase();

  // Verificar código do imóvel (ex: DFM-123, código 123)
  const regexCodigo = /(?:código|codigo|cod)[:\s]*(\w+[-]?\w+)/i;
  const regexCodigo2 = /\b([A-Z]{2,}[-]?\d{2,})\b/;
  const matchCodigo = texto.match(regexCodigo) || texto.match(regexCodigo2);
  if (matchCodigo) {
    return { intencao: 'consulta_imovel', dados: { codigo: matchCodigo[1] } };
  }

  // Verificar intenção de agendar visita
  if (/visita|ver\s+o\s+imóvel|conhecer|agendar|marcar|visitar/.test(textoLower)) {
    return { intencao: 'agendar_visita', dados: {} };
  }

  // Verificar intenção de orçamento/consulta de preço
  if (/preço|preco|valor|quanto|custa|orçamento|orcamento|R\$/.test(textoLower)) {
    return { intencao: 'orcamento', dados: {} };
  }

  // Verificar dúvidas gerais
  if (/dúvida|duvida|pode|como|qual|quais|por que|porque|informação|informacao/.test(textoLower)) {
    return { intencao: 'duvida', dados: {} };
  }

  if (/ajuda|help|menu|opções|opcoes/.test(textoLower)) {
    return { intencao: 'ajuda', dados: {} };
  }

  // Intenção desconhecida
  return { intencao: 'desconhecida', dados: {} };
}

/**
 * Retorna resposta automática baseada na intenção do cliente
 * @param {String} intencao - Tipo de intenção identificada
 * @param {Object} dados - Dados adicionais parseados
 * @returns {String} Resposta do bot
 */
function respostaAutomatica(intencao, dados) {
  switch (intencao) {
    case 'consulta_imovel':
      return `Encontrei o imóvel! Aqui está a ficha: [ficha]`;
    case 'agendar_visita':
      return `Ótimo! Vou verificar disponibilidade. Quando seria melhor para você?`;
    case 'orcamento':
      return `Posso preparar uma análise completa! Me envie o link do anúncio.`;
    case 'duvida':
      return `Claro! Posso ajudar. Me envie mais detalhes.`;
    case 'ajuda':
      return 'Posso ajudar com:\n• Envie um link de anúncio para análise\n• Digite um código de imóvel\n• Peça para agendar visita\n• Pergunte sobre preços e valores';
    case 'desconhecida':
    default:
      return `Olá! Sou assistente virtual. Envie o link de um imóvel para análise ou digite 'ajuda'.`;
  }
}

/**
 * Verifica se o horário atual está dentro do horário comercial
 * Segunda a Sexta: 8h às 19h | Sábado: 8h às 13h | Domingo: Fechado
 * Baseado no fuso horário de Brasília (UTC-3)
 * @returns {Boolean} true se estiver em horário comercial
 */
function ehHorarioComercial(agora) {
  if (!agora) agora = new Date();

  // Converter para horário de Brasília (UTC-3)
  const offsetBRT = -3;
  const brtMs = agora.getTime() + (offsetBRT * 60 * 60 * 1000);
  const brtDate = new Date(brtMs);
  const diaSemana = brtDate.getUTCDay();
  const horasBRT = brtDate.getUTCHours();
  const minutos = brtDate.getUTCMinutes();

  const horasDecimais = horasBRT + minutos / 60;

  // Segunda a Sexta (1 a 5): 8h às 19h
  if (diaSemana >= 1 && diaSemana <= 5) {
    return horasDecimais >= 8 && horasDecimais < 19;
  }

  // Sábado (6): 8h às 13h
  if (diaSemana === 6) {
    return horasDecimais >= 8 && horasDecimais < 13;
  }

  // Domingo (0): fechado
  return false;
}

/**
 * Retorna resposta inteligente com base na intenção e horário
 * @param {String} intencao - Tipo de intenção
 * @param {Object} dados - Dados parseados da mensagem
 * @param {Date} [agora] - Data/hora atual (para testes, opcional)
 * @returns {String} Resposta contextualizada
 */
function respostaInteligente(intencao, dados, agora) {
  const horarioComercial = ehHorarioComercial(agora || new Date());

  const resposta = respostaAutomatica(intencao, dados);

  if (horarioComercial) {
    return `${resposta} Um corretor entrará em contato!`;
  }

  return `${resposta}\n\nEstou fora do horário comercial. Deixe sua mensagem que retorno amanhã!`;
}

// Exportar funções do módulo
module.exports = {
  formatarFicha,
  parseMensagemCliente,
  respostaAutomatica,
  ehHorarioComercial,
  respostaInteligente,
};
