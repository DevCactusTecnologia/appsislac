# Plataforma 2.0 — Fase 13: Código Morto de Banco

Inventário de objetos suspeitos de não-uso (somente documentação — **não removidos**).

## Funções suspeitas (sem consumidor localizado)

| Função | Suspeita | Notas |
|--------|----------|-------|
| `_import_legacy_exec(text)` | Alta | Helper de import; sem chamada no código atual. |
| `enrich_tuss_em_lote` | Média | Pode ter sido substituída por `match_tuss_v2`. |
| `match_tuss_estrito` | Média | Versão antiga do matcher; `match_tuss_v2` é o canônico. |
| `match_tuss_por_nome` | Média | Idem. |
| `aplicar_enriquecimento_exame` | Média | Endpoint de enrich; sem consumidor após Exames 2.x. |
| `audit_trigger` (genérica) | Média | Triggers específicas (`audit_atendimentos` etc) parecem cobrir o uso. |
| `bootstrap_set_cron_secret` | Baixa | Setup inicial; ok manter. |
| `is_super_admin()` (sem args) | Baixa | Coexiste com `is_super_admin(uuid)` — uma das duas pode estar não usada. |

## Triggers suspeitos

- Verificar se o trigger associado a `sync_amostra_tipo_material` foi totalmente removido na fase 2.3 (esperado: sim).
- `block_friendly_id_update` — confirmar attachment.

## Views suspeitas
Nenhuma. Todas as 13 têm consumidor frontend confirmado.

## Índices suspeitos
265 índices com `idx_scan = 0` — ver `indexes-audit.md`. **Não considerar mortos sem 30 dias de produção real.**

## Policies mortas
Nenhuma policy órfã (em tabela inexistente) detectada.

## Conclusão
Volume de código morto baixo (~8 funções suspeitas, 0 views, 0 tabelas, 0 policies). **Nada removido.** Lista preservada para a eventual fase de cleanup.
