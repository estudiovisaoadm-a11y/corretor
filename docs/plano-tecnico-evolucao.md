# Plano técnico de evolução do sistema imobiliário

## Objetivo

Transformar o sistema em uma plataforma operacional imobiliária confiável, organizada e visualmente consistente. A evolução deve abranger experiência, arquitetura, dados e qualidade, com critérios verificáveis para atingir o nível desejado de produto.

Este documento descreve o trabalho proposto. Não representa funcionalidades já implementadas.

## 1. Reorganizar a arquitetura

Adotar um **monólito modular**, mantendo Node.js e PostgreSQL e separando responsabilidades:

```text
src/
  modules/
    properties/       Cadastro de imóveis e anúncios
    analyses/         Extração, pontuação e evidências
    contacts/         Contatos e preferências
    opportunities/   Negociações e etapas comerciais
    activities/      Tarefas, visitas e atendimentos
    proposals/       Propostas e versões
    monitoring/      Monitoramento e histórico de preços
    team/            Usuários, equipes e distribuição
  integrations/
    portals/
    whatsapp/
  infrastructure/
    database/
    jobs/
    logging/
  http/
    routes/
    middleware/
    validation/
```

Cada módulo deve separar rotas, serviços e repositórios. O `server.js` ficará responsável pela inicialização e composição da aplicação.

Introduzir TypeScript gradualmente, começando pelos contratos da API e pelas entidades. Preservar as regras existentes com testes antes de movê-las.

**Critério de conclusão:** nenhuma regra de negócio ou consulta SQL diretamente nas rotas.

## 2. Corrigir a modelagem e a consistência dos dados

Separar os registros hoje concentrados em `analises`:

| Entidade | Responsabilidade |
|---|---|
| Imóvel | Características físicas e localização |
| Anúncio | Portal, URL, identificador externo e disponibilidade |
| Histórico de preço | Valor observado e data da coleta |
| Análise | Resultado, evidências e versão da regra |
| Contato | Dados pessoais e preferências |
| Oportunidade | Contato, imóvel, responsável e etapa comercial |
| Atividade | Tarefa, atendimento, visita ou retorno |
| Proposta | Condições comerciais e versões |
| Evento de integração | Recebimento, processamento e falhas |

Implementar:

- Migrações versionadas, com conferência dos dados existentes.
- Chaves estrangeiras, campos obrigatórios e restrições contra duplicações.
- Transações na distribuição de leads e atualização de negociações.
- Separação entre etapa comercial, disponibilidade do imóvel e resultado da análise.
- Uma fonte de verdade para campos atualmente duplicados entre colunas e JSON.
- Paginação nas listagens e agregações próprias para indicadores.

Corrigir especificamente o limite atual de 500 registros: os indicadores devem considerar toda a base correspondente aos filtros, sem depender da página carregada.

**Critério de conclusão:** totais corretos em bases maiores, atualização consistente de status e migração sem perda de registros.

## 3. Implementar acesso individual

Substituir o uso cotidiano da chave administrativa compartilhada por:

- Login individual.
- Sessões seguras e expiração.
- Perfis de administrador, gestor e corretor.
- Autorização no backend por ação e registro.
- Histórico de alterações com usuário, data e operação.
- Credenciais de integração exclusivamente no servidor.

Se houver atendimento a várias imobiliárias, incluir isolamento por organização desde a modelagem.

**Critério de conclusão:** um corretor acessa somente os dados permitidos, inclusive ao chamar a API diretamente.

## 4. Tornar as integrações confiáveis

Separar o processamento demorado das requisições HTTP.

Fluxo proposto:

```text
Receber evento
→ validar origem e conteúdo
→ registrar evento de forma durável
→ confirmar recebimento
→ processar em segundo plano
→ registrar resultado ou tentativa de recuperação
```

Implementar:

- Deduplicação atômica de webhooks.
- Fila persistente para análises, monitoramento e mensagens.
- Retentativas com limites e intervalos progressivos.
- Timeouts e tratamento de indisponibilidade por portal.
- Agendamento persistente para rotinas recorrentes.
- Registro das tentativas de envio e retorno do provedor.
- Tela de integrações com última execução, resultado e falhas.

**Critério de conclusão:** reiniciar o servidor não perde tarefas; eventos repetidos não criam registros duplicados.

## 5. Reestruturar o frontend

Separar o HTML e JavaScript atualmente concentrados no painel.

Organizar por funcionalidades, com:

