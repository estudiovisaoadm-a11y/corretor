// Extração heurística (MVP sem chave de IA) + gerador de prompt pra LLM
// Detecta os 5 pilares no texto do anúncio. Nunca inventa: null + precisa_confirmar quando ausente.

function norm(t) {
  return (t || '').toLowerCase();
}

function tem(texto, ...termos) {
  const n = norm(texto);
  return termos.some((t) => n.includes(t));
}

function extrairPreco(texto) {
  // R$ 550.000 / R$ 550 mil / 550k
  const m = String(texto || '').match(/r\$\s?([\d.,]+)\s?(mil|k|m|milh[õo]es|mi)?/i);
  if (!m) return null;
  let num = parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
  if (isNaN(num)) return null;
  const suf = (m[2] || '').toLowerCase();
  if (suf.startsWith('mil') || suf === 'k' || suf === 'm') num *= 1000;
  if (suf.startsWith('milh') || suf === 'mi') num *= 1000000;
  if (num < 10000) return null; // evita confundir com m² / condomínio
  return Math.round(num);
}

function extrairArea(texto) {
  const m = String(texto || '').match(/(\d{2,4})\s?m[²2]/i);
  if (!m) return null;
  return Number(m[1]);
}

function extrair(texto) {
  const t = texto || '';
  const preco = extrairPreco(t);
  const area = extrairArea(t);

  const aceitaFin = tem(t, 'financi', 'finacia', 'fgts', 'minha casa', 'mcmv', 'crédito imobiliário', 'credito imobiliario', 'caixa econômica', 'caixa economica');
  const negaFin = tem(t, 'não aceita financiamento', 'nao aceita financiamento', 'somente à vista', 'somente a vista', 'só à vista', 'so a vista');
  const aceitaPerm = tem(t, 'permuta', 'aceita troca', 'aceito troca', 'troca por', 'torna');
  const negaPerm = tem(t, 'não aceita permuta', 'nao aceita permuta', 'não aceito troca', 'nao aceito troca');

  const temEscritura = tem(t, 'escritura', 'escriturado', 'registrado em cartório', 'registrado em cartorio');
  const temHabiteSe = tem(t, 'habite-se', 'habitese', 'habite se');
  const temMatricula = tem(t, 'matrícula', 'matricula');
  const temIptu = tem(t, 'iptu');

  return {
    preco,
    area_m2: area,
    preco_m2: preco && area ? Math.round(preco / area) : null,
    aceita_financiamento: negaFin ? false : aceitaFin ? true : null,
    aceita_permuta: negaPerm ? false : aceitaPerm ? true : null,
    tem_escritura: temEscritura ? true : null,
    tem_habite_se: temHabiteSe ? true : null,
    tem_matricula: temMatricula ? true : null,
    menciona_iptu: temIptu ? true : null,
    precisa_confirmar: [
      !aceitaFin && !negaFin ? 'financiamento' : null,
      !aceitaPerm && !negaPerm ? 'permuta' : null,
      !temEscritura ? 'escritura' : null,
      !temHabiteSe ? 'habite-se' : null
    ].filter(Boolean)
  };
}

function buildPromptLLM(textoAnuncio) {
  return `Você é analista imobiliário no DF. Extraia do anúncio abaixo um JSON com: preco, area_m2, bairro, cidade, aceita_financiamento(bool|null), aceita_permuta(bool|null), tipo_permuta, tem_escritura(bool|null), tem_habite_se(bool|null), matricula_ok(bool|null), iptu_valor. Se não informado, use null e adicione em "precisa_confirmar". Depois gere 3 bullets de riscos e 1 veredito (OTIMA/BOA/REGULAR/DESCARTAR). Nunca invente documento.\n\nANÚNCIO:\n${textoAnuncio}`;
}

module.exports = { extrair, buildPromptLLM, extrairPreco, extrairArea };
