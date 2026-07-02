# 10 — Chain of Responsibility

Padrão observado (aplicável à maioria dos fluxos operacionais):

| Papel | Ator |
|---|---|
| Inicia | Componente React (página) |
| Coordena | Hook + Store (`ensureLoaded`, mutação) |
| Executa | Edge Function (quando existe) → RPC `*_tx` |
| Valida | Zod (frontend) + RPC (regras de negócio) + RLS + Trigger (RBAC) |
| Persiste | RPC `*_tx` dentro de transação |
| Audita | Trigger `audit_<tabela>` (side-effect) |
| Responde | RPC/Edge → Store → Hook → UI |
| Notifica | Realtime broadcast → subscribers |

## Exceções observadas
- **Cadastros simples** (paciente, convênio, exame): pulam Edge e RPC — vão direto de Store para `supabase.from` (protegidos por RLS).
- **Auditoria**: nunca escrita pela aplicação; sempre por trigger.
- **Super Admin**: pula Store e Hook — chama edge com service-role diretamente.
- **Público (Landing/inscrição)**: pula AuthContext; usa `anon` + rate limit.
