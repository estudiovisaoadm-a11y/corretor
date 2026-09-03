# Blueprint Completo: IA Analisadora de Anúncios Imobiliários

## 1. Problema do Corretor

Hoje o corretor perde horas analisando anúncios manualmente no Zap, VivaReal, OLX, grupos de WhatsApp, planilhas. Não tem padronização para responder rápido:

> Vale a pena? Está caro? Dá pra financiar? Dá pra permutar? Tem documento ok?

## 2. Visão da Solução

Um **Bot + Painel IA** que recebe um anúncio (link, print, PDF, texto do WhatsApp) e devolve em 30s uma **Ficha de Análise Padronizada + Score 0-100 + Veredito**.

Entrada flexível -> IA extrai -> Cruza com métricas -> Alerta de riscos/oportunidades.

## 3. Usuário-alvo

Corretor autônomo / pequena imobiliária. Usa WhatsApp como principal canal. Quer filtrar captação e responder cliente/investidor mais rápido.

## 4. Ficha de Análise - 5 Pilares

### 4.1. Preço por m²

- Extrai: `preço_total / área_privativa = R$/m²`
- Compara com: média do bairro/cidade (base própria + APIs + histórico)
- Classifica: `Oportunidade / Na média / Acima / Muito acima`
- Ex: `R$ 550k / 70m² = R$ 7.857/m² | Média Jardins: R$ 8.500/m² = -7,5% -> Oportunidade`

### 4.2. Localização

Score 0-10 composto por:

- Bairro + proximidade (metro, escola, hospital, comércio)
- Valorização histórica (últimos 12-24m)
- Perfil: residencial, comercial, risco de enchente/violência
- Fonte: Google Maps API + base interna de bairros + avaliação IA

### 4.3. Financiamento

Detecta: `aceita financiamento? FGTS? Minha Casa Minha Vida?`

- Se SIM: estima entrada + parcela (tabela SAC/Price, juros 10-11% a.a.)
- Se NÃO: alerta: `só à vista = reduz público em ~70%`
- IA pergunta faltante: `valor de avaliação da Caixa costuma ser X% menor?`

### 4.4. Permuta

Detecta: `aceita permuta? parcial? por carro/terreno/outro imóvel?`

- Classifica: total / parcial / com torna / não aceita
- Relevância: ótimo para giro de estoque e investidor

### 4.5. Documentação - Crítico

Checklist binário:

- [ ] Escritura registrada?
- [ ] Habite-se?
- [ ] IPTU quitado / valor?
- [ ] Matrícula atualizada?
- [ ] Condomínio sem débitos / sem ação judicial?
- [ ] Inventário / usufruto / alienação?

> Sem Habite-se + Escritura = **não financia**. IA deve travar score e colocar selo vermelho `RISCO DOCUMENTAL`.

## 5. Score Final - Fórmula MVP

Sugestão inicial simples e explicável:

```
Score = (Preço/m² 30%) + (Localização 25%) + (Documentação 25%) + (Financiamento 10%) + (Permuta 10%)
```

- 80-100: `ÓTIMA OPORTUNIDADE` - captar/agendar agora
- 60-79: `BOM, NEGOCIÁVEL` - pedir desconto / ajustar
- 40-59: `REGULAR` - só se tiver condição especial
- 0-39: `DESCARTAR / ALTO RISCO`

Sempre mostrar **motivo**: não só nota, ex: `-20pts: sem escritura`.

## 6. Como o Bot vai funcionar - Fluxo

**Canal 1 - WhatsApp (prioridade):**

1. Corretor encaminha link/foto/texto
2. Bot responde: `Analisando...`
3. Em 30s devolve ficha resumida + PDF completo
4. Botões: `[Ver Detalhes] [Comparar] [Gerar proposta p/ cliente]`

**Canal 2 - Painel Web:**

Dashboard com lista, filtros: `só financiáveis, só com escritura, m² < 8k, score >70`, mapa de calor por bairro.

