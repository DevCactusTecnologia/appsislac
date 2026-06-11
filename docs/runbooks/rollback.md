# Runbook — Rollback de deploy

## 1. Sintomas

- Spike de erros 5xx após Publish.
- Console do navegador: erros novos de runtime/JS em massa.
- Edge function logs com stack traces de funções tocadas no último deploy.
- KPIs operacionais (atendimentos criados, pagamentos confirmados) caem.

## 2. Diagnóstico rápido

- Confirmar **commit/versão atual** vs versão anterior estável.
- Cruzar com `cron_health` e `integration_jobs` para ver se a regressão
  está no frontend (UI) ou no backend (edges/DB).
- Conferir se houve migration nova no deploy — migrations exigem cuidado
  extra (ver seção 4).

## 3. Mitigação

### 3.1 Rollback de frontend / edge functions

Lovable não tem canary nativo. Para reverter:

1. Abrir o histórico de versões do projeto (sidebar → "Versions").
2. Selecionar a última versão estável (anterior ao deploy ruim).
3. **Restore to this version** → republicar via Publish.
4. Confirmar que `https://sislac.lovable.app` voltou ao build anterior
   (hash do bundle muda).

Edge functions são parte do mesmo restore — não precisam ser revertidas
separadamente.

### 3.2 Migration regredindo schema

**Migrations não são revertidas automaticamente pelo restore.** Se a
regressão foi causada por uma migration:

1. Identificar o arquivo: `supabase/migrations/<timestamp>_*.sql`.
2. Escrever uma **nova migration** que reverte logicamente o efeito
   (drop column, restore default, etc.). Nunca apagar a migration original.
3. Validar com `supabase--linter` e aplicar.

**Nunca** rodar `ALTER DATABASE` ou tocar schemas reservados
(`auth`, `storage`, `realtime`, `vault`, `supabase_functions`).

## 4. Correção definitiva

- Abrir PR com fix; rodar `bun run ci` localmente.
- Adicionar teste que cobre a regressão.
- Republicar fora do horário de pico, se possível.

## 5. Pós-mortem

- Linha do tempo: deploy ruim → detecção → rollback → fix → re-deploy.
- Métrica de "tempo até detectar" — se > 10 min, falta observabilidade
  (criar issue para alerta novo).
- Atualizar `mem://architecture/ci-pipeline` se adicionar gate.