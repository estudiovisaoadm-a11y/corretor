// Simula webhook da Evolution API sem precisar de WhatsApp real
// Uso: node test-webhook.js
const { handleIncoming } = require('./src/bot/handler');

async function main() {
  const casos = [
    { name: 'ajuda', body: { event: 'MESSAGES_UPSERT', data: { key: { remoteJid: '5561999999999@c.us', fromMe: false }, message: { conversation: 'ajuda' } } } },
    { name: 'link dfimoveis', body: { event: 'MESSAGES_UPSERT', data: { key: { remoteJid: '5561999999999@c.us', fromMe: false }, message: { conversation: 'https://www.dfimoveis.com.br/venda/df/aguas-claras/sul/apartamento Ap 70m2 R$ 550 mil, aceita financiamento, escritura e habite-se ok' } } } },
    { name: 'texto puro', body: { event: 'MESSAGES_UPSERT', data: { key: { remoteJid: '5561999999999@c.us', fromMe: false }, message: { conversation: 'Casa 120m2 R$ 700 mil, aceita permuta com torna, aceita financiamento' } } } },
    { name: 'ignora propria', body: { event: 'MESSAGES_UPSERT', data: { key: { remoteJid: '5561999999999@c.us', fromMe: true }, message: { conversation: 'oi' } } } }
  ];
  for (const c of casos) {
    const out = await handleIncoming(c.body, null);
    console.log('\n=== ' + c.name + ' ===');
    console.log(JSON.stringify(out.replies || out, null, 2).slice(0, 1200));
  }
}
main();
