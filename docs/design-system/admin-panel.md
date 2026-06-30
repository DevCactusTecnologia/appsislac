# Design System — Painel Admin do Laboratório (SISLAC)

> Documento canônico do design system aplicado ao painel administrativo do laboratório (rotas `/dashboard`, `/atendimentos`, `/pacientes`, `/resultados`, `/financeiro`, `/configuracoes`, etc.).
> Princípio: **Lovable Minimalist SaaS** — superfícies planas, tipografia Inter, paleta monocromática com acento Indigo `#4D41F3`, sem gradientes/sombras agressivas, sem ornamentos.

---

## 1. Princípios

1. **Plano antes de profundidade.** Sombras só como elevação funcional (`shadow-soft`, `shadow-hover`); nunca decorativas.
2. **Tokens semânticos sempre.** Nunca usar `text-white`, `bg-black`, `bg-[#xxx]` em componentes — apenas tokens definidos em `src/index.css`.
3. **Densidade calma.** Espaçamento generoso (`py-6 sm:py-8`), respiração entre blocos, listas leves.
4. **Reatividade silenciosa.** Animações apenas de entrada (`fade-in`, `fade-in-up`, `scale-in`). Diálogos e popovers **sem animação** (regra de performance).
5. **Estado é o conteúdo.** Badges de status são planos, altura fixa `h-9`, cor semântica do token `--status-*`.
6. **Mobile-aware, desktop-first.** Tabelas no desktop, grids no tablet, cards compactos no mobile.

---

## 2. Tokens de cor (HSL, definidos em `src/index.css`)

Todas as cores são HSL e expostas via Tailwind (`tailwind.config.ts`).

### 2.1 Superfícies e texto

| Token              | Valor (light)   | Uso                                       |
| ------------------ | --------------- | ----------------------------------------- |
| `--background`     | `220 20% 98%`   | Fundo geral da aplicação                  |
| `--foreground`     | `230 25% 11%`   | Texto primário                            |
| `--card`           | `0 0% 100%`     | Cards, painéis, dialogs                   |
| `--card-foreground`| `230 25% 12%`   | Texto sobre cards                         |
| `--surface`        | `220 25% 98%`   | Superfície 1 (dashboard, hero)            |
| `--surface-2`      | `220 20% 96%`   | Superfície 2 (subseções)                  |
| `--muted`          | `220 16% 95%`   | Fundo de chips, inputs, skeletons         |
| `--muted-foreground`| `220 9% 46%`   | Texto secundário, descrições              |
| `--border`         | `220 14% 92%`   | Bordas hairline                           |
| `--input`          | `220 14% 92%`   | Borda de inputs                           |
| `--ring`           | `244 88% 60%`   | Anel de foco                              |

### 2.2 Marca

| Token                  | Valor          | Uso                                  |
| ---------------------- | -------------- | ------------------------------------ |
| `--primary`            | `244 88% 60%`  | Indigo `#4D41F3` — CTA, links, foco  |
| `--primary-foreground` | `0 0% 100%`    | Texto sobre primary                  |
| `--secondary`          | `152 55% 42%`  | Verde institucional (confirmação)    |
| `--accent`             | `244 70% 96%`  | Hover sutil em itens primários       |

### 2.3 Status (semânticos — usar SEMPRE em badges/alerts)

| Token                          | Texto             | Fundo                  |
| ------------------------------ | ----------------- | ---------------------- |
| `status-success` / `-bg`       | `152 55% 42%`     | `152 40% 95%`          |
| `status-warning` / `-bg`       | `38 92% 50%`      | `42 100% 95%`          |
| `status-danger` / `-bg`        | `0 72% 51%`       | `0 70% 96%`            |
| `status-pending` / `-bg`       | `38 92% 50%`      | `42 100% 95%`          |
| `status-info` / `-bg`          | `210 90% 55%`     | `210 50% 95%`          |
| `status-neutral` / `-bg`       | `220 10% 52%`     | `220 10% 95%`          |
| `status-purple` / `-bg`        | `270 65% 58%`     | `270 50% 95%`          |
| `status-teal` / `-bg`          | `175 55% 42%`     | `175 40% 95%`          |

Especial: **Recém-nascido (≤365 dias)** — `--age-newborn-foreground/-surface/-border` (azul `200 85% 38%`).

