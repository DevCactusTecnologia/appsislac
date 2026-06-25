# Auditoria de Segurança

## RLS

- `valores_referencia`: 4 policies (select/insert/update/delete) — confirmadas.
- `exame_parametros`: 4 policies (`expar_*`) — confirmadas.
- Tenant resolvido via `current_tenant_id()` (server-side) — alinhado com a Core rule.

## Grants

- Confirmar manualmente, mas as policies sugerem grants para `authenticated` + `service_role`. Sem grants para `anon` (correto — não é tabela pública).

## Permissões aplicacionais

- Nenhum guard de role na UI: qualquer usuário com sessão e RLS satisfeita pode editar VR e parâmetros.
- Não há checagem de `has_permission('valores_referencia.edit')` — todas as escritas usam apenas RLS.

## Auditoria / Rastreabilidade

- Tabela `auditoria` registra eventos genéricos do sistema, **mas não há entrada específica** para alterações de `valores_referencia` ou `exame_parametros`.
- Existe `src/pages/admin/AuditoriaVR.tsx` (página interna) que faz diagnóstico **estrutural**, não histórico.
- Não há tabela `valores_referencia_history` nem trigger de auditoria.

## Quem pode

| Ação | Quem (hoje) |
|---|---|
| Visualizar VR | Qualquer usuário autenticado do tenant. |
| Alterar VR | Qualquer usuário autenticado do tenant. |
| Visualizar parâmetros | idem. |
| Alterar parâmetros | idem. |

## Conclusão

- **RLS OK**; **auditoria de mudanças ausente**; **permissões finas ausentes**. Para uma área crítica (afeta interpretação clínica), recomenda-se trigger de história e role mínima ("admin" ou "responsável técnico") na Fase 2.
