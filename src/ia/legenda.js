// Gerador de legenda persuasiva (template local; com LLM usa buildPromptLegenda)
function gerarLegenda(a, foco = 'venda') {
  if (!a || !a.extracao) return { error: 'análise sem dados para gerar legenda' };
  const e = a.extracao;
  const brl = (v) => v ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : '';
  const feats = [];
  if (e.area_m2) feats.push(`${e.area_m2}m²`);
  if (a.bairro) feats.push(a.bairro);
  if (e.aceita_financiamento) feats.push('aceita financiamento');
  if (e.aceita_permuta) feats.push('aceita permuta');
  if (e.tem_escritura && e.tem_habite_se) feats.push('documentação em dia');
  const gancho = a.score >= 80 ? 'OPORTUNIDADE ABAIXO DA MÉDIA' : a.score >= 60 ? 'ÓTIMO CUSTO-BENEFÍCIO' : 'CONFIRA ESTA OPÇÃO';
  const legenda = `${gancho} — ${e.preco ? brl(e.preco) : ''}${e.preco_m2 ? ` (${brl(e.preco_m2)}/m²)` : ''}\n${feats.join(' • ')}\n${a.veredito} (${a.score}/100). Chame no direct e agende sua visita!`;
  return { legenda, hashtags: '#imoveis #brasilia #df #oportunidade #corretor' };
}

function buildPromptLegenda(a) {
  return `Você é copywriter imobiliário. Gere 1 legenda curta de WhatsApp/Instagram para este imóvel (máx 500 chars, tom consultivo, sem inventar dados): ${JSON.stringify({ preco: a.extracao?.preco, area: a.extracao?.area_m2, bairro: a.bairro, score: a.score, veredito: a.veredito })}`;
}

module.exports = { gerarLegenda, buildPromptLegenda };