## 7. Arquitetura Técnica Proposta para `/sistema`

```
sistema/
  /frontend -> Painel Next.js + Tailwind
  /backend -> Node + Postgres (anúncios, análises, médias m²)
  /bot -> WhatsApp via Evolution API / Twilio
  /ia -> Orquestrador: GPT/Muse para extração + regras para cálculo
  /integracoes -> Zap/VivaReal scraping, Google Maps, Caixa simulador
```

MVP pode ser **sem scraping automático**: corretor cola, IA faz resto. V2 automatiza monitoramento.

## 8. Modelo de Dados Mínimo

`imovel`: id, titulo, link, preco, area, preco_m2, bairro, cidade, lat/lng, aceita_financiamento[bool], aceita_permuta[bool], tipo_permuta, tem_escritura, tem_habite_se, matricula_ok, iptu_valor, score, veredito, fonte, criado_em

`media_bairro`: bairro, preco_m2_medio, amostra_qtd, atualizado_em

## 9. Prompt Base da IA (extração)

> Você é analista imobiliário. Extraia do texto abaixo JSON com: preco, area_m2, bairro, aceita_financiamento, aceita_permuta, tem_escritura, tem_habite_se. Se não informado, marque `null` + `precisa_confirmar:true`. Depois gere resumo de riscos em 3 bullets.

Isso garante que nunca invente documento - se não achar, pede confirmação.

## 10. Roadmap

**MVP 2-3 semanas:**
Colar anúncio -> Ficha + Score + PDF WhatsApp

**V2:**
Comparador lado-a-lado, histórico de preço/m² por bairro, alerta diário `novo abaixo da média`, gerador de legenda persuasiva pro cliente.

**V3:**
CRM leve, funil captação, previsão de valorização.

## 11. Fontes Oficiais para Análise

Foco inicial: **Distrito Federal**. 3 portais validados em 03/09/2026.

### 11.1. DFImóveis - https://www.dfimoveis.com.br
**Por que é prioridade:** líder no DF, +50 mil imóveis, 100% focado em Brasília e entorno. Só anuncia com CRECI ativo = base mais limpa.

Pontos-chave mapeados:
- Filtros prontos: `Aceita Permuta`, `Ver no Mapa`, `Busca Inteligente com IA` (linguagem natural: "Apartamento 3 quartos em Águas Claras até 400 mil")
- Selos que a IA deve extrair como sinal de qualidade/documentação:
  - `Imóvel Seguro` = certidões essenciais analisadas em cartório, sem impedimentos (`/venda/df/todos/imoveis?imovelseguro=true`)
  - `Imóvel Assinado`, `Mansão Suspensa`, `Super-Destaque`
- Parceiros cartório (Allan Guerra, Sobradinho) + Sinduscon/Secovi/CRECI-DF = âncora de confiança pra documentação
- Padrão de URL: `/venda/df/brasilia/asa-sul/sala`, `/venda/df/aguas-claras/sul/apartamento`, `/aluguel/...` - ótimo pra inferir cidade/bairro/tipo por regex sem nem abrir a página

O que extrair: preço, área, bairro/cidade (da URL), selos, descrição (financiamento/permuta/Habite-se/escritura), imobiliária/CRECI.

### 11.2. WImóveis - https://www.wimoveis.com.br
**Por que é prioridade:** parte do Grupo QuintoAndar + Imovelweb/Navent, 25 anos. Cobre DF + Goiás + MT + MS. Ideal pra expansão Entorno.

Pontos-chave mapeados:
- Estrutura: `/venda/imoveis/df/brasilia`, `/venda/apartamentos/df/brasilia/asa-norte`, `/aluguel/...`, `/temporada/...`
- Filtros via query: `?bedroom=3,3`, `?propertyType=2`, `sort=most_lowered_price` (oportunidade!), `sort=more_recent`, `sort=most_visit`
- Serviços embutidos que viram diferencial da nossa IA:
  - `Precificador` (/precificador) - pra validar R$/m²
  - `Crédito imobiliário` (/financas...) - pra simular financiamento
  - `Leilão`, `Lançamentos`, `Seguro fiança`
