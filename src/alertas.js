// Alertas: encontra análises recentes com m² bem abaixo da média de referência
const { mediaDoBairro } = require('./ficha');

function alertasOportunidade(analises, descontoMin = 0.1) {
  return analises
    .filter((a) => a.extracao?.preco_m2)
    .map((a) => {
      const media = mediaDoBairro(a.bairro);
      const diff = (a.extracao.preco_m2 - media) / media;
      return { ...a, desconto: Math.round(-diff * 100), mediaRef: media };
    })
    .filter((a) => a.desconto >= descontoMin * 100 && a.score >= 60)
    .sort((x, y) => y.desconto - x.desconto);
}

module.exports = { alertasOportunidade };
