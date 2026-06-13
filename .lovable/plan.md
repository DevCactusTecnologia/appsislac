## Objetivo

Aplicar o **mesmo layout, theme e design system** da aba **Laboratório** (hero com gradiente sutil + ícone em pill arredondado + título com `uppercase tracking-widest` + blocos agrupados com cabeçalhos iconográficos + footer sticky quando há salvar/descartar) às 14 abas listadas em `/configuracoes`.

## Abordagem

A grande maioria das abas (10) já consome um único componente compartilhado: `src/components/configuracoes/_shared/SectionShell.tsx`. Vou **evoluir esse shell** para o novo visual — assim **todas as abas que já o usam são atualizadas automaticamente, sem mexer no conteúdo interno**. As demais (que renderizam container próprio) recebem um wrapper equivalente.

### Etapa 1 — Upgrade do `SectionShell` (atinge 10 abas)
Reescrever apenas o **chrome visual** preservando 100% da API (props `icon`, `title`, `description`, `meta`, `actions`, `toolbar`, `banner`, `children`, `footer`, `bodyless`):

- Container externo `rounded-2xl border border-border bg-card overflow-hidden`.
- **Hero header**: faixa com `bg-gradient-to-br from-primary/5 via-card to-transparent`, ícone em pill `p-3 rounded-xl bg-primary/10 ring-1 ring-primary/20`, eyebrow `text-[11px] uppercase tracking-[0.18em] text-muted-foreground`, título `text-xl font-semibold`, descrição abaixo.
- Toolbar e banner mantêm posição, mas com paddings e tipografia alinhados.
- Footer ganha variante "sticky-like" (`bg-card/95 backdrop-blur`) quando solicitado.

Abas beneficiadas direto: **Documentos, Site público, Exames, Tabelas de Preço, Convênio, Apoio Laboratorial, Unidades/Filiais, Mapas de Trabalho, Meu acesso (AdminTab), Setores** (também usa).

### Etapa 2 — Retrofit das abas sem `SectionShell` (4 abas)
Envolver o conteúdo dessas abas no novo `SectionShell` (sem reescrever lógica/CRUDs/dialogs):

- **FormasPagamentoTab.tsx**
- **FornecedoresTab.tsx**
- **IntegracoesApoioTab.tsx**
- **GatewayPagamentoTab.tsx**
- **NotificacoesTab.tsx** (hoje só placeholder de 12 linhas — vira um hero "Em breve").

Cada uma recebe ícone Lucide adequado (Wallet, Truck, PlugZap, CreditCard, BellRing) + título + descrição curta. Nenhuma feature, RLS, query ou handler é alterado.

### Garantias

- **Sem mudanças funcionais**: somente layout/estilização.
- **Sem mudanças em rotas, boot, deps ou contextos globais** (respeita a regra do projeto).
- **Aba Laboratório intocada** — ela já está no padrão alvo e serve de referência.
- Mobile/tablet/desktop continuam funcionando (breakpoints atuais preservados).

## Arquivos modificados

```text
src/components/configuracoes/_shared/SectionShell.tsx   (reescrita visual)
src/components/configuracoes/FormasPagamentoTab.tsx     (wrap)
src/components/configuracoes/FornecedoresTab.tsx        (wrap)
src/components/configuracoes/IntegracoesApoioTab.tsx    (wrap)
src/components/configuracoes/GatewayPagamentoTab.tsx    (wrap)
src/components/configuracoes/NotificacoesTab.tsx        (wrap)
```

## Confirmação

Posso prosseguir com essa abordagem (evoluir o `SectionShell` + 5 wrappers), ou prefere que eu faça **redesign profundo página-a-página** dos 14 tabs (muito maior, ~9.500 linhas, alto risco de regressão)?