# Equipe 2.0 — Papéis e Permissões

## Dois eixos coexistentes

1. **Role forte (`user_roles.role app_role`)** — `user` | `admin` | `super_admin`. Usado em RLS via `has_role()`.
2. **Perfil + permissões finas (`profiles.perfil` + `permissoes_extras[]` + `permissoes_revogadas[]`)** — usado em UI (sidebar, ProtectedRoute, ações condicionais) e em RLS via `has_permission()`.

## Perfis selecionáveis no diálogo

`PERFIS_SELECIONAVEIS = ['analista', 'recepcionista', 'financeiro']` (`Usuarios.tsx:40`).
`admin` é alcançado pelo toggle "Administrador" → `user_roles.role='admin'` (não via perfil).

| Perfil | Existe formalmente? | Origem |
|---|---|---|
| Administrador | Sim | role forte `admin` (+ wildcard `*` em AuthContext) |
| Analista | Sim | `profiles.perfil='analista'` + defaults |
| Recepcionista | Sim | `profiles.perfil='recepcionista'` + defaults |
| Financeiro | Sim | `profiles.perfil='financeiro'` + defaults |
| Biomédico / Bioquímico / Técnico / Coletador / Gerente | **NÃO** | Não existem como perfis. Pode-se aproximar via permissões finas, mas o operador não enxerga essas categorias na UI. |

Conclusão: o universo de perfis é enxuto (4). Cargos clínicos clássicos não são modelados — e isso é coerente com a filosofia operacional.

## Catálogo de permissões finas

Definido em `src/data/usuariosStore.ts:55-130` (`PERMISSOES_AGRUPADAS`) e **espelhado em `public.has_permission`** (Postgres). Total: **32 permissões**.

Grupos: Atendimentos, Rotina, Resultados, Pacientes & Especialistas, Financeiro, Configurações & Cadastros, Relatórios.

Permissões adicionais detectadas **apenas no banco** (`has_permission`, presentes no array `admin`) que **não** estão no catálogo de UI:

- `integracoes.gerenciar`
- `gerenciar_soroteca`
- `armazenar_amostra`

Essas três permissões existem em `has_permission` para uso em RLS/edge mas **nunca aparecem como toggle** no diálogo `/equipe`. Resultado: somente admin (wildcard) recebe-as na prática.

## Fonte única?

Não. Há **duplicação intencional**:

- Catálogo de UI: `PERMISSOES_AGRUPADAS` (TS).
- Defaults por perfil: `DEFAULTS_POR_PERFIL` (TS) **e** branch `CASE prof_perfil` em `has_permission` (SQL).
- Mapeamento rota→permissão: `PERMISSION_BY_PATH` (`AppSidebar.tsx`) **e** atributo `permissao` em cada `<ProtectedRoute>` (`App.tsx`).

Qualquer alteração de defaults exige update em **dois lugares** (TS + SQL). Risco operacional baixo, mas o risco de drift existe.

## Permissões sem uso aparente

`grep` por uso real:

- `auditoria` — usada em `/auditoria` (ProtectedRoute). OK.
- `relatorios_recoletas` / `relatorios_ocorrencias` / `relatorios_producao` / `impressao_geral` — todas usadas em rotas. OK.
- `solicitacoes_site_acesso` — usada em `/solicitacoes-site`. OK.
- `mapa_trabalho_acesso` — usada em `/mapa`. OK.
- `lab_apoio_acesso` — usada em `/lab-apoio`. OK.

Nenhuma permissão do catálogo UI está órfã. Mas três permissões do banco (`integracoes.gerenciar`, `gerenciar_soroteca`, `armazenar_amostra`) são invisíveis no toggle — efetivamente concedidas apenas a admins, ainda que poderiam ser delegadas.

## Sobreposições

- "Administrador" como toggle vs perfil `admin` no enum: o perfil `admin` selecionável existe no banco, mas a UI só permite ativar via toggle `isAdmin` (que escreve em `user_roles`). Resultado: na prática `profiles.perfil='admin'` quase nunca acontece — admin é definido pela role, não pelo perfil.
- "Wildcard `*`" no `AuthContext` (`hasPermission` retorna true se `permissoes.includes("*")`) — coexiste com o `has_role(admin)` no banco. Dois caminhos, mesmo resultado.

## Conclusão

Sistema funciona, mas tem **3 fontes** que precisam ficar em sincronia (TS catálogo, TS defaults, SQL `has_permission`). Há **3 permissões fantasmas** no banco. Não há código morto de permissões.
