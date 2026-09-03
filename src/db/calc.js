// Helpers puros compartilhados (usados pelo Postgres e pelo JSON)
function mediasPorBairro(analises) {
  const map = {};
  for (const a of analises) {
    const pm2 = a.extracao?.preco_m2;
    if (!pm2) continue;
    const b = (a.bairro || 'df').toLowerCase();
    map[b] = map[b] || { bairro: b, total: 0, qtd: 0, min: pm2, max: pm2 };
    map[b].total += pm2;
    map[b].qtd += 1;
    map[b].min = Math.min(map[b].min, pm2);
    map[b].max = Math.max(map[b].max, pm2);
  }
  return Object.values(map).map((m) => ({ bairro: m.bairro, qtd: m.qtd, min: m.min, max: m.max, media: Math.round(m.total / m.qtd) })).sort((x, y) => y.qtd - x.qtd);
}

module.exports = { mediasPorBairro };
