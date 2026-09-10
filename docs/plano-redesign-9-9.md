# IA Imóveis — plano técnico de redesign completo

Data: 10/09/2026  
Base de código inspecionada: `f5abbf2`  
Status: redesign visual executado em 10/09/2026, com paleta marrom publicada no commit `f87deae`; itens estruturais de evolução permanecem registrados neste plano.
Escopo: página pública, acesso ao sistema, painel operacional, fluxos comerciais e experiência mobile.

## Progresso da execução

Concluído nesta entrega:

- nova identidade visual compartilhada por tokens, com grafite, verde-petróleo, lima e superfícies claras;
- landing page reconstruída visualmente, com proposta de valor direta, demonstrações identificadas e CTA claro;
- painel reorganizado em navegação lateral no desktop e navegação inferior no mobile;
- abertura operacional com quatro indicadores, prioridades, oportunidades, atalhos e nova análise;
- respostas do resumo tratadas com estados de carregamento, vazio e erro;
- ícone local, manifesto, página offline e versão do cache PWA atualizados;
- documentação do sistema visual e validação em navegador das rotas principais.
- paleta marrom café/espresso aplicada à marca, seleção, ícone, manifesto e tela offline, com cache `ia-moveis-v6-brown`.

Continuam como evolução estrutural, sem impedir o uso desta versão: separar o script monolítico em módulos, substituir todos os ícones legados externos, eliminar os últimos campos técnicos por seleção contextual e criar uma tela de acesso dedicada caso o produto passe a exigir autenticação antes do painel.

## 1. Resultado pretendido

Transformar a experiência visual e de uso do IA Imóveis de forma imediatamente perceptível ao abrir o site e ao entrar no painel. A direção será uma identidade clara, contemporânea e precisa: superfícies claras, tipografia bem hierarquizada, navegação lateral, dados legíveis e destaque para a próxima ação do corretor.

A meta de **9,9/10** é um objetivo de qualidade a ser avaliado, e não uma nota já obtida ou uma garantia subjetiva. A entrega deve satisfazer os critérios visuais, funcionais e técnicos da seção 17, com evidências de testes e capturas de tela.

Ao concluir o redesign, o usuário deve conseguir:

1. Entender o produto e localizar a entrada do painel na primeira tela pública.
2. Entrar com e-mail e senha sem procurar uma configuração no rodapé.
3. Identificar contatos pendentes, atrasos e oportunidades na abertura do painel.
4. Analisar um anúncio, abrir sua ficha e comparar imóveis sem copiar IDs.
5. Trabalhar pelo celular com a mesma clareza do desktop.
6. Reconhecer a atualização tanto em `/` quanto em `/dashboard`, inclusive com cache de uma versão anterior.

## 2. Diagnóstico do código atual

Diagnóstico feito pela leitura dos arquivos locais; não representa uma auditoria visual ou de desempenho do deploy atual.

| Evidência | Efeito na experiência | Decisão técnica |
|---|---|---|
| `server.js` serve `public/landing.html` em `/` e `public/index.html` em `/dashboard` | Alterar só o painel deixa a página de entrada igual | Redesenhar e validar as duas rotas separadamente |
| Landing com preto, serifas, cartões flutuantes e fotos; painel com marrom, dourado e radar animado | Duas linguagens visuais distintas | Criar tokens e componentes compartilhados |
| `public/styles.css` tem aproximadamente 2 mil linhas, regras repetidas e ajustes sobrepostos | A cascata dificulta mudanças previsíveis | Consolidar estilos por responsabilidade, substituindo regras antigas |
| Cabeçalho promocional grande dentro do painel | A operação começa abaixo de conteúdo decorativo | Adotar cabeçalho compacto, resumo e fila de prioridades |
| `loadOverview()` aproveita principalmente título, subtítulo e status do `/api/dashboard` | Dados úteis já disponíveis ficam pouco visíveis | Renderizar totais, prioridades, oportunidades, recentes e funil |
| Imóveis, preços, variações e indicadores fixos na landing e no radar | Exemplos podem parecer dados reais | Identificar demonstrações; usar dados reais somente na área autenticada |
| Login dentro de `settingsPanel` e campos de backend/API key | Entrada pouco evidente para o corretor | Criar estado de acesso na entrada do painel; conexão avançada separada |
| Campos de ID em match, follow-up e proposta | O usuário precisa manipular referências técnicas | Abrir ações pelo imóvel/contato selecionado |
| Comparador renderizado em uma área diferente do histórico | Resultado pode ficar oculto após a comparação | Exibir comparador junto da carteira e manter seleção visível |
| `window.fetch` sobrescrito globalmente; várias chamadas não verificam `response.ok` | Erros de autenticação podem parecer listas vazias ou sucesso | Centralizar requisições em cliente explícito com estados de erro |
| Inicialização carrega histórico, mapa, equipe, fila e monitor juntos | Custo desnecessário antes de usar cada área | Carregar módulos ao navegar para a área correspondente |
| Ícones PNG externos, emojis e símbolos misturados | Inconsistência de traço e dependências externas | Usar uma biblioteca visual de SVGs locais |
| `manifest.json` referencia ícones não presentes na listagem de `public` | Instalação PWA pode ficar sem identidade | Gerar os arquivos, registrar rotas e verificar respostas HTTP |
| Existe service worker `ia-moveis-v4` e URLs com versão antiga | Atualização precisa ser verificada com navegador que já visitou o site | Coordenar versão de assets e migração de cache |

