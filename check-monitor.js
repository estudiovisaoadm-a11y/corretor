// Roda o monitor via linha de comando (cron / Agendador de Tarefas do Windows).
// Uso: node check-monitor.js
const store = require('./src/db');
const { fetchTextoAnuncio } = require('./src/fetchAnuncio');
const { runMonitor } = require('./src/monitor');

(async () => {
  const r = await runMonitor(store, fetchTextoAnuncio);
  console.log(JSON.stringify(r, null, 2));
})();
