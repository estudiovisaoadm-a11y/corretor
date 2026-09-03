# Design System — IA Imóveis (Horizon Premium)

Data: 03/09/2026 · Escopo: `public/index.html` (painel) + ficha WhatsApp (texto)

## 1. Identidade Visual

Inspirado no design "Horizon Real Estate" — tom marrom escuro profundo com branco/creme e acentos dourados. Sensação premium, confiança e elegância.

**Palavras-chave:** premium, quente, confiável, sofisticado.

## 2. Princípios

1. **O score manda:** toda decisão visual prioriza leitura instantânea do veredito (cor + palavra, nunca só número).
2. **Zero dependência:** CSS vanilla com variáveis — nada de framework, mesma filosofia do backend.
3. **Mobile do corretor:** alvos ≥44px, tabelas com scroll horizontal, mapa funcional em tela pequena.
4. **Confiança documental:** risco de documentação sempre em vermelho/âmbar explícito, nunca em cinza neutro.
5. **Premium sem peso:** glassmorphism e gradientes sutis que comunicam qualidade sem prejudicar performance.

## 3. Tokens

### 3.1. Cores
```css
:root {
  /* Marca — escala marrom profundo */
  --brand-950: #120C07;
  --brand-900: #1A120B;
  --brand-800: #2D1F14;
  --brand-700: #3F2E1E;
  --brand-600: #5C4330;
  --accent-500: #C49A3C;  /* dourado — CTAs, selos, acentos */
  --accent-400: #D4AD52;  /* dourado claro — gradientes */
  --accent-600: #A47F2E;  /* dourado escuro — bordas de CTA */

  /* Score / veredito (única fonte de verdade p/ cor) */
  --score-otimo: #15803d;   /* 80-100 */
  --score-bom: #1d4ed8;     /* 60-79 */
  --score-regular: #b45309; /* 40-59 */
  --score-risco: #b91c1c;   /* 0-39 + trava documental */

  /* Funil CRM (1 cor por estágio) */
  --st-novo: #6b7280;
  --st-analisado: #1d4ed8;
  --st-visitado: #7c3aed;
  --st-proposta: #b45309;
  --st-fechado: #15803d;
  --st-descartado: #6a6f77;

  /* Superfície e texto */
  --bg: #F8F4ED;             /* fundo geral creme suave */
  --surface: #ffffff;
  --surface-warm: #FBF8F3;   /* fundo alternado tabelas/cards */
  --border: #E8DDD0;
  --border-light: #F0E8DC;
  --text: #1A120B;           /* texto principal */
  --text-secondary: #3F2E1E; /* subtítulos */
  --text-muted: #7A6B5A;     /* legendas, captions */
}
```

### 3.2. Tipografia (system-ui, com escala)
`--fs-display: 36px` (título hero) · `--fs-h: 18px` · `--fs-body: 15px` · `--fs-small: 13px` · `--fs-caption: 12px`. Peso 800 em títulos e scores, 700 em botões e valores R$.

### 3.3. Espaçamento, raio, sombra
Escala 4pt (`--sp-1:4px … --sp-8:32px`) · `--radius-card:16px`, `--radius-field:10px`, `--radius-pill:999px`.

Sombras em 3 níveis:
- `--shadow-card`: sutil, repouso
- `--shadow-card-hover`: elevação no hover
- `--shadow-elevated`: card de busca sobre hero

## 4. Componentes

| Componente | Regra |
|---|---|
| `btn-primary` (hero CTA) | gradiente dourado accent, hover escurece, shadow dourado |
| `btn-ghost` / `btn-danger` | ações secundárias (legenda) e destrutivas (remover watch) |
| `score-badge` | pílula com cor da faixa + veredito em texto; **sempre os dois juntos** |
| `status-pill` | cor do estágio (tabela §3.1); "descartado" usa cinza tracejado |
| `table` | zebra warm, hover na linha, header sticky uppercase, scroll-x no mobile |
| `input/select/textarea` | borda border, foco com anel dourado, placeholder muted |
| `alert-doc` | bloco âmbar/vermelho com borda esquerda para risco documental |
| `map-legend` | legenda visível no mapa (verde ≤8k, âmbar ≤10k, vermelho >10k) |
| `skeleton` | placeholder pulsante em tons creme durante fetch |
| `search-card` | card glassmorphism sobre o hero, elevação alta |
| `hstat` | stats glassmorphism sobre fundo escuro, backdrop-blur |
| `diff` | card de diferencial com ícone gradient e hover elevado |
| `hist-card` | card de histórico com banner gradient no topo |

## 5. Hero / Header

- Gradiente profundo: `#120C07 → #1A120B → #2D1F14 → #3A271A`
- Glow dourado em radial-gradient (accent com 28% e 15% de opacidade)
- Grid sutil 48×48px com máscara fade
- Stats com glassmorphism (blur 8px, border white/12%)
- Foto decorativa com gradiente marrom→dourado e card overlay

## 6. Mapeamento dado → visual (contrato)

- Score → `score-otimo/bom/regular/risco` pela mesma função do `score.js`.
- `precisa_confirmar` não vazio → `alert-doc` âmbar listando os itens.
- Selo `Imóvel Seguro` → selo dourado com gradiente accent.
- Mapa: mesma rampa do `mapaCarregar` (red >10k, orange >8k, green demais) + legenda em tela.

## 7. Acessibilidade (mínimo)

- Contraste ≥4.5:1 em texto; pares validados: branco/`#1A120B`, branco/`#15803d`, branco/`#b91c1c`, `#1A120B`/`#F8F4ED`.
- `:focus-visible` com anel dourado em todo interativo; alvos de toque ≥44px; respeitar `prefers-reduced-motion`.

## 8. Paleta de referência visual

| Uso | Cor | Hex |
|---|---|---|
| Hero background (mais escuro) | ████ | `#120C07` |
| Hero background (base) | ████ | `#1A120B` |
| Brand primário / botões | ████ | `#2D1F14` |
| Brand intermediário | ████ | `#3F2E1E` |
| Brand claro | ████ | `#5C4330` |
| Dourado CTA | ████ | `#C49A3C` |
| Dourado claro (gradiente) | ████ | `#D4AD52` |
| Fundo geral | ████ | `#F8F4ED` |
| Superfície (cards) | ████ | `#FFFFFF` |
| Borda | ████ | `#E8DDD0` |
| Texto principal | ████ | `#1A120B` |
| Texto muted | ████ | `#7A6B5A` |

## 9. Arquivos atualizados

- [x] `public/styles.css` — tokens + componentes completos
- [x] `public/index.html` — meta theme-color atualizado
- [x] `public/offline.html` — cores hardcoded atualizadas
- [x] `public/manifest.json` — background_color e theme_color

Fora de escopo: dark mode, troca de fonte, framework CSS.
