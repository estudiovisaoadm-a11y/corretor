const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { isAuthorized, verifyWebhook, readJson } = require('./src/security');

test('exige API key configurada', () => {
  const oldKey = process.env.ADMIN_API_KEY;
  const oldEnv = process.env.NODE_ENV;
  process.env.ADMIN_API_KEY = 'segredo-de-teste';
  process.env.NODE_ENV = 'production';
  const req = { headers: { 'x-api-key': 'segredo-de-teste' } };
  assert.equal(isAuthorized(req), true);
  assert.equal(isAuthorized({ headers: { 'x-api-key': 'errada' } }), false);
  process.env.ADMIN_API_KEY = oldKey;
  process.env.NODE_ENV = oldEnv;
});

test('valida assinatura HMAC e janela de replay', () => {
  const oldSecret = process.env.WEBHOOK_SECRET;
  const oldEnv = process.env.NODE_ENV;
  process.env.WEBHOOK_SECRET = 'webhook-teste';
  process.env.NODE_ENV = 'production';
  const raw = JSON.stringify({ event: 'CONTACTO' });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = crypto.createHmac('sha256', process.env.WEBHOOK_SECRET).update(timestamp + '.' + raw).digest('hex');
  const req = { headers: { 'x-webhook-timestamp': timestamp, 'x-webhook-signature': signature } };
  assert.equal(verifyWebhook(req, raw), true);
  assert.equal(verifyWebhook(req, raw + 'x'), false);
  process.env.WEBHOOK_SECRET = oldSecret;
  process.env.NODE_ENV = oldEnv;
});

test('rejeita body acima do limite', async () => {
  const req = {
    async *[Symbol.asyncIterator]() { yield Buffer.alloc(1024 * 1024 + 1); }
  };
  await assert.rejects(readJson(req), (error) => error.statusCode === 413);
});
