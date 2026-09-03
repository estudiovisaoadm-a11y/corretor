// Feed XML padrão de portais (estilo OpenNavent/VRSync) — zero dependências.
const contentType = 'application/xml';

function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function normTransacao(t) {
  const s = String(t || 'venda').toLowerCase().trim();
  if (s === 'imoveis' || s === 'imóveis' || s === 'vendas') return 'venda';
  if (s === 'aluguel' || s === 'alugueis' || s === 'locacao' || s === 'locação') return 'aluguel';
  return s || 'venda';
}

function gerarFeedXml(analises) {
  const arr = Array.isArray(analises) ? analises : [];
  const itens = arr.map((a) => {
    const ex = a.extracao || {};
    const parsed = a.parsed || {};
    const codigo = a.id ?? a.codigo ?? '';
    const tipo = a.tipo ?? ex.tipo ?? parsed.tipo ?? 'apartamento';
    const transacao = normTransacao(a.transacao ?? parsed.transacao ?? 'venda');
    const preco = a.preco ?? ex.preco ?? '';
    const area = a.area_m2 ?? ex.area_m2 ?? '';
    const quartos = a.quartos ?? ex.quartos ?? (parsed.filtros ? parsed.filtros.bedroom : null);
    const bairro = a.bairro ?? parsed.bairro ?? '';
    const cidade = a.cidade ?? parsed.cidade ?? 'Brasilia';
    const descricao = a.descricao ?? a.ficha ?? '';
    const url = a.url ?? '';
    let fotos = a.fotos ?? ex.fotos ?? parsed.fotos ?? [];
    if (typeof fotos === 'string') fotos = [fotos];
    if (!Array.isArray(fotos)) fotos = [];
    let xml = '  <imovel>\n';
    xml += `    <codigo>${esc(codigo)}</codigo>\n`;
    xml += `    <tipo>${esc(tipo)}</tipo>\n`;
    xml += `    <transacao>${esc(transacao)}</transacao>\n`;
    xml += `    <preco>${esc(preco)}</preco>\n`;
    xml += `    <area_m2>${esc(area)}</area_m2>\n`;
    if (quartos !== null && quartos !== undefined && quartos !== '') {
      xml += `    <quartos>${esc(quartos)}</quartos>\n`;
    }
    xml += `    <bairro>${esc(bairro)}</bairro>\n`;
    xml += `    <cidade>${esc(cidade)}</cidade>\n`;
    xml += `    <descricao>${esc(descricao)}</descricao>\n`;
    xml += `    <url>${esc(url)}</url>\n`;
    if (fotos.length) {
      xml += '    <fotos>\n';
      for (const f of fotos) xml += `      <foto>${esc(f)}</foto>\n`;
      xml += '    </fotos>\n';
    }
    xml += '  </imovel>';
    return xml;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<imoveis>\n${itens.join('\n')}\n</imoveis>`;
}

module.exports = { gerarFeedXml, contentType };
