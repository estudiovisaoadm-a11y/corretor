// Fetch compartilhado: baixa página do anúncio e devolve texto limpo p/ análise.
// As validações abaixo são deliberadamente restritivas para evitar SSRF.
const dns = require('dns').promises;
const net = require('net');

const MAX_RESPONSE_BYTES = 1024 * 1024;
const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 10000;
const ALLOWED_CONTENT_TYPES = /^(text\/|application\/(json|ld\+json|xhtml\+xml))/i;

function ipv4Privado(ip) {
  const o = ip.split('.').map(Number);
  return o[0] === 10 || o[0] === 127 || (o[0] === 169 && o[1] === 254) ||
    o[0] === 0 || (o[0] === 172 && o[1] >= 16 && o[1] <= 31) ||
    (o[0] === 192 && o[1] === 168) || (o[0] === 100 && o[1] >= 64 && o[1] <= 127);
}

function ipBloqueado(ip) {
  const normalizado = ip.toLowerCase().replace(/^::ffff:/, '');
  if (net.isIPv4(normalizado)) return ipv4Privado(normalizado);
  if (!net.isIPv6(normalizado)) return true;
  return normalizado === '::1' || normalizado === '::' || normalizado.startsWith('fc') ||
    normalizado.startsWith('fd') || ['fe8', 'fe9', 'fea', 'feb'].some((p) => normalizado.startsWith(p));
}

async function validarUrlAnuncio(input) {
  let url;
  try { url = new URL(input); } catch { throw new Error('URL de anúncio inválida'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('destino não permitido');
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) throw new Error('destino não permitido');
  if (net.isIP(hostname) && ipBloqueado(hostname)) throw new Error('destino não permitido');
  if (!net.isIP(hostname)) {
    let enderecos;
    try { enderecos = (await dns.lookup(hostname, { all: true, verbatim: true })).map((item) => item.address); }
    catch { throw new Error('host indisponível'); }
    if (!enderecos.length || enderecos.some(ipBloqueado)) throw new Error('destino não permitido');
  }
  return url;
}

async function lerRespostaLimitada(res) {
  const contentLength = Number(res.headers?.get?.('content-length') || 0);
  if (contentLength > MAX_RESPONSE_BYTES) throw new Error('resposta muito grande');
  if (!res.body?.getReader) return res.text();
  const reader = res.body.getReader();
  const partes = [];
  let total = 0;
  while (true) {
    const item = await reader.read();
    if (item.done) break;
    total += item.value.byteLength;
    if (total > MAX_RESPONSE_BYTES) throw new Error('resposta muito grande');
    partes.push(Buffer.from(item.value));
  }
  return Buffer.concat(partes).toString('utf8');
}

async function fetchTextoAnuncio(input) {
  try {
    let atual = await validarUrlAnuncio(input);
    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      let res;
      try {
        res = await fetch(atual, { redirect: 'manual', signal: controller.signal, headers: {
          'User-Agent': 'sistema-ia-imoveis/0.3 (+contato corretor)',
          Accept: 'text/html,application/xhtml+xml,application/json'
        } });
      } finally { clearTimeout(timer); }
      if ([301, 302, 303, 307, 308].includes(res.status)) {
        if (redirects === MAX_REDIRECTS) throw new Error('muitos redirecionamentos');
        const location = res.headers?.get?.('location');
        if (!location) throw new Error('redirecionamento inválido');
        atual = await validarUrlAnuncio(new URL(location, atual).toString());
        continue;
      }
      if (!res.ok) return '';
      const contentType = res.headers?.get?.('content-type') || '';
      if (contentType && !ALLOWED_CONTENT_TYPES.test(contentType)) return '';
      const html = await lerRespostaLimitada(res);
      const title = (html.match(/<title>([^<]+)<\/title>/i) || [])[1] || '';
      const jsonlds = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]).join('\n').slice(0, 4000);
      const body = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 6000);
      return title + '\n' + body + '\n' + jsonlds;
    }
  } catch { return ''; }
  return '';
}

module.exports = { fetchTextoAnuncio, validarUrlAnuncio, ipBloqueado };