- Cobertura forte por bairro: Asa Norte/Sul, Lago Norte/Sul, Sudoeste, Noroeste, Park Sul/Way, Jardim Botânico, Águas Claras, Taguatinga, Guará, etc.

O que extrair: preço + histórico de queda (sort most_lowered_price = alerta oportunidade), quartos, tipo, bairro, textos sobre financiamento/garantia.

### 11.3. NetImóveis - https://www.netimoveis.com/
**Por que é prioridade:** +100 mil imóveis únicos, maior rede de imobiliárias do Brasil. Tem DF + nacional. Melhor estrutura técnica pra scraping.

Pontos-chave mapeados:
- Padrão SEO: `/venda/distrito-federal/brasilia/apartamento?tipo=apartamento&localizacao=BR-DF-brasilia---&transacao=venda`
- Mesmo padrão pra `/locacao/...` e `/lancamento?...` - parser único resolve tudo
- Tem JSON-LD `schema.org/RealEstateAgent + WebSite + ItemList` no HTML = extração robusta sem quebrar com layout
- Filtros: `?maisOpcoes=varanda`, `aceitaanimais`, `soldamanhanosquartos`, `?precoMax=2000` - mostra que aceita query de características, dá pra adaptar pra `permuta/financiamento`
- Blog ativo com dados de mercado (reforma tributária, compactos, valorização) = fonte pra contextualizar análise de localização

O que extrair: JSON-LD + HTML, tipo/transação/localização da URL, preço/área da página, descrição completa pra IA.

### 11.4. Estratégia de Coleta MVP (sem quebrar ToS)

1. **Fase 1 - Manual (semana 1):** corretor cola link dos 3 portais no WhatsApp/painel -> backend faz fetch da URL + extrai + IA gera ficha. Zero risco, valida valor.
2. **Fase 2 - Monitorada:** lista de URLs de busca salvas por bairro (ex: DFImóveis Águas Claras até 400k, WImóveis most_lowered_price, NetImóveis BR-DF) rodando 1x/dia via cron, respeitando robots.txt + delay 3-5s + user-agent identificado.
3. **Regras de normalização:** tabela `fonte` = `dfimoveis|wimoveis|netimoveis`, deduplicação por `titulo+preco+area+bairro` (mesmo imóvel anunciado nos 3), `media_bairro` calculada separada por fonte + consolidada.
4. **Mapeamento pros 5 pilares:**
   - `m²`: todos têm preço + área -> cálculo direto + compara com média do bairro na nossa base
   - `localização`: bairro da URL + complemento Google Maps
   - `financiamento`: buscar termos `financiável, FGTS, MCMV, crédito` + selo Imóvel Seguro (DF) + simulador WImóveis
   - `permuta`: filtro `Aceita Permuta` (DF) + busca textual `aceita permuta, troca, torna` nos 3
   - `documentação`: selo Imóvel Seguro (DF) = forte positivo; nos demais, IA marca `null + precisa_confirmar` se não achar `escritura/habite-se/matrícula/IPTU` - nunca inventar.

> Próximo passo: implementar `integracoes/dfimoveis.ts`, `wimoveis.ts`, `netimoveis.ts` com parser de URL + extrator JSON-LD/texto + normalizador comum pro score.

## 12. Status da Implantação (atualizado em 03/09/2026)

MVP, V2, V3, V4 e V5 completamente implementados em Node 20, zero dependências obrigatórias, 100% testados:

