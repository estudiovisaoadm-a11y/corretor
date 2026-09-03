// Comparador lado-a-lado: recebe 2-3 análises, devolve tabela + vencedor por critério
function comparar(lista) {
  const itens = lista.filter(Boolean).slice(0, 3);
  if (itens.length < 2) return { error: 'passe 2 ou 3 ids para comparar' };
  const linha = (label, fn) => {
    const vals = itens.map(fn);
    const num = vals.every((v) => typeof v === 'number' && v != null);
    let best = -1;
    if (num) best = vals.indexOf(Math[label === 'R$/m²' ? 'min' : 'max'].apply(null, vals));
    return { criterio: label, valores: vals, melhor: best };
  };
  const linhas = [
    linha('Score', (a) => a.score),
    linha('R$/m²', (a) => a.extracao?.preco_m2 ?? null),
    linha('Preço', (a) => a.extracao?.preco ?? null),
    linha('Área m²', (a) => a.extracao?.area_m2 ?? null),
    { criterio: 'Veredito', valores: itens.map((a) => a.veredito), melhor: -1 },
    { criterio: 'Bairro', valores: itens.map((a) => a.bairro || '—'), melhor: -1 },
    { criterio: 'Financiamento', valores: itens.map((a) => a.extracao?.aceita_financiamento === true ? 'Sim' : a.extracao?.aceita_financiamento === false ? 'Não' : '?'), melhor: -1 },
    { criterio: 'Permuta', valores: itens.map((a) => a.extracao?.aceita_permuta === true ? 'Sim' : a.extracao?.aceita_permuta === false ? 'Não' : '?'), melhor: -1 },
    { criterio: 'Doc OK', valores: itens.map((a) => a.extracao?.tem_escritura && a.extracao?.tem_habite_se ? 'Sim' : '?'), melhor: -1 }
  ];
  const vencedor = [...itens].sort((a, b) => b.score - a.score)[0];
  return { ids: itens.map((a) => a.id), linhas, vencedorId: vencedor.id, resumo: `Melhor custo-benefício: ${vencedor.id.slice(-4)} (${vencedor.veredito}, ${vencedor.score}/100)` };
}

module.exports = { comparar };
