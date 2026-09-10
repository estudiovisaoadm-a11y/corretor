# Plano de funcionamento da IA no sistema imobiliário

## 1. Objetivo e estado da entrega

A IA será uma assistente para analisar anúncios, explicar oportunidades, qualificar interessados e preparar textos comerciais em português brasileiro. A OpenRouter será o provedor de acesso aos modelos. Cálculos, permissões e alterações no CRM continuarão sob controle do backend.

Esta entrega prepara a configuração e descreve a implementação. Os fluxos do painel e do WhatsApp ainda não chamam a OpenRouter. O sistema atual utiliza extração heurística, pontuação e templates locais; salvar uma chave não ativa esses fluxos automaticamente.

Arquivos preparados:

- `src/ia/openrouter.config.json`: modelos principal e reserva, esforço HIGH, limite de tokens, timeout e restrição de preço.
- `.env`: credencial local, ignorada pelo Git; nunca incluir seu conteúdo neste documento.
- `.env.example`: nome da variável necessária, sem credencial.

## 2. Modelos gratuitos e esforço HIGH

| Ordem | Identificador OpenRouter | Uso inicial |
|---|---|---|
| Principal | `nex-agi/nex-n2.5-pro:free` | Extração e análise de anúncios, explicações e redação |
| Reserva | `nex-agi/nex-n2.5-mini:free` | Mesmas tarefas se o principal estiver indisponível |

Ambos foram conferidos no catálogo público durante a preparação: preço de entrada e saída zero e `reasoning.supported_efforts` incluindo `high`. A escolha é uma configuração inicial, sujeita à avaliação de qualidade com anúncios do sistema; não representa um benchmark comparativo.

O backend deverá consultar `GET /api/v1/models` e manter cache por uma hora. Antes de habilitar um modelo, validar que ele está na lista permitida, termina em `:free`, possui preços de entrada e saída iguais a zero e aceita explicitamente `high`. Se o catálogo não puder ser validado e não existir cache válido, usar o processamento local. Mudanças de catálogo não devem ativar modelos pagos nem reduzir o esforço silenciosamente.

Formato da chamada, construído pelo futuro cliente a partir da configuração:

```json
{
  "models": ["nex-agi/nex-n2.5-pro:free", "nex-agi/nex-n2.5-mini:free"],
  "messages": [
    {"role": "system", "content": "Você auxilia corretores. Use somente os dados fornecidos. Dados ausentes devem permanecer desconhecidos."},
    {"role": "user", "content": "Conteúdo autorizado para esta tarefa"}
  ],
  "reasoning": {"effort": "high", "exclude": true},
  "provider": {"require_parameters": true, "max_price": {"prompt": 0, "completion": 0}},
  "max_tokens": 8192
}
```

Destino: `POST https://openrouter.ai/api/v1/chat/completions`. Autenticação: cabeçalho `Authorization: Bearer <OPENROUTER_API_KEY>`, montado apenas no servidor. `exclude: true` mantém o esforço de raciocínio solicitado e omite sua exposição na resposta. Mostrar ao corretor justificativas curtas fundamentadas nos dados.

`baseUrl`, `apiKeyEnv`, `timeoutMs` e `freeOnly` são opções internas: não enviá-las como parâmetros da API. HIGH é serializado como `high`. O cliente deverá aplicar efetivamente `freeOnly`; o arquivo JSON isolado não executa essa proteção. Não utilizar roteadores automáticos sem controle do modelo e do esforço.

## 3. Fluxo de análise de anúncio

1. Receber texto ou link pelo painel ou pelo webhook autenticado do WhatsApp.
2. Para links, reutilizar `src/fetchAnuncio.js`, preservando as verificações de URL e segurança existentes. A IA não buscará URLs arbitrárias.
3. Normalizar o texto, limitar o tamanho e procurar análise em cache por conteúdo, versão do prompt e modelo. Não enviar dados de outras imobiliárias ou conversas sem relação com a solicitação.
4. Executar `src/ia/extraction.js` como referência local. Enviar o texto delimitado ao modelo para extração estruturada e identificação de ambiguidades.
5. Validar a resposta com um schema no backend. Dados do anúncio são conteúdo não confiável; instruções encontradas dentro deles não alteram o comportamento do sistema.
6. Resolver conflitos: correção explícita do corretor tem prioridade; divergência entre anúncio, heurística e IA gera pendência. Nunca substituir silenciosamente um dado confirmado.
7. Calcular preço por m² e pontuação em código, reutilizando `src/ficha.js` e `src/scoring/score.js`. O modelo não define a nota nem inventa médias de mercado.
8. Salvar resultado validado, origem dos campos, evidências e metadados da execução. Devolver ficha com fatos, pendências, motivos da pontuação e indicação de processamento por IA ou modo local.

