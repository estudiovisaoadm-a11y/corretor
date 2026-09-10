// Backend Postgres (pg). Mesma interface do store JSON + watchlist + snapshots.
const { Pool } = require('pg');
const connectionString = String(process.env.DATABASE_URL || '').trim();
// Supabase exige TLS nas conexões PostgreSQL públicas. Mantemos a opção
// automática para não exigir uma segunda variável no ambiente de produção.
const supabaseConnection = /supabase\.(?:co|com)\b/i.test(connectionString);
const sslModeRequired = /(?:[?&]|^)sslmode=require(?:&|$)/i.test(connectionString);
const pool = new Pool({
  connectionString,
  ...(supabaseConnection || sslModeRequired ? { ssl: { rejectUnauthorized: false } } : {})
});
async function healthcheck() { await pool.query('SELECT 1'); return true; }

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
  // The old array response remains the default. Paginated callers receive a bounded
  // page and a count from the same filter, avoiding the former hard 500-row cap.
  if (f.page == null && f.perPage == null && f.limit == null && f.offset == null) {
    const { rows } = await pool.query(`SELECT * FROM analises ${where} ORDER BY created_at DESC`, vals);
    return rows.map(rowToRec);
  }
  const page = Number.isInteger(f.page) && f.page > 0 ? f.page : 1;
  const perPage = Number.isInteger(f.perPage) && f.perPage > 0 ? Math.min(f.perPage, 100) : 25;
  const offset = Number.isInteger(f.offset) && f.offset >= 0 ? f.offset : (page - 1) * perPage;
  const limit = Number.isInteger(f.limit) && f.limit > 0 ? Math.min(f.limit, 100) : perPage;
  const count = await pool.query(`SELECT COUNT(*)::int AS total FROM analises ${where}`, vals);
  const pageVals = vals.concat([limit, offset]);
  const { rows } = await pool.query(`SELECT * FROM analises ${where} ORDER BY created_at DESC LIMIT $${pageVals.length - 1} OFFSET $${pageVals.length}`, pageVals);
  const total = count.rows[0].total;
  return { items: rows.map(rowToRec), total, page: Math.floor(offset / limit) + 1, perPage: limit, totalPages: Math.ceil(total / limit) };
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

// Distribuição (E1): equipe + patch parcial + meta KV
async function updateAnalise(id, patch) {
  const atual = await getAnalise(id);
  if (!atual) return null;
  const novo = { ...atual, ...patch, updatedAt: new Date().toISOString() };
  await pool.query(
    `UPDATE analises SET status=$2, fonte=$3, url=$4, bairro=$5, score=$6, veredito=$7, origem=$8, whatsapp=$9, dados=$10, updated_at=now() WHERE id=$1`,
    [id, novo.status || null, novo.fonte || null, novo.url || null, novo.bairro || null, novo.score ?? null, novo.veredito || null, novo.origem || null, novo.whatsapp || null, novo]
  );
  return novo;
}
async function equipeAdd(nome, whatsapp) {
  const id = uid();
  const clean = String(whatsapp || '').replace(/\D/g, '');
  await pool.query('INSERT INTO equipe (id, nome, whatsapp) VALUES ($1,$2,$3)', [id, nome, clean]);
  return { id, nome, whatsapp: clean, ativo: true };
}
async function equipeList() {
  const { rows } = await pool.query('SELECT * FROM equipe ORDER BY created_at');
  return rows.map((r) => ({ id: r.id, nome: r.nome, whatsapp: r.whatsapp, ativo: r.ativo, createdAt: r.created_at }));
}
async function equipeToggle(id) {
  const { rows } = await pool.query('UPDATE equipe SET ativo = NOT ativo WHERE id=$1 RETURNING *', [id]);
  return rows.length ? { id: rows[0].id, nome: rows[0].nome, whatsapp: rows[0].whatsapp, ativo: rows[0].ativo } : null;
}
async function equipeRemove(id) {
  await pool.query('DELETE FROM equipe WHERE id=$1', [id]);
  return { ok: true };
}
async function metaGet(chave) {
  const { rows } = await pool.query('SELECT valor FROM meta WHERE chave=$1', [chave]);
  return rows.length ? rows[0].valor : null;
}
async function metaSet(chave, valor) {
  await pool.query(`INSERT INTO meta (chave, valor) VALUES ($1,$2) ON CONFLICT (chave) DO UPDATE SET valor=$2`, [chave, valor]);
  return { ok: true };
}
async function userCreate(user) {
  const { rows } = await pool.query(`INSERT INTO usuarios (id,email,nome,role,password_hash) VALUES ($1,$2,$3,$4,$5) RETURNING id,email,nome,role,created_at,ativo`, [uid(), user.email.toLowerCase(), user.nome || user.email, user.role || 'corretor', user.passwordHash]);
  return { id: rows[0].id, email: rows[0].email, nome: rows[0].nome, role: rows[0].role, createdAt: rows[0].created_at, ativo: rows[0].ativo };
}
async function userFindByEmail(email) { const { rows } = await pool.query('SELECT * FROM usuarios WHERE email=$1 AND ativo=true', [String(email).toLowerCase()]); return rows[0] ? { id: rows[0].id, email: rows[0].email, nome: rows[0].nome, role: rows[0].role, passwordHash: rows[0].password_hash, createdAt: rows[0].created_at, ativo: rows[0].ativo } : null; }
async function userCount() { const { rows } = await pool.query('SELECT COUNT(*)::int AS total FROM usuarios'); return rows[0].total; }

