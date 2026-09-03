'use strict';

const {
  SEQUENCIAS,
  tarefasPendentes,
  proximoStep,
  iniciarSequencia,
  avancarStep,
  gerarMensagem,
} = require('./src/followup');

let falhas = 0;

function assert(condicao, msg) {
  if (!condicao) {
    console.error(`FALHOU: ${msg}`);
    falhas++;
  } else {
    console.log(`OK: ${msg}`);
  }
}

// 1) QUENTE tem 3 passos
assert(SEQUENCIAS.QUENTE.length === 3, 'SEQUENCIAS.QUENTE tem 3 passos');

// 2) MORNO tem 4 passos
assert(SEQUENCIAS.MORNO.length === 4, 'SEQUENCIAS.MORNO tem 4 passos');

// 3) FRIO tem 3 passos
assert(SEQUENCIAS.FRIO.length === 3, 'SEQUENCIAS.FRIO tem 3 passos');

const DIA = 86400000;
const agora = Date.now();

// 4) Lead novo sem followup recebe step 1
const leadNovo = {
  id: 'L001',
  createdAt: agora,
  leadScore: { faixa: 'QUENTE' },
};
const pendentesNovo = tarefasPendentes(leadNovo, agora);
assert(pendentesNovo.length === 1, 'Lead novo recebe exatamente 1 tarefa pendente');
assert(pendentesNovo[0].step === 1, 'Lead novo recebe step 1');
assert(pendentesNovo[0].nome === 'Apresentação ficha', 'Lead novo recebe step com nome correto');

// 5) Lead com followup no step 1 recebe step 2 quando dias suficientes passam
const leadStep1 = {
  id: 'L002',
  createdAt: agora,
  leadScore: { faixa: 'QUENTE' },
  followup: { sequencia: 'QUENTE', ultimoStep: 1, proximoStep: 2, inicioEm: agora },
};
const pendentesStep2 = tarefasPendentes(leadStep1, agora + 1 * DIA + 1);
assert(pendentesStep2.length === 1, 'Lead no step 1 recebe step 2 quando 1 dia passa');
assert(pendentesStep2[0].step === 2, 'O passo retornado é o step 2');

// 6) Lead com followup completo retorna null
const leadCompleto = {
  id: 'L003',
  createdAt: agora,
  leadScore: { faixa: 'QUENTE' },
  followup: { sequencia: 'QUENTE', ultimoStep: 3, proximoStep: 4, completo: true, inicioEm: agora },
};
const proximo = proximoStep(leadCompleto);
assert(proximo === null, 'Sequência completa retorna null');

// 7) Template de mensagem substitui placeholders
const stepMock = { mensagem: 'Olá {nome}, imóvel {codigo} no {bairro} por {preco}.' };
const leadMock = { nome: 'João', codigo: 'IM-123', bairro: 'Centro', preco: 'R$ 500.000', leadScore: { faixa: 'MORNO' } };
const msg = gerarMensagem(stepMock, leadMock);
assert(msg === 'Olá João, imóvel IM-123 no Centro por R$ 500.000.', 'gerarMensagem substitui todos os placeholders');

// 8) avancarStep incrementa corretamente
const leadAvancar = {
  id: 'L004',
  createdAt: agora,
  leadScore: { faixa: 'MORNO' },
  followup: { sequencia: 'MORNO', ultimoStep: 1, proximoStep: 2, inicioEm: agora },
};
const patchAvancar = avancarStep(leadAvancar, agora);
assert(patchAvancar.followup.ultimoStep === 2, 'avancarStep incrementa ultimoStep');
assert(patchAvancar.followup.proximoStep === 3, 'avancarStep incrementa proximoStep');

// 9) avancarStep no último passo marca como completo
const leadUltimo = {
  id: 'L005',
  createdAt: agora,
  leadScore: { faixa: 'FRIO' },
  followup: { sequencia: 'FRIO', ultimoStep: 2, proximoStep: 3, inicioEm: agora },
};
const patchCompleto = avancarStep(leadUltimo, agora);
assert(patchCompleto.followup.completo === true, 'avancarStep no último passo marca completo: true');

// 10) overdue funciona quando está atrasado
const leadAtrasado = {
  id: 'L006',
  createdAt: agora,
  leadScore: { faixa: 'QUENTE' },
  followup: { sequencia: 'QUENTE', ultimoStep: 0, proximoStep: 1, inicioEm: agora },
};
const pendentesAtrasado = tarefasPendentes(leadAtrasado, agora + 5 * DIA);
assert(pendentesAtrasado.length > 0, 'Lead com 5 dias de atraso tem tarefas pendentes');
assert(pendentesAtrasado[0].overdue === true, 'Tarefa está marcada como overdue');

// 11) iniciarSequencia retorna patch correto
const patchInit = iniciarSequencia(leadNovo);
assert(patchInit.followup.sequencia === 'QUENTE', 'iniciarSequencia retorna sequencia correta');
assert(patchInit.followup.ultimoStep === 0, 'iniciarSequencia inicia ultimoStep em 0');
assert(patchInit.followup.proximoStep === 1, 'iniciarSequencia inicia proximoStep em 1');

console.log('');
if (falhas === 0) {
  console.log('TODOS OS TESTES PASSARAM');
} else {
  console.error(`${falhas} teste(s) falharam`);
  process.exit(1);
}
