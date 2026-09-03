# Proposta de Homologação como Integrador — DFImóveis (V4.4)

> Dossiê pronto para enviar. Data de elaboração: 03/09/2026.
> Referências de contexto: `blueprint-ia-imoveis.md` §11.1 (DFImóveis como fonte prioritária) e §14.1/§14.4/§14.5 (estratégia de virar publicador oficial via feed).
> Nenhum dado de cliente neste documento — apenas placeholders `[NOME]`, `[CPF/CNPJ]`, `[TELEFONE]`, `[URL_DO_FEED]`.

---

## (a) Apresentação — quem somos (1 parágrafo)

Somos um CRM com IA de análise para corretores e pequenas imobiliárias do Distrito Federal: recebemos um anúncio (link, print, PDF ou texto de WhatsApp) e devolvemos em ~30 segundos uma ficha padronizada de 5 pilares (preço/m², localização, financiamento, permuta, documentação) com score 0–100 e veredito explicável, além de funil de captação, médias de m² por bairro, alertas de oportunidade e geração de legenda — e, na camada de distribuição (V4), publicamos o estoque qualificado dos nossos clientes nos portais via feed XML padrão e recebemos os leads de volta via webhook direto no funil.

---

## (b) O que solicitamos

1. **Homologação do nosso CRM como integrador/publicador** no DFImóveis, nos mesmos moldes dos CRMs já listados na página de parceiros (TimiPro, inGaia, Vista, TecImob, Imobzi, AlterData, entre outros — ver Fontes).
2. **Leitura periódica da nossa URL de integração (feed XML)** pelo DFImóveis, a ser enviada para `suporte@dfimoveis.com.br` com identificação do responsável + CPF/CNPJ, conforme fluxo documentado na base AlterData.
3. **Inclusão dos nossos imóveis na fila de aprovação / lista de espera** do portal, com habilitação após aprovação de cada unidade (fluxo padrão: ícone desabilitado → aprovado/habilitado).
4. Alinhamento sobre **remoção/baixa automática** (vendido/alugado/retirado) e sobre **requisitos de qualidade e CRECI**, para operarmos em conformidade desde o dia 1.

Não solicitamos leitura de todo o mercado via API (sabemos que não há API pública de leitura do DFImóveis) — nossa análise de mercado continua via fetch dos anúncios públicos + parsers próprios; o pedido aqui é **direção CRM → portal (publicação)**, exatamente como descrito no blueprint §14.1.

---

## (c) Anexo técnico

### c.1. Formato do feed

- **Endpoint que vamos expor:** `GET /feed/xml` (HTTPS, GET público com token por query ou header, a combinar com o suporte).
  - URL canônica a informar no e-mail: `[URL_DO_FEED]` (ex.: `https://[DOMINIO]/feed/xml?token=[TOKEN]` — placeholder, sem domínio real definido neste dossiê).
- **Formato:** XML de estoque no padrão praticado pelos portais (estrutura equivalente a OpenNavent/VRSync: um elemento por imóvel com código único, tipo, transação, preço, área, endereço, descrição, URL de detalhe e lista de fotos), servido com `Content-Type: application/xml; charset=utf-8`.
- **Exemplo de estrutura (ilustrativa, nomes de tags a ajustar ao layout exigido pelo DFImóveis):**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<imoveis>
  <imovel>
    <codigo>DF-000123</codigo>
    <tipo>apartamento</tipo>
    <transacao>venda</transacao>
    <preco>550000</preco>
    <area_privativa_m2>70</area_privativa_m2>
    <quartos>3</quartos>
    <bairro>Aguas Claras</bairro>
    <cidade>Brasilia</cidade>
    <uf>DF</uf>
    <descricao>Apartamento 3 quartos, aceita financiamento e FGTS. Escritura registrada, habite-se ok.</descricao>
    <aceita_financiamento>true</aceita_financiamento>
    <aceita_permuta>false</aceita_permuta>
    <url>https://[DOMINIO]/imoveis/DF-000123</url>
    <fotos>
      <foto>https://[DOMINIO]/fotos/DF-000123-01.jpg</foto>
    </fotos>
    <creci_responsavel>[CRECI]</creci_responsavel>
    <atualizado_em>2026-09-03T12:00:00-03:00</atualizado_em>
    <status>disponivel</status>
  </imovel>
