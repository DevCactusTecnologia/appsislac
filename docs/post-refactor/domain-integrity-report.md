# FASE 5 — Integridade dos Domínios

Estrutura observada em `src/domains/`: cada domínio tem `repositories/`, `services/`, `types/`, `validators/`.

| Domínio | Responsabilidade única? | Lógica espalhada? | Acoplamento excessivo? | Observação |
|---|---|---|---|---|
| **patient** | SIM | NÃO | NÃO | Validators e tipos próprios; consumo via `pacienteStore`. |
| **appointment** | SIM | PARCIAL | NÃO | `pricing.ts` é SSOT, mas regras de wizard ainda vivem em `NovoAtendimento.tsx` (2.570 LOC). |
| **result** | SIM | PARCIAL | NÃO | Bem fatiado (`comprovantes{Html,Render,Upload,Whatsapp,Validation}.ts`), mas UI `ResultadoDetalhe.tsx` (2.627 LOC) concentra orquestração. |
| **finance** | SIM | NÃO | NÃO | Entradas read-only do appointment — desacoplamento correto. |
| **tenant** | SIM | NÃO | NÃO | `selectOptionsReader`, `operationalAuditReader`. Boundary super-admin nítido. |
| **notification** | SIM | NÃO | NÃO | Whatsapp/critico via edge fn única. |
| **exam** | SIM | PARCIAL | NÃO | Catálogo + layouts + parâmetros em stores separados; ainda há lógica de derivação em `src/lib/exameDefaults.ts`. |
| **auth** | SIM | NÃO | NÃO | `AuthContext` único, hidratação por `profiles` + `user_roles`. |

## Padrões observados

- Repositórios de domínio são finos e delegam para Supabase client (sem regra de negócio).
- Serviços concentram regras puras (pricing, criticoChecker, parseValorReferencia).
- Validators independentes por domínio (sem cross-import).

## Pontos a monitorar

1. Páginas-monstro (`NovoAtendimento.tsx`, `ResultadoDetalhe.tsx`, `Financeiro.tsx`) ainda orquestram regras + UI. Tecnicamente OK porque consomem serviços de domínio, mas elevam custo de manutenção.
2. Convergência `documentoRenderer.ts` ↔ `comprovantesHtml.ts` ainda pendente.

**Veredito:** Integridade de domínios **boa**. Acoplamento controlado. Lógica espalhada residual está na camada de apresentação, não no domínio.