**Implicação:** este trabalho exige modificar estrutura, hierarquia, navegação, conteúdo e componentes. Uma nova camada de cores acrescentada ao final do CSS não atende ao objetivo.

## 3. Direção visual: arquitetura clara, operação precisa

### 3.1 Identidade

- Preservar o nome **IA Imóveis** e o foco no trabalho do corretor.
- Usar branco mineral e cinza muito claro como base, grafite como estrutura e verde-petróleo para ação principal.
- Reservar imagens arquitetônicas para a apresentação pública e imóveis que realmente possuam fotografia.
- Usar bordas finas, alinhamentos rigorosos e sombra discreta apenas para indicar elevação.
- Remover radar decorativo, brilho contínuo, vidro desfocado em excesso, cartões inclinados e gradientes de fundo dominantes.
- Diferenciar navegação, conteúdo, seleção e alertas por função, sem depender apenas da cor.
- Não inventar outro nome de produto, depoimentos, clientes, resultados comerciais ou selo documental.

### 3.2 Tokens propostos

Criar `public/design-tokens.css` e consumi-lo em ambas as páginas. Os pares efetivamente usados devem ter contraste medido durante a implementação.

```css
:root {
  --canvas: #f5f7f8;
  --surface: #ffffff;
  --surface-subtle: #eef2f4;
  --ink: #17252d;
  --ink-secondary: #475761;
  --ink-muted: #596973;
  --border: #dce4e7;
  --field-border: #7b8c95;
  --brand: #086b62;
  --brand-hover: #07554e;
  --brand-soft: #e6f4f0;
  --success: #166534;
  --warning: #92400e;
  --danger: #b42318;
  --info: #175cd3;
  --focus: #175cd3;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --space-12: 48px;
  --space-16: 64px;
  --radius-field: 8px;
  --radius-card: 12px;
  --radius-dialog: 16px;
  --shadow-float: 0 12px 40px rgb(23 37 45 / 12%);
  --sidebar-width: 232px;
  --topbar-height: 72px;
  --content-max: 1440px;
  --z-sticky: 20;
  --z-menu: 30;
  --z-dialog: 50;
  --z-toast: 60;
}
```

- Borda decorativa e borda necessária para reconhecer um controle terão tokens distintos.
- Score manterá as faixas atuais: `>=80`, `>=60`, `>=40` e `<40`, com número e descrição. Cor visual não altera regra comercial.
- Verde do botão indica ação; verde do score terá fundo e rótulo próprios para evitar ambiguidade.
- Espaçamento segue a escala de 4 px; exceções devem ser justificadas por alinhamento óptico.
- Sem `!important` como estratégia de layout. Remover regras substituídas na mesma etapa.

### 3.3 Tipografia, ícones e imagens

| Elemento | Especificação |
|---|---|
| Fonte | Inter variável WOFF2 local, pesos 400–700, com licença incluída; fallback `system-ui, sans-serif` |
| Título da landing | `clamp(40px, 4.6vw, 64px)`, entrelinha 1.08, peso 600, no máximo 3 linhas no desktop |
| Título de página interna | 28–32 px, peso 600, entrelinha 1.2 |
| Título de seção | 18–20 px, peso 600 |
| Texto | 15–16 px, entrelinha 1.5–1.65 |
| Rótulos | 13–14 px; textos essenciais nunca em microtipografia |
| Números | `font-variant-numeric: tabular-nums`; valores e unidades alinhados |
| Ícones | SVG local, grade 24×24, traço uniforme; ícones decorativos com `aria-hidden` |
| Fotos | AVIF/WebP, `srcset`, `sizes`, largura/altura explícitas, origem e licença documentadas |

Não adicionar fotos decorativas de imóveis a registros sem fotografia: mostrar placeholder arquitetônico neutro e “Sem foto”. A foto principal da landing será ilustrativa e não aparecerá como oferta disponível.

## 4. Nova página inicial pública — `/`

### 4.1 Composição desktop

```text
┌────────────────────────────────────────────────────────────────────┐
│ IA Imóveis       Produto     Como funciona     [Entrar no painel]   │
├────────────────────────────────────────────────────────────────────┤
│ Inteligência para o corretor     │ Imagem arquitetônica             │
│                                 │                                 │
│ Seu próximo negócio começa      │ Prévia da ficha de análise        │
│ com uma decisão melhor.         │ identificada como demonstração    │
│                                 │                                 │
│ Analise anúncios, compare       │ Preço · área · score · pendências │
│ imóveis e priorize contatos.    │                                 │
│ [Acessar meu painel] [Ver produto]                                 │
├────────────────────────────────────────────────────────────────────┤
│ Análise de anúncios  /  Carteira organizada  /  Atendimento         │
├────────────────────────────────────────────────────────────────────┤
│ Produto em uso: preview real do painel novo + explicação curta      │
├────────────────────────────────────────────────────────────────────┤
│ 01 Analisar               02 Comparar               03 Atender     │
├────────────────────────────────────────────────────────────────────┤
│ O que o score mostra e o que depende de confirmação                 │
├────────────────────────────────────────────────────────────────────┤
│ [Entrar no painel]                 Rodapé simples                  │
└────────────────────────────────────────────────────────────────────┘
```

