# 14 — Frontend Score

Notas baseadas exclusivamente nas evidências das Partes 01–13.

| Dimensão | Nota /10 | Evidência principal |
|---|---:|---|
| Arquitetura (camadas explícitas) | 9.0 | 5 camadas claras + chokepoint único (`runtime/db.ts`) |
| Organização de pastas | 8.5 | 20 subpastas de domínio em `components/`, stores por bounded context |
| Padronização de rotas/layouts/guards | 9.0 | 80 rotas seguem o mesmo padrão de guards |
| Reutilização de componentes | 8.5 | shadcn `ui/`, badges e dialogs reaproveitados por todas as pages |
| State management | 7.5 | Coexistência de stores + TanStack Query (dois padrões) |
| Formulários | 6.5 | Ausência de RHF/zod; validação inline manual |
| Separação de responsabilidades | 8.5 | Regras críticas no backend; UX-mirror em `domains/services` |
| Realtime | 8.5 | Wrapper único; 6 assinantes bem escopados |
| Escalabilidade | 8.0 | Code splitting universal; cache TTL; cursor pagination; store lazy |
| Manutenibilidade | 7.5 | Arquivos gigantes em pages/tabs críticos (10 ≥50 KB, 10 ≥30 KB) |
| Duplicação | 8.0 | Duas landings; sem duplicações estruturais |
| Consistência de padrões | 8.0 | Alta na macro, média na micro (formulários, fetch) |

**Nota consolidada:** **8.1 / 10** — média ponderada simples.
