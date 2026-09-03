// Normalização de leads vindos de portais — zero dependências.
function pick(obj, keys) {
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return null;
}

function normalizarLead(portal, payload) {
  const p = (payload && typeof payload === 'object') ? payload : {};
  const nome = pick(p, ['nome', 'name', 'cliente', 'nome_cliente', 'contato']);
  const telefone = pick(p, ['telefone', 'phone', 'celular', 'tel', 'whatsapp', 'fone']);
  const email = pick(p, ['email', 'e_mail', 'mail', 'e-mail']);
  const mensagem = pick(p, ['mensagem', 'message', 'msg', 'texto', 'observacao', 'descricao']);
  const codigoImovel = pick(p, ['codigoImovel', 'cod', 'codigo', 'codigo_imovel', 'idImovel', 'id_imovel']);
  const origemExtra = pick(p, ['origem', 'source', 'utm_source', 'canal']);

  if (!telefone && !email) {
    return { error: 'informe ao menos telefone ou email' };
  }

  const lead = {};
  if (nome !== null) lead.nome = String(nome);
  if (telefone !== null) lead.telefone = String(telefone);
  if (email !== null) lead.email = String(email);
  if (mensagem !== null) lead.mensagem = String(mensagem);
  if (codigoImovel !== null) lead.codigoImovel = String(codigoImovel);
  if (origemExtra !== null) lead.origem = String(origemExtra);

  const rec = {
    fonte: portal,
    origem: 'lead-' + portal,
    status: 'novo',
    lead,
    createdAt: new Date().toISOString()
  };

  const bairro = pick(p, ['bairro', 'neighborhood', 'bairroInteresse']);
  if (bairro !== null) rec.bairro = String(bairro);
  if (codigoImovel !== null) rec.codigoImovel = String(codigoImovel);

  return rec;
}

module.exports = { normalizarLead };
