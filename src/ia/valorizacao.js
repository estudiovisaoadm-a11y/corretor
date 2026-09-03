// Previsão de valorização 12 meses — heurística explicável (estimativa, não garantia).
// Combina: score da análise, tendência da base (snapshots) e risco documental.
function prever(a, snapshots = []) {
  if (!a || !a.extracao) return { error: 'análise sem dados' };
  const motivos = [];
  let base;
  if (a.score >= 80) { base = 7.5; motivos.push('score alto: demanda forte p/ esse perfil'); }
  else if (a.score >= 60) { base = 4; motivos.push('score bom: acompanha o mercado'); }
  else if (a.score >= 40) { base = 1.5; motivos.push('score regular: valorização abaixo do mercado'); }
  else { base = -2; motivos.push('score baixo: risco de desvalorização'); }

  // Tendência: compara snapshot mais antigo x mais novo p/ o bairro
  let tend = 0;
  const b = (a.bairro || 'df').toLowerCase();
  if (snapshots.length >= 2) {
    const nova = snapshots[0].medias.find((m) => m.bairro === b);
    const antiga = snapshots[snapshots.length - 1].medias.find((m) => m.bairro === b);
    if (nova && antiga && antiga.media) {
      tend = ((nova.media - antiga.media) / antiga.media) * 100;
      tend = Math.max(-5, Math.min(5, tend));
      motivos.push(`tendência da base no bairro: ${tend >= 0 ? '+' : ''}${tend.toFixed(1)}% no período`);
    }
  }
  // Risco documental derruba projeção
  const e = a.extracao;
  let risco = 0;
  if (!e.tem_escritura && !e.tem_habite_se) { risco = -3; motivos.push('sem escritura/habite-se: trava financiamento e revenda (-3pp)'); }

  const proj = Math.round((base + tend * 0.5 + risco) * 10) / 10;
  const faixa = [Math.round((proj - 2) * 10) / 10, Math.round((proj + 2) * 10) / 10];
  return {
    projecao12m_pct: proj,
    faixa12m_pct: faixa,
    classificacao: proj >= 6 ? 'ALTA' : proj >= 3 ? 'MODERADA' : proj >= 0 ? 'BAIXA' : 'NEGATIVA',
    motivos,
    aviso: 'Estimativa heurística baseada na base local — não é recomendação de investimento.'
  };
}

module.exports = { prever };
