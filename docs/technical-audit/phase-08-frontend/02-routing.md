# 02 — Routing

**Fonte única:** `src/App.tsx` (80 `<Route>` declarados).

## Guards
- `ProtectedRoute` (props `permissao`, `bloqueadoPontoColeta`) — controla acesso autenticado por permissão.
- `RequireSuperAdmin` (`src/components/RequireSuperAdmin.tsx`) — bloqueia bundle `/super-admin/*`; redireciona não-super-admins.
- `RotinaColetaAnaliseGuard` (`src/components/RotinaColetaAnaliseGuard.tsx`) — desvia `/registrar-coleta` e `/analisar-amostra` para `/resultados` quando o admin do laboratório desativou a etapa.
- Redirects legados (`LegacyEditarAtendimentoRedirect`, `LegacyConsultarResultadoRedirect`) preservam URLs históricos.

## Grupos de rotas
### Públicas (sem auth)
- `/`, `/inscricao`, `/login`, `/super-admin/login`, `/reset-password`, `/privacidade`
- `/verificar/:codigo`, `/p/:codigo`
- `/site/:slug`, `/site/:slug/sobre`, `/site/:slug/contato` (site institucional do tenant)

### Autenticadas – Tenant (ProtectedRoute)
- Dashboard: `/dashboard`
- Atendimento: `/atendimentos`, `/atendimentos/novo`, `/atendimentos/:protocolo/editar` (+ redirects)
- Rotina laboratorial: `/registrar-coleta`, `/analisar-amostra`, `/resultados`, `/resultado/:id`
- Consulta: `/resultados/consulta`, `/resultados/:id/consulta`
- Cadastros: `/pacientes`, `/especialistas`, `/exames/*`, `/convenios/*`, `/unidades/*`, `/documentos/*`, `/tabelas-preco/*`
- Operação: `/lab-apoio`, `/mapa`, `/soroteca(/estrutura|/triagem|/materiais|/expurgo)`, `/estoque`
- Financeiro: `/financeiro`, `/orcamentos`
- Relatórios: `/relatorios/{impressao,producao,ocorrencias,recoletas}`
- Governança: `/auditoria`, `/pedidos-site`, `/equipe`, `/configuracoes`
- Perfil: `/perfil`

### Super Admin (RequireSuperAdmin + SuperAdminLayout)
- `/super-admin`, `/super-admin/laboratorios(/novo|/:id|/:id/migrar)`
- `/super-admin/{inscricoes,planos,auditoria,configuracoes,notificacoes}`
- Redirects: `/super-admin/tenants*` → `/super-admin/laboratorios`

### IA
- Não possui rota dedicada — a superfície é o painel `AssistenteSISLAC` (`src/components/assistente/`) embutido no layout autenticado.

### Landing
- `/` renderiza `Landing.tsx` para visitantes (memory rule).

### Configuração / Migração
- `/configuracoes` (tenant admin) e `/super-admin/laboratorios/:id/migrar` (SuperAdminMigration).

### Diagnóstico
- `/admin/ckeditor-test` — teste do editor oficial.

## Contagem
- Total `<Route>` no `App.tsx`: **80** (inclui redirects e rotas parametrizadas).
- Rotas protegidas por `ProtectedRoute`: predominante em todo bloco `/dashboard`…`/perfil`.
- Rotas Super Admin: 12.
- Redirects (`<Navigate>` ou componentes legacy): 8+.
