# Equipe 2.0 — Performance

## Carregamento inicial

`_initUsuariosStore()` (`usuariosStore.ts:217`) faz **2 queries paralelas**:

1. `select(... 17 colunas ...) from profiles order by created_at`
2. `select(user_id, role) from user_roles`

Sem filtro `tenant_id` no client — confia 100% em RLS. Em tenant grande (>500 usuários) carrega tudo de uma vez em memória. **Sem paginação**.

`profiles` tem **20 colunas**; a query traz 17 (omite `id`, `tenant_id`, `updated_at`). Aceitável para painel administrativo de baixíssima frequência de uso.

## N+1

- Avatar URL: resolvido via `fetchAvatarUrl(key)` sob demanda, com cache em memória (TTL 50 min). **Não há N+1** porque a tabela não exibe avatar (apenas iniciais). A função existe para o componente `<UserBadge>` em outros lugares.
- Assinatura URL: idem (`fetchAssinaturaUrl`), só carrega quando o editor abre.
- `tenant_users_integrity()` é RPC única, agregada — sem N+1.

## Realtime

`AuthContext` subscreve **canal por usuário** para mudanças no próprio `profiles` e em `user_roles` (`postgres_changes` com filtro `user_id=eq.<self>`). Custo: 1 canal/usuário/sessão. OK.

`usuariosStore` **não** subscreve realtime — recarrega tudo (`_initUsuariosStore`) após cada mutação. Aceitável para volume típico.

## Filtros / busca

- Filtro client-side (`useMemo` sobre `usuarios`) com normalização NFD. Custo O(n) por keystroke, sem debounce. Em tenant com 50 usuários (caso típico) é imperceptível. Não recomendado adicionar debounce a menos que tenants reais ultrapassem ~500 usuários.

## Consultas redundantes

- Toda mutação chama `_initUsuariosStore()` no final → 2 round-trips. Para a página `/equipe`, OK; para chamadas vindas de outras telas (não há) seria desperdício.
- `AuthContext.signInWithPassword` e `login` duplicam: ambos fazem `signInWithPassword` + checa `profiles.status` + `isTenantActive`. **Código duplicado**, mesma lógica em duas funções.

## Índices

Banco tem `profiles.user_id` único, `user_roles (user_id, role)` único. Não verificamos `idx_scan` em produção — recomendado para Fase 2 se houver evidência de slow query. Para volume atual não é gargalo.

## Hotspots

- **Carregamento sem paginação** — Aceitável até ~500 usuários por tenant.
- **Login com 2 funções duplicadas (`login` + `signInWithPassword`)** — sem impacto de performance, mas custo de manutenção.
- **17 colunas trazidas no select** — incluindo `avatar` (base64 legado, pode ser grande). Vale considerar `avatar_key` apenas e ignorar `avatar`. Não verificado tamanho médio.
