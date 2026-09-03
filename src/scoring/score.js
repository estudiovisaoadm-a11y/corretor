// Score 0-100 — fórmula do blueprint
// Score = (Preço/m² 30%) + (Localização 25%) + (Documentação 25%) + (Financiamento 10%) + (Permuta 10%)

function notaPrecoM2(precoM2, mediaBairro) {
  if (!precoM2 || !mediaBairro) return { nota: 5, motivo: 'sem base de m² para comparar' };
  const diff = (precoM2 - mediaBairro) / mediaBairro; // negativo = mais barato = melhor
  if (diff <= -0.15) return { nota: 10, motivo: `${pct(diff)} abaixo da média — oportunidade` };
  if (diff <= -0.05) return { nota: 8, motivo: `${pct(diff)} abaixo da média` };
  if (diff <= 0.05) return { nota: 6, motivo: 'na média do bairro' };
  if (diff <= 0.15) return { nota: 4, motivo: `${pct(diff)} acima da média` };
  return { nota: 2, motivo: `${pct(diff)} acima da média — caro` };
}

function pct(diff) {
  return `${Math.abs(Math.round(diff * 100))}%`;
}

function notaDocumentacao(extracao, seloImovelSeguro) {
  if (seloImovelSeguro) return { nota: 10, motivo: 'selo Imóvel Seguro (DFImóveis) — certidões verificadas' };
  let nota = 5;
  const motivos = [];
  if (extracao.tem_escritura) { nota += 2; motivos.push('menciona escritura'); }
  if (extracao.tem_habite_se) { nota += 2; motivos.push('menciona habite-se'); }
  if (extracao.tem_matricula) { nota += 1; motivos.push('menciona matrícula'); }
  if (!extracao.tem_escritura && !extracao.tem_habite_se) {
    motivos.push('sem escritura/habite-se confirmados — RISCO DOCUMENTAL, confirmar antes de financiar');
    nota = Math.min(nota, 3);
  }
  return { nota: Math.min(nota, 10), motivo: motivos.join('; ') || 'sem dados' };
}

function calcScore({ precoM2, mediaBairro, localizacaoNota = 6, extracao = {}, seloImovelSeguro = false, oportunidadeSinal = false }) {
  const p = notaPrecoM2(precoM2, mediaBairro);
  let pNota = p.nota;
  if (oportunidadeSinal) pNota = Math.min(10, pNota + 1); // queda de preço detectada (WImóveis)

  const d = notaDocumentacao(extracao, seloImovelSeguro);
  const finNota = extracao.aceita_financiamento === true ? 9 : extracao.aceita_financiamento === false ? 2 : 5;
  const permNota = extracao.aceita_permuta === true ? 9 : extracao.aceita_permuta === false ? 4 : 5;

  const score = Math.round(pNota * 3 + localizacaoNota * 2.5 + d.nota * 2.5 + finNota * 1 + permNota * 1);
  // pesos: 30 + 25 + 25 + 10 + 10 = /10 → score 0-100

  let veredito = 'DESCARTAR / ALTO RISCO';
  if (score >= 80) veredito = 'ÓTIMA OPORTUNIDADE';
  else if (score >= 60) veredito = 'BOM, NEGOCIÁVEL';
  else if (score >= 40) veredito = 'REGULAR';

  // trava documental: sem escritura+habite-se não pode ser ótima
  if (!seloImovelSeguro && !extracao.tem_escritura && !extracao.tem_habite_se && score >= 80) {
    veredito = 'BOM, NEGOCIÁVEL (confirmar documentação)';
  }

  return {
    score,
    veredito,
    detalhes: {
      preco_m2: { nota: pNota, motivo: p.motivo },
      localizacao: { nota: localizacaoNota },
      documentacao: d,
      financiamento: { nota: finNota, valor: extracao.aceita_financiamento },
      permuta: { nota: permNota, valor: extracao.aceita_permuta }
    }
  };
}

module.exports = { calcScore };
