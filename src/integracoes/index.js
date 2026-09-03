// Detecta fonte + normaliza URL dos 3 portais
const { parseDfimoveisUrl } = require('./dfimoveis');
const { parseWimoveisUrl } = require('./wimoveis');
const { parseNetimoveisUrl } = require('./netimoveis');

function detectarFonte(urlString) {
  if (!urlString || typeof urlString !== 'string') return null;
  if (urlString.includes('dfimoveis.com.br')) return 'dfimoveis';
  if (urlString.includes('wimoveis.com.br')) return 'wimoveis';
  if (urlString.includes('netimoveis.com')) return 'netimoveis';
  return null;
}

function parseAnuncioUrl(urlString) {
  const fonte = detectarFonte(urlString);
  if (!fonte) return { fonte: null, url: urlString };
  if (fonte === 'dfimoveis') return parseDfimoveisUrl(urlString);
  if (fonte === 'wimoveis') return parseWimoveisUrl(urlString);
  if (fonte === 'netimoveis') return parseNetimoveisUrl(urlString);
  return { fonte: null, url: urlString };
}

module.exports = { detectarFonte, parseAnuncioUrl };
