const crypto = require('crypto');
function isProduction(env = process.env) { return String(env.NODE_ENV || 'development').toLowerCase() === 'production'; }
function validateConfig(env = process.env) {
  const production = isProduction(env); const errors = [];
  const required = production ? ['DATABASE_URL', 'ADMIN_API_KEY', 'AUTH_TOKEN_SECRET'] : [];
  for (const key of required) if (!String(env[key] || '').trim()) errors.push(`${key} é obrigatório em produção`);
  if (production && String(env.AUTH_TOKEN_SECRET || '').length < 32) errors.push('AUTH_TOKEN_SECRET deve ter pelo menos 32 caracteres');
  if (production && String(env.ADMIN_API_KEY || '').length < 16) errors.push('ADMIN_API_KEY deve ter pelo menos 16 caracteres');
  const origins = String(env.CORS_ORIGINS || env.RENDER_EXTERNAL_URL || '').split(',').map((x) => x.trim()).filter(Boolean);
  if (production && !origins.length) errors.push('CORS_ORIGINS ou RENDER_EXTERNAL_URL é obrigatório em produção');
  if (production && origins.some((origin) => origin === '*' || !/^https:\/\//i.test(origin))) errors.push('CORS_ORIGINS em produção deve conter somente URLs HTTPS explícitas');
  if (env.DATABASE_URL && !/^postgres(?:ql)?:\/\//i.test(String(env.DATABASE_URL))) errors.push('DATABASE_URL deve ser uma URL PostgreSQL válida');
  return { valid: errors.length === 0, errors, production, origins };
}
function assertConfig(env = process.env) { const result = validateConfig(env); if (!result.valid) throw new Error(`Configuração inválida: ${result.errors.join('; ')}`); return result; }
function publicConfig(env = process.env) { return { nodeEnv: env.NODE_ENV || 'development', backend: env.DATABASE_URL ? 'postgres' : 'json', version: env.APP_VERSION || '0.1.0' }; }
module.exports = { isProduction, validateConfig, assertConfig, publicConfig, randomSecret: () => crypto.randomBytes(32).toString('hex') };
