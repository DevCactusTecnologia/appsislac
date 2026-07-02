# 09 — Directory Cohesion

Avaliação da coesão dos diretórios: os arquivos internos convergem para um mesmo propósito?

## Matriz de coesão

| Diretório | Coesão | Evidência |
| --------- | ------ | --------- |
| `src/runtime/` | Máxima | 1 arquivo, 1 responsabilidade (facade db). |
| `src/contexts/` | Alta | 3 arquivos, cada um um Provider React distinto. |
| `src/domains/**/services/` | Alta | Cada `services/` contém funções puras do próprio domínio. |
| `src/data/` | Alta | Convenção `*Store.ts` uniforme; único subdirectory (`atendimentoStore/`) por necessidade de tamanho. |
| `src/hooks/` | Alta | Cada arquivo expõe hook único e nomeado. |
| `src/integrations/contracts/` | Alta | Todos os arquivos definem contratos entre app ↔ providers. |
| `src/integrations/providers/hermes-pardini/` | Alta | Estrutura interna espelhada (dto/mocks/parsers/transports/xml/ui). |
| `src/integrations/providers/dbsync/` | Alta | Mesmo padrão. |
| `src/integrations/supabase/` | Alta | Client + types auto-gerados. |
| `src/pages/` | Alta na raiz | Uma rota por arquivo. Subpastas (`NovoAtendimento/`, `ResultadoDetalhe/`, `Financeiro/`, `superadmin/`, `admin/`, `producao/`) reforçam a coesão. |
| `src/components/ui/` | Máxima | shadcn primitivos, um por arquivo. |
| `src/components/configuracoes/` | Alta | 42 arquivos organizados por Tab/Dialog/Panel do módulo Configurações. |
| `src/components/soroteca/` | Alta | Todos referenciados pelas telas Soroteca. |
| `src/components/superadmin/` | Alta | Todos referenciados nas telas do super admin. |
| `src/components/financeiro/` | Alta | Todos referenciados por telas financeiras. |
| `src/components/mapa/` | Alta | Constants + autocomplete + preview + date picker. |
| `src/components/tenant-site/` | Alta | Landing + shell + blocks. |
| `src/components/*` (subdiretórios menores) | Alta | Escopo claro por pasta. |
| `src/components/` (raiz) | Média | Concentra dialogs/panels compartilhados por múltiplos módulos. Justificado pelo caráter transversal, porém sem subagrupamento. |
| `src/lib/` (raiz) | Média | Utilitários de vários temas (print, PDF, mapas, formatters, integrações) convivem no mesmo nível. Subpastas (`integration/`, `pricing/`, `tenantSite/`, `whatsapp/`) mostram tentativa de sub-agrupamento apenas parcial. |
| `src/lib/pricing/` | Máxima | 1 arquivo, escopo único. |
| `src/lib/integration/` | Máxima | 1 arquivo. |
| `src/lib/tenantSite/` | Alta | 6 arquivos coerentes. |
| `src/lib/whatsapp/` | Alta | 5 arquivos coerentes. |
| `src/test/`, `src/__tests__/`, `src/lib/__tests__/` | Alta | Um propósito (testes). Convivem 3 diretórios de teste. |
| `supabase/functions/` | Alta por função | Cada função é um diretório coerente. |
| `supabase/functions/_shared/` | Alta | Organizado por subdomínio (`runtime/`, `drivers/`, `migration/`, `canonical/`, `protocols/`). |
| `supabase/migrations/` | Média | 355 arquivos sequenciais sem subagrupamento (padrão da CLI Supabase). |
| `scripts/` | Alta | Todos são guards/tests. |
| `e2e/` | Máxima | 1 spec. |
| `public/` | Alta | 4 assets estáticos. |
| `docs/` | Média | 9 subdomínios, alguns com múltiplas iterações (`database-runtime/{forensic-review,surgery,...}`). |

## Observações objetivas

1. **`src/lib/` na raiz** tem a maior amplitude temática do projeto: 40+ arquivos flats sem subagrupamento consistente. Subpastas foram criadas para `pricing/`, `tenantSite/`, `whatsapp/`, `integration/`, mas engines maiores (print/laudo, mapas) permanecem na raiz.
2. **`src/components/` na raiz** também concentra ~37 arquivos transversais sem sub-pasta, embora muitos poderiam ser candidatos naturais a `atendimento/`, `resultado/`, `rastreabilidade/`, etc. (diretórios já existentes com poucos arquivos).
3. **`docs/`** possui iterações históricas por fase de trabalho — coerência interna alta em cada subdomínio, coesão geral menor por sobreposição temática entre `database-per-tenant-audit/`, `database-runtime/`, `technical-audit/`.
