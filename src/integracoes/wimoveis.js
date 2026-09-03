// Parser WImóveis — https://www.wimoveis.com.br
// Padrões: /venda/imoveis/df/brasilia , /venda/apartamentos/df/brasilia/asa-norte , /aluguel/casas/...

function parseWimoveisUrl(urlString) {
  try {
    const u = new URL(urlString);
    if (!u.hostname.includes('wimoveis.com.br')) return null;
    const parts = u.pathname.split('/').filter(Boolean);
    // [venda, apartamentos, df, brasilia, asa-norte]
    const [transacao, tipo, uf, cidade, bairro] = parts;
    const params = u.searchParams;
    return {
      fonte: 'wimoveis',
      transacao: transacao || 'venda',
      tipo: tipo ? decodeURIComponent(tipo) : null,
      uf: uf || null,
      cidade: cidade ? decodeURIComponent(cidade) : null,
      bairro: bairro ? decodeURIComponent(bairro).replace(/-/g, ' ') : null,
      filtros: {
        bedroom: params.get('bedroom'),
        propertyType: params.get('propertyType'),
        sort: params.get('sort'), // most_lowered_price = oportunidade, more_recent, most_visit
        edificio: params.get('edificio')
      },
      oportunidadeSinal: params.get('sort') === 'most_lowered_price',
      url: urlString
    };
  } catch {
    return null;
  }
}

module.exports = { parseWimoveisUrl };
