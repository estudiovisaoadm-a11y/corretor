# Pedido de Conexão — NetImóveis (V4.2)

> Data de elaboração: 04/09/2026.
> Nenhum dado de cliente neste documento — apenas placeholders `[NOME]`, `[CPF/CNPJ]`, `[TELEFONE]`, `[URL_DO_FEED]`.

---

## 1. Veredito: por onde conectar

| Direção | Canal | Status |
|---|---|---|
| **Leitura (portal → nós)** | **API oficial WCF** — `GET /api/imovel/lista` com `?apiKey=` em `https://wcfservices.netimoveis.com` | ✅ Existe, documentada, já implementada em `src/integracoes/api/netimoveis-wcf.js`. Falta só a `apiKey`. |
| **Publicação (nós → portal)** | **Integração oficial do portal** — doc em `https://docs.redenetimoveis.com/integracao-portal-netimoveis`, painel em `https://painel.netimoveis.com/` | ⏳ Exige homologação/cadastro como anunciante ou parceiro. |
| **Leads (portal → nosso funil)** | Nosso webhook `POST /webhook/leads/netimoveis` | ✅ Já implementado (`src/leads.js`). Formato do callback a alinhar. |

**Evidência técnica da API (Swagger oficial, conferido em 04/09/2026):**
- Leitura: ~18 operações `Imovel_Get*` (`Imovel_Get_listaimoveisauxiliar`, `Imovel_GetImoveis`, `Imovel_GetImoveisSemelhantes`, `Imovel_GetDestaquesImoveisAgencia`, `Imovel_GetImovelVideos`, `Imovel_Get_Foto360`, `Imovel_GetUrlImovel`, `Imovel_GetretornarImovelMapaMobile`...). A usada por nós: `GET /api/imovel/lista` com query obrigatórias `apiKey, quantidadeRegistro (4–50), pagina, transacao, estado, cidade` + filtros opcionais (`bairro, tipo, valorMinimo/Maximo, quartos, suites, areaMinima/Maxima, agenciaId...`).
- Os únicos `POST` da API são de **favoritos/retorno de visita** (`/api/imovel/favoritos`, `imovelId+Ip+clienteId`) — **não há POST de anúncio**. Ou seja: publicar estoque exige o canal oficial do portal (doc de integração), não a WCF.

**Canais oficiais de contato (verificados):** `suporte@netimoveis.com`, Central `0800 333 3232` (seg–sex 8h–18h), formulário em `https://www.netimoveis.com/contato-cliente/` (perfil "Parceiro"/"Imobiliária"), associação em `https://www.netimoveis.com/faca-parte` (exige CRECI PJ + 2 anos de atuação).

---

## 2. O que solicitamos

1. **`apiKey` da API WCF** para leitura oficial (`GET /api/imovel/lista`, DF/Brasília, venda + locação) — alimenta nosso score com dado oficial em vez de fetch.
2. **Homologação como integrador/anunciante** conforme `https://docs.redenetimoveis.com/integracao-portal-netimoveis` (acesso ao `https://painel.netimoveis.com/`), para publicar nosso estoque qualificado.
3. **Alinhamento do retorno de leads**: formato do callback do portal → nosso `POST /webhook/leads/netimoveis` (JSON com `codigo` do anúncio + dados do interessado + timestamp).

---

## 3. Anexo técnico

### 3.1. Leitura WCF (já consome, falta a chave)

```
GET https://wcfservices.netimoveis.com/api/imovel/lista
  ?apiKey=[API_KEY]
  &quantidadeRegistro=10&pagina=1&transacao=venda
  &estado=distrito-federal&cidade=brasilia
Headers: Accept: application/json (+ Authorization: Bearer [API_KEY])
```

Resposta: array `Site_ViewListarImoveisApi` (`Imovel_Id, ValorImovel, AreaRealPrivativa/AreaConstruida/AreaLote, NomeBairro, NomeCidade, SiglaEstado, Descricao, Quartos, Suites, Banho, VagaGaragem, FlagFinanciamento, FlagHabites, TipoImovel1...`). Nosso normalizador (`normalizar()` em `src/integracoes/api/netimoveis-wcf.js`) converte cada item para `analisar()` — só usa documento/financiamento quando há flag ou menção na descrição (nunca inventa).

### 3.2. Publicação (nosso lado, a homologar)

- `GET /feed/xml` (HTTPS, token por query/header a combinar): XML de estoque, só imóveis com status ≠ `descartado/vendido/alugado/retirado`; `codigo` estável para deduplicação; baixa = sai do XML na leitura seguinte.
- URL canônica a informar: `[URL_DO_FEED]`.

