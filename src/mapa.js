// Mapa de calor: centroides aproximados dos bairros do DF + dados de m²
const CENTROS = {
  'asa sul': [-15.8267, -47.9218],
  'asa norte': [-15.767, -47.882],
  'aguas claras': [-15.834, -47.962],
  'sul': [-15.834, -47.962],
  'norte': [-15.7538, -47.954],
  'sudoeste': [-15.799, -47.925],
  'noroeste': [-15.74, -47.88],
  'lago sul': [-15.85, -47.87],
  'lago norte': [-15.73, -47.87],
  'taguatinga': [-15.853, -48.06],
  'guara': [-15.81, -47.98],
  'vicente pires': [-15.8, -48.03],
  'jardim botanico': [-15.87, -47.79],
  'df': [-15.78, -47.93]
};

function mapaData(medias) {
  return medias.map((m) => {
    const c = CENTROS[m.bairro] || CENTROS.df;
    return { ...m, lat: c[0], lng: c[1] };
  });
}

module.exports = { mapaData, CENTROS };
