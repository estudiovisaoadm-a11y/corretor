// Config do bot — lê de process.env com defaults seguros para dev local
module.exports = {
  evolutionUrl: process.env.EVOLUTION_URL || 'http://localhost:8080',
  evolutionKey: process.env.EVOLUTION_API_KEY || '',
  instance: process.env.EVOLUTION_INSTANCE || 'corretor-bot',
  // Se vazio, o webhook apenas loga a resposta (modo dry-run, sem enviar)
  dryRun: !process.env.EVOLUTION_API_KEY
};
