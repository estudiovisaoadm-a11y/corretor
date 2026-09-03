# Design System — IA Imóveis (auditoria + proposta)

Data: 03/09/2026 · Escopo: `public/index.html` (painel) + ficha WhatsApp (texto)

## 1. Diagnóstico do estado atual

Base real auditada: 1 bloco `<style>` com ~10 regras + estilos inline (`style="width:100%"`, `height:320px`) e 2 classes dinâmicas (`.pill`, `.cfg`).

**Forças**
- Layout simples e funcional: header + cards + grid 2 col que colapsa no mobile (`@media 800px`).
- Contraste do header ok (branco sobre `#111827`).
- Hierarquia básica existe (h3 por seção, tabela no histórico).

**Problemas (por impacto)**
1. **Sem tokens:** cores, raios e espaçamentos repetidos como literais (`#111827`, `#eee`, `#f4f4f5`, `10px`, `6px`). Mudar a identidade = caçar strings.
2. **Estilos inline no HTML:** `width:100%`, `width:55%/25%`, `height:320px` misturam estrutura e estilo; quebram fácil no mobile.
3. **Score sem linguagem visual:** o dado mais importante (0-100) aparece como número puro, sem cor por faixa. O corretor decide pelo número, não pelo significado.
4. **Botões sem estados:** sem `:hover`, `:focus-visible`, `:disabled`. Sem foco visível = falha de acessibilidade (WCAG 2.4.7).
5. **Tabelas densas:** sem zebra/hover, fonte 13px, sem sticky header — com 50+ análises vira parede de texto.
6. **Feedback de loading fraco:** só o monitor mostra "rodando..."; análise/comparador travam a UI sem indicar progresso.
7. **Mapa fora da identidade:** Leaflet com pin/cores padrão; legenda da cor (verde→vermelho) só existe no código, não na tela.
8. **Tipografia sem escala:** tudo `system-ui` tamanho default; h3, corpo e tabelas sem hierarquia definida.
9. **Ficha WhatsApp:** usa `*negrito*` e texto corrido — ok pro canal, mas sem padrão de ordem dos campos entre ficha do painel e do bot.

## 2. Princípios

1. **O score manda:** toda decisão visual prioriza leitura instantânea do veredito (cor + palavra, nunca só número).
2. **Zero dependência:** CSS vanilla com variáveis — nada de framework, mesma filosofia do backend.
3. **Mobile do corretor:** alvos ≥44px, tabelas com scroll horizontal, mapa funcional em tela pequena.
4. **Confiança documental:** risco de documentação sempre em vermelho/âmbar explícito, nunca em cinza neutro.

## 3. Tokens

### 3.1. Cores
```css
:root {
  /* Marca (derivado do atual #111827) */
  --brand-900: #0b1220;
  --brand-800: #111827;
  --brand-600: #1f2a44;
  --accent-500: #c9a227; /* dourado imobiliário — CTAs secundários, selos */

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
  --st-descartado: #9ca3af;

  /* Superfície e texto */
  --bg: #f4f4f5;
  --surface: #ffffff;
  --border: #e5e7eb;
  --text: #111827;
  --text-muted: #6b7280;
}
```

### 3.2. Tipografia (system-ui, com escala)
`--fs-display: 28px` (score grande) · `--fs-h: 17px` · `--fs-body: 15px` · `--fs-small: 13px` · `--fs-caption: 12px`. Peso 700 só em score, veredito e valores R$.

### 3.3. Espaçamento, raio, sombra
Escala 4pt (`--sp-1:4px … --sp-6:24px`) · `--radius-card:12px`, `--radius-pill:999px` · sombra de card `0 1px 3px rgb(0 0 0 / .08)`.

## 4. Componentes

| Componente | Regra |
|---|---|
| `btn-primary` | fundo brand, hover escurece 10%, focus com anel de 2px, disabled 50% opacidade |
| `btn-ghost` / `btn-danger` | ações secundárias (legenda) e destrutivas (remover watch) |
| `score-badge` | pílula grande com cor da faixa + veredito em texto; **sempre os dois juntos** |
| `status-pill` | cor do estágio (tabela §3.1); "descartado" usa cinza tracejado |
| `table` | zebra sutil, hover na linha, header sticky, scroll-x no mobile |
| `input/select/textarea` | borda `--border`, foco com anel brand, erro com borda vermelha + mensagem |
| `alert-doc` | bloco âmbar/vermelho com ícone para risco documental — nunca texto cinza |
| `map-legend` | legenda visível no mapa (verde ≤8k, âmbar ≤10k, vermelho >10k) |
| `skeleton` | placeholder pulsante em análise/comparador/monitor durante fetch |

## 5. Mapeamento dado → visual (contrato)

- Score → `score-otimo/bom/regular/risco` pela mesma função do `score.js` (frontend e backend compartilham as faixas 80/60/40).
- `precisa_confirmar` não vazio → `alert-doc` âmbar listando os itens.
- Selo `Imóvel Seguro` → selo dourado `accent-500`.
- Mapa: mesma rampa do `mapaCarregar` (red >10k, orange >8k, green demais) + legenda em tela.

## 6. Acessibilidade (mínimo)

- Contraste ≥4.5:1 em texto; pares validados: branco/`#111827`, branco/`#15803d`, branco/`#b91c1c`, `#111827`/`#f4f4f5`.
- `:focus-visible` em todo interativo; alvos de toque ≥44px; respeitar `prefers-reduced-motion` (desliga pulse do skeleton).

## 7. Plano de implementação

- [x] 1. `public/styles.css` com tokens (§3) + componentes (§4); `<style>` e inlines trocados por classes.
- [x] 2. `score-badge` em histórico, comparador e ficha (painel); ficha do bot segue mesma ordem de campos (§5).
- [x] 3. `alert-doc`, `map-legend` e `skeleton` nos fluxos com loading; erros visíveis em vez de falha silenciosa.
- [x] 4. Revisão de contraste (todos os pares ≥4.5:1; ajustes: `--text-muted` → `#68707d`, `--st-descartado` → `#6a6f77`, `score-badge small` opacidade 1) + navegação por teclado (Enter analisa, `:focus-visible` em tudo, alvos ≥44px) + `lang="pt-BR"` + empty states + `confirm()` ao excluir watchlist.

Fora de escopo: dark mode, troca de fonte, framework CSS.