</imoveis>
```

### c.2. Frequência de atualização

- Geração dinâmica a cada requisição (sempre reflete o estado atual da base) + regeneração programada no nosso monitor diário (rodada 1x/dia, padrão já usado no `src/monitor.js`).
- Frequência de leitura pelo portal: conforme grade do DFImóveis (por analogia ao padrão de mercado documentado para integrações AlterData → portais, com janelas periódicas ao longo do dia e propagação em até 24h — a grade exata do DFImóveis será confirmada com o suporte).
- Cada item carrega `atualizado_em`; `codigo` é estável por imóvel para permitir deduplicação/atualização no portal.

### c.3. Campos enviados

| Campo | Origem no nosso modelo | Observação |
|---|---|---|
| `codigo` | `imovel.id` | estável, único por imóvel |
| `tipo` | `imovel` (apartamento/casa/sala etc., inferido também da URL padrão DFImóveis) | vocabulário a mapear para a tabela do portal |
| `transacao` | venda / aluguel | inferido da URL (`/venda/...`, `/aluguel/...`) |
| `preco` | `preco` | numérico, em R$ |
| `area_privativa_m2` | `area` | base do cálculo R$/m² |
| `bairro`, `cidade`, `uf` | `bairro`, `cidade` (+ lat/lng quando houver) | foco DF + Entorno |
| `descricao` | descrição + sinais extraídos (financiamento/permuta/documentação) | sem inventar documento: ausente = omitido |
| `aceita_financiamento`, `aceita_permuta` | booleanos da ficha | |
| `url` | link canônico do imóvel no nosso CRM | |
| `fotos` | lista de URLs HTTPS públicas | |
| `creci_responsavel` | CRECI do anunciante | só anunciamos com CRECI ativo |
| `atualizado_em`, `status` | controle interno | `disponivel` no feed; baixas saem do feed (ver c.4) |

### c.4. Como tratamos baixa de vendido / alugado / retirado

- **Regra dura:** o feed publica **somente** imóveis com status interno diferente de `descartado`/`vendido`/`alugado`/`retirado` (espelho do filtro previsto na V4.1: "estoque com status ≠ descartado").
- Quando um imóvel é vendido, alugado ou retirado pelo corretor (status movido para `fechado`/`descartado` no funil `novo/analisado/visitado/proposta/fechado/descartado`), ele **deixa de aparecer no XML na próxima leitura**, sinalizando remoção ao portal.
- Remoção pontual sob demanda pelo mesmo mecanismo (equivalente ao "Remover" documentado no fluxo AlterData → DFImóveis).
- Nunca republicamos unidade baixada sem reativação explícita do corretor + revalidação de CRECI/documentação mínima.

### c.5. Webhook de leads (lado CRM, informação complementar)

- Vamos expor `POST /webhook/leads/:portal` para receber leads do portal em tempo real, com origem marcada (`dfimoveis`) caindo direto no funil — fecha o ROI por portal. Formato exato do payload a alinhar com o DFImóveis (JSON com identificação do anúncio via `codigo`, dados do interessado e timestamp).

---

## (d) Rascunho de e-mail pronto para `suporte@dfimoveis.com.br`

> Assunto, corpo e placeholders abaixo. Preencher `[...]` antes de enviar. Não enviar com valores fictícios.

```
Para: suporte@dfimoveis.com.br
Assunto: Solicitação de homologação como integrador — URL de feed XML do CRM [NOME DA EMPRESA]

Prezados,

Somos um CRM com IA de análise para corretores e imobiliárias do DF e
gostaríamos de nos homologar como integrador/publicador no DFImóveis,
nos mesmos moldes dos CRMs parceiros listados em
https://www.dfimoveis.com.br/parceiros.