- [x] Parsers dos 3 portais (`src/integracoes/`) + detecção de fonte e selos
- [x] Extração heurística 5 pilares (`src/ia/extraction.js`) + prompt p/ LLM
- [x] Score + ficha (`src/scoring/score.js`, `src/ficha.js`)
- [x] API `POST /api/analisar` com auto-fetch da página e salvamento
- [x] Bot WhatsApp via Evolution API (`src/bot/` + `POST /webhook/evolution`, `README-bot.md`, `docker-compose.evolution.yml`)
- [x] Histórico persistido (`src/store.js` → `db.json`; com suporte opcional a Postgres)
- [x] Comparador lado-a-lado (`GET /api/comparar?ids=`)
- [x] Gerador de legenda (`POST /api/legenda`)
- [x] CRM leve: status `novo/analisado/visitado/proposta/fechado/descartado` + funil (`GET /api/funil`)
- [x] Médias m² por bairro (`GET /api/medias`) + alertas abaixo da média (`GET /api/alertas`)
- [x] Painel web em `GET /` completo (Hero Horizon, filtros, histórico, comparador, funil, mapa, métricas de gestão, follow-up, proposta digital e reativação)
- [x] V3 completa: Postgres opcional, monitor diário com watchlist, mapa de calor Leaflet e previsão de valorização 12m
- [x] V4 completa: Feed XML portais, webhook de leads e conectores NetImóveis WCF e Navent Open
- [x] V5 completa: Distribuição + SLA, Lead scoring (0-100), Match lead×imóvel, Follow-up automático, Bot 24/7, PWA offline, Dashboard gestor, Proposta digital e Reativação de base fria

Rodar: `node server.js` → http://localhost:3000 | demo: `node demo.js` | suíte de testes: `node test-*.js`

## 13. V3 Implantada (03/09/2026)

- [x] Postgres opcional: `migrate.sql` + `src/db/` (usa `DATABASE_URL` quando existe, senão `db.json`; pacote `pg` já instalado)
- [x] Monitor diário: `src/monitor.js` + `node check-monitor.js` (watchlist com 3 buscas seed, dedupe 24h, snapshot das médias a cada rodada; testado: 2 novas na 1ª rodada, 0 na 2ª)
- [x] Watchlist CRUD: `GET/POST/DELETE /api/watchlist` + `POST /api/monitor/run`
- [x] Mapa de calor: `GET /api/mapa` (bairro + média + lat/lng) + Leaflet no painel com fallback em tabela
- [x] Previsão de valorização 12m: `GET /api/valorizacao?id=` (score + tendência dos snapshots + risco documental, com aviso de estimativa)
- [x] Painel: seções Monitor, Mapa e botão de previsão na área de legenda; `.env.example` com `DATABASE_URL`

## 14. Evolução via APIs Oficiais (pesquisa 03/09/2026)

Verificação honesta da premissa "todas as fontes têm API": **existe superfície oficial nas 3, mas com direções e acessos diferentes**. Nenhuma oferece leitura livre de todo o mercado — o modelo é B2B (anunciante/integrador credenciado). Estratégia correta: 3 camadas.

### 14.1. DFImóveis — sem API pública de leitura
- O que existe: página de parceiros com CRMs integrados (TimiPro, inGaia, Vista, TecImob, Imobzi, AlterData...) e fluxo documentado onde o CRM gera **URL de integração** e envia para `suporte@dfimoveis.com.br` (direção CRM → portal, para **publicar**).
- Ou seja: dá para virar **publicador oficial** (nosso estoque → DFImóveis), mas leitura de mercado continua via fetch + JSON-LD + parsers (já implementado em `src/integracoes/`).
- Contato comercial: `suporte@dfimoveis.com.br` informando responsável + CPF/CNPJ; aprovação em lista de espera.

### 14.2. WImóveis/Navent (QuintoAndar) — OpenNavent API real
- Docs vivas em `http://api-br.open.navent.com/` (OpenNavent API RealEstate) + SDK de referência em PHP (`mrprompt/imovelweb-sdk`, token + `production|sandbox`).
- Painel do anunciante aceita **integração de anúncios via XML ou API** ("Desenvolvedor Próprio") e **integração de leads** (callbacks para o CRM).
- Caminho: solicitar credencial de integrador (exige plano/código de anunciante); usar para dados oficiais do próprio portfólio + recebimento de leads em tempo real.

