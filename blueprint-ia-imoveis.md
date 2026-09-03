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

MVP + V2-major implementados em Node 20, zero dependências, tudo testado localmente:

- [x] Parsers dos 3 portais (`src/integracoes/`) + detecção de fonte e selos
- [x] Extração heurística 5 pilares (`src/ia/extraction.js`) + prompt p/ LLM
- [x] Score + ficha (`src/scoring/score.js`, `src/ficha.js`)
- [x] API `POST /api/analisar` com auto-fetch da página e salvamento
- [x] Bot WhatsApp via Evolution API (`src/bot/` + `POST /webhook/evolution`, `README-bot.md`, `docker-compose.evolution.yml`)
- [x] Histórico persistido (`src/store.js` → `db.json`; migra p/ Postgres na V3)
- [x] Comparador lado-a-lado (`GET /api/comparar?ids=`)
- [x] Gerador de legenda (`POST /api/legenda`)
- [x] CRM leve: status `novo/analisado/visitado/proposta/fechado/descartado` + funil (`GET /api/funil`)
- [x] Médias m² por bairro (`GET /api/medias`) + alertas abaixo da média (`GET /api/alertas`)
- [x] Painel web em `GET /` (nova análise, filtros, histórico, comparador, funil, médias, alertas, legenda)

Rodar: `node server.js` → http://localhost:3000 | demo: `node demo.js` | teste bot: `node test-webhook.js`

Pendente V3: Postgres, monitoramento automático diário (cron), mapa de calor, previsão de valorização.

## 13. V3 Implantada (03/09/2026)

- [x] Postgres opcional: `migrate.sql` + `src/db/` (usa `DATABASE_URL` quando existe, senão `db.json`; pacote `pg` já instalado)
- [x] Monitor diário: `src/monitor.js` + `node check-monitor.js` (watchlist com 3 buscas seed, dedupe 24h, snapshot das médias a cada rodada; testado: 2 novas na 1ª rodada, 0 na 2ª)
- [x] Watchlist CRUD: `GET/POST/DELETE /api/watchlist` + `POST /api/monitor/run`
- [x] Mapa de calor: `GET /api/mapa` (bairro + média + lat/lng) + Leaflet no painel com fallback em tabela
- [x] Previsão de valorização 12m: `GET /api/valorizacao?id=` (score + tendência dos snapshots + risco documental, com aviso de estimativa)
- [x] Painel: seções Monitor, Mapa e botão de previsão na área de legenda; `.env.example` com `DATABASE_URL`