### 3.3. Webhook de leads (nosso lado, pronto)

- `POST /webhook/leads/netimoveis` → funil como `novo` com origem `netimoveis` + distribuição automática ao corretor de plantão. Payload exato a alinhar.

---

## 4. Rascunho de e-mail pronto para `suporte@netimoveis.com`

> Preencher `[...]` antes de enviar. Não enviar com valores fictícios.

```
Para: suporte@netimoveis.com
Assunto: Solicitação de apiKey WCF + homologação como integrador — CRM [NOME DA EMPRESA]

Prezados,

Somos um CRM com IA de análise para corretores e imobiliárias do DF e
gostaríamos de nos conectar oficialmente à NetImóveis em duas frentes:

1. LEITURA — apiKey da API WCF (GET /api/imovel/lista) para consumo
   oficial de estoque (DF/Brasília, venda e locação). Nosso conector já
   está implementado contra o Swagger em
   https://wcfservices.netimoveis.com/docs/; falta apenas a chave.

2. PUBLICAÇÃO — homologação como integrador/anunciante conforme a doc
   em https://docs.redenetimoveis.com/integracao-portal-netimoveis
   (acesso ao painel + formato esperado de carga do estoque). Nosso feed:
   - [URL_DO_FEED]
   - Somente imóveis disponíveis; baixas saem do feed automaticamente.
   - Anúncios exclusivamente com CRECI ativo do responsável.

3. LEADS — alinhar o formato do callback de leads do portal para o nosso
   webhook (recebemos em tempo real e distribuímos ao corretor).

Responsável pela integração:
- Nome: [NOME]
- CPF/CNPJ: [CPF/CNPJ]
- CRECI PJ: [CRECI] (2+ anos de atuação, conforme regra de associação)
- Telefone/WhatsApp: [TELEFONE]
- E-mail técnico: [EMAIL]

Pedimos, por gentileza:
1. Emissão da apiKey WCF (ambiente + limites de uso);
2. Procedimento de homologação/publicação e tabela de campos obrigatórios;
3. Formato do callback de leads;
4. Contato técnico para ajustes durante a homologação.

Ficamos à disposição. Obrigado!

Atenciosamente,
[NOME] — [EMPRESA] — [TELEFONE]
```

**Alternativo:** formulário `https://www.netimoveis.com/contato-cliente/` (Eu sou: Parceiro) ou Central `0800 333 3232`.

---

## 5. Checklist — nosso lado

- [x] Conector WCF implementado (`src/integracoes/api/netimoveis-wcf.js`, teste mock OK; live sem chave retorna 401 + `{error}` gracioso).
- [x] `GET /feed/xml` + `POST /webhook/leads/netimoveis` implementados e testados.
- [ ] Obter `NETIMOVEIS_API_KEY` e configurar em produção (`.env`, nunca no código).
- [ ] Definir domínio público + HTTPS + token do feed (preencher `[URL_DO_FEED]`).
- [ ] Preencher dados reais do responsável + CRECI PJ válido.
- [ ] Piloto: 2–5 imóveis publicados, validar leitura WCF + recebimento de lead.

## 6. Riscos e condições

1. **A chave WCF pode exigir vínculo comercial** (associação/anunciante: CRECI PJ + 2 anos). Sem chave, a leitura segue via fetch público + parser (`src/integracoes/netimoveis.js`) — a homologação destrava dado oficial + publicação.
2. **A WCF não publica anúncios** (só favoritos/visita via POST) — não insistir nessa rota para publicação; usar o canal da doc oficial.
3. **Campos obrigatórios do portal prevalecem** sobre nosso XML — reservar 1 ciclo de ajuste pós-retorno do suporte.

---

## Fontes (pesquisa 04/09/2026)

1. **Swagger WCF oficial** — UI `https://wcfservices.netimoveis.com/docs/`, JSON `https://wcfservices.netimoveis.com/swagger/api-docs/Imovel` (operações `Imovel_Get*` + `Imovel_Post` de favoritos/retorno).
2. **Doc oficial de integração** — link "Documentação de Integração" no login do painel: `https://docs.redenetimoveis.com/integracao-portal-netimoveis` (painel: `https://painel.netimoveis.com/`).
3. **Contato oficial** — `https://www.netimoveis.com/contato-cliente/` (`suporte@netimoveis.com`, `0800 333 3232`, seg–sex 8h–18h).
4. **Associação** — `https://www.netimoveis.com/faca-parte` (CRECI PJ + 2 anos; fone/WhatsApp `(31) 97177-4370`).
