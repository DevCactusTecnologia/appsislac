# 09 — Realtime

## Wrapper único
`src/hooks/useRealtimeChannel.ts` encapsula `supabase.channel(...)`, gerencia `subscribe/unsubscribe` e propaga eventos ao caller.

## Assinantes ativos (evidência grep)
| Assinante | Fonte | Efeito |
|---|---|---|
| `AuthContext.tsx` | `supabase.auth.onAuthStateChange` | Reset de stores + `queryClient` por tenant |
| `data/atendimentoStore/realtime.ts` | canal de `atendimentos` | Atualiza store in-memory; re-emite para subscribers das pages |
| `pages/LabApoio.tsx` | canal de integrações | Atualiza status de envio/retorno |
| `pages/SolicitacoesSite.tsx` | canal de solicitações | Lista viva |
| `hooks/useSolicitacoesNaoLidas.ts` | canal de solicitações | Contador não-lidas no sidebar |

Total: **6 arquivos** com `supabase.channel` / `useRealtimeChannel`.

## Quem publica
Publicações são feitas pelo Postgres (Supabase Realtime replicando WAL); o frontend **não publica** — apenas consome. Mutações partem das RPCs `*_tx` server-side (memory rule).

## Quem atualiza
- Stores (`atendimentoStore/realtime.ts`) mutam estado in-memory ao receber payload.
- Contextos (`AuthContext`) invalidam cache global no evento de troca de tenant/session.
- Componentes reagem via `subscribe` do store ou setState local do hook.

## Quem sincroniza
- `installQueryClientTenantReset` (queryClient) + reset de stores no `AuthContext` = sincronização por tenant.
- `subscribeAtendimentos` (memory) mantém `atendimentoStore` coerente entre abas/usuários.

## Escopo
Realtime restringe-se a: sessão, atendimentos, integrações de apoio, solicitações do site. Demais domínios (financeiro, laudos) usam pull explícito.
