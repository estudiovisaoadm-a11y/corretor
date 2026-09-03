// Client Evolution API — POST /message/sendText/{instance}
const config = require('./config');

async function sendText(number, text) {
  if (config.dryRun) {
    console.log(`[bot dry-run] -> ${number}: ${text.slice(0, 200)}...`);
    return { dryRun: true };
  }
  const url = `${config.evolutionUrl}/message/sendText/${config.instance}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: config.evolutionKey },
    body: JSON.stringify({ number: String(number).replace(/\D/g, ''), text, delay: 800, linkPreview: false })
  });
  if (!res.ok) throw new Error(`Evolution sendText ${res.status}: ${await res.text()}`);
  return res.json();
}

module.exports = { sendText };
