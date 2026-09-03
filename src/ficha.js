// Gera ficha padronizada + veredito (texto + markdown)
const { parseAnuncioUrl } = require('./integracoes');
const { extrair } = require('./ia/extraction');
const { calcScore } = require('./scoring/score');

// Base inicial de média m² por bairro (DF) — MVP: editar manualmente, V2 calcula do histórico
const MEDIAS_M2 = {
  'asa sul': 10500,
  'asa norte': 9800,
  'aguas claras': 8200,
  'sul': 8200,
  'norte': 7800,
  'sudoeste': 11200,
  'noroeste': 10800,
  'lago sul': 12500,
  'lago norte': 11000,
  'taguatinga': 6800,
  'guara': 7300,
  'vicente pires': 5900,
  'jardim botanico': 8900,
  default: 8000
};

function mediaDoBairro(bairro) {
  if (!bairro) return MEDIAS_M2.default;
  const b = bairro.toLowerCase();
  for (const k of Object.keys(MEDIAS_M2)) {
    if (k !== 'default' && b.includes(k)) return MEDIAS_M2[k];
  }
  return MEDIAS_M2.default;
}

function analisar({ url, texto = '', preco = null, area = null, localizacaoNota = 6 }) {
  const parsed = url ? parseAnuncioUrl(url) : { fonte: 'manual' };
  const extracao = extrair(texto);

  const precoFinal = preco ?? extracao.preco;
  const areaFinal = area ?? extracao.area_m2;
  const precoM2 = precoFinal && areaFinal ? Math.round(precoFinal / areaFinal) : extracao.preco_m2;

  const bairro = parsed.bairro || null;
  const media = mediaDoBairro(bairro);
  const seloImovelSeguro = parsed.selos?.imovelSeguro === true;
  const oportunidadeSinal = parsed.oportunidadeSinal === true;

  const score = calcScore({ precoM2, mediaBairro: media, localizacaoNota, extracao, seloImovelSeguro, oportunidadeSinal });

  return {
    fonte: parsed.fonte || 'manual',
    url: url || null,
    parsed,
    extracao: { ...extracao, preco: precoFinal, area_m2: areaFinal, preco_m2: precoM2 },
    media_bairro_ref: media,
    bairro,
    ...score
  };
}

function fichaMarkdown(a) {
  const e = a.extracao;
  const fmt = (v) => v === true ? '✅ Sim' : v === false ? '❌ Não' : '⚠️ Confirmar';
  const brl = (v) => v ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : '—';
  return [
    `# Ficha — ${a.veredito} (${a.score}/100)`,
    ``,
    `- Fonte: ${a.fonte}${a.url ? ` — ${a.url}` : ''}`,
    `- Preço: ${brl(e.preco)} | Área: ${e.area_m2 ? e.area_m2 + 'm²' : '—'} | **R$/m²: ${e.preco_m2 ? brl(e.preco_m2) : '—'}** (média ref ${a.bairro || 'DF'}: ${brl(a.media_bairro_ref)})`,
    `- Localização: ${a.bairro || 'não identificada'} — nota ${a.detalhes.localizacao.nota}/10`,
    `- Financiamento: ${fmt(e.aceita_financiamento)}`,
    `- Permuta: ${fmt(e.aceita_permuta)}`,
    `- Escritura: ${fmt(e.tem_escritura)} | Habite-se: ${fmt(e.tem_habite_se)} | Matrícula: ${fmt(e.tem_matricula)}`,
    ``,
    `## Por quê`,
    `- m²: ${a.detalhes.preco_m2.motivo}`,
    `- doc: ${a.detalhes.documentacao.motivo}`,
    ...(e.precisa_confirmar.length ? [`- ⚠️ Confirmar com anunciante: ${e.precisa_confirmar.join(', ')}`] : []),
    ...(a.fonte === 'dfimoveis' && a.parsed.selos?.imovelSeguro ? [`- Selo Imóvel Seguro detectado`] : []),
    ...(a.parsed.oportunidadeSinal ? [`- Sinal de queda de preço (WImóveis) — checar histórico`] : [])
  ].join('\n');
}

module.exports = { analisar, fichaMarkdown, mediaDoBairro };
