# Realtime Reduction Plan

> Pergunta-mãe: **"Qual valor de negócio este realtime entrega?"**
> Se a resposta for "conveniência", converter para refetch on-focus.

---

## 1. Canais identificados

| Canal | Origem | Valor de negócio | Classificação |
|---|---|---|---|
| `atendimentos` (tenant-scoped) | `installAtendimentosRealtime` | Coleta/análise simultânea — analistas veem mudanças entre setores em segundos. | **Crítico — manter** |
| `solicitacoes_publicas` | `SolicitacoesSite` + `useSolicitacoesNaoLidas` | Badge não-lido + CRM kanban. | **Crítico — manter** (badge); conveniência (kanban) |
| `whatsapp_mensagens` | (se ativo) | Status de envio. | **Conveniência** → refetch a cada 30s |
| `integration_jobs` | painel integrações | Acompanhamento job assíncrono. | **Conveniência** → polling 10s enquanto em foco |
| `cron_health` | painel super admin | Monitoramento. | **Conveniência** → refetch on-focus |
| `criticos_comunicacoes` | painel críticos | Notificar liberação crítica. | **Crítico — manter** |

---

## 2. Padrão a eliminar

**Reconnect manual com back-off duplicado** em:
- `SolicitacoesSite.tsx:99-135`
- `useSolicitacoesNaoLidas.ts:30-88`

**Proposta:** hook único `useRealtimeChannel(name, opts)` encapsulando back-off, cleanup, e visibilidade da aba (`document.hidden` → pause).

---

## 3. Plano

| Sprint | Ação | Risco |
|---|---|---|
| 1 | Criar `useRealtimeChannel` e migrar os 2 consumidores existentes (refactor, mesmo comportamento). | Baixo |
| 2 | Converter `whatsapp_mensagens` realtime → polling 30s + invalidate on mutation. | Baixo |
| 3 | Converter `integration_jobs` → polling 10s (apenas em foco). | Baixo |
| 4 | Converter `cron_health` → refetch on-focus (React Query `refetchOnWindowFocus`). | Muito baixo |

---

## 4. Métricas

| Métrica | Hoje (est.) | Meta |
|---|---|---|
| Canais realtime abertos por sessão | ~6 | ~3 |
| Conexões WS simultâneas (servidor) | proporcional | -50% |
| Reconnects/dia | alto | reduzido |

---

## 5. Regra permanente

```text
Realtime só se:
  - latência <5s for requisito de negócio
  - múltiplos atores convergem no mesmo registro
  - badge não-lido / notificação push

Senão: React Query com refetchOnWindowFocus + invalidate on mutation.
```

---

## 6. Não fazer

- ❌ Desligar realtime de `atendimentos` (quebra coleta/análise simultânea).
- ❌ Desligar realtime de `solicitacoes_publicas` badge (perde notificação de novo lead).
- ❌ Substituir realtime por SSE/long-poll custom (mantém Supabase Realtime onde necessário).
