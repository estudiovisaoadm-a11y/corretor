'use strict';

/**
 * Módulo de geração de propostas de intermediação imobiliária.
 * Funções puras — recebe análise + configuração, retorna texto formatado.
 * Zero dependências externas, CommonJS.
 */

function formatarMoeda(valor) {
  if (valor == null || isNaN(valor)) return 'R$ 0';
  const num = Number(valor);
  const partes = num.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return 'R$ ' + partes;
}

function formatarData(data) {
  if (!data) data = new Date();
  const d = String(data.getDate()).padStart(2, '0');
  const m = String(data.getMonth() + 1).padStart(2, '0');
  const a = data.getFullYear();
  return `${d}/${m}/${a}`;
}

function validarProposta(analise) {
  const erros = [];

  if (!analise || typeof analise !== 'object') {
    return { ok: false, erros: ['Análise não fornecida ou inválida'] };
  }

  const ex = analise.extracao || {};

  if (ex.preco == null || ex.preco <= 0) {
    erros.push('Preço não informado ou inválido');
  }
  if (!analise.bairro || analise.bairro.trim() === '') {
    erros.push('Bairro não informado');
  }

  // Avisos sobre campos faltantes
  if (ex.area == null || ex.area <= 0) {
    erros.push('Área não informada');
  }
  if (ex.tem_escritura == null) {
    erros.push('Status da escritura não informado');
  }
  if (ex.tem_habite_se == null) {
    erros.push('Status do habite-se não informado');
  }

  return { ok: erros.length === 0, erros };
}

function gerarProposta(analise, config) {
  if (!analise || !config) {
    throw new Error('Parâmetros analise e config são obrigatórios');
  }

  const ex = analise.extracao || {};
  const validadeDias = config.validadeDias || 10;
  const comissaoPct = config.comissaoPct || 6;

  const preco = ex.preco != null ? formatarMoeda(ex.preco) : 'R$ não informado';
  const precoM2 = ex.preco_m2 != null ? formatarMoeda(ex.preco_m2) : 'R$ não informado';
  const area = ex.area != null ? ex.area : 'não informada';
  const bairro = analise.bairro || 'não informado';
  const url = analise.url || 'não informado';

  const financiamento = ex.aceita_financiamento ? 'Sim, aceita financiamento' : 'Não aceita financiamento';
  const escritura = ex.tem_escritura ? '✓ registrada' : '✗ pendente';
  const habite_se = ex.tem_habite_se ? '✓ aprovado' : '✗ pendente';
  const iptu = ex.IPTU ? `R$ ${ex.IPTU}` : 'a verificar';

  const data = formatarData();
  const corretorNome = config.corretorNome || 'não informado';
  const corretorCreci = config.corretorCreci || 'não informado';
  const imobiliariaNome = config.imobiliariaNome || '';
  const observacoes = config.observacoes ? `\n${config.observacoes}\n` : '';

  const linhas = [
    '═══════════════════════════',
    'PROPOSTA DE INTERMEDIAÇÃO',
    '═══════════════════════════',
    '',
    `INTERMEDIÁRIO(A): ${corretorNome}`,
    `CRECI: ${corretorCreci}`,
    imobiliariaNome,
    '',
    `DATA: ${data}`,
    `VALIDADE: ${validadeDias} dias`,
    '',
    '───────────────────────────',
    'DADOS DO IMÓVEL',
    '───────────────────────────',
    `Código: ${url}`,
    `Bairro: ${bairro}`,
    `Área: ${area}m²`,
    `Preço: ${preco}`,
    `Preço/m²: ${precoM2}`,
    '',
    `Análise IA: ${analise.score != null ? analise.score : '?'}/100 — ${analise.veredito || 'sem veredito'}`,
    '',
    `FINANCIAMENTO: ${financiamento}`,
    'DOCUMENTAÇÃO:',
    `  Escritura: ${escritura}`,
    `  Habite-se: ${habite_se}`,
    `  IPTU: ${iptu}`,
    '',
    '───────────────────────────',
    'CONDIÇÕES',
    '───────────────────────────',
    `• Comissão: ${comissaoPct}% sobre o valor de venda`,
    '• Pagamento: à vista ou financiamento conforme aprovação',
    `• Prazo de venda exclusiva: ${validadeDias} dias`,
    '',
    observacoes,
    '═══════════════════════════',
    '_Análise gerada por IA — score baseado em preço/m², localização, documentação, financiamento e permuta._',
  ];

  return linhas.join('\n');
}

function resumoProposta(analise) {
  if (!analise) return '';

  const ex = analise.extracao || {};
  const bairro = analise.bairro || '?';
  const preco = ex.preco != null ? formatarMoeda(ex.preco) : '?';
  const area = ex.area != null ? `${ex.area}m²` : '?';
  const score = analise.score != null ? analise.score : '?';
  const veredito = analise.veredito || '?';
  const financiamento = ex.aceita_financiamento ? 'Aceita financiamento' : 'Não aceita financiamento';

  const docParts = [];
  if (ex.tem_escritura != null) docParts.push(ex.tem_escritura ? 'Escritura ✓' : 'Escritura ✗');
  if (ex.tem_habite_se != null) docParts.push(ex.tem_habite_se ? 'Habite-se ✓' : 'Habite-se ✗');
  const docs = docParts.length > 0 ? docParts.join(' | ') : 'Docs pendentes';

  return `🏠 ${bairro} | ${preco} | ${area} — Score ${score}/100 (${veredito})\n💳 ${financiamento} | 📝 ${docs}`;
}

module.exports = { gerarProposta, validarProposta, resumoProposta, formatarMoeda };
