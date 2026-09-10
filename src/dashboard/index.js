const { slaStatus } = require('../distribuicao');
const { alertasOportunidade } = require('../alertas');

function isLead(record) {
  return String(record?.origem || '').startsWith('lead-');
}

function buildOverview(records, now = Date.now()) {
  const list = Array.isArray(records) ? records : [];
  const properties = list.filter((record) => !isLead(record));
  const leads = list.filter(isLead);
  const activeLeads = leads.filter((record) => !['fechado', 'descartado'].includes(record.status));
  const pending = activeLeads.filter((record) => !record.status || record.status === 'novo');
  const priorities = pending.map((record) => ({
    id: record.id,
    name: record.lead?.nome || record.nome || 'Contato sem nome',
    source: record.fonte || 'Manual',
    assignedTo: record.corretorNome || 'Sem responsável',
    phone: record.lead?.telefone || record.whatsapp || null,
    sla: slaStatus(record, now),
  })).sort((a, b) => Number(b.sla.estourado) - Number(a.sla.estourado) || b.sla.minutosDecorridos - a.sla.minutosDecorridos);
  const opportunities = alertasOportunidade(properties);
  const pipeline = Object.fromEntries(['novo', 'analisado', 'visitado', 'proposta', 'fechado'].map((status) => [status, leads.filter((record) => record.status === status).length]));
  return {
    updatedAt: new Date(now).toISOString(),
    totals: { properties: properties.length, pending: pending.length, overdue: priorities.filter((item) => item.sla.estourado).length, opportunities: opportunities.length },
    priorities: priorities.slice(0, 8),
    opportunities: opportunities.slice(0, 5),
    recent: properties.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 5),
    pipeline,
  };
}

module.exports = { buildOverview, isLead };
