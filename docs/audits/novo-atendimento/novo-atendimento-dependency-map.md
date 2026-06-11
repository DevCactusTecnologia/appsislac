# /novo-atendimento — Dependency Map

> Auditoria somente-leitura. Nada foi alterado.

## Arquivo raiz

- `src/pages/NovoAtendimento.tsx` — **2.598 linhas** (componente monolítico).

## Módulos co-localizados (extraídos na Sprint 1)

- `src/pages/NovoAtendimento/types.ts` — `CobrancaDestino`, `Exame`, `ExameTemplate`.
- `src/pages/NovoAtendimento/helpers.ts` — `examesCatalogoLegado` (vazio, legado),
  `computeAvailableConvenios`, `computeAvailableSolicitantes`,
  `buildAvailableExames`, `resolveCobrancaDefault`.
- `src/pages/NovoAtendimento/DropdownStatus.tsx` — UI de estado vazio de dropdown.
- `src/pages/NovoAtendimento/highlightMatch.tsx` — destaque tipográfico do termo
  pesquisado.

## Hooks React utilizados

`useState` (~38 instâncias), `useEffect` (~12), `useMemo`, `useRef`, `lazy`,
`Suspense`, `useNavigate`, `useParams`, `useLocation`, `useAuth`.

## Contextos consumidos

- `AuthContext` (`useAuth`) — usuário, unidade ativa, permissões.

## Stores (Zustand/legacy) consumidas

| Store | Uso |
|---|---|
| `unidadeStore` | `getUnidadeById` (badge da unidade ativa) |
| `convenioStore` | `getConvenios`, `getConveniosAtivosNomes`, `getTabelaByConvenioNome`, `subscribeConvenios` |
| `pacienteStore` | `getPacientes`, `getPacienteByCPF` |
| `especialistaStore` | `getSolicitantesNomes`, `subscribeEspecialistas` |
| `tabelaPrecoStore` | `getTabelaPrecoItens`, `getPrecoExame`, `subscribeTabelaPreco` |
| `atendimentoStore` | `addAtendimento`, `getAtendimentos`, `getNextProtocolo`, `updateAtendimento`, `fetchAtendimentosByPacienteCpf`, `fetchAtendimentoByProtocolo` |
| `orcamentoStore` | `addOrcamento` |
| `sorotecaStore` | `buscarAmostrasReutilizaveisPorNome`, `reutilizarAmostra` |
| `exameCatalogoStore` | `getExamesCatalogo` |

## Serviços / libs

- `@/lib/cpf` — `isValidCPF`, `looksLikeCPF`, `sanitizeCPF`.
- `@/lib/comprovantes` — geração de PDF/HTML de orçamento e comprovante,
  envio WhatsApp.
- `@/lib/atendimentoPolicy` — `isEdicaoClinicaBloqueada`,
  `mensagemBloqueioClinico`.
- `@/lib/showError`, `@/lib/idade`, `@/lib/utils` (`fmtBRL`, `fmtBRLNumber`,
  `searchNormalize`).

## Componentes lazy-loaded

`PagamentoDialog`, `AvaliacaoIADialog`, `LeituraRequisicaoDialog`,
`CadastroPacienteDialog`, `PdfPreviewDialog`, `ReutilizarAmostraDialog`,
`RoteamentoApoioPanel`.

## Componentes diretos

`ResultadoPopup`, `StandardDialog`, `PacienteTelefoneInline`,
`AlertDialog*`.

## Edge Functions chamadas (indiretas via store)

| Função | Caminho | Quando |
|---|---|---|
| `create-atendimento` | `supabase/functions/create-atendimento/index.ts` | `addAtendimento` (fluxo "novo") |
| `update-atendimento` | `supabase/functions/update-atendimento/index.ts` | `updateAtendimento` (fluxo "editar") |
| `lab-apoio-adapter` | indireta via `atendimentoStore` para roteamento de apoio |

## RPCs Postgres invocadas

- `create_atendimento_tx(_atendimento, _exames, _pagamentos)` — chamada por
  `create-atendimento`.
- `update_atendimento_tx(_atendimento_id, _patch, _exames, _pagamentos,
  _cancelar_tudo, _motivo_cancel, _justificativa)` — chamada por
  `update-atendimento`.
- `has_permission(_user_id, _permission)` — RBAC server-side em ambas as
  edge functions.

## Queries Supabase diretas

Nenhuma a partir do componente. **Toda escrita passa por edge function +
RPC transacional** (BEGIN/COMMIT/ROLLBACK gerenciados pelo Postgres).
Leituras complementares (`fetchAtendimentosByPacienteCpf`,
`fetchAtendimentoByProtocolo`) usam o cliente Supabase via store, com RLS
filtrando por `current_tenant_id()`.

## Roteamento

- Entrada: `/novo-atendimento` e `/novo-atendimento/:protocolo` (modo edição).
- Saídas: `navigate("/atendimentos")` (cancelar/voltar/sucesso).

## Resumo gráfico

```text
NovoAtendimento.tsx
├── lazy dialogs (Pagamento, IA, Leitura, Cadastro, PDF, Soroteca, Apoio)
├── stores (convenio, paciente, especialista, tabelaPreco, atendimento,
│           orcamento, soroteca, exameCatalogo, unidade)
├── libs (cpf, comprovantes, atendimentoPolicy, idade, utils)
├── AuthContext
└── escrita → atendimentoStore
              └── supabase.functions.invoke(create|update-atendimento)
                    └── RPC create|update_atendimento_tx (transacional)
                          └── RLS por current_tenant_id()
```
