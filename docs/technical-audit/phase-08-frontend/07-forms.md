# 07 — Forms

## Inventário (evidências)

**Ausência de biblioteca de formulários**: `rg "react-hook-form" src` retorna **0 arquivos**. Não há `zod`/`yup` importados em pages/components.

## Padrão observado
- **Estado**: `useState` local (às vezes múltiplos states) ou `useReducer` no caso dos wizards.
- **Validação**: inline, imperativa, dentro do handler de submit (ex.: `CadastroPacienteDialog`, `PagamentoDialog`, `NovaEntradaSaidaDialog`, `NovoAtendimento`).
- **Persistência**: submit chama método de store (`atendimentoStore.upsert*`, `pacienteStore.save`, `financeiroStore.criar*`) que por sua vez chama RPC via `src/runtime/db.ts`.
- **Consultas de suporte**: `useDicionario`, `EstadoCidadeFields`, `PacienteTelefoneInline`.
- **Decisão de negócio**: sempre delegada à RPC `*_tx` (memory rule) — o formulário apenas monta payload.

## Formulários principais identificados
| Formulário | Local | Persistência |
|---|---|---|
| Novo/Editar Atendimento (wizard) | `NovoAtendimento.tsx` + `pages/NovoAtendimento/` | `update_atendimento_tx`, `create_atendimento_tx` |
| Cadastro Paciente | `CadastroPacienteDialog.tsx` | `pacienteStore` → RPC |
| Cadastro Especialista | `CadastroEspecialistaDialog.tsx` | `especialistaStore` |
| Pagamento (balcão/PIX) | `PagamentoDialog.tsx` | RPC financeira + `pixBrCode` |
| Nova Entrada/Saída Financeira | `NovaEntradaSaidaDialog.tsx` | `financeiroStore` |
| Resultado / Laudo | `ResultadoDetalhe.tsx` + `pages/ResultadoDetalhe/` | RPCs de resultado + `sign-resultado` edge |
| Solicitar Recoleta | `SolicitarRecoletaDialog.tsx` | `recoletasStore` |
| Login / Reset / Inscrição | `LoginV2`, `ResetPassword`, `Inscricao` | Supabase Auth + edge functions |
| Configurações (12 tabs) | `components/configuracoes/*Tab.tsx` | stores + RPCs específicas |
| Super Admin (novo lab, migrar, planos, etc.) | `pages/superadmin/*`, `components/superadmin/*` | Edge functions `super-admin-*` |

## Existe padrão único?
- **Sim**, na arquitetura macro: `useState` → validação inline → `store.mutation()` → RPC `*_tx`.
- **Não**, na implementação micro: cada formulário reescreve validação; ausência de schema declarativo compartilhado.
