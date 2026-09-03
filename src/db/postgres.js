// Backend Postgres (pg). Mesma interface do store JSON + watchlist + snapshots.
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function rowToRec(r) {
  return { id: r.id, createdAt: r.created_at, updatedAt: r.updated_at, status: r.status, ...(r.dados || {}), fonte: r.fonte, url: r.url, bairro: r.bairro, score: r.score, veredito: r.veredito, origem: r.origem, whatsapp: r.whatsapp };
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

async function addAnalise(a) {
  const rec = { id: uid(), createdAt: new Date().toISOString(), status: 'analisado', ...a };
  await pool.query(
    `INSERT INTO analises (id, created_at, status, fonte, url, bairro, score, veredito, origem, whatsapp, dados)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [rec.id, rec.createdAt, rec.status, rec.fonte || null, rec.url || null, rec.bairro || null, rec.score ?? null, rec.veredito || null, rec.origem || null, rec.whatsapp || null, rec]
  );
  return rec;
}
async function listAnalises(f = {}) {
  const conds = [];
  const vals = [];
  if (f.fonte) { vals.push(f.fonte); conds.push(`fonte = $${vals.length}`); }
  if (f.status) { vals.push(f.status); conds.push(`status = $${vals.length}`); }
  if (f.minScore != null) { vals.push(f.minScore); conds.push(`score >= $${vals.length}`); }
  if (f.financiavel) conds.push(`dados->'extracao'->>'aceita_financiamento' = 'true'`);
  if (f.comEscritura) conds.push(`dados->'extracao'->>'tem_escritura' = 'true'`);
  if (f.q) { vals.push(`%${f.q.toLowerCase()}%`); conds.push(`LOWER(dados::text) LIKE $${vals.length}`); }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  const { rows } = await pool.query(`SELECT * FROM analises ${where} ORDER BY created_at DESC LIMIT 500`, vals);
  return rows.map(rowToRec);
}
async function getAnalise(id) {
  const { rows } = await pool.query('SELECT * FROM analises WHERE id = $1', [id]);
  return rows.length ? rowToRec(rows[0]) : null;
}
async function setStatus(id, status) {
  const { rows } = await pool.query(`UPDATE analises SET status=$2, updated_at=now() WHERE id=$1 RETURNING *`, [id, status]);
  return rows.length ? rowToRec(rows[0]) : null;
}
async function mediasPorBairro() {
  const { mediasPorBairro: calc } = require('./calc');
  return calc(await listAnalises({}));
}
async function funil() {
  const { rows } = await pool.query(`SELECT status, COUNT(*)::int AS n FROM analises GROUP BY status`);
  const out = {};
  for (const r of rows) out[r.status || 'analisado'] = r.n;
  return out;
}
// Watchlist
async function watchAdd(url, rotulo) {
  const id = uid();
  await pool.query('INSERT INTO watchlist (id, url, rotulo) VALUES ($1,$2,$3)', [id, url, rotulo || null]);
  return { id, url, rotulo };
}
async function watchList() {
  const { rows } = await pool.query('SELECT * FROM watchlist ORDER BY created_at DESC');
  return rows.map((r) => ({ id: r.id, url: r.url, rotulo: r.rotulo, createdAt: r.created_at }));
}
async function watchRemove(id) {
  await pool.query('DELETE FROM watchlist WHERE id=$1', [id]);
  return { ok: true };
}
// Snapshots
async function addSnapshot(medias) {
  await pool.query('INSERT INTO snapshots (medias) VALUES ($1)', [JSON.stringify(medias)]);
  return { ok: true };
}
async function listSnapshots(limit = 10) {
  const { rows } = await pool.query('SELECT * FROM snapshots ORDER BY created_at DESC LIMIT $1', [limit]);
  return rows.map((r) => ({ id: r.id, createdAt: r.created_at, medias: r.medias }));
}

module.exports = { backend: 'postgres', addAnalise, listAnalises, getAnalise, setStatus, mediasPorBairro, funil, watchAdd, watchList, watchRemove, addSnapshot, listSnapshots };
