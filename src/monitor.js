// Monitor diário: percorre a watchlist (buscas salvas dos 3 portais),
// analisa o conteúdo atual, salva novidades (dedupe 24h por URL) e registra snapshot das médias.
const { analisar } = require('./ficha');
const { alertasOportunidade } = require('./alertas');

const SEED_WATCHLIST = [
  { url: 'https://www.dfimoveis.com.br/venda/df/aguas-claras/sul/apartamento', rotulo: 'DFImóveis — Águas Claras Sul ap' },
  { url: 'https://www.wimoveis.com.br/imoveis?sort=most_lowered_price', rotulo: 'WImóveis — maiores quedas' },
  { url: 'https://www.netimoveis.com/venda/distrito-federal?localizacao=BR-DF', rotulo: 'NetImóveis — DF venda' }
];

async function ensureSeed(store) {
  const atual = await store.watchList();
  if (atual.length === 0) {
    for (const s of SEED_WATCHLIST) await store.watchAdd(s.url, s.rotulo);
  }
  return store.watchList();
}

async function runMonitor(store, fetchTexto) {
  const watch = await ensureSeed(store);
  const recentes = await store.listAnalises({});
  const umDiaAtras = Date.now() - 24 * 3600 * 1000;
  const novas = [];
  for (const w of watch) {
    const texto = await fetchTexto(w.url);
    if (!texto || texto.length < 200) continue; // página bloqueou/vazia — pula sem quebrar
    const jaExiste = recentes.some((a) => a.url === w.url && new Date(a.createdAt).getTime() > umDiaAtras);
    if (jaExiste) continue;
    const r = analisar({ url: w.url, texto });
    novas.push(await store.addAnalise({ ...r, origem: 'monitor', watchRotulo: w.rotulo }));
  }
  const medias = await store.mediasPorBairro();
  await store.addSnapshot(medias);
  const alertas = alertasOportunidade(await store.listAnalises({}));
  return { verificadas: watch.length, novas: novas.length, ids: novas.map((n) => n.id), alertas: alertas.length, snapshot: medias.length };
}

module.exports = { runMonitor, ensureSeed };
