// Roteador de banco: Postgres quando DATABASE_URL existe, senão JSON local.
// Interface única e assíncrona — o server usa sempre com await.
let impl = require('../store');
if (process.env.DATABASE_URL) {
  try {
    impl = require('./postgres');
    console.log('Banco: postgres');
  } catch (e) {
    console.error('Falha ao carregar pg, usando JSON:', e.message);
    impl = require('../store');
  }
} else {
  console.log('Banco: json local (defina DATABASE_URL p/ Postgres)');
}

const wrap = (fn) => (...args) => Promise.resolve(impl[fn](...args));

module.exports = {
  backend: impl.backend,
  addAnalise: wrap('addAnalise'),
  listAnalises: wrap('listAnalises'),
  getAnalise: wrap('getAnalise'),
  setStatus: wrap('setStatus'),
  mediasPorBairro: wrap('mediasPorBairro'),
  funil: wrap('funil'),
  watchAdd: wrap('watchAdd'),
  watchList: wrap('watchList'),
  watchRemove: wrap('watchRemove'),
  addSnapshot: wrap('addSnapshot'),
  listSnapshots: wrap('listSnapshots'),
  updateAnalise: wrap('updateAnalise'),
  equipeAdd: wrap('equipeAdd'),
  equipeList: wrap('equipeList'),
  equipeToggle: wrap('equipeToggle'),
  equipeRemove: wrap('equipeRemove'),
  metaGet: wrap('metaGet'),
  metaSet: wrap('metaSet')
};
