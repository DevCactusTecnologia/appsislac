# 10 — Technical Debt

Registro por evidência. Sem sugestão de correção.

| ID | Categoria | Descrição | Evidência | Impacto |
|---|---|---|---|---|
| TD-01 | Código | 25 arquivos > 800 LOC concentram fluxos operacionais críticos | `wc -l` src | Alto |
| TD-02 | Código | `ResultadoDetalhe.tsx` (3129) e `NovoAtendimento.tsx` (2829) misturam múltiplas responsabilidades | fase-03 | Alto |
| TD-03 | Arquitetural | 3 caminhos paralelos de acesso ao banco (fachada, singleton, strategies) | forensic-review/07 | Alto |
| TD-04 | Arquitetural | Runtime dedicated implementado mas sem consumidor efetivo (fachada nunca ativa) | forensic-review/15 | Alto |
| TD-05 | Backend | ~60 edges duplicam CORS headers e validação JWT (não usam `edgeBoot`) | fase-07/12 | Médio |
| TD-06 | Banco | `tenant_registry` com 3 famílias de colunas para identificar dedicated | forensic-review/07 | Médio |
| TD-07 | Testes | 11 testes unitários para 469 arquivos; sem cobertura publicada | fase-11/09 | Alto |
| TD-08 | Testes | Ausência de testes E2E do pipeline `migrate-{auth,data,storage,flip}` | forensic-review/06 | Alto |
| TD-09 | Documentação | 247 `.md`, dos quais 31+ obsoletos (shared-to-dedicated, per-tenant-audit) | forensic-review/06 | Médio |
| TD-10 | Código | 12 símbolos exportados sem consumidor no runtime cliente/servidor | forensic-review/06 | Médio |
| TD-11 | Código | 65 `as any`, 7 `@ts-ignore`, 48 `eslint-disable` | grep | Médio |
| TD-12 | Código | 66 TODO/FIXME/HACK/XXX não endereçados | grep | Baixo |
| TD-13 | Frontend | Diálogos operacionais chamam stores diretamente (mistura UI/data) | fase-02/08 | Médio |
| TD-14 | Frontend | 2 páginas landing coexistindo (`Landing.tsx`, `LandingPageResponsive.tsx`) | ls src/pages | Baixo |
| TD-15 | Frontend | 37 stores custom + TanStack Query coexistem (dualidade de cache) | fase-08 | Médio |
| TD-16 | Infraestrutura | 355 migrations acumuladas sem consolidação | ls | Médio |
| TD-17 | Infraestrutura | Rota `/admin/ckeditor-test` presente em produção | ls | Baixo |
| TD-18 | Integrações | Contratos de provider bem definidos, mas sem mocks para teste | fase-11/09 | Médio |
| TD-19 | Backend | Colunas `tenant_registry` (`runtime_status`, `frozen_at`, `db_provider`, `runtime_dedicated_enabled`) nunca populadas | forensic-review/06 | Baixo |
| TD-20 | Arquitetural | 2 edges sem consumidor (`tenant-dedicated-login-gate`, `tenant-resolve`) | forensic-review/15 | Baixo |