### 14.3. NetImóveis — WCF read API real
- Swagger vivo em `https://wcfservices.netimoveis.com/docs/` com operações de leitura (`Imovel_Get...`, filtros por estado/cidade, paginação `quantidadeRegistro` 4–50). É a **melhor candidata a leitura oficial**.
- Caminho: solicitar acesso/parceria e mapear `Imovel_Get` → nosso normalizador (mesmo formato da ficha/score, zero mudança no resto).

### 14.4. Arquitetura-alvo (3 camadas)
1. **Leitura de mercado (mantém):** fetch + JSON-LD + parsers por portal — cobre 100% dos anúncios visíveis, sem credencial.
2. **Conectores oficiais (novo `src/integracoes/api/`):** clientes `netimoveis-wcf.js` e `navent-open.js` com slots de credencial via env (`NETIMOVEIS_API_*`, `NAVENT_TOKEN`), reaproveitando `analisar()`/`calcScore()` — dado oficial entra pelo mesmo funil de score.
3. **Distribuição (inversão do fluxo):** nosso CRM vira fonte — feed XML OUT padrão portais (formato OpenNavent/VRSync servido em `/feed/xml`) para publicar estoque como "Desenvolvedor Próprio" + webhook IN de leads (`POST /webhook/leads/:portal`) caindo direto no funil com origem marcada (fecha o ROI por portal).

### 14.5. Roadmap V4 proposto
- [x] V4.1: `GET /feed/xml` (estoque com status ≠ descartado no formato portal) + `POST /webhook/leads/:portal` → funil (testado: feed 200 com 4 imóveis, lead cria `novo` no funil, 400 em payload inválido).
- [x] V4.2: conector NetImóveis WCF (`src/integracoes/api/netimoveis-wcf.js`, endpoint real `GET /api/imovel/lista`, teste mock: 76 BOM / 39 DESCARTAR; live sem chave retorna 401 + `{error}` gracioso). Falta: `NETIMOVEIS_API_KEY` da Rede NetImóveis.
- [x] V4.3: conector Navent Open (`src/integracoes/api/navent-open.js`, Bearer + sandbox/production + detalhar, teste mock: 65 BOM / 53 REGULAR; sem token retorna `{error}`). Falta: `NAVENT_TOKEN` (client_credentials) + `NAVENT_IMOBILIARIA` + callback de leads.
- [x] V4.4: dossiê comercial DFImóveis (`docs/proposta-dfimoveis.md`, e-mail pronto p/ `suporte@dfimoveis.com.br`). Falta: preencher placeholders + conta anunciante + piloto 2–5 imóveis.

## 15. Benchmark de mercado + evolução V5 (pesquisa 03/09/2026)

Fontes: comparativos BR 2026 (Kenlo, Vista/Loft, Jetimob, PipeRun, inGaia, ImobTotal, Tecimob) + mercado global (Lofty, Rechat, Shilo, Fello, Revaluate).

### 15.1. Onde estamos vs. mercado

