# Plataforma 2.0 — Fase 7: RPCs Órfãs

190 funções em `public`. Análise por categoria de uso.

## Categorias

| Categoria | Qtd ≈ | Origem do consumo |
|-----------|------:|-------------------|
| Trigger functions (não chamadas via `.rpc`) | ~80 | Anexadas a triggers — uso garantido |
| Forwarders auditoria (`fwd_*`) | 8 | Anexadas a triggers — uso garantido |
| Helpers SQL internos (`_*`, `cnpj_digits`, `_calc_dv_amostra`) | ~12 | Usadas por outras funções/policies |
| Tenancy guards (`current_tenant_id`, `has_role`, `has_permission`, `is_super_admin`) | 5 | Usadas em todas as policies |
| RPCs públicas consumidas pelo frontend | 34 | Identificadas por `rg "\.rpc\("` |
| RPCs consumidas por edge functions | ~25 | Importadas via service-role |
| **Candidatas a revisão (uso não localizado)** | **~26** | Veja lista abaixo |

## RPCs candidatas a revisão (não confirmar como órfãs sem mais inspeção)

| Função | Observação |
|--------|------------|
| `_import_legacy_exec(text)` | Helper de import legado — pode estar morto. |
| `enrich_tuss_em_lote` | Possivelmente substituída por `match_tuss_v2`. |
| `match_tuss_estrito` / `match_tuss_por_nome` | Coexistem com `match_tuss_v2`. Verificar se as duas primeiras ainda são chamadas. |
| `aplicar_enriquecimento_exame` | Pode ter perdido consumidor após Exames 2.x. |
| `bootstrap_set_cron_secret` | Usada apenas em setup inicial. |
| `audit_trigger` (genérica) | Possivelmente substituída por funções dedicadas (`audit_atendimentos`, etc.). |
| `block_friendly_id_update` | Verificar se trigger ainda existe. |
| `desfazer_movimentacao` | Não localizada no frontend; talvez só via SQL admin. |
| `is_super_admin()` (sem args) vs `is_super_admin(uuid)` | Duas assinaturas — uma pode estar não usada. |

## Recomendação
**0 RPCs comprovadamente órfãs.** ~26 candidatas exigem auditoria dedicada (fora do escopo desta fase, que é somente leitura). Documentadas em `dead-database-code.md`.