### 2.4 Sidebar (escura)

| Token                      | Valor          |
| -------------------------- | -------------- |
| `--sidebar-background`     | `230 25% 11%`  |
| `--sidebar-foreground`     | `220 15% 62%`  |
| `--sidebar-primary`        | `244 88% 60%`  |
| `--sidebar-accent`         | `230 20% 16%`  |
| `--sidebar-accent-foreground` | `0 0% 96%`  |

### 2.5 Gráficos (Recharts)

`--chart-1` indigo · `--chart-2` verde · `--chart-3` azul · `--chart-4` âmbar · `--chart-5` vermelho. **Nunca** passar hex direto para `<Cell />` — sempre `hsl(var(--chart-N))`.

---

## 3. Tipografia

- **Família padrão:** Inter (`font-sans`), 400/500/600/700/800.
- **Opt-in:** `font-display` (Sora) e `font-body` (Manrope) — usadas só em superfícies redesenhadas (ex.: `.financeiro-shell`).
- **Soroteca 2.0:** Space Grotesk + DM Sans (escopo isolado).

### Escala

| Uso                | Classe Tailwind                                    |
| ------------------ | -------------------------------------------------- |
| H1 página          | `text-2xl sm:text-3xl font-bold tracking-tight`    |
| H2 seção           | `text-lg sm:text-xl font-semibold`                 |
| H3 card            | `text-base font-semibold`                          |
| Body               | `text-sm`                                          |
| Descrição          | `text-sm text-muted-foreground/80`                 |
| Eyebrow            | `text-[9px] font-bold uppercase tracking-[0.2em]`  |
| Numérico tabular   | `tabular-nums` (`font-feature-settings: "tnum" 1`) |

---

## 4. Layout

### 4.1 Container de página

Use sempre `PageContainer` (`src/components/shared/PageContainer.tsx`):

```tsx
<PageContainer size="7xl">
  <PageHeader title="Atendimentos" description="..." actions={<Button>...</Button>} />
  {/* conteúdo */}
</PageContainer>
```

- `max-w-7xl` padrão · padding `px-4 sm:px-6 lg:px-8 py-6 sm:py-8`
- Animação `animate-fade-in` na montagem
- **Nunca** envolva a página com `key={location.pathname}` (causa remount — regra de performance)

### 4.2 PageHeader

`src/components/superadmin/PageHeader.tsx` (reexportado em `@/components/shared/PageHeader`):

- Eyebrow opcional (chip de contexto)
- Título tight, descrição `max-w-2xl`
- Ações alinhadas à direita, `gap-3`, `shrink-0`

### 4.3 Grid responsivo

| Breakpoint | Faixa     | Padrão                       |
| ---------- | --------- | ---------------------------- |
| Mobile     | `<640px`  | 1 coluna, cards compactos    |
| Tablet     | `640–1024`| 2 colunas, grid              |
| Desktop    | `>1024`   | tabelas / 3–4 colunas        |

Use `.no-scrollbar` quando houver scroll horizontal em chips/filtros.

---

## 5. Radius, sombras e elevação

- **Radius base:** `--radius: 0.75rem` → `rounded-lg` (8px). Pílulas: `rounded-full`.
- **Sombras:**
  - `shadow-elevation-xs/sm/md/lg` — utilitárias finas.
  - `shadow-soft` — padrão de card.
  - `shadow-hover` — hover de card tátil (`.card-tactile`).
- **Card tátil:** `.card-tactile` (translateY(-2px) + `shadow-hover` no hover).

---

## 6. Componentes (shadcn customizados)

Local: `src/components/ui/*`. Sempre customizados via variantes — nunca sobrescritos com classes ad-hoc.

### 6.1 Button

- Variantes: `default` (primary), `secondary`, `outline`, `ghost`, `destructive`, `link`.
- Tamanhos: `sm`, `default`, `lg`, `icon`.
- CTA principal: `<Button>` com ícone Lucide à esquerda (`mr-2 h-4 w-4`).

### 6.2 Dialog (flat)

Regra: **diálogos planos com backdrop blur de 6px**, sem animação interna.

- `DialogContent` usa `rounded-lg`, borda hairline, `shadow-soft`.
- Footer com ações: principal à direita, secundária à esquerda.
- Sem `motion.*` dentro de dialogs.

### 6.3 Badge / Status