| Dimensão | Mercado | Nós |
|---|---|---|
| Score do **imóvel/anúncio** (m², doc, permuta, financiamento) | Ninguém entrega — diferencial nosso | ✅ Core pronto (`src/scoring/score.js`) |
| Score do **lead** (prob. fechamento, estilo Kenlo LIA 250 vars) | Padrão 2026 | ✅ Pronto (`src/scoring/lead-score.js`, fila quente) |
| Distribuição automática (rodízio, SLA <5min) | PipeRun, CRMs maduros | ✅ Pronto (`src/distribuicao/`, equipe + SLA) |
| Follow-up automatizado (sequências, tarefas) | Padrão | ✅ Pronto (`src/followup/`, QUENTE/MORNO/FRIO) |
| Match lead × imóvel | Colibex/Roomy, CRMs | ✅ Pronto (`src/match/`, tolerância ±30% + bairro) |
| WhatsApp conversacional 24/7 p/ cliente final | Gap até nos grandes (só bot de disparo) | ✅ Pronto (`src/bot247/`, horário BRT + intents) |
| AVM/precificador com explainability | WImóveis precificador; AVMs globais 2,4% erro mediano | ✅ Heurística c/ motivos + previsão 12m |
| Proposta/contrato digital | Kenlo/Vista | ✅ Pronto (`src/proposta/`, gerador + validador) |
| App mobile / corretor em campo | Jetimob mobile-first | ✅ PWA pronto (`manifest.json` + `sw.js` cache-first) |
| Dashboard gestor (tempo resposta, conversão/corretor/portal) | Padrão | ✅ Pronto (`src/gestor/`, velocity + conversões) |
| Reativação de base | Fello/Revaluate | ✅ Pronto (`src/reativacao/`, fit automático >14d) |
| Cadastro express | Voz (ImobTotal), link (nós) | ✅ Link/texto com extração 5 pilares |

### 15.2. Backlog V5 (Status da Entrega)
- [x] **E1 — Distribuição + SLA:** rodízio de corretores, notificação WhatsApp ao responsável, watchdog de SLA (lead >X min sem atendimento → re-rota + alerta). Módulo `src/distribuicao/`.
- [x] **E2 — Lead scoring:** probabilidade de fechamento por lead (origem, engajamento, fit com estoque) + fila "ligar primeiro". Não confundir com nosso score do imóvel — os dois se somam.
- [x] **E3 — Match lead × imóvel:** cruza perfil do lead com estoque + alertas abaixo da média; envio automático de compatíveis.
- [x] **E4 — Follow-up automático:** sequências por estágio, tarefas com vencimento, lembretes WhatsApp.
- [x] **E5 — Atendimento 24/7:** bot que apresenta ficha ao cliente final e agenda visita com contextualização de horário comercial BRT.
- [x] **E6 — PWA campo:** manifest + instalação + service worker com cache-first e tela offline dedicada.
- [x] **E7 — Dashboard gestor:** tempo de resposta, conversão por corretor/portal, velocity do funil.
- [x] **E8 — Proposta digital:** gerar proposta a partir da ficha com cálculo de comissão e validações documentais.
- [x] **E9 — Reativação de base:** varredura periódica de leads frios (>14 dias) com fit automático de novos imóveis cadastrados.

Posicionamento: o mercado faz **lead-score**; nós fazemos **deal-score**. V5 completou o ciclo integrando ambos.
- Pré-requisitos comerciais (fora do código): plano de anunciante com código válido em cada portal; sem isso, a camada de extração via URL/texto já entrega todo o valor operacional.

## 16. Roadmap V6 (Próximos Passos de Escala)

| Prioridade | Feature | Descrição | Impacto |
|---|---|---|---|
| **P0** | **Credenciais Oficiais de Portais** | Inserção de `NETIMOVEIS_API_KEY` e `NAVENT_TOKEN` em produção | Leitura direta sem requisições web externas |
| **P1** | **LLM na Extração** | Chamada opcional de modelo de linguagem (GPT/Claude) para descrições não padronizadas | Redução de `precisa_confirmar` em anúncios informais |
| **P1** | **Migração Postgres em Produção** | Ativação do pool `src/db/postgres.js` via `DATABASE_URL` no Render | Concorrência ilimitada, integridade relacional |
| **P2** | **Gráficos no Dashboard Gestor** | Visualização interativa no frontend das métricas de conversão e resposta | Gestão ágil de equipe |
| **P2** | **OCR & Análise de Imagem** | Reconhecimento de print de anúncio/cartaz via upload | Entrada sem precisar digitar link |
| **P3** | **Áudio WhatsApp (Transcriber)** | Extrair dados de imóveis a partir de áudios enviados pelos corretores | Agilidade máxima no WhatsApp |