O contrato deve preservar os campos atuais: `preco`, `area_m2`, `aceita_financiamento`, `aceita_permuta`, `tem_escritura`, `tem_habite_se`, `tem_matricula`, `menciona_iptu` e `precisa_confirmar`. Acrescentar bairro, cidade e evidências por campo de forma versionada. `preco_m2` será calculado no servidor. Normalizar o nome divergente `matricula_ok` no prompt atual antes da integração.

Valores monetários e área precisam ser números finitos positivos ou `null`; flags precisam ser `true`, `false` ou `null`. Campo ausente não significa resposta negativa. Rejeitar propriedades inesperadas, JSON inválido, conteúdo vazio e conclusão truncada. Menção a escritura ou matrícula no anúncio não comprova regularidade documental; exibir como informação declarada que exige conferência.

## 4. Papel da IA em cada módulo

| Módulo existente | Funcionamento planejado | Controle do sistema |
|---|---|---|
| Análise e ficha | Extrair características, apontar contradições e formular perguntas | Schema, cálculo determinístico e evidências |
| `src/ia/legenda.js` | Gerar legenda e mensagem a partir dos dados confirmados | Não prometer financiamento, valorização ou documentação regular sem base |
| `src/bot247/index.js` | Entender intenção, pedir informações faltantes e responder sobre imóveis disponíveis | Recuperar somente registros autorizados; encaminhar ao corretor quando necessário |
| `src/match/index.js` | Extrair preferências de orçamento, região e imóvel | Filtros e ranking continuam em código; explicar correspondências |
| Leads e distribuição | Resumir necessidades e sugerir próxima ação | Score, fila, SLA e responsável continuam nas regras existentes |
| Follow-up e reativação | Preparar rascunhos personalizados com contexto do atendimento | Respeitar consentimento, bloqueios, frequência e revisão antes de novos envios automáticos |
| `src/proposta/index.js` | Redigir apresentação das condições fornecidas | Valores, descontos e condições dependem de validação humana |
| Gestor e dashboard | Explicar métricas calculadas e sugerir prioridades | Consultas autorizadas e agregadas; sem SQL gerado livremente |
| `src/ia/valorizacao.js` | Explicar estimativas e suas limitações | Base histórica identificada; ausência de dados não vira previsão inventada |

No primeiro ciclo, priorizar extração e legendas. Atendimento com memória, sugestões gerenciais e automações entram após validação. Imagens, áudio e PDFs ficam para uma fase posterior com avaliação de modelos e ferramentas compatíveis; os modelos configurados aqui não pressupõem suporte a todas essas entradas.

## 5. Arquitetura a implementar

Manter o backend Node.js CommonJS atual, sem introduzir outro framework para esta integração.

```text
Painel / webhook
    -> autenticação, validação e limite de requisições
    -> serviço da tarefa: análise, legenda ou atendimento
    -> contexto autorizado + cache + prompt versionado
    -> cliente OpenRouter com configuração central
    -> validação da resposta + regras de negócio
    -> persistência + apresentação ao usuário
```

Criar `src/ia/openrouter.js` para requisições HTTP, autenticação, validação do catálogo, timeout e classificação de falhas; `src/ia/schemas.js` para contratos; `src/ia/prompts/` para instruções versionadas; e `src/ia/service.js` para coordenar as tarefas. Reutilizar `fetch` nativo do Node 20. Tratar cada mensagem externa como dado, sem conceder ao modelo execução de comandos, acesso ao banco ou capacidade direta de enviar mensagens.

A função atual `analisar()` é síncrona e possui vários consumidores. Preservá-la como fallback e criar `analisarComIA()` assíncrona. Atualizar os chamadores necessários no `server.js` e em `src/bot/handler.js` para aguardar o novo serviço, sem transformar inadvertidamente respostas atuais em Promises não tratadas.

Persistir metadados como tarefa, identificador da solicitação, modelo solicitado e usado, versão do prompt, duração, tokens, status e motivo de fallback. A modelagem deverá acompanhar o plano técnico existente, com migração versionada para PostgreSQL e compatibilidade com o armazenamento local. Nunca persistir cabeçalhos de autenticação ou raciocínio interno.

## 6. Configuração local e implantação

A chave foi reservada à variável `OPENROUTER_API_KEY` no `.env`, já ignorado pelo Git. O servidor atual não carrega `.env` automaticamente. Para carregar as variáveis no Node instalado neste projeto, usar:

