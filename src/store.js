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
    return db;
  } catch {
    return { analises: [], watchlist: [], snapshots: [], equipe: [], meta: {} };
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
  const rec = { id: uid(), createdAt: new Date().toISOString(), status: 'analisado', ...a };
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
  return arr;
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

module.exports = { backend: 'json', addAnalise, listAnalises, getAnalise, setStatus, updateAnalise, mediasPorBairro, funil, watchAdd, watchList, watchRemove, addSnapshot, listSnapshots, equipeAdd, equipeList, equipeToggle, equipeRemove, metaGet, metaSet };
