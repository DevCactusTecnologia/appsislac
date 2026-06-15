# Inventário de Rotas Atuais — SISLAC

> Fase 1 — Auditoria. Não houve nenhuma alteração de código.
> Fonte: `src/App.tsx` (commit atual). Total: **46 rotas** (incluindo aliases/redirects e públicas).

## 1. Rotas Públicas (sem autenticação)

| URL atual | Página | Componente | Módulo | Responsabilidade |
|---|---|---|---|---|
| `/` | Landing | `pages/Landing.tsx` | Marketing | Landing pública SISLAC (visitante). Autenticado redireciona p/ `/dashboard` ou `/super-admin`. |
| `/login` | LoginV2 | `pages/LoginV2.tsx` | Auth (tenant) | Login dos usuários do laboratório. |
| `/auth` | — | Redirect → `/login` | Auth | Alias legado. |
| `/super-admin/login` | SuperAdminLogin | `pages/SuperAdminLogin.tsx` | Auth (plataforma) | Login restrito do Super Admin SaaS. |
| `/reset-password` | ResetPassword | `pages/ResetPassword.tsx` | Auth | Reset de senha via token Supabase. |
| `/privacidade` | Privacidade | `pages/Privacidade.tsx` | Institucional | Política de privacidade (LGPD). |
| `/inscricao` | Inscricao | `pages/Inscricao.tsx` | Onboarding | Formulário público de inscrição de novo laboratório. |
| `/verificar/:codigo` | VerificarComprovante | `pages/VerificarComprovante.tsx` | Portal | Validação pública de comprovante via QR. |
| `/p/:codigo` | RedirectShortlink | `pages/RedirectShortlink.tsx` | Portal | Shortlink → PDF assinado. Exposto em WhatsApp/QR. |
| `/site/:slug` | TenantSite | `pages/TenantSite.tsx` | Site Tenant | Home do site público do laboratório. |
| `/site/:slug/sobre` | TenantSiteSobre | `pages/TenantSiteSobre.tsx` | Site Tenant | Página institucional "Sobre". |
| `/site/:slug/contato` | TenantSiteContato | `pages/TenantSiteContato.tsx` | Site Tenant | Página "Contato". |
| `/site/:slug/app` | — | Redirect → `/login` ou `/dashboard` | Site Tenant | Entrada operacional via site público. |

## 2. Rotas Operacionais (tenant, autenticadas)

| URL atual | Página | Componente | Módulo | Responsabilidade |
|---|---|---|---|---|
| `/dashboard` | Dashboard | `pages/Dashboard.tsx` | Operacional | KPIs do tenant. |
| `/atendimentos` | Atendimentos | `pages/Index.tsx` | Clínico/Atendimento | Lista de atendimentos. |
| `/novo-atendimento` | Novo Atendimento | `pages/NovoAtendimento.tsx` | Clínico/Atendimento | Criação de atendimento. |
| `/editar-atendimento/:protocolo` | Editar Atendimento | `pages/NovoAtendimento.tsx` | Clínico/Atendimento | Edição via protocolo. |
| `/registrar-coleta` | Registrar Coleta | `pages/RegistrarColeta.tsx` | Clínico/Coleta | Operacional de coleta. |
| `/analisar-amostra` | Analisar Amostra | `pages/AnalisarAmostra.tsx` | Clínico/Análise | Bancada de análise. |
| `/resultados` | Resultados | `pages/Resultados.tsx` | Clínico/Resultado | Lista de resultados para liberação. |
| `/resultado/:id` | Resultado Detalhe | `pages/ResultadoDetalhe.tsx` | Clínico/Resultado | Edição/liberação de laudo. |
| `/consultar-resultados` | Consultar Resultados | `pages/ConsultarResultados.tsx` | Clínico/Resultado | Consulta read-only. |
| `/consultar-resultado/:id` | Consultar Resultado Detalhe | `pages/ResultadoDetalhe.tsx` | Clínico/Resultado | Consulta detalhe (read-only). |
| `/lab-apoio` | Lab Apoio | `pages/LabApoio.tsx` | Clínico/Terceirização | Gestão de exames enviados a laboratório de apoio. |
| `/pacientes` | Pacientes | `pages/Pacientes.tsx` | Clínico/Cadastros | CRUD de pacientes. |
| `/especialistas` | Especialistas | `pages/Especialistas.tsx` | Clínico/Cadastros | CRUD de médicos solicitantes. |
| `/soroteca` | Soroteca | `pages/Soroteca.tsx` | Clínico/Operacional | Estoque de amostras armazenadas. |
| `/mapa` | Mapa de Trabalho | `pages/Mapa.tsx` | Clínico/Operacional | Mapa diário de trabalho. |
| `/auditoria` | Auditoria | `pages/Auditoria.tsx` | Compliance | Log de auditoria. |
| `/orcamentos` | Orçamentos | `pages/Orcamentos.tsx` | Financeiro | Geração de orçamentos. |
| `/financeiro` | Financeiro | `pages/Financeiro.tsx` | Financeiro | Entradas, saídas, caixa. |
| `/relatorios/impressao` | Impressão Geral | `pages/ImpressaoGeral.tsx` | Relatórios | Lote de impressão. |
| `/relatorios/producao` | Produção | `pages/Producao.tsx` | Relatórios | Indicadores de produção. |
| `/relatorios/ocorrencias` | Ocorrências | `pages/RelatorioOcorrencias.tsx` | Relatórios | Ocorrências de coleta. |
| `/relatorios/recoletas` | Recoletas | `pages/RelatorioRecoletas.tsx` | Relatórios | Recoletas por motivo. |
| `/estoque` | Estoque | `pages/Estoque.tsx` | Operacional | Estoque de insumos. |
| `/configuracoes` | Configurações | `pages/Configuracoes.tsx` | Configuração | Hub de configurações (convênios, unidades, exames, modelos de laudo, etc). |
| `/pedidos-site` | Pedidos Site | `pages/SolicitacoesSite.tsx` | Portal/Site | Pedidos enviados via site público. |
| `/solicitacoes-site` | — | Redirect → `/pedidos-site` | — | Alias legado. |
| `/equipe` | Equipe | `pages/Usuarios.tsx` | Configuração/RH | Gestão de usuários do tenant. |
| `/usuarios` | — | Redirect → `/equipe` | — | Alias legado. |
| `/perfil` | Perfil | `pages/Perfil.tsx` | Conta | Perfil do usuário logado. |
| `/admin/ckeditor-test` | CKEditor Test | `pages/admin/CKEditorTest.tsx` | Dev/QA | Tela de teste do editor. |
| `*` | NotFound | `pages/NotFound.tsx` | — | Fallback 404. |

