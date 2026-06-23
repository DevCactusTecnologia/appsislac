# SISLAC — Índice de Documentação

Histórico auditável do programa de modernização do SISLAC. Cada módulo possui
auditorias, planos e relatórios de execução em sua própria pasta.

## Módulos

- **Atendimento** — [`docs/atendimento-2.0/`](./atendimento-2.0/)
- **Convênios** — [`docs/convenios-2.0/`](./convenios-2.0/)
- **Documentos** — [`docs/documentos/`](./documentos/)
- **Equipe** — [`docs/equipe-2.0/`](./equipe-2.0/) · [`docs/equipe-2.1/`](./equipe-2.1/)
- **Estoque** — [`docs/estoque-2.0/`](./estoque-2.0/)
- **Exames** — [`docs/exames-2.0/`](./exames-2.0/) · [`docs/exames-2.1/`](./exames-2.1/) · [`docs/exames-2.2/`](./exames-2.2/) · [`docs/exames-2.3/`](./exames-2.3/) · [`docs/exames-2.4/`](./exames-2.4/)
- **Financeiro** — [`docs/financeiro-audit/`](./financeiro-audit/) · [`docs/financeiro/`](./financeiro/)
- **PDF / Impressão** — [`docs/pdf/`](./pdf/)
- **Plataforma** — [`docs/plataforma-2.0/`](./plataforma-2.0/) · [`docs/plataforma-2.1/`](./plataforma-2.1/)
- **Soroteca** — [`docs/soroteca-audit/`](./soroteca-audit/) · [`docs/soroteca-2.0/`](./soroteca-2.0/) · [`docs/soroteca-2.1/`](./soroteca-2.1/)
- **WhatsApp** — [`docs/whatsapp-2.0/`](./whatsapp-2.0/)
- **UX transversal** — [`docs/ux/`](./ux/)

## Limpezas estruturais

- **Cleanup 1.0** — radiografia ([`docs/cleanup-1.0/`](./cleanup-1.0/))
- **Cleanup 1.1** — execução ([`docs/cleanup-1.1/`](./cleanup-1.1/))

## Convenção

Cada pasta segue o padrão:

- `executive-report.md` — sumário para revisão.
- `*-audit.md` / `*-report.md` — auditorias e fases de execução.
- `inventory-report.md` — inventário de objetos/arquivos do domínio.

Relatórios são **append-only**: documentam o estado histórico e não devem ser
removidos sem aprovação explícita.
