const crypto = require('crypto');

const MAX_BODY_BYTES = 1024 * 1024;
const WEBHOOK_WINDOW_MS = 5 * 60 * 1000;
const RATE_WINDOW_MS = 60 * 1000;
const RATE_LIMIT = 120;
const buckets = new Map();

function constantTimeEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function configuredOrigins() {
  return String(process.env.CORS_ORIGINS || 'http://localhost:3000')
    .split(',').map((origin) => origin.trim()).filter(Boolean);
}

function applySecurityHeaders(res, origin) {
  const allowed = configuredOrigins();
  if (origin && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key, X-Webhook-Signature, X-Webhook-Timestamp, X-Idempotency-Key');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (process.env.NODE_ENV === 'production') res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
}

function isAuthorized(req) {
  const expected = String(process.env.ADMIN_API_KEY || '').trim();
  if (!expected) return process.env.NODE_ENV !== 'production';
  const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  return constantTimeEqual(req.headers['x-api-key'], expected) || constantTimeEqual(bearer, expected);
}

function rateLimit(req) {
  const key = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || now - bucket.startedAt >= RATE_WINDOW_MS) bucket = { startedAt: now, count: 0 };
  bucket.count += 1;
  buckets.set(key, bucket);
  if (buckets.size > 5000) for (const [address, value] of buckets) if (now - value.startedAt >= RATE_WINDOW_MS) buckets.delete(address);
  return bucket.count <= RATE_LIMIT;
}

async function readJson(req) {
  let total = 0;
  const chunks = [];
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) {
      const error = new Error('payload too large');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') Object.defineProperty(parsed, '__rawBody', { value: raw, enumerable: false });
    return parsed;
  } catch {
    return { _raw: raw, __rawBody: raw };
  }
}

function webhookSecret(portal) {
  const suffix = portal ? String(portal).toUpperCase().replace(/[^A-Z0-9]/g, '_') : '';
  const key = 'WEBHOOK_SECRET_' + suffix;
  return String(process.env[key] || process.env.WEBHOOK_SECRET || '').trim();
}

function verifyWebhook(req, rawBody, portal) {
  const secret = webhookSecret(portal);
  if (!secret) return process.env.NODE_ENV !== 'production';
  const timestamp = String(req.headers['x-webhook-timestamp'] || '');
  const timestampMs = Number(timestamp) * 1000;
  if (!/^\d+$/.test(timestamp) || !Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > WEBHOOK_WINDOW_MS) return false;
  const received = String(req.headers['x-webhook-signature'] || '').replace(/^sha256=/i, '').trim();
  const expected = crypto.createHmac('sha256', secret).update(timestamp + '.' + rawBody).digest('hex');
  return constantTimeEqual(received, expected);
}

function idempotencyKey(req, rawBody, portal) {
  const supplied = String(req.headers['x-idempotency-key'] || '').trim();
  if (supplied && supplied.length <= 200) return (portal || 'evolution') + ':' + supplied;
  return (portal || 'evolution') + ':' + crypto.createHash('sha256').update(rawBody || '').digest('hex');
}

module.exports = { MAX_BODY_BYTES, applySecurityHeaders, isAuthorized, rateLimit, readJson, verifyWebhook, idempotencyKey };
