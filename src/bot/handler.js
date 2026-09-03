// Handler do webhook Evolution API (evento MESSAGES_UPSERT)
// Extrai texto + remetente, ignora mensagens próprias/grupos, gera resposta(s)
const { analisar } = require('../ficha');
const { fichaWhats, AJUDA } = require('./whatsappFormat');

function extractPayload(body) {
  // Formatos variam por versão; cobre os 2 mais comuns
  const data = body?.data || body || {};
  const msg = data.message || data;
  const key = data.key || msg.key || {};
  const text =
    msg.conversation ||
    msg.extendedTextMessage?.text ||
    msg.imageMessage?.caption ||
    data.body ||
    body?.body ||
    '';
  const remoteJid = key.remoteJid || data.remoteJid || data.from || '';
  const fromMe = key.fromMe === true || data.fromMe === true;
  const number = String(remoteJid).replace(/@.*/, '').replace(/\D/g, '');
  const isGroup = String(remoteJid).includes('@g.us');
  return { text: String(text).trim(), number, fromMe, isGroup };
}

function temUrl(texto) {
  const m = String(texto).match(/https?:\/\/[^\s]+/);
  return m ? m[0].replace(/[),.]+$/, '') : null;
}

async function handleIncoming(body, fetchTexto) {
  const { text, number, fromMe, isGroup } = extractPayload(body);
  if (!text || !number || fromMe || isGroup) return { ignored: true };

  if (/^(ajuda|help|oi|olá|ola|menu|começar|comecar)$/i.test(text.trim())) {
    return { number, replies: [AJUDA] };
  }

  const url = temUrl(text);
  let texto = text;
  // Se veio só o link, busca o conteúdo da página para enriquecer a análise
  if (url && text.replace(url, '').trim().length < 20 && fetchTexto) {
    try {
      const extra = await fetchTexto(url);
      if (extra) texto = `${text}\n${extra}`.slice(0, 8000);
    } catch { /* segue com o link mesmo */ }
  }

  const resultado = analisar({ url, texto });
  const replies = fichaWhats(resultado);
  return { number, replies, analise: resultado };
}

module.exports = { handleIncoming, extractPayload };