Responsável pela integração:
- Nome: [NOME]
- CPF/CNPJ: [CPF/CNPJ]
- Telefone/WhatsApp: [TELEFONE]
- E-mail de contato técnico: [EMAIL]

URL de integração (feed XML do nosso estoque):
- [URL_DO_FEED]

Sobre o feed:
- Formato XML padrão de portais (codigo, tipo, transacao, preco, area,
  bairro, cidade, descricao, url, fotos, atualizado_em), servido em
  GET HTTPS com atualização dinâmica + revisão diária.
- Publicamos somente imóveis disponíveis (status diferente de
  vendido/alugado/retirado/descartado); baixas saem do XML na leitura
  seguinte para remoção no portal.
- Anunciamos exclusivamente por corretores/imobiliárias com CRECI ativo,
  com CRECI do responsável informado por anúncio.

Pedimos, por gentileza:
1. Confirmação de recebimento e do formato esperado do XML
   (exemplo/layout oficial ou tabela de equivalências tipo/transação);
2. Periodicidade de leitura e prazo médio da lista de espera/aprovação;
3. Procedimento de homologação e de remoção/baixa de unidades;
4. Contato técnico para ajustes durante a homologação.

Ficamos à disposição. Obrigado!

Atenciosamente,
[NOME] — [EMPRESA] — [TELEFONE]
```

**Cc sugerido (opcional):** `comercial@dfimoveis.com.br` — canal comercial listado em https://www.dfimoveis.com.br/fale-conosco.

---

## (e) Checklist de pré-requisitos — nosso lado

### Já temos pronto ✅

- [x] Motor de análise + score 0–100 e ficha de 5 pilares (`src/ia/extraction.js`, `src/scoring/score.js`, `src/ficha.js`) — garante qualidade mínima antes de publicar.
- [x] Modelo de dados do imóvel (id/código estável, título, preço, área, bairro, cidade, financiamento, permuta, escritura, habite-se, fotos, fonte, status) — cobre todos os campos do feed.
- [x] CRM leve + funil (`novo/analisado/visitado/proposta/fechado/descartado`) e `GET /api/funil` — base da regra de baixa (só disponível entra no XML).
- [x] Parsers DFImóveis/WImóveis/NetImóveis (`src/integracoes/`) + `POST /api/analisar` — leitura de mercado mantida independente da homologação.
- [x] Monitor diário, watchlist, médias por bairro, mapa, previsão (`src/monitor.js`, `GET /api/mapa`, `GET /api/valorizacao`) — sustenta a frequência de atualização do feed.
- [x] Especificação do feed e do webhook de leads definida neste dossiê + blueprint §14.4 (camada 3 — distribuição).

### Falta / a fazer antes ou durante a homologação ⏳

- [x] **V4.1 — `GET /feed/xml` IMPLEMENTADO** (`src/feed/xml.js`, testado: exclui descartados e leads, `Content-Type: application/xml`). Falta: token de acesso + URLs HTTPS públicas de fotos.
- [x] **V4.1 — `POST /webhook/leads/:portal` IMPLEMENTADO** (`src/leads.js`, testado: lead cai no funil como `novo` com origem do portal; validação 400).
- [ ] Definir domínio público + HTTPS + token do feed (preencher `[URL_DO_FEED]` real antes do envio).
- [ ] Mapear tabelas de equivalência exigidas pelo portal (tipos, subtipos, transação) assim que o suporte enviar o layout oficial.
- [ ] Garantir fotos em URLs públicas estáveis e descrição sem dados sensíveis.
- [ ] Preencher `[NOME]`, `[CPF/CNPJ]`, `[TELEFONE]`, `[EMAIL]` reais do responsável + validar CRECI ativo de cada anunciante-piloto.
- [ ] Conta/plano de anunciante com código válido no DFImóveis, se exigido (pré-requisito comercial fora do código, cf. blueprint §14.5).
- [ ] Bateria de teste: publicar 2–5 imóveis-piloto, acompanhar lista de espera/aprovação, validar remoção.

---

## (f) Riscos e condições

1. **Aprovação não é imediata — há lista de espera.** Pelo fluxo documentado (AlterData), após o envio da URL e a seleção dos imóveis, eles entram em lista de espera aguardando aprovação do portal; o anúncio só aparece habilitado após aprovação individual. Prazo a confirmar com o suporte.
2. **Formato do XML pode exigir ajustes.** Trabalhamos com o padrão de mercado, mas a tabela oficial de tipos/transação e campos obrigatórios do DFImóveis prevalece — reservar 1 ciclo de ajuste pós-retorno do suporte.
3. **Conformidade CRECI é eliminatória.** O DFImóveis publica que aceita anúncios exclusivamente de corretores/imobiliárias com CRECI ativo (FAQ da home) e reforça confiança via selos (`Imóvel Seguro`), parcerias com CRECI-DF/Sinduscon/Secovi e cartórios. Operaremos só com CRECI válido; sem CRECI, sem publicação.
4. **Qualidade documental afeta aprovação e selos.** `Imóvel Seguro` exige certidões analisadas em cartório. Nossa IA nunca inventa documento (ausente = `null + precisa_confirmar`, cf. blueprint §9/§11.4); anúncio sem escritura/habite-se carrega selo de risco interno e não deve ser forçado como "seguro".
5. **Leitura de mercado ≠ publicação.** Mesmo sem homologação, nossa análise segue funcionando via fetch público + parsers; a homologação destrava apenas a distribuição oficial (nosso estoque → DFImóveis) e eventual retorno de leads.
6. **Dependência operacional do portal.** Grade de leitura, SLA da fila de aprovação e regras de remoção são definidos pelo DFImóveis e podem mudar; manter canal aberto com `suporte@dfimoveis.com.br` (suporte técnico) e `comercial@dfimoveis.com.br`.

---

## Fontes (pesquisa 03/09/2026)

1. **Página de parceiros DFImóveis** — lista CRMs integrados (TimiPro, Allmatech, inGaia, Fantastiko, Imobex, Imobibrasil, Nido Informática, TecImob, Vista, Code 49, Imobzi, AlterData) e o texto "Conheça nossos parceiros e utilize seus sistemas de integração para o nosso portal!". Portal movido a TimiPro ("Powered By TimiPro"). URL: https://www.dfimoveis.com.br/parceiros
2. **Base de conhecimento AlterData — "Como integrar os imóveis com o portal DFimoveis"** — fluxo exato: (i) aba Integração → Configurações, copiar a URL de integração do DFImoveis e enviar para `suporte@dfimoveis.com.br` informando nome + CNPJ/CPF do responsável; (ii) Integração → Publicar Imóveis → selecionar → Integrar → DFImóveis → confirmar envio da URL → OK → imóveis vão para **lista de espera aguardando aprovação** (ícone desabilitado até aprovado; habilitado + notificação após aprovação); (iii) remoção via selecionar → Remover → OK. URL: https://ajuda.alterdata.com.br/immobilewebbase/corretagem-web-base-de-conhecimento/como-integrar-os-imoveis-com-o-portal-dfimoveis (resumo: https://ajuda.alterdata.com.br/pages/viewpage.action?pageId=253566448)
3. **Página Fale Conosco DFImóveis** — canais oficiais: Comercial `(61) 99241-2480` / `comercial@dfimoveis.com.br`; Suporte Técnico `(61) 99239-4399` e `(61) 99562-2031` / `suporte@dfimoveis.com.br`. URL: https://www.dfimoveis.com.br/fale-conosco
4. **Home DFImóveis (contexto)** — +50 mil imóveis, +3.000 corretores, FAQ declara que só anuncia com CRECI ativo e que o portal é vitrine (não imobiliária). URL: https://www.dfimoveis.com.br/
