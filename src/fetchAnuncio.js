// Fetch compartilhado: baixa página do anúncio e devolve texto limpo p/ análise
async function fetchTextoAnuncio(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'sistema-ia-imoveis/0.3 (+contato corretor)' } });
    const html = await res.text();
    const title = (html.match(/<title>([^<]+)<\/title>/i) || [])[1] || '';
    const jsonlds = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]).join('\n').slice(0, 4000);
    const body = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 6000);
    return `${title}\n${body}\n${jsonlds}`.slice(0, 8000);
  } catch { return ''; }
}

module.exports = { fetchTextoAnuncio };
