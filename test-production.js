const test = require('node:test');
const assert = require('node:assert/strict');
const { validateConfig } = require('./src/config');
const { applySecurityHeaders } = require('./src/security');
const { safeError } = require('./src/logger');

test('produção rejeita configuração incompleta e insegura', () => {
  const result = validateConfig({ NODE_ENV: 'production', ADMIN_API_KEY: 'curta', AUTH_TOKEN_SECRET: 'curto', CORS_ORIGINS: '*', DATABASE_URL: 'sqlite://local' });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('DATABASE_URL')));
  assert.ok(result.errors.some((e) => e.includes('HTTPS')));
});

test('desenvolvimento mantém configuração local sem credenciais', () => {
  assert.equal(validateConfig({ NODE_ENV: 'development' }).valid, true);
});

test('headers de segurança e CORS são aplicados', () => {
  const headers = {};
  const res = { setHeader: (key, value) => { headers[key] = value; } };
  const old = process.env.CORS_ORIGINS;
  process.env.CORS_ORIGINS = 'https://app.example.com';
  applySecurityHeaders(res, 'https://app.example.com');
  process.env.CORS_ORIGINS = old;
  assert.equal(headers['Access-Control-Allow-Origin'], 'https://app.example.com');
  assert.equal(headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(headers['Cross-Origin-Opener-Policy'], 'same-origin');
});

test('erro seguro não expõe stack ou credenciais', () => {
  const result = safeError(Object.assign(new Error('senha=segredo'), { stack: 'private stack' }));
  assert.equal(result.name, 'Error');
  assert.equal(result.stack, undefined);
  assert.match(result.message, /senha/);
});
