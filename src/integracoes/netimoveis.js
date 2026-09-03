// Parser NetImóveis — https://www.netimoveis.com/
// Padrões: /venda/distrito-federal/brasilia/apartamento?tipo=apartamento&localizacao=BR-DF-brasilia---&transacao=venda

function parseNetimoveisUrl(urlString) {
  try {
    const u = new URL(urlString);
    if (!u.hostname.includes('netimoveis.com')) return null;
    const parts = u.pathname.split('/').filter(Boolean);
    // [venda, distrito-federal, brasilia, apartamento]
    const [transacao, estado, cidade, tipo] = parts;
    const params = u.searchParams;
    return {
      fonte: 'netimoveis',
      transacao: params.get('transacao') || transacao || 'venda',
      estado: estado ? decodeURIComponent(estado) : null,
      cidade: cidade ? decodeURIComponent(cidade) : null,
      tipo: params.get('tipo') || (tipo ? decodeURIComponent(tipo) : null),
      localizacao: params.get('localizacao'), // ex: BR-DF-brasilia---
      maisOpcoes: params.get('maisOpcoes'),
      precoMax: params.get('precoMax') ? Number(params.get('precoMax')) : null,
      url: urlString
    };
  } catch {
    return null;
  }
}

module.exports = { parseNetimoveisUrl };