### 4.2 Regras de implementação

- Container máximo de 1280 px, margens laterais fluidas de 24–64 px.
- Cabeçalho com 72 px; hero com duas colunas, aproximadamente 52% texto e 48% visual.
- CTA principal visível antes da rolagem em 1440×900 e 390×844. No celular, texto e CTA precedem a imagem.
- Eliminar `min-height: 900px` fixo, títulos excessivamente estreitos e elementos que forcem rolagem horizontal.
- Substituir vitrines fictícias por uma demonstração identificada do produto. Não publicar dados privados do banco na landing.
- Produzir a imagem de preview a partir do painel efetivamente implementado e de fixtures de demonstração.
- Trocar “documentação verificada” por “Informações extraídas do anúncio; confirmação necessária” quando aplicável.
- Remover “ao vivo”, “24h” e variações percentuais onde não exista evidência operacional correspondente.
- Conteúdo visível sem JavaScript; efeitos de entrada não podem deixar seções invisíveis em caso de falha.
- Animações discretas de 120–200 ms; sem parallax, rolagem forçada ou animação contínua.
- `Entrar no painel` leva a `/dashboard`; `Ver produto` leva à seção de demonstração.
- Não exibir botão de cadastro, recuperação de senha ou contratação sem um fluxo funcional correspondente.

Arquivos principais: `public/landing.html`, `public/landing.css`, `public/landing.js`.

## 5. Acesso ao sistema

Criar um estado de acesso dedicado dentro de `/dashboard`, aproveitando `POST /api/auth/login` e a autenticação existente.

- Desktop: formulário de até 400 px, marca discreta, título “Entre no seu painel” e contexto visual pequeno.
- Mobile: formulário em uma coluna, labels persistentes, campos com 16 px e botão principal de largura total.
- Campos: e-mail e senha, exibir/ocultar senha, mensagem de erro associada ao campo ou ao formulário.
- Estado de envio com texto “Entrando…” e bloqueio de submissões duplicadas.
- Não disparar consultas operacionais antes de existir uma sessão candidata; um 401 invalida a sessão e mostra o acesso.
- Retomar a área de destino após o login, preservando filtros que não contenham informações sensíveis.
- Oferecer “Sair” no menu de conta, limpar credenciais e dados em memória.
- Manter configuração de backend/API key apenas em acesso avançado contextual; não exigir esses campos no uso normal.
- Não criar cadastro público nem acionar `/api/auth/bootstrap` automaticamente. Primeiro administrador é provisionamento controlado, separado deste redesign.
- Usar a autenticação atual; não introduzir Supabase Auth nem `@supabase/server` como requisito visual.

## 6. Estrutura do painel — `/dashboard`

### 6.1 Navegação

Preservar os hashes existentes para não quebrar favoritos e histórico do navegador.

| Hash | Nome apresentado | Conteúdo |
|---|---|---|
| `#inicio` | Visão geral | Prioridades, totais, oportunidades e recentes |
| `#imoveis` | Imóveis | Carteira, filtros, nova análise, ficha e comparação |
| `#crm` | Atendimento | Fila, contato, follow-up, negócios e equipe em abas internas |
| `#mercado` | Mercado | Monitor, mapa e médias por bairro |
| `#gestao` | Gestão | Métricas consolidadas e desempenho |

Configurações e conta ficam no rodapé da sidebar. Subáreas não devem gerar novas rotas de backend nesta etapa. Não adicionar item de menu sem conteúdo implementado.

### 6.2 Wireframe desktop

```text
┌──────────────┬──────────────────────────────────────────────────────┐
│ IA Imóveis   │ Visão geral                       Conta do usuário  │
│              ├──────────────────────────────────────────────────────┤
│ Visão geral  │ Sua operação, em perspectiva.        [+ Analisar]   │
│ Imóveis      │ Atualizado às 09:42                                │
│ Atendimento  ├─────────────┬────────────┬─────────────┬─────────────┤
│ Mercado      │ Imóveis     │ Pendentes  │ Em atraso   │ Oportunid.  │
│ Gestão       │ dado real   │ dado real  │ dado real   │ dado real   │
│              ├─────────────┴────────────┴─────────────┴─────────────┤
│              │ Prioridades de atendimento     │ Oportunidades    │
│              │ Nome · responsável · espera    │ Imóvel · score   │
│              │ [Abrir contato]                │ [Abrir ficha]    │
│              │                                │                  │
│              ├────────────────────────────────┴──────────────────┤
│              │ Imóveis recentes               │ Funil de leads   │
│ Configurações│ Lista compacta                 │ Etapas e totais  │
│ Conta / Sair │                                │                  │
└──────────────┴──────────────────────────────────────────────────────┘
```

- Sidebar de 232 px em fundo grafite; item selecionado com contraste, marcador e `aria-current`.
- Topbar de 72 px; área útil com padding de 24–32 px; grid interno de 12 colunas.
- Quatro indicadores resumidos; abaixo, prioridades ocupam aproximadamente 7 colunas e oportunidades 5.
- Título, resumo e primeira prioridade visíveis na primeira tela de um notebook 1366×768.
- Retirar hero promocional, faixa de diferenciais e radar decorativo do painel autenticado.
- Uma ação primária dominante por região. Menu de ações secundárias com nome acessível.
- Não adicionar gráficos de tendência sem série histórica disponível.

