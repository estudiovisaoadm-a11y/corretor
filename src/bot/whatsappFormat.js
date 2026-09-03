// Formata ficha para WhatsApp: curta, em até 2 mensagens (<3500 chars cada)
function fmt(v) {
  return v === true ? 'Sim' : v === false ? 'Nao' : 'Confirmar';
}
function brl(v) {
  return v ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : '—';
}

function fichaWhats(a) {
  const e = a.extracao;
  // Mesma ordem canônica da fichaMarkdown 1→9: veredito → preço → local → financiamento → permuta → documentação → motivos → pendências → selos.
  // Se falta escritura ou habite-se, o motivo de documentação deve explicitar o risco.
  const faltaDoc = (e.precisa_confirmar || []).some((p) => /escritura|habite/i.test(String(p)));
  let motivoDoc = a.detalhes.documentacao.motivo;
  if (faltaDoc && !/risco documental/i.test(motivoDoc)) motivoDoc += ' — RISCO DOCUMENTAL';
  const msg1 = [
    `*${a.veredito}* (${a.score}/100)`,
    ``,
    `Fonte: ${a.fonte}`,
    `Preco: ${brl(e.preco)} | Area: ${e.area_m2 ? e.area_m2 + 'm2' : '—'} | *R$/m2: ${e.preco_m2 ? brl(e.preco_m2) : '—'}* (media ${a.bairro || 'DF'}: ${brl(a.media_bairro_ref)})`,
    `Local: ${a.bairro || 'n/i'}`,
    `Financ: ${fmt(e.aceita_financiamento)}`,
    `Permuta: ${fmt(e.aceita_permuta)}`,
    `Escrit: ${fmt(e.tem_escritura)} | Habite-se: ${fmt(e.tem_habite_se)} | Matricula: ${fmt(e.tem_matricula)}`,
    ``,
    `m2: ${a.detalhes.preco_m2.motivo}`,
    `doc: ${motivoDoc}`
  ].join('\n');

  const extras = [];
  if (e.precisa_confirmar.length) extras.push(`Confirmar: ${e.precisa_confirmar.join(', ')}`);
  if (a.parsed?.selos?.imovelSeguro) extras.push('Selo Imovel Seguro detectado');
  if (a.parsed?.oportunidadeSinal) extras.push('Sinal de queda de preco — checar historico');
  const msg2 = extras.length ? extras.join('\n') : null;
  return msg2 ? [msg1, msg2] : [msg1];
}

const AJUDA = [
  `*IA Imoveis — corretor*`,
  ``,
  `Encaminhe o *link* (DFImoveis / WImoveis / NetImoveis) ou o *texto* do anuncio e devolvo a ficha em segundos.`,
  ``,
  `Ex: https://www.dfimoveis.com.br/venda/df/aguas-claras/sul/apartamento`,
  `Ou: Ap 70m2 R$ 550 mil, aceita financiamento, escritura e habite-se ok`,
  ``,
  `Comandos: AJUDA`
].join('\n');

module.exports = { fichaWhats, AJUDA };