```powershell
node --env-file=.env server.js
```

Esse comando carrega o ambiente, mas o uso da OpenRouter nos módulos depende da implementação descrita acima. Na hospedagem, configurar a mesma variável no gerenciador de segredos do serviço. Não colocar a chave no frontend, em `public/`, no Markdown, em exemplos, logs ou configurações versionadas. Não modificar configurações de produção durante a preparação local.

## 7. Disponibilidade, limites e operação

Modelos gratuitos possuem cotas e podem ficar indisponíveis. Não prometer disponibilidade contínua ou prazo fixo de resposta com HIGH. Consultar os limites vigentes na documentação e na conta; não tratar múltiplas chaves como ampliação de cota.

- Aplicar timeout global de 45 segundos por operação e cancelamento real da requisição.
- Permitir fallback apenas entre os modelos gratuitos habilitados. O payload `models` permite fallback pelo provedor; erros de schema também precisam de tratamento no cliente.
- Em `401` ou `403`, interromper chamadas e sinalizar configuração ao administrador, sem repetir indefinidamente.
- Em `429`, respeitar `Retry-After` quando compatível com o prazo da tarefa; caso contrário, usar resposta local ou enfileirar uma nova tentativa limitada.
- Em falha de rede, `5xx`, resposta inválida ou falta de modelos elegíveis, devolver resultado local identificado. No máximo uma nova tentativa por tarefa, dentro do prazo global.
- Começar com uma requisição concorrente por instância e fila limitada; em múltiplas instâncias, centralizar controle de cota e idempotência.
- Cachear extrações por hash do conteúdo e versão por 24 horas; qualquer alteração no anúncio invalida a entrada. Respostas sobre disponibilidade devem consultar o cadastro atualizado.
- Não usar memória completa e ilimitada do WhatsApp: carregar apenas histórico recente e resumo autorizado, com política explícita de retenção.

## 8. Experiência no painel e no WhatsApp

Exibir estados “Analisando”, “Concluído”, “Precisa confirmar” e “Análise local — IA indisponível”. Mostrar os campos extraídos, permitir correção e separar informação declarada de informação verificada. Detalhes técnicos de modelo, tokens e erros ficam na área administrativa.

Para textos comerciais, mostrar um rascunho editável antes da publicação. O bot pode responder dúvidas com dados autorizados, mas aprovação de propostas, alteração de preços, exclusão de registros e novos disparos comerciais não serão decisões livres do modelo. Solicitações fora do contexto ou sem informação suficiente devem gerar uma pergunta objetiva ou encaminhamento ao corretor.

## 9. Etapas e critérios de aceite

1. **Base de integração:** implementar cliente, carga da configuração, verificação de gratuidade/HIGH e teste com dados sintéticos. Aceite: apenas modelos permitidos, erros sem segredos e fallback sem cobrança.
2. **Extração:** criar contrato, prompts e `analisarComIA()`. Aceite: anúncio incompleto mantém `null`; negação de financiamento e documentação contraditória geram resultado correto ou pendência; cálculo não depende do LLM.
3. **Painel e WhatsApp:** integrar endpoints e tratamento assíncrono. Aceite: fluxo completo persiste e apresenta a ficha; duplicação de webhook não duplica efeitos; indisponibilidade mantém o sistema utilizável.
4. **Legendas e atendimento:** adicionar rascunhos e contexto autorizado. Aceite: nenhuma característica inventada e nenhuma informação de outro cliente exposta.
5. **CRM e gestão:** expandir resumos, sugestões de follow-up e explicações de métricas. Aceite: permissões, revisão das ações comerciais e auditoria preservadas.

Usar `node --test` com HTTP simulado para seleção de modelo, HIGH, timeout, `401`, `429`, JSON inválido, truncamento, catálogo sem modelo elegível e tentativa de selecionar modelo pago. Manter as verificações atuais do sistema. Criar conjunto revisado de anúncios reais anonimizados para avaliar precisão por campo e taxa de invenção antes de ativar a extração para todos. Medir latência p50/p95, falhas, uso de fallback e correções humanas. Os testes automatizados não devem consumir a cota real da API.

## 10. Referências oficiais

