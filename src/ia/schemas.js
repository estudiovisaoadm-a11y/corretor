const BOOLEAN_KEYS = ['aceita_financiamento', 'aceita_permuta', 'tem_escritura', 'tem_habite_se', 'tem_matricula'];
const NUMBER_KEYS = ['preco', 'area_m2', 'iptu_valor'];
function normalizeExtraction(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('resposta de extração inválida');
  const out = {};
  for (const key of NUMBER_KEYS) { const v = value[key]; if (v == null || v === '') out[key] = null; else if (typeof v === 'number' && Number.isFinite(v) && v >= 0) out[key] = v; else throw new Error(`campo numérico inválido: ${key}`); }
  for (const key of BOOLEAN_KEYS) { const v = value[key]; if (v == null) out[key] = null; else if (typeof v === 'boolean') out[key] = v; else throw new Error(`campo booleano inválido: ${key}`); }
  out.bairro = value.bairro == null ? null : String(value.bairro).slice(0, 160); out.cidade = value.cidade == null ? null : String(value.cidade).slice(0, 160); out.tipo_permuta = value.tipo_permuta == null ? null : String(value.tipo_permuta).slice(0, 160);
  out.precisa_confirmar = Array.isArray(value.precisa_confirmar) ? value.precisa_confirmar.map(String).slice(0, 20) : []; out.riscos = Array.isArray(value.riscos) ? value.riscos.map(String).slice(0, 10) : []; out.veredito = value.veredito == null ? null : String(value.veredito).slice(0, 40); out.evidencias = value.evidencias && typeof value.evidencias === 'object' ? value.evidencias : {};
  return out;
}
function extractJson(text) { const raw = String(text || '').replace(/```json\s*/gi, '').replace(/```/g, '').trim(); try { return JSON.parse(raw); } catch {} const m = raw.match(/\{[\s\S]*\}/); if (!m) throw new Error('modelo não retornou JSON'); return JSON.parse(m[0]); }
module.exports = { normalizeExtraction, extractJson };