- Camada central de comunicação com a API.
- Componentes reutilizáveis de formulário, tabela, filtros, modal e notificações.
- Rotas navegáveis, com suporte a voltar, avançar e recarregar.
- Estado de filtros preservado na URL.
- Carregamento por tela.
- Tratamento padronizado de erros HTTP.
- Cancelamento de buscas antigas e atraso curto na pesquisa digitada.
- Estados explícitos de carregamento, vazio, erro e sucesso.

A migração deve ocorrer por tela, mantendo os fluxos existentes utilizáveis durante a transição.

**Critério de conclusão:** nenhuma falha de API aparece como sucesso, e nenhuma ação depende de variáveis globais implícitas do navegador.

## 6. Redesenhar a navegação e os fluxos

Implementar a seguinte estrutura:

| Tela | Função principal |
|---|---|
| Hoje | Prioridades, retornos e próximas ações |
| Atendimento | Contatos, responsáveis e histórico |
| Imóveis | Carteira, filtros e comparação |
| Negócios | Funil comercial e propostas |
| Mercado | Monitoramento e referências de preço |
| Gestão | Conversão, desempenho e distribuição |
| Configurações | Usuários, permissões e integrações |

O painel inicial deve destacar dados reais: contatos sem resposta, tarefas vencidas, visitas agendadas e oportunidades relevantes.

Eliminar a necessidade de copiar IDs. Selecionar imóveis e contatos por nome, localização e contexto.

Na ficha do imóvel, reunir análise, documentação informada, histórico de preço, interessados e ações comerciais. Na ficha do contato, reunir preferências, conversas, tarefas e negociações.

**Critério de conclusão:** o corretor consegue receber um lead, registrar atendimento, indicar imóvel e avançar a negociação sem manipular identificadores técnicos.

## 7. Consolidar o design visual

Criar uma única base de estilos, substituindo as sobreposições acumuladas no CSS.

Direção visual:

- Marrom escuro como identidade.
- Fundo claro e superfícies neutras para leitura.
- Dourado reservado para destaque.
- Cores semânticas distintas para sucesso, atenção e erro.
- Tipografia, espaçamento, bordas e botões padronizados.
- Menu lateral no desktop e navegação compacta no celular.
- Cabeçalho operacional curto.
- Tabelas legíveis e fichas adaptadas ao toque.

Definir componentes com todos os estados: normal, foco, carregamento, desabilitado, erro e confirmação.

Incluir navegação por teclado, foco correto nos modais, rótulos acessíveis e informação que não dependa exclusivamente da cor.

**Critério de conclusão:** todas as telas usam os mesmos padrões e funcionam em celular sem cortes ou sobreposição de controles.

## 8. Tornar as análises transparentes

Ajustar a apresentação para refletir o que o sistema realmente comprova:

- Trocar “documentação verificada” por “documentação informada no anúncio” quando houver apenas extração textual.
- Exibir origem e data das informações.
- Mostrar motivos da pontuação.
- Diferenciar referência configurada de média calculada.
- Informar tamanho da amostra nas comparações.
- Identificar estimativas e dados ausentes.
- Remover indicadores demonstrativos que aparentem ser dados reais.
- Exigir dados reais do corretor nas propostas, eliminando valores fictícios fixos.

**Critério de conclusão:** cada conclusão relevante pode ser rastreada até sua fonte ou regra de cálculo.

## 9. Validar antes de publicar

Cobrir os fluxos críticos com testes:

- Analisar anúncio e consultar resultado.
- Receber webhook duplicado.
- Distribuir leads concorrentes.
- Atualizar status e recarregar a ficha.
- Consultar indicadores com mais de 500 registros.
- Executar tarefas após reinício.
- Verificar restrições de acesso.
- Gerar proposta e concluir acompanhamento.

Complementar com revisão visual no desktop e celular, testes de teclado, logs estruturados, verificação real de disponibilidade do banco e procedimento de backup/restauração.

## Sequência de execução

1. Mapear fluxos atuais e registrar os testes de referência.
2. Corrigir consistência de dados e separar módulos.
3. Implementar identidade e permissões.
4. Construir o design system e a estrutura de navegação.
5. Entregar Hoje, Atendimento e Imóveis.
6. Entregar Negócios, Mercado e Gestão.
7. Consolidar filas, monitoramento e recuperação de falhas.
8. Validar a jornada completa e publicar gradualmente.

## Critérios de aprovação final

- Zero falhas críticas nos fluxos principais.
- Indicadores consistentes com a base completa e os filtros aplicados.
- Permissões verificadas na interface e na API.
- Interface validada em desktop e celular.
- Recuperação de tarefas após reinício comprovada.
- Migração de dados conferida e restauração de backup testada.
- Informações extraídas, estimativas e verificações humanas claramente diferenciadas.

Esses critérios tornam a evolução para “nota 9” demonstrável, além da mudança estética.
