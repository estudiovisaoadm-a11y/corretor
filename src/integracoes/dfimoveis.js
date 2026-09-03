// Parser DFImóveis — https://www.dfimoveis.com.br
// Padrões: /venda/df/brasilia/asa-sul/sala , /venda/df/aguas-claras/sul/apartamento , /aluguel/...

function parseDfimoveisUrl(urlString) {
  try {
    const u = new URL(urlString);
    if (!u.hostname.includes('dfimoveis.com.br')) return null;
    const parts = u.pathname.split('/').filter(Boolean); // ex: [venda, df, brasilia, asa-sul, sala]
    const [transacao, uf, cidade, bairroOuTipo, tipoOuNada] = parts;
    let tipo = null;
    let bairro = null;
    if (parts.length >= 5) {
      bairro = bairroOuTipo;
      tipo = tipoOuNada;
    } else if (parts.length === 4) {
      tipo = bairroOuTipo;
    }
    const params = u.searchParams;
    return {
      fonte: 'dfimoveis',
      transacao: transacao === 'aluguel' ? 'aluguel' : transacao === 'lancamento' ? 'lancamento' : 'venda',
      uf: uf || 'df',
      cidade: cidade ? decodeURIComponent(cidade) : null,
      bairro: bairro ? decodeURIComponent(bairro).replace(/-/g, ' ') : null,
      tipo: tipo ? decodeURIComponent(tipo) : null,
      selos: {
        imovelSeguro: params.get('imovelseguro') === 'true',
        superDestaque: params.get('superdestaque') === 'true',
        imovelAssinado: params.get('imovelassinado') === 'true',
        mansaoSuspensa: params.get('mansaosuspensa') === 'true'
      },
      url: urlString
    };
  } catch {
    return null;
  }
}

module.exports = { parseDfimoveisUrl };
