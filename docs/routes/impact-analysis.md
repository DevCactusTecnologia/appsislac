# Análise de Impacto — Migração Domain Driven Routes

> Fase 4. Auditoria. Nenhuma rota foi modificada. Avalia dependências externas e risco por rota.

## Legenda

- **Impacto**: tamanho da mudança no codebase (refs internas a atualizar).
- **Risco**: probabilidade de quebra externa (links públicos, QR, PDF, WhatsApp, favoritos).
- **Dependências**:
  - **Menu** — `AppSidebar` / `AppTopbar` / `MenuLayoutContext`.
  - **Link interno** — `Navigate`, `<Link>`, `navigate()`.
  - **WhatsApp** — mensagens disparadas com URL embutida.
  - **PDF** — URL impressa em comprovantes/laudos.
  - **QR Code** — código gerado apontando para a URL.
  - **Portal externo** — link enviado a paciente/médico.
  - **Favoritos / Deep link** — usuário pode ter salvo no navegador.

---

## Clínico — Atendimento

| Rota atual | Proposta | Impacto | Dependências | Risco |
|---|---|---|---|---|
| `/atendimentos` | `/atendimentos` (mantém) | — | Menu, links | — |
| `/novo-atendimento` | `/atendimentos/novo` | Médio | Menu, botões "Novo Atendimento" em várias telas | Baixo (só interno) |
| `/editar-atendimento/:protocolo` | `/atendimentos/:protocolo/editar` | Médio | Links em Index, Resultados, Coleta, Financeiro | Baixo |

## Clínico — Coleta / Análise / Resultado

| Rota atual | Proposta | Impacto | Dependências | Risco |
|---|---|---|---|---|
| `/registrar-coleta` | `/coletas` (lista) + `/coletas/:id` ou manter como ação | Médio | Menu, links | Baixo |
| `/analisar-amostra` | `/analises` (lista) | Médio | Menu | Baixo |
| `/resultados` | `/resultados` (mantém) | — | Menu | — |
| `/resultado/:id` | `/resultados/:id` (plural) | Baixo | Links em Resultados, Index, Mapa | **Médio — PDF/QR podem usar** |
| `/consultar-resultados` | `/resultados/consulta` | Baixo | Menu | Baixo |
| `/consultar-resultado/:id` | `/resultados/:id/consulta` | Baixo | Links | Baixo |
| `/lab-apoio` | `/lab-apoio` (mantém) | — | Menu | — |
| `/mapa` | `/mapa-trabalho` ou manter | Baixo | Menu | Baixo |
| `/soroteca` | `/soroteca` (mantém) | — | Menu | — |

## Clínico — Cadastros

| Rota atual | Proposta | Impacto | Dependências | Risco |
|---|---|---|---|---|
| `/pacientes` | `/pacientes` (mantém) + adicionar `/pacientes/novo`, `/pacientes/:id`, `/pacientes/:id/editar` | Médio (criar páginas) | Menu | Baixo |
| `/especialistas` | `/especialistas` + CRUD análogo | Médio | Menu | Baixo |

## Financeiro

| Rota atual | Proposta | Impacto | Dependências | Risco |
|---|---|---|---|---|
| `/financeiro` | `/financeiro` (mantém como hub) | — | Menu | — |
| `/orcamentos` | `/financeiro/orcamentos` | Alto | Menu, links externos enviados a clientes via WhatsApp (validar) | **Médio/Alto** |
| (aba) Faturas | `/financeiro/faturas`, `/financeiro/faturas/:id` | Alto (criar páginas) | Interno | Baixo |
| (aba) Recebimentos | `/financeiro/recebimentos` | Alto | Interno | Baixo |
| (aba) A Receber | `/financeiro/a-receber` | Médio | Interno | Baixo |

## Configuração — Promover sub-entidades para URLs próprias

| Atual (aba interna) | Proposta | Impacto | Dependências | Risco |
|---|---|---|---|---|
| Convênios | `/convenios`, `/convenios/novo`, `/convenios/:id` | Alto | Links internos | Baixo |
| Unidades | `/unidades`, `/unidades/:id` | Alto | Links internos | Baixo |
| Tabelas de Preço | `/tabelas-preco`, `/tabelas-preco/:id` | Alto | Links internos | Baixo |
| Exames (catálogo) | `/exames`, `/exames/novo`, `/exames/:id`, `/exames/:id/editar` | **Alto** | Menus de configuração, modelos de laudo | Baixo |
| Modelos de Laudo | `/exames/:id/modelos`, `/exames/:id/modelos/novo`, `/exames/:id/modelos/:modelId`, `/exames/:id/modelos/:modelId/editar` | **Alto** | Editor CKEditor, Resultado | Baixo |
| Documentos (templates) | `/documentos`, `/documentos/:id` | Médio | Interno | Baixo |
| Régua Etária | `/regua-etaria` | Médio | Interno | Baixo |
| Setores Laboratoriais | `/setores` | Médio | Interno | Baixo |
| Lab. Apoio (cadastro) | `/lab-apoio/cadastro` | Baixo | Interno | Baixo |
| Site do Tenant (admin) | `/configuracoes/site` ou `/site-admin` | Médio | Interno | Baixo |
| `/configuracoes` | Manter como hub raiz que linka às novas rotas | Baixo | Menu | — |
| `/equipe` | `/equipe` (mantém) | — | Menu | — |
| `/usuarios` (alias) | manter redirect | — | — | — |
| `/estoque` | `/estoque` (mantém) | — | Menu | — |

