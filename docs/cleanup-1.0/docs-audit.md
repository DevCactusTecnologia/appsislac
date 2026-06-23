# Cleanup 1.0 — Fase 5: Auditoria de Documentação

> Documentação. **Nada removido.**

184 arquivos `.md` em `docs/` (740 KB), distribuídos em **21 pastas**
de fases auditoriais.

## Pastas e estado de encerramento

| Pasta | Arquivos | Status |
|-------|---:|--------|
| `atendimento-2.0/` | 13 | Auditoria concluída (executive-report presente) |
| `convenios-2.0/` | 12 | Concluída |
| `documentos/` | 8 | Concluída |
| `equipe-2.0/` + `equipe-2.1/` | 13 | Encerrada (hardening em 2.1) |
| `estoque-2.0/` | 13 | Concluída |
| `exames-2.0/` | 15 | Auditoria base |
| `exames-2.1/` | 1 | Cleanup |
| `exames-2.2/` | 1 | Layout decoupling |
| `exames-2.3/` | 2 | Material FK |
| `exames-2.4/` | 1 | Encerramento |
| `financeiro/` + `financeiro-audit/` | 18 | Encerrada (SSOT final presente) |
| `pdf/` | 7 | Encerrada (final-cleanup + final-hardening) |
| `plataforma-2.0/` | 15 | Radiografia base |
| `plataforma-2.1/` | 10 | Hardening |
| `soroteca-2.0/` | 18 | Concluída |
| `soroteca-2.1/` | 1 | Hardening operacional |
| `soroteca-audit/` | 14 | Auditoria base (anterior a 2.0) |
| `whatsapp-2.0/` | 21 | Concluída |
| `ux/` | 1 | Pontual |

## Sobreposição potencial

- `docs/financeiro-audit/` vs `docs/financeiro/` — auditoria base vs fases
  de execução. Mantenedora pode considerar mesclar quando consolidar baseline.
- `docs/soroteca-audit/` vs `docs/soroteca-2.0/` — idem.

## Documentos "ativos" (referência permanente)

- `docs/atendimento-2.0/business-rules.md`
- `docs/convenios-2.0/business-rules.md`
- `docs/financeiro/financial-ssot-final.md`
- `docs/financeiro/ssot.md`
- `docs/plataforma-2.0/executive-report.md` + `domains-map.md` + `baseline-study.md`
- `docs/plataforma-2.1/executive-report.md`

## Documentos de fase (snapshot histórico)

- Todos os `phase*-report.md` (123 arquivos contados em
  `find docs -name 'phase*' -o -name '*audit*' -o -name '*report*'`).
  São snapshots imutáveis de cada fase — **não remover**, são o histórico
  auditável do programa de modernização SISLAC.

## Recomendação

A documentação **não é dívida**. Consolidação possível: criar
`docs/INDEX.md` apontando para os relatórios executivos de cada domínio,
mas a estrutura atual é navegável e auditável. Nenhuma remoção indicada.
