## Contexto

São ~30 páginas operacionais do laboratório (Index/Atendimentos, Pacientes, Coleta, Análise, Resultados, Financeiro, Estoque, Especialistas, Configurações, Mapa, Soroteca, Produção, Auditoria, Usuários, Orçamentos, LabApoio, ConsultarResultados, Dashboard, etc.). Index.tsx sozinho tem 1.158 linhas. Fazer tudo "em um único turno" gera risco real de regressão. O caminho seguro é padronizar a **fundação compartilhada** primeiro e depois aplicá-la página por página.

## Fundação compartilhada (entrega já nesta fase)

Promover os componentes do Super Admin para uso global do app (sem mexer na lógica, só no visual):

1. **`PageHeader`** — mover de `src/components/superadmin/PageHeader.tsx` para `src/components/shared/PageHeader.tsx` (re-export no caminho antigo para não quebrar nada do SA). Mesma assinatura: `eyebrow`, `title`, `description`, `actions`, `children`.
2. **`StatusBadge`** — mover de `src/components/superadmin/StatusBadge.tsx` para `src/components/shared/StatusBadge.tsx` (mesmo padrão de re-export). Adicionar helpers para os status do laboratório: `toneForAtendimento`, `toneForColeta`, `toneForAnalise`, `toneForResultado`, `toneForFinanceiro`.
3. **`PageContainer`** novo — wrapper padrão `max-w-7xl mx-auto px-6 py-8` que todas as páginas do lab passam a usar (mesmo respiro/densidade do SA).
4. **`Toolbar`** novo — barra de busca + filtros + ações, no mesmo estilo do SuperAdminTenants (input com ícone, chips de filtro flat, debounce 300ms já é o padrão do projeto).

Esses 4 ficam em `src/components/shared/` e viram a referência visual de toda a app.

## Aplicação por fase (uma fase por turno)

Faço uma fase por vez, valido visualmente, sigo para a próxima. Em cada página: substituir cabeçalho ad-hoc por `PageHeader`, envelopar conteúdo em `PageContainer`, trocar badges de status soltos por `StatusBadge`, padronizar a toolbar de busca/filtros. **Sem mexer em lógica, store, RLS, fluxos ou impressão de laudo (travada por constraint).**

### Fase 1 — Operacional principal (mais visível)
- `Index.tsx` (/atendimentos)
- `Pacientes.tsx`
- `RegistrarColeta.tsx`
- `AnalisarAmostra.tsx`
- `Resultados.tsx` + `ConsultarResultados.tsx`

### Fase 2 — Financeiro + Orçamentos
- `Financeiro.tsx` (+ pasta `Financeiro/`)
- `Orcamentos.tsx`

### Fase 3 — Suporte operacional
- `Estoque.tsx`, `Soroteca.tsx`, `Producao.tsx` (+ pasta `producao/`), `Mapa.tsx`, `Especialistas.tsx`, `LabApoio.tsx`, `SolicitacoesSite.tsx`

### Fase 4 — Configurações / administração do tenant
- `Configuracoes.tsx`, `Usuarios.tsx`, `Auditoria.tsx`, `RelatorioOcorrencias.tsx`, `RelatorioRecoletas.tsx`, `Perfil.tsx`, `Dashboard.tsx`

### Fora do escopo (não tocar)
- `ResultadoDetalhe.tsx` (CSS de impressão congelado por constraint)
- `LoginV2.tsx`, `ResetPassword.tsx`, `Inscricao.tsx`, `TenantSite*`, `Privacidade.tsx`, `NotFound.tsx`, `VerificarComprovante.tsx`, `RedirectShortlink.tsx`, `ImpressaoGeral.tsx` (são telas públicas/sem chrome ou de impressão)
- Páginas `superadmin/*` (já estão no padrão)

## Detalhes técnicos

- Sem mudança de rotas, contextos globais, deps ou boot — apenas componentes e classes Tailwind.
- Reusa 100% dos tokens HSL já definidos em `index.css` (`--primary`, `--status-*`, `--muted`, etc.). Nenhuma cor hardcoded.
- Mantém comportamento existente (busca-as-you-type 300ms NFD, responsividade desktop/tablet/mobile, animações framer-motion onde já existem).
- Atualiza a memória `mem://style/visual-identity-lovable-minimalist` no fim, registrando que o padrão SA agora é o padrão único do app.

## O que entrego nesta fase agora (após você aprovar)

Apenas a **Fundação compartilhada** + **Fase 1** (Index/atendimentos como referência). Aí você valida o resultado visual e libero as fases 2–4 nos próximos turnos.