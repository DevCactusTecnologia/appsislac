# 13 — Frontend Quality

Avaliação estática, sem sugerir alterações.

## Coesão
- **Alta** por domínio: cada subpasta em `src/components/*` e `src/data/*Store*` corresponde a um bounded context claro (atendimento, financeiro, resultado, soroteca, superadmin, etc.).
- Wizards e páginas críticas foram **decompostos** em subpastas (`pages/NovoAtendimento/`, `pages/ResultadoDetalhe/`, `pages/Financeiro/`) com contexto interno (`FinanceiroContext.tsx`) — evidência de coesão intra-domínio.

## Acoplamento
- **Baixo** entre pages (todas lazy, sem imports cruzados observados).
- **Médio** entre stores: alguns hooks combinam múltiplos stores (`useDashboardKpis`, `useAReceberPacientes`), acoplamento intencional para derivação.
- **Baixo** com backend: chokepoint `src/runtime/db.ts` isola clientes.

## Reutilização
- Alta em `ui/` (shadcn) e badges (`StatusBadge`, `LabBadge`, `OrigemBadge`).
- Alta em dialogs de domínio (`AtendimentoDetalheDialog`, `PagamentoDialog`, `CadastroPacienteDialog`).
- Alta em stores (múltiplos consumidores por store — matriz na Parte 12).

## Separação de responsabilidades
- Pages = apresentação/orquestração.
- Hooks = coordenação/derivação.
- Stores = estado replicado.
- Runtime = roteamento tenant-aware.
- Backend = verdade transacional.
- Fronteira respeitada exceto por regras de UX espelhadas em `domains/*/services/` (Parte 10).

## Duplicidade
- `Landing.tsx` vs `LandingPageResponsive.tsx` (duas variantes).
- Fetch coexiste em dois padrões (stores vs TanStack Query) — desbalanceado a favor das stores (37 vs 6).
- Nenhuma outra duplicidade estrutural identificada por inspeção de nomes/tamanhos.

## Sinais de atenção (evidência)
- **10 pages ≥50 KB** e **10 componentes ≥30 KB** — arquivos densos, especialmente `ResultadoDetalhe.tsx` (160 KB) e `NovoAtendimento.tsx` (156 KB). Fato — não há sugestão de refatoração.
- `useCleanupUtils.ts` é utilitário de dev — presença legítima.

## Órfãos
- Nenhum hook em `src/hooks/` sem consumidor (grep confirma).
- Nenhum store em `src/data/*Store*` sem consumidor (matriz Parte 12).
- Nenhum provider desnecessário (3 contexts, todos consumidos).