### 6.3 Dados da visão geral

Usar a resposta existente de `GET /api/dashboard`, produzida por `src/dashboard/index.js`:

| Dado | Componente | Regra |
|---|---|---|
| `totals.properties` | Indicador “Imóveis analisados” | Não chamar de estoque disponível sem contrato para disponibilidade |
| `totals.pending` | Indicador “Contatos pendentes” | Link para atendimento |
| `totals.overdue` | Indicador “Atendimentos em atraso” | Atenção sem animação contínua |
| `totals.opportunities` | Indicador “Oportunidades” | Link para imóveis/alertas |
| `priorities` | Fila de prioridade | Usar ordenação recebida; nome, responsável e SLA |
| `opportunities` | Lista de imóveis relevantes | Mostrar somente campos efetivamente fornecidos |
| `recent` | Histórico recente | Bairro, fonte, data, score e ação de ficha |
| `pipeline` | Funil resumido de leads | Não misturar com funil de todas as análises |
| `updatedAt` | Horário da atualização | Não rotular como streaming ou tempo real |

Os totais não podem ser calculados a partir das listas resumidas: `priorities`, `opportunities` e `recent` já têm limites diferentes. Se não houver API de filtragem correspondente, um indicador abre a área adequada sem prometer uma seleção que não está disponível.

## 7. Especificação das telas operacionais

### 7.1 Carteira de imóveis

- Cabeçalho: título, total de resultados e botão “Analisar anúncio”.
- Filtros: busca, fonte, status, financiável e documentação informada. Exibir filtros aplicados e ação “Limpar”.
- Busca com debounce de 300 ms; cancelar requisição anterior para evitar resultados fora de ordem.
- Desktop: tabela com identificação do imóvel, bairro/fonte, preço quando disponível, preço/m², score, status e ações.
- Mobile: cards de lista compactos com os mesmos dados prioritários; tabela comparativa usa rolagem interna identificada.
- Paginação no servidor com 25 registros por página; preservar contrato legado para os consumidores atuais.
- Seleção para comparação com limite de 3 imóveis e barra contextual “2 selecionados · Comparar”.
- Botão “Abrir ficha” visível; duplo clique pode ser atalho, nunca requisito.
- Sem foto: placeholder neutro. Sem preço: “Não informado”. Sem score: “Não calculado”.

### 7.2 Nova análise

- Abrir por CTA no início e na carteira, em diálogo de até 760 px; página cheia no celular.
- Alternância real entre “Link do anúncio” e “Texto do anúncio”, usando botões/abas acessíveis.
- Labels visíveis, exemplos curtos, validação de URL e informação de erro junto ao campo.
- Durante envio: “Analisando anúncio…”, preservar entrada, bloquear duplicação e permitir sair do diálogo.
- Não mostrar percentual fictício nem etapas de progresso que o servidor não informa.
- Resultado: resumo, score com motivos, preço/m², documentação informada e itens a confirmar.
- A análise atual já salva no backend: CTA de envio pode ser “Analisar e salvar”; resultado oferece “Abrir ficha”. Não adicionar um segundo salvamento.

### 7.3 Ficha de imóvel e comparação

- Ficha em drawer de 600–720 px no desktop, tela inteira no celular.
- Ordem: identificação → preço/área → score e explicação → documentação → contexto comercial → origem e data.
- Ações: comparar, gerar legenda, consultar projeção e abrir ações de proposta compatíveis com o contrato atual.
- Valorizações exibidas como estimativas, com premissas e data quando disponíveis.
- Dados documentais extraídos não recebem selo de verificação jurídica.
- Comparador permanece na área de imóveis, com cabeçalhos fixos e destaque textual para diferenças.
- IDs ficam em metadados avançados; a seleção de imóvel acompanha toda ação derivada.
- “Enviar para CRM” só pode comunicar associação/salvamento se houver operação persistida; navegação isolada terá rótulo correspondente.

### 7.4 Atendimento e negócios

- Primeiro bloco: fila por prioridade, com nome, responsável, tempo de espera e ação de abrir contato.
- Ficha do contato: dados, preferência disponível, imóveis compatíveis e tarefas de follow-up.
- Equipe em aba própria; formulário de cadastro recolhido até a ação “Adicionar corretor”.
- Match, follow-up e propostas recebem o registro selecionado; remover solicitação manual de ID do fluxo principal.
- Quadro de negócios usa somente os status aceitos pelo backend. Movimento por menu deve existir antes de implementar arrastar.
- Não prometer agenda de visitas, conversa em tempo real ou envio de WhatsApp onde o contrato atual não oferece essas ações.
- Copiar uma mensagem e enviar uma mensagem são ações distintas, com textos e confirmações diferentes.
- Proposta deve coletar os dados reais necessários; retirar nomes e CRECI de exemplo do fluxo de emissão.

### 7.5 Mercado e gestão

