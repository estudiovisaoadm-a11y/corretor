// Storage MVP — JSON file (db.json). V2 migra para Postgres sem mudar a interface.
const fs = require('fs');
const path = require('path');
const { mediasPorBairro: calcMedias } = require('./db/calc');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'db.json');

function load() {
  try {
    const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    db.analises = db.analises || [];
    db.watchlist = db.watchlist || [];
    db.snapshots = db.snapshots || [];
    db.usuarios = db.usuarios || [];
    db.jobs = db.jobs || [];
    return db;
  } catch {
    return { analises: [], watchlist: [], snapshots: [], equipe: [], usuarios: [], meta: {} };
  }
}
function save(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function addAnalise(a) {
  const db = load();
  const agoraIso = new Date().toISOString();
  const rec = {
    id: uid(),
    createdAt: a?.createdAt || a?.criadoEm || agoraIso,
    criadoEm: a?.criadoEm || a?.createdAt || agoraIso,
    status: 'analisado',
    ...a
  };
  db.analises.unshift(rec);
  save(db);
  return rec;
}
function listAnalises(f = {}) {
  let arr = load().analises;
  if (f.fonte) arr = arr.filter((a) => a.fonte === f.fonte);
  if (f.minScore != null) arr = arr.filter((a) => a.score >= f.minScore);
  if (f.financiavel) arr = arr.filter((a) => a.extracao?.aceita_financiamento === true);
  if (f.comEscritura) arr = arr.filter((a) => a.extracao?.tem_escritura === true);
  if (f.status) arr = arr.filter((a) => a.status === f.status);
  if (f.q) {
    const q = f.q.toLowerCase();
    arr = arr.filter((a) => JSON.stringify(a).toLowerCase().includes(q));
  }
  // Compatibilidade: sem paginação explícita o contrato histórico continua sendo um array.
  if (f.page == null && f.perPage == null && f.limit == null && f.offset == null) return arr;
  const page = Number.isInteger(f.page) && f.page > 0 ? f.page : 1;
  const perPage = Number.isInteger(f.perPage) && f.perPage > 0 ? Math.min(f.perPage, 100) : 25;
  const offset = Number.isInteger(f.offset) && f.offset >= 0 ? f.offset : (page - 1) * perPage;
  const limit = Number.isInteger(f.limit) && f.limit > 0 ? Math.min(f.limit, 100) : perPage;
  const total = arr.length;
  const items = arr.slice(offset, offset + limit);
  return { items, total, page: Math.floor(offset / limit) + 1, perPage: limit, totalPages: Math.ceil(total / limit) };
}
function getAnalise(id) {
  return load().analises.find((a) => a.id === id) || null;
}
function setStatus(id, status) {
  const db = load();
  const rec = db.analises.find((a) => a.id === id);
  if (!rec) return null;
  rec.status = status;
  rec.updatedAt = new Date().toISOString();
  save(db);
  return rec;
}
function mediasPorBairro() {
  return calcMedias(load().analises);
}
function funil() {
  const counts = {};
  for (const a of load().analises) counts[a.status || 'analisado'] = (counts[a.status || 'analisado'] || 0) + 1;
  return counts;
}
function watchAdd(url, rotulo) {
  const db = load();
  const rec = { id: uid(), url, rotulo: rotulo || null, createdAt: new Date().toISOString() };
  db.watchlist.unshift(rec);
  save(db);
  return rec;
}
function watchList() {
  return load().watchlist;
}
function watchRemove(id) {
  const db = load();
  db.watchlist = db.watchlist.filter((w) => w.id !== id);
  save(db);
  return { ok: true };
}
function addSnapshot(medias) {
  const db = load();
  db.snapshots.unshift({ id: uid(), createdAt: new Date().toISOString(), medias });
  db.snapshots = db.snapshots.slice(0, 30);
  save(db);
  return { ok: true };
}
function listSnapshots(limit = 10) {
  return load().snapshots.slice(0, limit);
}

function updateAnalise(id, patch) {
  const db = load();
  const rec = db.analises.find((a) => a.id === id);
  if (!rec) return null;
  Object.assign(rec, patch);
  rec.updatedAt = new Date().toISOString();
  save(db);
  return rec;
}
// Equipe (E1 — distribuição) + meta KV (estado round-robin)
function equipeAdd(nome, whatsapp) {
  const db = load();
  db.equipe = db.equipe || [];
  const rec = { id: uid(), nome, whatsapp: String(whatsapp || '').replace(/\D/g, ''), ativo: true, createdAt: new Date().toISOString() };
  db.equipe.push(rec);
  save(db);
  return rec;
}
function equipeList() {
  return load().equipe || [];
}
function equipeToggle(id) {
  const db = load();
  const rec = (db.equipe || []).find((e) => e.id === id);
  if (!rec) return null;
  rec.ativo = !rec.ativo;
  save(db);
  return rec;
}
function equipeRemove(id) {
  const db = load();
  db.equipe = (db.equipe || []).filter((e) => e.id !== id);
  save(db);
  return { ok: true };
}
function metaGet(chave) {
  return (load().meta || {})[chave] ?? null;
}
function metaSet(chave, valor) {
  const db = load();
  db.meta = db.meta || {};
  db.meta[chave] = valor;
  save(db);
  return { ok: true };
}

function userCreate(user) {
  const db = load();
  db.usuarios = db.usuarios || [];
  if (db.usuarios.some((u) => u.email.toLowerCase() === user.email.toLowerCase())) {
    const e = new Error('email já cadastrado'); e.code = 'USER_EXISTS'; throw e;
  }
  const rec = { id: uid(), email: user.email.toLowerCase(), nome: user.nome || user.email, role: user.role || 'corretor', passwordHash: user.passwordHash, createdAt: new Date().toISOString(), ativo: true };
  db.usuarios.push(rec); save(db); return rec;
}
function userFindByEmail(email) { return (load().usuarios || []).find((u) => u.email === String(email).toLowerCase()) || null; }
function userCount() { return (load().usuarios || []).length; }

function jobEnqueue(job) {
  const db = load(); db.jobs = db.jobs || [];
  const rec = { ...job, state: 'queued', attempts: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  db.jobs.push(rec); save(db); return rec;
}
function jobRecover(cutoff) {
  const db = load(); let n = 0;
  for (const j of (db.jobs || [])) if (j.state === 'running' && j.lockedAt < cutoff) { j.state = 'queued'; j.updatedAt = new Date().toISOString(); n++; }
  if (n) save(db); return n;
}
function jobClaim(now, leaseMs) {
  const db = load(); const j = (db.jobs || []).filter(x => x.state === 'queued' && (!x.runAt || x.runAt <= now)).sort((a,b) => a.createdAt.localeCompare(b.createdAt))[0];
  if (!j) return null;
  j.state = 'running'; j.attempts = (j.attempts || 0) + 1; j.lockedAt = now; j.updatedAt = now; save(db); return j;
}
function jobComplete(id, result) { const db = load(); const j = (db.jobs || []).find(x => x.id === id); if (!j) return null; j.state='completed'; j.result=result ?? null; j.lockedAt=null; j.updatedAt=new Date().toISOString(); save(db); return j; }
function jobFail(id, error, terminal) { const db = load(); const j=(db.jobs||[]).find(x=>x.id===id); if(!j) return null; j.state=terminal?'failed':'queued'; j.error=error; j.lockedAt=null; j.updatedAt=new Date().toISOString(); save(db); return j; }
function jobList(f={}) { let a=load().jobs||[]; if(f.state) a=a.filter(j=>j.state===f.state); if(f.type) a=a.filter(j=>j.type===f.type); return a.slice().sort((x,y)=>y.createdAt.localeCompare(x.createdAt)); }
function jobRetry(id) { const db=load(); const j=(db.jobs||[]).find(x=>x.id===id); if(!j) return null; j.state='queued'; j.error=null; j.lockedAt=null; j.updatedAt=new Date().toISOString(); save(db); return j; }

// Entidades normalizadas V6, mantidas no JSON para desenvolvimento sem Postgres.
function entityCreate(collection, data, defaults = {}) { const db = load(); db[collection] = db[collection] || []; const rec = { id: uid(), createdAt: new Date().toISOString(), ...defaults, ...data }; db[collection].unshift(rec); save(db); return rec; }
function entityFind(collection, id) { return (load()[collection] || []).find((x) => x.id === id) || null; }
function propertyCreate(p={}) { return entityCreate('imoveis', p, { status: 'ativo', dados: {} }); }
function propertyFind(id) { return entityFind('imoveis', id); }
function listingCreate(a={}) { return entityCreate('anuncios', a, { disponivel: true, dados: {} }); }
function listingFind(id) { return entityFind('anuncios', id); }
function contactCreate(c={}) { return entityCreate('contatos', c, { nome: c.nome || 'Contato', status: 'ativo', preferencias: {}, dados: {} }); }
function contactFind(id) { return entityFind('contatos', id); }
function opportunityCreate(o={}) { if (!o.contatoId) throw new Error('contatoId é obrigatório'); return entityCreate('oportunidades', o, { etapa: 'novo', prioridade: 'normal', dados: {} }); }
function opportunityFind(id) { return entityFind('oportunidades', id); }

module.exports = { backend: 'json', addAnalise, listAnalises, getAnalise, setStatus, updateAnalise, mediasPorBairro, funil, watchAdd, watchList, watchRemove, addSnapshot, listSnapshots, equipeAdd, equipeList, equipeToggle, equipeRemove, metaGet, metaSet, userCreate, userFindByEmail, userCount, jobEnqueue, jobRecover, jobClaim, jobComplete, jobFail, jobList, jobRetry, propertyCreate, propertyFind, listingCreate, listingFind, contactCreate, contactFind, opportunityCreate, opportunityFind };
