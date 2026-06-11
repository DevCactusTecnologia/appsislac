# Runbook — Backup & Restore

> **Status:** política documentada. Restore **REAL não testado** — gap aberto
> da Fase 5 (depende de projeto Lovable Cloud disposable, ainda não provisionado).

## 1. Backups (estado atual)

- **Banco Postgres (Lovable Cloud):** backup automático gerenciado pela
  plataforma (snapshots periódicos + PITR no plano correspondente).
  Visível no painel Cloud → Database → Backups.
- **Storage de arquivos (laudos, comprovantes, assinaturas):** versionado
  conforme política do bucket; uploads novos não sobrescrevem antigos
  (UUID no path).
- **Edge functions / código frontend:** versionado em Git + histórico
  de versões do Lovable.
- **Secrets / vault:** **não** estão no backup do banco. Devem estar
  inventariados (ver `mem://architecture/secrets-inventory` — pendente)
  e re-injetáveis via painel Cloud.

## 2. RPO / RTO alvo

| Componente | RPO alvo | RTO alvo |
|---|---|---|
| Banco (PITR) | 5 min | 30 min |
| Storage | 0 (versionado) | 5 min |
| Edge functions | 0 (Git) | 10 min |
| Secrets | re-injeção manual | 15 min |

## 3. Procedimento de restore (DRAFT — pendente teste real)

### 3.1 Restore de banco (PITR)

1. Cloud → Database → Backups → escolher timestamp alvo.
2. **Nunca restaurar em cima de PROD em uso.** Criar projeto temporário
   ou aceitar janela de manutenção declarada.
3. Após restore, rodar:
   ```sql
   select max(created_at) from public.atendimentos;
   select count(*) from public.cron_health where started_at > now() - interval '1 hour';
   ```
   para confirmar que o estado pós-restore bate com o esperado.
4. Re-injetar secrets que tenham sido alterados após o ponto restaurado
   (ex: `cron_secret`, credenciais de provedor).

### 3.2 Restore de objeto único (linha apagada por engano)

- **Não restaurar PITR para isso.** Em vez disso:
  1. Abrir snapshot mais recente em modo read-only (se disponível).
  2. Extrair a(s) linha(s) via `pg_dump --data-only --table=... --where=...`.
  3. Reinserir no PROD via migration ou edge function `super-admin-*`,
     respeitando `tenant_id` e RLS.

### 3.3 Restore de arquivo (laudo/comprovante)

- Storage versionado: localizar versão anterior pelo prefixo do path
  no painel de Storage; baixar e re-uplodar com novo UUID.

## 4. Teste de restore (pendente)

TODO Fase 5 real:

1. Provisionar projeto Lovable Cloud descartável.
2. Restaurar último backup PROD nele.
3. Validar checklist: login, criar atendimento, gerar laudo, conferir
   `cron_health`.
4. Registrar duração total e gaps.
5. Repetir trimestralmente.

## 5. Pós-incidente

- Documentar exatamente que dados foram perdidos (entre RPO real e o
  ponto restaurado).
- Notificar tenants afetados se houve perda de dado operacional.
- Reavaliar RPO/RTO se ficaram fora do alvo.