- Mercado: buscas monitoradas em lista, ação “Executar agora”, estado de execução e resultado; não usar “monitor ativo 24h” sem confirmação de agendamento.
- Mapa carregado somente ao abrir Mercado; executar `invalidateSize()` após tornar o container visível.
- Média por bairro sempre acompanhada da quantidade de amostras; não apresentar pequena amostra como avaliação definitiva.
- Gestão usa `/api/gestor`; métricas recebem rótulo, unidade, período e definição compatíveis com a resposta.
- Filtros temporais, variação semanal e séries históricas só serão oferecidos após suporte real dos endpoints.
- Gráficos com tabela/resumo acessível, valores explícitos e estados sem dados.

## 8. Contratos e limites da integração

| Fluxo | API atual a preservar | Trabalho no frontend |
|---|---|---|
| Acesso | `POST /api/auth/login` | Formulário, sessão expirada e logout local |
| Visão geral | `GET /api/dashboard` | Componentes reais para toda a resposta útil |
| Nova análise | `POST /api/analisar` | Formulário, envio, sucesso e falha |
| Carteira | `GET /api/historico` | Filtros, paginação e adaptação de resposta |
| Status | `POST /api/status` | Atualização confirmada pelo servidor; desfazer UI em falha |
| Comparação | `GET /api/comparar` | Seleção de 2–3 itens e resultado visível |
| Texto comercial | `POST /api/legenda` | Resultado editável/copiável com erro explícito |
| Projeção | `GET /api/valorizacao` | Premissas, unidade e contexto |
| Monitor | `/api/watchlist`, `POST /api/monitor/run` | Busca salva, execução, exclusão confirmada |
| Mercado | `/api/mapa`, `/api/medias`, `/api/alertas` | Mapa sob demanda, amostras e alertas |
| Atendimento | `/api/fila`, `/api/sla`, `/api/equipe`, `/api/match` | Seleção contextual e operações já suportadas |
| Follow-up | `/api/followup`, `/api/followup/iniciar`, `/api/followup/avancar` | Tarefas do contato selecionado |
| Gestão/propostas | `/api/gestor`, `/api/proposta`, `/api/reativacao` | Métricas, propostas e abordagens |

Antes de alterar cada consumidor, registrar amostras de resposta em fixtures de teste sem dados pessoais. O contrato da carteira deve distinguir retorno legado em array de retorno paginado com `items`, `total`, `page`, `perPage` e `totalPages` quando solicitado.

**Dependências adicionais, condicionais:** filtros de atraso no servidor, série histórica e detalhes de entidades não presentes no cache. Se necessários, implementar em tickets separados com contrato e autorização compatíveis. Não transformar ausência de endpoint em botão decorativo.

## 9. Componentes e estados obrigatórios

| Componente | Especificação | Estados mínimos |
|---|---|---|
| Button | Primário, secundário, discreto e destrutivo; altura base 44 px | Normal, hover, foco, disabled, loading |
| Field | Label, ajuda, controle e erro associados | Vazio, preenchido, inválido, disabled |
| Metric | Rótulo, valor, unidade, atualização | Carregando, valor, zero, indisponível |
| Score | Número + faixa + acesso aos motivos | Calculado, ausente, informação parcial |
| DataTable / lista | Cabeçalho, seleção, ordenação apenas quando suportada | Carregando, dados, vazio, filtrado vazio, erro |
| EmptyState | Explica o que falta e oferece uma ação útil | Primeiro uso e nenhum resultado de filtro |
| Dialog / Drawer | Título, fechar, foco contido, rolagem própria | Abrir, salvar, erro, fechar |
| Toast | Confirmações curtas, sem esconder erros de formulário | Sucesso, falha e ação quando aplicável |
| Tabs / Menu | Botões semânticos, seleção e teclado | Selecionado, foco e fechado/aberto |
| ConnectionStatus | Estado de atualização do dado | Atualizado, desatualizado, offline, erro |

Regras de conteúdo:

- `0` significa resposta válida sem registros; `—` significa desconhecido/indisponível. Não tratar ambos como vazio.
- Erro 401 conduz ao acesso; 403 explica indisponibilidade da ação; 5xx oferece nova tentativa.
- Texto de erro compreensível, sem stack trace ou credenciais.
- Skeleton deve ocupar dimensões próximas do conteúdo final para evitar salto de layout.
- Sucesso em mutação somente após confirmação HTTP válida; preservar entrada em caso de falha.
- Atualização de dados mantém contexto, rolagem e seleção quando ainda válidos.

## 10. Arquitetura de frontend proposta

Manter HTML, CSS e JavaScript nativos, servidor Node CommonJS e persistência atual. A transformação visual não depende de migração para Next.js, React ou outro provedor.

Estrutura planejada:

```text
public/
  landing.html              # Página pública
  landing.css               # Composição da landing
  landing.js                # Interações progressivas da landing
  index.html                # Shell e templates semânticos do painel
  design-tokens.css         # Cores, tipografia, dimensões e camadas
  ui.css                    # Controles e componentes compartilhados
  styles.css                # Layout e telas do painel, consolidado
  js/
    app.js                  # Inicialização e navegação
    api.js                  # Fetch explícito e tratamento de erros
    state.js                # Sessão, área, filtros, seleção e cache
    format.js               # BRL, números, datas e valores ausentes
    components/             # Dialog, drawer, toast, lista, score
    views/                  # Overview, imóveis, CRM, mercado, gestão
  assets/
    fonts/                  # Fonte local e licença
    icons/                  # SVGs locais
    images/                 # Imagens e versões responsivas
  manifest.json
  sw.js
  offline.html
```