async function jobEnqueue(job) {
  const { rows } = await pool.query(`INSERT INTO jobs (id,type,payload,max_attempts,run_at) VALUES ($1,$2,$3,$4,$5) RETURNING *`, [job.id, job.type, JSON.stringify(job.payload || {}), job.maxAttempts || 3, job.runAt || new Date()]);
  return jobRow(rows[0]);
}
function jobRow(r) { return { id:r.id, type:r.type, payload:r.payload || {}, state:r.state, attempts:r.attempts, maxAttempts:r.max_attempts, runAt:r.run_at, lockedAt:r.locked_at, error:r.error, result:r.result, createdAt:r.created_at, updatedAt:r.updated_at }; }
async function jobRecover(cutoff) { const out = await pool.query(`UPDATE jobs SET state='queued', locked_at=NULL, updated_at=now() WHERE state='running' AND locked_at < $1`, [cutoff]); return out.rowCount; }
async function jobClaim(now) {
  const c = await pool.connect();
  try { await c.query('BEGIN'); const q = await c.query(`SELECT * FROM jobs WHERE state='queued' AND (run_at IS NULL OR run_at <= $1) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1`, [now]); if (!q.rows.length) { await c.query('COMMIT'); return null; }
    const u = await c.query(`UPDATE jobs SET state='running', attempts=attempts+1, locked_at=$1, updated_at=now() WHERE id=$2 RETURNING *`, [now, q.rows[0].id]); await c.query('COMMIT'); return jobRow(u.rows[0]);
  } catch(e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
}
async function jobComplete(id, result) { const { rows } = await pool.query(`UPDATE jobs SET state='completed', result=$2, locked_at=NULL, updated_at=now() WHERE id=$1 RETURNING *`, [id, JSON.stringify(result ?? null)]); return rows.length ? jobRow(rows[0]) : null; }
async function jobFail(id, error, terminal) { const { rows } = await pool.query(`UPDATE jobs SET state=$2, error=$3, locked_at=NULL, updated_at=now() WHERE id=$1 RETURNING *`, [id, terminal ? 'failed' : 'queued', error]); return rows.length ? jobRow(rows[0]) : null; }
async function jobList(f={}) { const vals=[]; const cond=[]; if(f.state){vals.push(f.state);cond.push(`state=$${vals.length}`);} if(f.type){vals.push(f.type);cond.push(`type=$${vals.length}`);} const {rows}=await pool.query(`SELECT * FROM jobs ${cond.length?'WHERE '+cond.join(' AND '):''} ORDER BY created_at DESC`,vals); return rows.map(jobRow); }
async function jobRetry(id) { const { rows } = await pool.query(`UPDATE jobs SET state='queued', error=NULL, locked_at=NULL, updated_at=now() WHERE id=$1 RETURNING *`, [id]); return rows.length ? jobRow(rows[0]) : null; }

// Entidades normalizadas V6; analises permanece como contrato legado.
const entityUid = uid;
function propertyRow(r) { return r ? { id:r.id, titulo:r.titulo, tipo:r.tipo, finalidade:r.finalidade, endereco:r.endereco, bairro:r.bairro, cidade:r.cidade, uf:r.uf, preco:r.preco == null ? null : Number(r.preco), area:r.area == null ? null : Number(r.area), quartos:r.quartos, banheiros:r.banheiros, vagas:r.vagas, status:r.status, dados:r.dados, createdAt:r.created_at, updatedAt:r.updated_at } : null; }
async function propertyCreate(p={}) { const id=p.id||entityUid(); const {rows}=await pool.query(`INSERT INTO imoveis (id,titulo,tipo,finalidade,endereco,bairro,cidade,uf,preco,area,quartos,banheiros,vagas,status,dados) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,[id,p.titulo||null,p.tipo||null,p.finalidade||null,p.endereco||null,p.bairro||null,p.cidade||null,p.uf||null,p.preco??null,p.area??null,p.quartos??null,p.banheiros??null,p.vagas??null,p.status||'ativo',p.dados||{}]); return propertyRow(rows[0]); }
async function propertyFind(id) { const {rows}=await pool.query('SELECT * FROM imoveis WHERE id=$1',[id]); return propertyRow(rows[0]); }
function listingRow(r) { return r ? { id:r.id, imovelId:r.imovel_id, fonte:r.fonte, url:r.url, identificadorExterno:r.identificador_externo, disponivel:r.disponivel, preco:r.preco==null?null:Number(r.preco), publicadoEm:r.publicado_em, ultimoColetadoEm:r.ultimo_coletado_em, dados:r.dados, createdAt:r.created_at, updatedAt:r.updated_at } : null; }
async function listingCreate(a={}) { const id=a.id||entityUid(); const {rows}=await pool.query(`INSERT INTO anuncios (id,imovel_id,fonte,url,identificador_externo,disponivel,preco,dados) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,[id,a.imovelId,a.fonte||null,a.url||null,a.identificadorExterno||null,a.disponivel!==false,a.preco??null,a.dados||{}]); return listingRow(rows[0]); }
async function listingFind(id) { const {rows}=await pool.query('SELECT * FROM anuncios WHERE id=$1',[id]); return listingRow(rows[0]); }
function contactRow(r) { return r ? { id:r.id,nome:r.nome,email:r.email,telefone:r.telefone,whatsapp:r.whatsapp,preferencias:r.preferencias,status:r.status,dados:r.dados,createdAt:r.created_at,updatedAt:r.updated_at } : null; }
async function contactCreate(c={}) { const id=c.id||entityUid(); const {rows}=await pool.query(`INSERT INTO contatos (id,nome,email,telefone,whatsapp,preferencias,status,dados) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,[id,c.nome||'Contato',c.email||null,c.telefone||null,c.whatsapp||null,c.preferencias||{},c.status||'ativo',c.dados||{}]); return contactRow(rows[0]); }
async function contactFind(id) { const {rows}=await pool.query('SELECT * FROM contatos WHERE id=$1',[id]); return contactRow(rows[0]); }
function opportunityRow(r) { return r ? { id:r.id,contatoId:r.contato_id,imovelId:r.imovel_id,responsavelId:r.responsavel_id,etapa:r.etapa,prioridade:r.prioridade,origem:r.origem,proximaAcaoEm:r.proxima_acao_em,dados:r.dados,createdAt:r.created_at,updatedAt:r.updated_at } : null; }
async function opportunityCreate(o={}) { const id=o.id||entityUid(); const {rows}=await pool.query(`INSERT INTO oportunidades (id,contato_id,imovel_id,responsavel_id,etapa,prioridade,origem,proxima_acao_em,dados) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[id,o.contatoId,o.imovelId||null,o.responsavelId||null,o.etapa||'novo',o.prioridade||'normal',o.origem||null,o.proximaAcaoEm||null,o.dados||{}]); return opportunityRow(rows[0]); }
async function opportunityFind(id) { const {rows}=await pool.query('SELECT * FROM oportunidades WHERE id=$1',[id]); return opportunityRow(rows[0]); }

module.exports = { backend: 'postgres', healthcheck, addAnalise, listAnalises, getAnalise, setStatus, updateAnalise, mediasPorBairro, funil, watchAdd, watchList, watchRemove, addSnapshot, listSnapshots, equipeAdd, equipeList, equipeToggle, equipeRemove, metaGet, metaSet, userCreate, userFindByEmail, userCount, jobEnqueue, jobRecover, jobClaim, jobComplete, jobFail, jobList, jobRetry, propertyCreate, propertyFind, listingCreate, listingFind, contactCreate, contactFind, opportunityCreate, opportunityFind };
