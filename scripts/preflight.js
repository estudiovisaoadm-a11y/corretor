const required = ['DATABASE_URL', 'AUTH_TOKEN_SECRET', 'ADMIN_API_KEY'];
const missing = required.filter((key) => !String(process.env[key] || '').trim());
if (process.env.NODE_ENV === 'production' && missing.length) {
  console.error(`Variáveis obrigatórias ausentes: ${missing.join(', ')}`);
  process.exit(1);
}
if (process.env.NODE_ENV === 'production') {
  for (const key of ['AUTH_TOKEN_SECRET', 'ADMIN_API_KEY']) {
    if (String(process.env[key]).length < 32) {
      console.error(`${key} deve ter pelo menos 32 caracteres em produção.`);
      process.exit(1);
    }
  }
}
console.log('Preflight de produção aprovado.');