## 3. Rotas do Super Admin (plataforma)

| URL atual | Página | Componente | Módulo | Responsabilidade |
|---|---|---|---|---|
| `/super-admin` | Super Admin Dashboard | `pages/superadmin/SuperAdminDashboard.tsx` | Super Admin | Visão geral SaaS. |
| `/super-admin/laboratorios` | Laboratórios | `pages/superadmin/SuperAdminTenants.tsx` | Super Admin | Lista de tenants. |
| `/super-admin/laboratorios/novo` | Novo Laboratório | `pages/superadmin/SuperAdminNovoLab.tsx` | Super Admin | Provisionamento de tenant. |
| `/super-admin/laboratorios/:id` | Detalhe do Laboratório | `pages/superadmin/SuperAdminTenantDetalhe.tsx` | Super Admin | Detalhe e edição de tenant. |
| `/super-admin/tenants` | — | Redirect → `/super-admin/laboratorios` | — | Alias legado. |
| `/super-admin/tenants/*` | — | Redirect → `/super-admin/laboratorios` | — | Alias legado wildcard. |
| `/super-admin/inscricoes` | Inscrições | `pages/superadmin/SuperAdminInscricoes.tsx` | Super Admin | Aprovação de inscrições públicas. |
| `/super-admin/planos` | Planos | `pages/superadmin/SuperAdminPlanos.tsx` | Super Admin | Gestão de planos SaaS. |
| `/super-admin/auditoria` | Auditoria Global | `pages/superadmin/SuperAdminAuditoria.tsx` | Super Admin | Auditoria cross-tenant. |
| `/super-admin/configuracoes` | Configurações | `pages/superadmin/SuperAdminConfiguracoes.tsx` | Super Admin | Config da plataforma. |

## 4. Observações de Inventário

- **Exames** e **Modelos de Laudo** não possuem rotas próprias — vivem dentro de `/configuracoes` (abas internas, navegação por estado local, não por URL).
- **Faturas** e **Recebimentos** não possuem rotas próprias — vivem dentro de `/financeiro`.
- **Convênios**, **Unidades**, **Tabelas de Preço**, **Layouts de Laudo**, **Documentos**, **Régua Etária**, **Setores**, **Lab. de Apoio (cadastro)** — todos dentro de `/configuracoes`.
- Existem **6 aliases/redirects** já implementados: `/auth`, `/solicitacoes-site`, `/usuarios`, `/super-admin/tenants`, `/super-admin/tenants/*`, `/site/:slug/app`.
- **Verbos em português** misturados na URL (`novo-atendimento`, `editar-atendimento`, `registrar-coleta`, `analisar-amostra`) — quebra do padrão REST/Laravel.
- **Singular vs plural** inconsistente: `/resultado/:id` (singular) coexiste com `/resultados` (plural).
- **Portal público** está espalhado: `/verificar/:codigo`, `/p/:codigo` (sem prefixo `/portal`).
