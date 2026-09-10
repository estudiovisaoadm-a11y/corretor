# Design System — IA Imóveis

Versão: 2.0
Atualizado em: 10/09/2026
Escopo: página pública (`/`) e painel (`/dashboard`).

## Direção

O IA Imóveis usa uma linguagem clara, precisa e operacional. A página pública apresenta o produto; o painel prioriza dados e próxima ação. Verde-petróleo representa a marca, grafite estrutura a navegação e verde-lima marca seleção sobre superfícies escuras. Fundos claros sustentam a leitura diária.

O produto não apresenta exemplos como atividade real. Scores demonstrativos, imóveis ilustrativos e previews precisam ser identificados. Informações documentais extraídas do anúncio ainda dependem de confirmação.

## Fonte de tokens

Os tokens compartilhados ficam em `public/design-tokens.css`. A landing consome `public/landing-v2.css`; o painel consome `public/dashboard-v2.css`. Os arquivos anteriores permanecem como base de compatibilidade até a migração de todos os componentes.

| Papel | Token | Valor |
|---|---|---|
| Fundo | `--ui-canvas` | `#f4f7f6` |
| Superfície | `--ui-surface` | `#ffffff` |
| Texto | `--ui-ink` | `#142b2a` |
| Texto secundário | `--ui-ink-secondary` | `#455c59` |
| Marca | `--ui-brand` | `#08786e` |
| Seleção escura | `--ui-lime` | `#c9f36b` |
| Borda | `--ui-border` | `#dbe6e3` |
| Perigo | `--ui-danger` | `#b42318` |

## Tipografia

- Interface: `Inter`, com fallback para `Segoe UI`, `Roboto`, `Helvetica`, `Arial` e `sans-serif`.
- Acento editorial: serifada do sistema somente em palavras de destaque na apresentação pública.
- Título público: 48–82 px no desktop e até 68 px no mobile.
- Título do painel: 26–36 px.
- Texto de uso: 15–17 px.
- Rótulo operacional: 11–13 px, sempre com contraste suficiente.
- Valores usam algarismos tabulares para evitar deslocamento visual.

## Estrutura

### Landing

- Cabeçalho fixo claro.
- Hero em duas colunas com CTA antes da rolagem.
- Demonstração explicitamente identificada.
- Método em três cartões.
- Seção escura para exemplos e seção clara para preview do painel.
- CTA final verde-petróleo.

### Painel

- Sidebar fixa de 236 px no desktop.
- Barra superior de 72 px.
- Conteúdo fluido com limite visual por grids internos.
- Navegação inferior no mobile.
- Visão geral com quatro indicadores, prioridades, oportunidades e atalhos.
- O hero promocional e o radar ficam fora do fluxo operacional.

## Componentes

| Componente | Regra |
|---|---|
| Botão primário | Verde-petróleo, altura mínima de 44 px e texto explícito |
| Botão secundário | Fundo branco, borda visível e ação menos dominante |
| Campo | Label real, borda de controle e anel azul no foco |
| Indicador | Rótulo, valor, significado e estado indisponível |
| Score | Número e faixa textual; a cor nunca comunica sozinha |
| Lista | Divisores discretos, ação contextual e estado vazio útil |
| Modal/drawer | Título, fechar, Escape, foco inicial e retorno ao acionador |
| Alerta | Cor semântica, ícone/rótulo e texto de resolução |

## Responsividade

- Desktop a partir de 981 px: sidebar fixa e conteúdo em grids.
- Tablet: indicadores em duas colunas e painéis empilhados.
- Mobile até 560 px: uma coluna, barra inferior, botões largos e formulários empilhados.
- Respeitar áreas seguras do dispositivo e reservar espaço para a navegação inferior.
- Rolagem horizontal somente em tabelas e comparação, nunca no documento.

## Acessibilidade

- Foco visível em links, botões e campos.
- Área de toque mínima de 44×44 px.
- Número, texto ou ícone acompanham qualquer significado dado por cor.
- Respeitar `prefers-reduced-motion`.
- Diálogos possuem nome acessível e fecham por Escape.
- Mapas e gráficos devem ter alternativa textual.

## Atualização e cache

O service worker usa o cache `ia-moveis-v5`. HTML, CSS e JavaScript seguem estratégia de rede primeiro. Endpoints `/api/*` nunca são armazenados. Uma versão visual nova deve atualizar o nome do cache e as referências versionadas dos assets na mesma alteração.

## Critérios de revisão

- A landing e o painel precisam parecer partes do mesmo produto.
- A primeira tela do painel deve mostrar dados reais ou estados vazios claros.
- Nenhuma ação principal pode exigir ID digitado quando já existe um registro selecionável.
- Nenhum exemplo público pode ser entendido como resultado real da conta.
- O site deve funcionar por teclado e nos tamanhos 390, 768, 1366 e 1440 px.