- Altura fixa `h-9` em chips de status operacionais.
- Cor via token `status-*` (`bg-status-success-bg text-status-success`).
- Sem gradiente, sem borda colorida.

### 6.4 Input / Select / Combobox

- Borda `border-input`, foco `ring-2 ring-ring ring-offset-2`.
- Busca: search-as-you-type, debounce 300ms, normalização NFD.

### 6.5 Table

- Cabeçalho `text-xs uppercase tracking-wide text-muted-foreground`.
- Linhas com `hover:bg-muted/40`.
- Colunas numéricas: `text-right tabular-nums`.

### 6.6 EmptyState

`src/components/configuracoes/_shared/EmptyState.tsx` — ícone Lucide leve em chip `bg-muted/40 rounded-2xl`, título `text-sm font-semibold`, descrição `text-xs text-muted-foreground`.

### 6.7 Skeleton

`.skeleton-shimmer` — shimmer 1.4s no token `--muted`. Use `PageSkeleton` para placeholders de página inteira.

---

## 7. Iconografia

- Biblioteca única: **lucide-react**.
- Tamanhos padrão: `h-4 w-4` (botões/inline), `h-5 w-5` (headers de card), `h-6 w-6` (empty states).
- Sem cor própria por padrão: herda `currentColor`. Status icon usa cor do token (`text-status-warning`).

---

## 8. Animação

| Classe                | Uso                                  |
| --------------------- | ------------------------------------ |
| `animate-fade-in`     | Páginas (apenas opacidade — sem transform residual) |
| `animate-fade-in-up`  | Listas/cards (framer-motion ou CSS)  |
| `animate-scale-in`    | Cards do dashboard                   |
| `animate-bar-in`      | Barras de gráficos                   |

**Proibido:** animação em `Dialog`, `Popover`, `DropdownMenu`, `Tooltip`. Performance > flourish.

---

## 9. Impressão (laudo / comprovante)

> Regra travada (`mem://constraints/layout-impressao-travado.md`): margens, rodapé (4mm), assinatura e CSS de impressão em `ResultadoDetalhe.tsx` **não devem ser alterados** sem pedido explícito.

- Folha A4: classe `.a4-sheet` (210×297mm, padding `22mm 20mm`, borda hairline + sombra leve).
- Stage de preview: `.a4-stage` (fundo `muted/35`, scroll vertical).
- Conteúdo editável: `.prose-mapa` (Inter, line-height 1.6, tabelas `table-layout: fixed`).
- Fonte de laudo científico: **Courier 12pt Bold** (definida no builder, não alterar).

---

## 10. Acessibilidade

- Contraste mínimo AA em todos os pares foreground/background dos tokens.
- Foco visível obrigatório: utilitário `.focus-ring` ou `focus-visible:ring-2 ring-ring ring-offset-2`.
- Labels associadas a inputs (`htmlFor` / `aria-label`).
- Diálogos: `DialogTitle` sempre presente (visualmente ou via `sr-only`).
- Hit area mínima `h-9 w-9` em ícones interativos.

---

## 11. Do / Don't

**Do**
- `bg-primary text-primary-foreground`
- `text-muted-foreground` para descrições
- `rounded-lg`, `shadow-soft`, `border-border`
- `tabular-nums` em valores monetários

**Don't**
- `text-white`, `bg-black`, `bg-[#4D41F3]`
- Sombras decorativas (`shadow-2xl` em cards estáticos)
- Gradientes no admin (exceto `--gradient-hero` em superfícies específicas)
- Animações em popovers/dialogs
- Roxo/indigo aleatório fora do token `--primary`

---

## 12. Referências de código

| Recurso         | Arquivo                                              |
| --------------- | ---------------------------------------------------- |
| Tokens          | `src/index.css`                                      |
| Tailwind config | `tailwind.config.ts`                                 |
| PageContainer   | `src/components/shared/PageContainer.tsx`            |
| PageHeader      | `src/components/superadmin/PageHeader.tsx`           |
| Empty state     | `src/components/configuracoes/_shared/EmptyState.tsx`|
| shadcn UI       | `src/components/ui/*`                                |
| Constantes      | `src/lib/constants.ts`                               |

---

**Versão:** 1.0 · **Escopo:** Painel admin do laboratório (tenant) · **Última revisão:** 2026-06-30