### 10.1 JavaScript

- Usar módulos de navegador com `type="module"`; isso não altera o CommonJS do backend.
- Extrair código inline progressivamente e trocar `onclick` por listeners, com ações identificadas por `data-action`.
- Centralizar estado: `area`, `filters`, `selectedPropertyIds`, `selectedContactId`, `session` e estados por recurso.
- Recursos seguem `idle → loading → success|empty|error`; diferenciar atualização com dado antigo de primeiro carregamento.
- Criar `apiRequest()` com autenticação apenas para a origem de API configurada, leitura segura da resposta e `response.ok`.
- Não substituir `window.fetch`; impedir envio de token para origens de imagens, fontes ou links externos.
- GETs usam cancelamento, timeout e deduplicação quando pertinente. Timeout de análise precisa considerar a duração real do backend.
- POSTs não recebem retry automático: a análise já persiste registros e uma repetição pode duplicar dados.
- Utilizar `textContent` para conteúdo externo; validar protocolos `http:`/`https:` em links e evitar HTML vindo de anúncios.
- Remover dependência de variáveis globais criadas implicitamente por IDs de elementos.
- Formatar BRL e datas com `Intl`; não converter valor ausente em preço zero.
- Carregar Leaflet somente na visualização de Mercado e tratar falha da biblioteca sem quebrar o restante do painel.

### 10.2 CSS e assets no servidor

- Ordem de carregamento: tokens → UI compartilhada → estilos específicos da página.
- Componentes têm seletor próprio e variações explícitas; eliminar duplicatas antes de remover classes antigas.
- `server.js` hoje registra arquivos estáticos individualmente: acrescentar um mapa explícito dos novos assets ou um resolvedor restrito ao diretório `public`.
- Caso se use resolvedor, validar caminho final, bloquear traversal, respeitar MIME e jamais servir `.env`, `db.json`, migrations ou arquivos de `src`.
- Registrar `font/woff2`, `image/svg+xml`, `image/webp`, `image/avif`, CSS e módulos JS corretamente.
- Verificar CSP para fonte e imagens locais. Reduzir permissões de scripts inline somente após terminar a extração e testar o mapa.
- Não mudar variáveis de produção, TLS, banco ou inicialização como efeito colateral do redesign.

## 11. Responsividade

| Faixa | Navegação | Conteúdo |
|---|---|---|
| A partir de 1200 px | Sidebar 232 px | Grid 12 colunas, quatro indicadores e duas colunas principais |
| 768–1199 px | Sidebar compacta ou recolhível com labels acessíveis | Indicadores 2×2; detalhes abaixo quando necessário |
| Até 767 px | Navegação inferior: Início, Imóveis, Atendimento e Mais | Uma coluna, indicadores 2×2, fichas em tela cheia |

```text
┌─────────────────────────┐
│ IA Imóveis       Conta  │
│ Visão geral             │
│ [ + Analisar anúncio ]  │
│ Imóveis     Pendentes   │
│ Atrasos     Oportunid.  │
│                         │
│ Prioridades             │
│ Contato → Abrir         │
│ Contato → Abrir         │
│                         │
│ Oportunidades           │
│ Imóvel → Ficha          │
├─────────────────────────┤
│ Início Imóveis CRM Mais │
└─────────────────────────┘
```

- Aplicar `env(safe-area-inset-bottom)` e reservar espaço para a barra inferior.
- Usar `100dvh` com fallback para drawers e modais; considerar teclado virtual.
- Nenhum menu ou botão pode cobrir o último item da lista ou a confirmação de formulário.
- Testar 360, 390, 768, 1024, 1366 e 1440 px; usar 1920 px para verificar limite de largura.
- Verificar textos longos, zoom de 200%, nomes de bairro extensos e valores monetários grandes.
- Scroll horizontal permitido somente dentro de comparação/tabela explicitamente identificada, nunca no documento inteiro.

## 12. Acessibilidade e interação

- HTML semântico: landmarks, um título principal por tela e hierarquia coerente de subtítulos.
- Foco visível com contraste; controles comuns com área mínima de toque de 44×44 px.
- Contraste mínimo de 4,5:1 para texto normal, 3:1 para texto grande e elementos de interface relevantes.
- Botões só com ícone precisam de nome acessível; formulários precisam de labels reais.
- Diálogo move foco para dentro, contém Tab, fecha por Escape e devolve foco ao acionador; fundo fica inerte.
- Troca de área posiciona foco no título apropriado sem disparar rolagem animada obrigatória.
- `aria-live` para conclusão e erro de operações, sem anunciar cada atualização de skeleton.
- Respeitar `prefers-reduced-motion`; nenhuma informação depende de animação.
- Mapas e gráficos oferecem lista/tabela equivalente.
- Confirmar comportamento por teclado e leitor de tela, além da análise automática.

## 13. Performance e atualização visual

Metas a medir, não resultados já alcançados:

| Medida | Meta inicial |
|---|---|
| Landing — Lighthouse mobile | Performance >=90, Acessibilidade >=95, Boas práticas >=95, SEO >=95 |
| Painel — Lighthouse em cenário controlado | Performance >=90 e Acessibilidade >=95; SEO não é critério do painel autenticado |
| LCP | <=2,5 s no cenário documentado |
| CLS | <=0,1 |
| INP | <=200 ms no p75 quando houver amostra real; antes disso, registrar interações em teste |
| CSS inicial por página | <=60 KB comprimidos |
| JavaScript inicial do painel | <=120 KB comprimidos, excluindo mapa carregado sob demanda |
| Hero mobile | Imagem alvo <=220 KB; ajustar qualidade com inspeção visual |

- Documentar dispositivo, viewport, rede, dados e ambiente de cada medição; usar mediana de três execuções equivalentes.
- Imagem de hero com dimensões reservadas e prioridade adequada; imagens abaixo da dobra com lazy loading.
- Pré-carregar apenas fonte e asset principal realmente necessários; não baixar biblioteca do mapa na landing.
- Eliminar animações contínuas, filtros de blur caros e chamadas de todas as abas durante a abertura.
- Servidor mantém HTML revalidável/sem cache persistente conforme configuração; assets devem ter versão de release coerente.

### 13.1 Cache e PWA

1. Atualizar versão do service worker e referências de assets em uma única release.
2. Manter navegação/HTML, CSS e JS com atualização via rede; não cachear `/api/*` nem respostas com dados de clientes.
3. Precachear apenas arquivos públicos que existam e respondam 200.
4. Servir `offline.html` como fallback offline explícito; não apresentar a landing antiga como se fosse o painel.
5. Substituir ativação forçada durante formulários em edição por aviso de “Nova versão disponível” com atualização controlada.
6. Gerar ícones 192 e 512, conferir suas rotas e atualizar as cores do manifesto e do documento.
7. Considerar `start_url: /dashboard` para o aplicativo instalado, com acesso tratado pela sessão.
8. Testar duas situações: visitante novo e navegador com cache/service worker anterior.

O critério de deploy é mudança visível nas duas rotas sem exigir limpeza manual de cache como procedimento normal.

## 14. Plano de execução por entrega

| Etapa | Trabalho | Arquivos principais | Critério de saída |
|---|---|---|---|
| 0. Baseline | Capturas antes, inventário de telas, componentes e contratos | Evidências de QA, fixtures de teste | Desktop/mobile e fluxos atuais registrados |
| 1. Fundação | Tokens, fonte, ícones, controles e rotas estáticas seguras | `design-tokens.css`, `ui.css`, `assets/*`, `server.js` | Componentes consistentes e todos os assets com MIME correto |
| 2. Página pública | Nova composição, texto, imagens e demonstração | `landing.html`, `landing.css`, `landing.js` | `/` claramente diferente e CTA funcional em desktop/mobile |
| 3. Acesso e shell | Login, sidebar, topbar, navegação mobile e sessão | `index.html`, `styles.css`, `js/app.js`, `js/api.js`, `js/state.js` | Entrar, sair, navegar e voltar funcionam |
| 4. Visão geral | Indicadores e prioridades reais | `js/views/overview.js` | Todas as seções de `/api/dashboard` apresentadas corretamente |
| 5. Imóveis | Carteira, filtros, ficha, análise e comparador | `js/views/properties.js`, componentes | Fluxo anúncio → ficha → comparação sem ID manual |
| 6. Atendimento | Fila, contato, equipe, follow-up e proposta contextual | `js/views/crm.js`, componentes | Ações existentes preservadas e contexto mantido |
| 7. Mercado/gestão | Mapa sob demanda, médias e métricas | `js/views/market.js`, `js/views/management.js` | Estados vazios/erro e métricas sem dados inventados |
| 8. Acabamento | Teclado, responsividade, microinterações e performance | CSS, componentes, assets | Matriz de QA sem bloqueadores |
| 9. Release | Cache, PWA, revisão, commit/push e validação no Hostinger | `sw.js`, manifesto, docs e arquivos revisados | Nova versão identificada e testada no domínio real |

**Ordem obrigatória:** fundação antes de consolidar telas; shell antes de integrar áreas; release após QA. O preview da landing deve ser atualizado ao final para refletir o painel entregue.

**Divisão segura para futura execução com subagentes:** um responsável exclusivo pela landing, outro pelo painel e outro por QA somente leitura durante edição. Tokens, componentes e alterações em `server.js` ficam com um responsável de integração. Não permitir dois agentes alterando o mesmo CSS simultaneamente.

## 15. Preservação funcional e testes

### 15.1 Fluxos de aceitação

- `/` carrega, apresenta a nova identidade e leva para `/dashboard`.
- Sessão ausente, credenciais inválidas, sessão válida, expiração e logout.
- Link de anúncio válido, URL inválida, texto manual, erro de análise e tentativa duplicada.
- Filtros combinados, limpeza, nenhum resultado, paginação e busca rápida com respostas fora de ordem.
- Seleção de 2–3 imóveis, impedimento do quarto item e comparação visível.
- Abrir/fechar ficha por mouse, toque e teclado; retorno do foco ao item correto.
- Mudança de status confirmada e falha sem simular sucesso.
- Legenda, projeção, follow-up, match e proposta com a seleção correta.
- Mapa em aba inicialmente oculta e biblioteca indisponível.
- Dados vazios, parciais, extensos e API offline.
- Navegador com service worker anterior recebe a nova interface.

### 15.2 Método