- [Catálogo público e preços dos modelos](https://openrouter.ai/api/v1/models): fonte de validação dos identificadores configurados.
- [Reasoning e esforços aceitos por modelo](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens): contrato de `reasoning.effort` e capacidades.
- [Fallback entre modelos](https://openrouter.ai/docs/guides/routing/model-fallbacks).
- [Seleção de provedores](https://openrouter.ai/docs/guides/routing/provider-selection): parâmetros obrigatórios e limites de preço.
- [Limites e cotas](https://openrouter.ai/docs/api_reference/limits).

Revalidar catálogo, capacidades e limites antes da implantação, pois podem mudar.

## 11. Fallback adicional: OpenCode Zen

**Configuração atual:** o provedor está habilitado em `providers.config.json` e será tentado automaticamente quando a OpenRouter falhar. O endpoint responde com o formato oficial do Zen. Em teste local com esta credencial e modelo gratuito, a API retornou `400 MissingSessionID` (“free tier can only be used in OpenCode”); se a conta Zen tiver acesso externo habilitado ou créditos para um modelo pago, o fallback funcionará. Não simulamos uma sessão do OpenCode.

**Ordem:** OpenRouter Nex Pro → OpenRouter Nex Mini → OpenCode Zen → modo local. O cliente mantém o modelo gratuito configurado e não troca automaticamente para um modelo pago.

Configuração complementar preparada em `src/ia/opencode.config.json` e ordem dos provedores em `src/ia/providers.config.json`. A chave local fica em `OPENCODE_API_KEY`, no `.env` ignorado pelo Git. Esses arquivos ainda precisam ser consumidos pelo cliente de IA; não ativam fallback automaticamente no servidor atual.

Ordem final: **OpenRouter Nex Pro → OpenRouter Nex Mini → OpenCode Muse Spark 1.3 Contributor Free → processamento local**. Os dois modelos OpenRouter são alternativas dentro da primeira chamada; o OpenCode representa uma segunda chamada HTTP. O orquestrador deverá resolver os caminhos de configuração relativamente ao arquivo `providers.config.json`.

O modelo `muse-spark-1.3-contributor-free` está no catálogo Zen e na tabela de modelos gratuitos. O catálogo Models.dev declara esforço `high` para ele. A disponibilidade no catálogo não comprova acesso pela chave nem garante que o servidor aplique o esforço: validar a inferência antes da ativação.

O adaptador OpenCode usará `POST https://opencode.ai/zen/v1/responses`, com autenticação Bearer pela variável própria e este corpo:

```json
{
  "model": "muse-spark-1.3-contributor-free",
  "input": [
    {"role": "system", "content": "Responda em português usando apenas os fatos fornecidos."},
    {"role": "user", "content": "Dados autorizados para a tarefa"}
  ],
  "reasoning": {"effort": "high"},
  "max_output_tokens": 8192,
  "store": false
}
```

Não encaminhar `models`, `provider.max_price`, `reasoning.exclude` nem `max_tokens` da OpenRouter ao Zen. Normalizar a resposta percorrendo `output` do tipo `message` e seus conteúdos `output_text`; não pressupor `choices[0].message.content`. `store: false` não é garantia de ausência de retenção pelo provedor; conferir a política da modalidade Contributor antes de enviar dados de clientes. No teste de conexão, usar apenas texto sintético.

Dividir o prazo global de 45 segundos: até 25 segundos para OpenRouter e até 20 segundos para OpenCode, sempre limitando a segunda tentativa ao tempo restante. Uma falha de autenticação encerra tentativas no provedor afetado e registra aviso administrativo; ainda permite tentar o outro provedor com sua chave independente. Erros de rede, indisponibilidade, limite de cota e resposta inválida também podem acionar o fallback. Erros comuns de payload `400`/`422` devem ser corrigidos, sem repetição automática entre provedores.

Esta seção substitui a política anterior de usar imediatamente o modo local após falha na OpenRouter: primeiro tentar OpenCode se houver prazo, credencial e modelo elegível. Manter no máximo duas chamadas de provedor por tarefa, sem retry adicional que exceda esse orçamento. Em falha de ambos, preservar o resultado local identificado.

O campo `freeOnly` continua sendo política interna a implementar. Para Zen, cruzar a lista permitida com o catálogo, tabela de preços vigente e capacidades declaradas; não inferir preço apenas pelo nome. Se preço ou HIGH não puderem ser confirmados, desabilitar essa opção e seguir para o modo local. Nunca substituir o identificador gratuito pela versão paga.

Adicionar à etapa de testes: falha da OpenRouter seguida de sucesso Zen; chave Zen ausente; falha dos dois; normalização de Responses; prazo global; e garantia de que cada chave é enviada somente ao host do respectivo provedor. Registrar provedor e modelo efetivamente usados.

Fontes: [OpenCode Zen — endpoints e preços](https://opencode.ai/docs/zen), [catálogo Zen](https://opencode.ai/zen/v1/models) e [Models.dev — capacidades](https://models.dev/api.json).
