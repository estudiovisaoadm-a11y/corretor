const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const tmp = path.join(__dirname, `.auth-test-${process.pid}.json`);
process.env.DB_PATH = tmp;
process.env.AUTH_TOKEN_SECRET = 'segredo-auth-teste-longo';
try { fs.unlinkSync(tmp); } catch {}
const store = require('./src/db');
const { hashPassword, verifyPassword, tokenFor, userFromToken, login } = require('./src/auth');

test.after(() => { try { fs.unlinkSync(tmp); } catch {} });

test('senha usa hash scrypt e não aceita senha incorreta', () => {
  const encoded = hashPassword('Senha-segura-123');
  assert.match(encoded, /^scrypt\$/);
  assert.equal(verifyPassword('Senha-segura-123', encoded), true);
  assert.equal(verifyPassword('errada', encoded), false);
});

test('login retorna token assinado com claims e rejeita credenciais inválidas', async () => {
  const user = await store.userCreate({ email: 'ana@example.com', nome: 'Ana', role: 'corretor', passwordHash: hashPassword('Senha-segura-123') });
  const ok = await login('ANA@EXAMPLE.COM', 'Senha-segura-123');
  assert.equal(ok.user.id, user.id);
  assert.equal(userFromToken(ok.token).role, 'corretor');
  assert.equal(await login('ana@example.com', 'incorreta'), null);
});

test('token adulterado ou expirado é rejeitado', () => {
  const token = tokenFor({ id: 'u1', email: 'a@b.com', role: 'admin' });
  assert.equal(userFromToken(token).sub, 'u1');
  assert.equal(userFromToken(token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a')), null);
});