## Relatórios

| Rota atual | Proposta | Impacto | Dependências | Risco |
|---|---|---|---|---|
| `/relatorios/impressao` | mantém | — | Menu | — |
| `/relatorios/producao` | mantém | — | Menu | — |
| `/relatorios/ocorrencias` | mantém | — | Menu | — |
| `/relatorios/recoletas` | mantém | — | Menu | — |

> Relatórios já estão DDD-compliant.

## Portal Público

| Rota atual | Proposta | Impacto | Dependências | Risco |
|---|---|---|---|---|
| `/verificar/:codigo` | `/portal/verificar/:codigo` | Médio | **QR Code impresso**, comprovantes PDF | **ALTO — QR antigos quebram sem redirect 301** |
| `/p/:codigo` | `/portal/p/:codigo` (ou manter por brevidade) | Médio | **WhatsApp, PDFs, links curtos enviados** | **ALTO** |
| `/pedidos-site` | `/portal/pedidos` ou manter | Baixo | Menu interno | Baixo |
| `/solicitacoes-site` (alias) | manter | — | — | — |
| (não existe) | `/portal/protocolo/:codigo` (nova consulta paciente) | Médio (nova) | — | — |

> **Atenção máxima**: `/verificar/:codigo` está impressa em comprovantes físicos já entregues. Migrar SOMENTE com redirect 301 permanente em produção, sem prazo de expiração.

## Super Admin

| Rota atual | Proposta | Impacto | Dependências | Risco |
|---|---|---|---|---|
| `/super-admin` | mantém | — | — | — |
| `/super-admin/laboratorios[/...]` | mantém | — | — | — |
| `/super-admin/tenants[/*]` | remover após período de graça | Baixo | Já é redirect | Baixo |
| `/super-admin/inscricoes/planos/auditoria/configuracoes` | mantém | — | — | — |

## Site Tenant / Onboarding

| Rota atual | Proposta | Impacto | Dependências | Risco |
|---|---|---|---|---|
| `/site/:slug` + `/sobre` + `/contato` | mantém | — | SEO, links externos | — |
| `/` | mantém Landing | — | SEO | — |
| `/inscricao` | mantém | — | Landing CTA | — |
| `/privacidade` | mantém | — | Footer, LGPD | — |

## Auth / Conta

| Rota atual | Proposta | Impacto | Dependências | Risco |
|---|---|---|---|---|
| `/login` | mantém | — | Auth, e-mails | — |
| `/auth` (alias) | manter ou remover após N meses | Baixo | — | Baixo |
| `/super-admin/login` | mantém | — | — | — |
| `/reset-password` | mantém | — | E-mail Supabase | — |
| `/perfil` | `/conta` ou manter `/perfil` | Baixo | Menu usuário | Baixo |
| `/dashboard` | mantém | — | Boot pós-login | — |

## Dev/QA

| Rota atual | Proposta | Impacto | Risco |
|---|---|---|---|
| `/admin/ckeditor-test` | Manter sob `/admin/*` (apenas dev/super-admin) | — | — |

---

## Matriz Consolidada por Risco

| Risco | Rotas | Motivo |
|---|---|---|
| **Alto** | `/verificar/:codigo`, `/p/:codigo` | Exposição externa via QR/PDF/WhatsApp. Exigem 301 perpétuo. |
| **Médio** | `/resultado/:id`, `/orcamentos` | Podem aparecer em PDFs/WhatsApp internos; checar antes. |
| **Baixo** | Todas as demais | Apenas referências internas controladas. |

## Esforço Estimado (T-shirt)

| Categoria | Esforço |
|---|---|
| Verbo→substantivo em Atendimento/Coleta/Análise | M |
| Promover sub-entidades de `/configuracoes` para URLs próprias | **G** |
| Criar CRUDs faltantes (`/pacientes/:id`, `/exames/:id`, faturas) | **G** |
| Padronizar `/portal/*` com redirects 301 | M |
| Limpeza de aliases antigos | P |
