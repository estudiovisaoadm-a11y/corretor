const crypto = require('crypto');
const store = require('./db');

const TOKEN_TTL_SEC = 8 * 60 * 60;
function secret() { return String(process.env.AUTH_TOKEN_SECRET || process.env.ADMIN_API_KEY || '').trim(); }
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, 32).toString('hex');
  return `scrypt$${salt}$${hash}`;
}
function verifyPassword(password, encoded) {
  const [scheme, salt, expected] = String(encoded || '').split('$');
  if (scheme !== 'scrypt' || !salt || !expected) return false;
  try { return crypto.timingSafeEqual(crypto.scryptSync(String(password), salt, 32), Buffer.from(expected, 'hex')); } catch { return false; }
}
function tokenFor(user) {
  const key = secret(); if (!key) throw new Error('AUTH_TOKEN_SECRET não configurado');
  const payload = Buffer.from(JSON.stringify({ sub: user.id, email: user.email, role: user.role, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SEC })).toString('base64url');
  const sig = crypto.createHmac('sha256', key).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}
function userFromToken(token) {
  const [payload, sig] = String(token || '').split('.');
  if (!payload || !sig || !secret()) return null;
  const expected = crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try { const value = JSON.parse(Buffer.from(payload, 'base64url').toString()); return value.exp > Math.floor(Date.now() / 1000) ? value : null; } catch { return null; }
}
async function login(email, password) {
  const user = await store.userFindByEmail(String(email || '').trim().toLowerCase());
  if (!user || !user.ativo || !verifyPassword(password, user.passwordHash)) return null;
  return { token: tokenFor(user), user: { id: user.id, email: user.email, nome: user.nome, role: user.role } };
}
async function authenticate(req) {
  const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const claims = userFromToken(bearer);
  if (claims) return claims;
  return null;
}
module.exports = { hashPassword, verifyPassword, tokenFor, userFromToken, login, authenticate };
