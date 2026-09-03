const test = require('node:test');
const assert = require('node:assert/strict');
const { validarUrlAnuncio, ipBloqueado } = require('./src/fetchAnuncio');

test('bloqueia endereços IPv4 privados e reservados', () => {
  for (const ip of ['127.0.0.1', '10.0.0.1', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1']) assert.equal(ipBloqueado(ip), true, ip);
  assert.equal(ipBloqueado('8.8.8.8'), false);
});

test('bloqueia loopback e redes locais IPv6', () => {
  for (const ip of ['::1', 'fc00::1', 'fd00::1', 'fe80::1']) assert.equal(ipBloqueado(ip), true, ip);
  assert.equal(ipBloqueado('2001:4860:4860::8888'), false);
});

test('aceita somente http/https sem credenciais', async () => {
  await assert.rejects(validarUrlAnuncio('file:///etc/passwd'));
  await assert.rejects(validarUrlAnuncio('http://user:pass@example.com/anuncio'));
  await assert.rejects(validarUrlAnuncio('http://localhost/anuncio'));
  await assert.rejects(validarUrlAnuncio('http://127.0.0.1/anuncio'));
});

test('aceita URL pública com HTTPS', async () => {
  const url = await validarUrlAnuncio('https://example.com/anuncio');
  assert.equal(url.protocol, 'https:');
  assert.equal(url.hostname, 'example.com');
});