- Executar `npm test` para proteger a lógica existente; os 33 testes reportados anteriormente são referência histórica, não resultado desta etapa.
- Validar sintaxe dos módulos e referências de assets; não inventar `npm run build` sem criar uma etapa de build real.
- Adicionar testes de navegador dos fluxos críticos, preferencialmente com Playwright como dependência de desenvolvimento.
- Mockar APIs com fixtures determinísticas para cobrir falhas, sessão expirada e estados extremos. Marcar fixtures como demonstração e não enviá-las à produção.
- Executar um smoke test integrado com backend e banco de teste, sem alterar clientes reais ou disparar mensagens externas.
- Rodar verificação automática de acessibilidade e complementá-la com navegação manual por teclado.
- Produzir capturas antes/depois nas mesmas rotas, tamanhos de tela e condições de dados.
- Não adicionar testes que apenas procuram classes ou repetem o CSS; verificar comportamento e resultado observável.

## 16. Entrega e publicação

- Atualizar `design-system.md` para a nova identidade, substituindo orientações contraditórias do tema anterior.
- Documentar componentes, tokens, variações, estrutura de assets e regras de conteúdo.
- Revisar diff para confirmar ausência de segredos, dados pessoais e alterações de infraestrutura não relacionadas.
- Registrar resultados dos testes e limitações conhecidas; não declarar produção validada usando somente testes locais.
- Fazer commit e push da implementação quando ela estiver concluída e verificada, conforme autorização já dada pelo usuário.
- Conferir a implantação no **Hostinger**, provedor identificado nos logs e no painel enviados. Não presumir Render, Koyeb ou Northflank como ambiente ativo.
- Verificar `/`, `/dashboard`, `/healthz` e `/readyz`, cada um com sua finalidade. HTTP 200 em `/healthz` não comprova banco conectado nem redesign publicado.
- Confirmar commit implantado, assets novos, login e primeira consulta; validar atualização em perfil de navegador que já usava o site.
- Se houver regressão crítica, reimplantar o commit anterior compatível e invalidar os assets da release problemática. O redesign não deve exigir rollback de banco.

## 17. Critério de qualidade para a meta 9,9

Rubrica de revisão proposta: atribuir nota de 0 a 10 em cada dimensão e calcular a média ponderada. A avaliação visual deve incluir o usuário; as métricas técnicas fornecem evidências, mas não substituem percepção de qualidade.

| Dimensão | Peso | Evidência necessária |
|---|---|---|
| Identidade e acabamento | 25% | Duas rotas coerentes, nova composição, tipografia consistente e comparação antes/depois |
| Clareza e produtividade | 25% | Ações principais descobertas sem ajuda; tarefas críticas sem IDs manuais |
| Integridade funcional e dos dados | 20% | Fluxos existentes funcionando, dados reais e ausência de indicadores fictícios |
| Mobile e acessibilidade | 20% | Sem cortes, teclado completo, foco correto, contraste e toque validados |
| Performance e atualização | 10% | Medições registradas e atualização funcionando com cache anterior |

Meta: média ponderada >=9,9, nenhuma dimensão abaixo de 9 e nenhum bloqueador. Se não atingir, registrar diferenças e iterar; não atribuir a nota por ter concluído uma lista de arquivos.

### Bloqueadores de entrega

- Página `/` continuar visualmente igual enquanto só `/dashboard` muda.
- Ações decorativas sem funcionamento ou mensagens de sucesso sem persistência.
- Login inacessível, credenciais expostas ou falha de autenticação tratada como lista vazia.
- Dados fictícios apresentados como atividade real da conta.
- Perda de campos, filtros ou funcionalidades já usadas.
- Conteúdo cortado no celular, foco perdido ou diálogo impossível de fechar pelo teclado.
- Imagens quebradas, fonte bloqueada, módulo JS com MIME errado ou erro não tratado no console.
- Release antiga continuar sendo servida por cache sem mecanismo de atualização funcional.

## 18. Checklist de conclusão

- [x] Página pública e painel redesenhados e inspecionados separadamente.
- [x] Tokens, componentes e documentação consolidados.
- [ ] Login visível, logout e sessão expirada funcionando.
- [x] Sidebar desktop e navegação mobile implementadas.
- [x] Visão geral utiliza os totais, prioridades e oportunidades disponíveis no endpoint atual.
- [x] Nova análise e áreas existentes preservadas durante a reorganização visual.
- [x] Estados de vazio, carregamento e erro do resumo operacional revisados.
- [x] Exemplos públicos identificados; alegações não comprovadas removidas.
- [x] Responsividade e acessibilidade estrutural inspecionadas no navegador; performance automatizada ainda requer Lighthouse.
- [x] Fontes, imagens, ícone local, manifesto e rotas estáticas novas validados.
- [x] PWA e atualização de cache versionadas e verificadas por rota.
- [x] Evidências antes/depois, testes automatizados e regressões funcionais registradas.
- [x] Commit, push e deploy do redesign confirmados no Hostinger; a última troca de paleta aguarda propagação dos assets.
- [ ] Revisão visual do usuário incorporada à avaliação final.

**Entrega deste documento:** plano técnico atualizado com o que foi executado e verificado. Permanecem pendentes o fluxo de autenticação dedicado, a modularização completa do JavaScript, a remoção de IDs técnicos dos fluxos comerciais e a medição formal de performance.
