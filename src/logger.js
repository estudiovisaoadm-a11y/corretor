function safeError(error) { return { name: error?.name || 'Error', message: String(error?.message || 'erro').slice(0, 300) }; }
function log(level, message, fields = {}) {
  const safe = { ...fields };
  for (const key of Object.keys(safe)) if (/token|secret|password|authorization|api.?key/i.test(key)) safe[key] = '[REDACTED]';
  const line = JSON.stringify({ time: new Date().toISOString(), level, message, ...safe });
  (level === 'error' ? console.error : console.log)(line);
}
module.exports = { log, safeError };
