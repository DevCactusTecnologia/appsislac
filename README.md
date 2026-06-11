# SISLAC — Sistema de Laboratório de Análises Clínicas

Plataforma SaaS multi-tenant para gestão completa de laboratórios de análises clínicas, cobrindo o ciclo de vida do exame — do atendimento ao paciente até a liberação do laudo — com rastreabilidade regulatória (RDC 978/2025), RBAC granular, auditoria imutável e armazenamento privado de comprovantes.

---

## 📑 Índice

1. [Stack Tecnológica](#-stack-tecnológica)
2. [Arquitetura e Estrutura](#-arquitetura-e-estrutura)
3. [Lógica e Regras de Negócio](#-lógica-e-regras-de-negócio)
4. [Funções, Páginas e Ações](#-funções-páginas-e-ações)
5. [Componentes](#-componentes)
6. [Tabelas e Relacionamentos](#-tabelas-e-relacionamentos)
7. [Design System](#-design-system)
8. [Segurança e RLS](#-segurança-e-rls)
9. [Edge Functions](#-edge-functions)
10. [LGPD e Privacidade](#-lgpd-e-privacidade)
11. [Testes](#-testes)
12. [Build e Deploy](#-build-e-deploy)
13. [Conformidade Regulatória](#-conformidade-regulatória)

---

## 🚀 Stack Tecnológica

### Frontend
| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Linguagem | TypeScript | 5.8 |
| Framework | React | 18.3 |
| Build | Vite | 5.4 |
| Roteamento | react-router-dom | 6.30 |
| Estilos | Tailwind CSS + CSS Variables (HSL) | 3.4 |
| UI Primitives | shadcn/ui (Radix) | latest |
| Editor Rich-Text | Tiptap | 2.11.5 |
| Animações | framer-motion + tailwindcss-animate | 12.x |
| Ícones | Lucide React | 0.462 |
| Datas | date-fns | 3.6 |
| Gráficos | Recharts | 2.15 |
| Geração de PDF | html2pdf.js | 0.14 |
| Confetes/UX | canvas-confetti, sonner | — |
| Cache/Server State | @tanstack/react-query | 5.83 |
| Variantes | class-variance-authority | 0.7 |
| Testes | Vitest + Testing Library + Playwright | — |

### Backend (Lovable Cloud / Supabase)
- **Banco**: PostgreSQL 14.5 (multi-tenant via `tenant_id`)
- **Auth**: Supabase Auth (JWT)
- **Storage**: Bucket privado para PDFs/comprovantes (URLs assinadas 1h)
- **Edge Functions**: Deno (28 funções — operações CORE, super-admin, IA, WhatsApp, comprovantes, signup público)
- **RLS**: Políticas por tenant + perfil + permissão granular
- **Audit**: Tabelas `*_audit` imutáveis (apenas SELECT permitido)

---

## 🏗️ Arquitetura e Estrutura

### Modelo Multi-Tenant
- Cada cliente = 1 `tenant` (`tenants.id`)
- Todas as tabelas de domínio carregam `tenant_id` (FK obrigatória)
- Função SQL `current_tenant_id()` derivada do JWT define o escopo
- Função `is_super_admin(uid)` libera acesso global ao Super Admin
- Função `has_role(uid, role)` e `has_permission(uid, perm)` controlam ações

### Estrutura de Pastas
```
src/
├── App.tsx                    # Roteamento + providers globais
├── main.tsx                   # Bootstrap React
├── index.css                  # Design tokens (HSL) + utilitários
├── components/
│   ├── ui/                    # shadcn/ui primitives
│   ├── configuracoes/         # Tabs e diálogos de configuração
│   ├── estoque/               # Diálogos de estoque
│   ├── financeiro/            # Diálogos financeiros
│   ├── mapa/                  # Componentes do Mapa de Trabalho
│   ├── rastreabilidade/       # Diálogos RDC 978/2025
│   ├── soroteca/              # Diálogos de amostras
│   └── *.tsx                  # Layout, sidebar, dialogs globais
├── contexts/
│   ├── AuthContext.tsx        # Sessão Supabase + RBAC + tenant ativo
│   ├── ThemeContext.tsx       # Light/Dark + persistência
│   └── MenuLayoutContext.tsx  # Layout da sidebar
├── data/                      # Stores: cache + chamadas Supabase
├── hooks/                     # Hooks customizados (mobile, scroll-fade)
├── integrations/supabase/     # Cliente + types gerados (read-only)
├── lib/                       # Lógica pura: PDF, audit, validação
├── pages/                     # Telas roteadas (lazy-loaded)
├── styles/design-tokens.ts    # Spacing, typography, transitions
└── types/                     # .d.ts auxiliares

supabase/
├── functions/                 # Edge functions Deno
└── migrations/                # SQL versionado (read-only)
```

---

## 🧠 Lógica e Regras de Negócio

### 1. Ciclo de vida do Atendimento
```
Pedido Realizado → Amostra Coletada → Em Análise → Resultado Salvo → Liberado
                                                                   ↘ Cancelado
```
- **Status derivado**: se TODOS os exames forem cancelados → atendimento `Cancelado`; se TODOS liberados → `Finalizado`.
- **Reversão**: exames cancelados podem voltar a `pendente` nas telas de coleta/análise.
- **Pós-finalização**: edições disparam audit com `pos_finalizacao=true` e exigem justificativa.

### 2. Precificação Dinâmica
- Ao escolher convênio em "Novo Atendimento", o preço é resolvido em cascata: tabela do convênio → CBHPM → TUSS → Própria.
- Convênio `Particular` (id=0) é fixo, padrão e imutável.
- Convênios com `libera_fluxo_sem_pagamento=true` permitem coleta sem pagamento.

### 3. Pagamento e Devolução
- Diálogo de pagamento aceita **múltiplas formas** (dinheiro, pix, cartão).
- Se valor pago > total → instrução automática: "Devolver R$ X para o cliente".
- Cada pagamento gera linha em `atendimento_pagamentos` e PDF de comprovante.

### 4. Coleta com Identidade (RDC 978/2025)
- Antes de coletar: botão **"Identidade"** abre `ConfirmarIdentidadeDialog` registrando documentos validados em `identidade_confirmacoes`.
- Botão **"Orientações"** registra entrega de instruções em `orientacoes_entregues`.
- Etiquetas geradas com sequencial diário por tenant (`amostra_sequence`).

### 5. Análise e Validação Clínica
- Motor `criticoChecker` compara cada parâmetro contra `valores_referencia` (lógica de pontuação por sexo/idade).
- Valores fora de `critico_min`/`critico_max` exigem comunicação obrigatória ANTES da liberação.
- Comunicações registradas em `criticos_comunicacoes` (canal, destinatário, observação).

### 6. Liberação e Entrega
- Resultado liberado → status `Liberado`, gera PDF via `html2pdf.js`.
- Entrega ao paciente/médico registrada em `resultados_entregas` (canal: portal, e-mail, WhatsApp, presencial).

### 7. Recoletas
- `SolicitarRecoletaDialog` aciona registro em `recoletas` com motivo (catálogo `recoletas_motivos`).
- Página `/relatorios/recoletas` analisa padrões por causa, etapa, responsável e período.

### 8. Faturamento de Convênios
- Itens (`atendimento_exames` com `cobranca_destino='convenio'`) são agrupados em `convenio_faturas`.
- Fechamento gera código sequencial, calcula subtotal/desconto/total.
- Status: `aberta`, `fechada`, `paga`, `cancelada`.

### 9. Estoque
- Insumos (`estoque_insumos`) → Lotes FEFO (`estoque_lotes`) → Movimentações (entrada/saída/ajuste).
- Alertas automáticos por validade (`alerta_validade_dias`) e estoque mínimo.

### 10. Auditoria e Dossiê
- Toda ação relevante grava em `atendimento_audit` (entidade, operação, antes/depois, autor, justificativa).
- `protocolo_auditoria` armazena assinatura criptográfica + IP/UA.
- Função `gerarDossieRastreabilidade(protocolo)` consolida em PDF: orientações, identidade, execução, críticos, entregas, audit completo.

---

## 🗂️ Funções, Páginas e Ações

| Rota | Página | Permissão | Descrição |
|------|--------|-----------|-----------|
| `/auth` | `Auth.tsx` | público | Login/cadastro Supabase |
| `/reset-password` | `ResetPassword.tsx` | público | Recuperação de senha |
| `/` | `Landing.tsx` | público | Landing institucional (autenticado redireciona para `/atendimentos`) |
| `/privacidade` | `Privacidade.tsx` | público | Política de privacidade LGPD |
| `/login-super-admin` | `SuperAdminLogin.tsx` | público | Login isolado do super admin |
| `/dashboard` | `Dashboard.tsx` | autenticado | KPIs operacionais e financeiros do tenant |
| `/atendimentos` | `Index.tsx` | atendimentos | Lista paginada de atendimentos |
| `/novo-atendimento` | `NovoAtendimento.tsx` | atendimentos | Wizard scrollable: paciente → exames → pagamento |
| `/editar-atendimento/:protocolo` | `NovoAtendimento.tsx` | atendimentos | Reidrata wizard para edição |
| `/registrar-coleta` | `RegistrarColeta.tsx` | coleta | Painel duplo: pacientes + checklist de exames |
| `/analisar-amostra` | `AnalisarAmostra.tsx` | analise | Lote/individual de análise (bloqueado para PONTO_DE_COLETA) |
| `/resultados` | `Resultados.tsx` | resultados | Lista filtrada de resultados |
| `/resultado/:id` | `ResultadoDetalhe.tsx` | resultados | Edição de parâmetros + crítico + entrega |
| `/pacientes` | `Pacientes.tsx` | pacientes | CRUD de pacientes |
| `/especialistas` | `Especialistas.tsx` | especialistas | CRUD de solicitantes/médicos |
| `/orcamentos` | `Orcamentos.tsx` | financeiro | Propostas com link compartilhável |
| `/financeiro` | `Financeiro.tsx` | financeiro | Entradas (read-only) + Saídas + Faturas |
| `/mapa` | `Mapa.tsx` | autenticado | Mapa de trabalho diário |
| `/soroteca` | `Soroteca.tsx` | coleta | Armazenamento e reuso de amostras |
| `/estoque` | `Estoque.tsx` | autenticado | Insumos, lotes, movimentações |
| `/auditoria` | `Auditoria.tsx` | relatorios | Trilha + Dossiê PDF (RDC 978) |
| `/relatorios/impressao` | `ImpressaoGeral.tsx` | relatorios | Impressão em lote por unidade |
| `/relatorios/producao` | `Producao.tsx` | relatorios | Produção por analista/setor |
| `/relatorios/ocorrencias` | `RelatorioOcorrencias.tsx` | relatorios | Ocorrências e críticos |
| `/relatorios/recoletas` | `RelatorioRecoletas.tsx` | relatorios | Análise de recoletas |
| `/configuracoes` | `Configuracoes.tsx` | configuracoes | Tabs: Lab, Convênios, Exames, Tabelas, Setores, Mapas, Documentos, Apoio, Motivos, Política, Admin |
| `/usuarios` | `Usuarios.tsx` | usuarios | RBAC: criar/editar usuários e permissões |
| `/super-admin/*` | `superadmin/` | super_admin | Painel global de tenants e métricas |

### Ações Principais (Toolbar/Header)
- **Pagar agora** / **Pagar depois** (atendimentos)
- **Cancelar Atendimento** (com motivo do catálogo `motivos_cancelamento`)
- **Coletar selecionados** / **Analisar em lote** / **Liberar lote**
- **Solicitar Recoleta**
- **Comunicar Crítico** / **Registrar Entrega** (resultado)
- **Confirmar Identidade** / **Registrar Orientações** (coleta)
- **Avaliação IA** (sugestão de exames pelo Lovable AI Gateway)
- **Imprimir Etiquetas** / **Imprimir Mapa** / **Imprimir Laudo**
- **Exportar Dossiê PDF** (auditoria)
- **Alterar Responsável** (analista/coletor)
- **Fechar Fatura** (convênio)

---

## 🧩 Componentes

### Layout & Navegação
| Componente | Função |
|------------|--------|
| `AppLayout.tsx` | Container global sidebar+conteúdo (sem remount por rota) |
| `AppSidebar.tsx` | Sidebar 250px/76px com menus por permissão |
| `AppTopbar.tsx` | Topbar: troca de unidade, tema, busca global (Ctrl+K), perfil |
| `SuperAdminLayout.tsx` | Layout exclusivo do painel super admin |
| `RequireSuperAdmin.tsx` | Guard de rota |
| `ChunkErrorBoundary.tsx` | Captura erros de chunk (HMR/lazy) |

### Diálogos Operacionais
| Componente | Função |
|------------|--------|
| `AtendimentoDetalheDialog.tsx` | Detalhes completos do atendimento |
| `AvaliacaoIADialog.tsx` | IA: análise de queixa + sugestão de exames |
| `CadastroPacienteDialog.tsx` | Cadastro/edição de pacientes |
| `CadastroEspecialistaDialog.tsx` | Cadastro de solicitantes |
| `PagamentoDialog.tsx` | Multi-formas + comprovante PDF |
| `NovaEntradaSaidaDialog.tsx` | Lançamentos manuais financeiros |
| `SolicitarRecoletaDialog.tsx` | Recoleta com motivo do catálogo |
| `CelebracaoLiberacaoDialog.tsx` | Confete + feedback ao liberar lote |
| `PdfPreviewDialog.tsx` | Preview com download/imprimir/compartilhar |
| `AlterarResponsavelPopup.tsx` | Troca analista/coletor |
| `AuditoriaPanel.tsx` | Sheet lateral com trilha de eventos |
| `ImpressaoLotePorLab.tsx` | Impressão agrupada por laboratório de apoio |

### Rastreabilidade RDC 978/2025
| Componente | Tabela alvo |
|------------|-------------|
| `ConfirmarIdentidadeDialog.tsx` | `identidade_confirmacoes` |
| `RegistrarOrientacoesDialog.tsx` | `orientacoes_entregues` |
| `RegistrarCriticoDialog.tsx` | `criticos_comunicacoes` |
| `RegistrarEntregaDialog.tsx` | `resultados_entregas` |

### UI Primitivos (shadcn/ui)
`alert`, `alert-dialog`, `avatar`, `badge`, `button`, `calendar`, `checkbox`, `dialog`, `dropdown-menu`, `input`, `label`, `popover`, `select`, `separator`, `sheet`, `sonner`, `standard-dialog`, `switch`, `textarea`, `toast`, `toaster`, `tooltip`.

### Componentes de Domínio
| Componente | Função |
|------------|--------|
| `StatusBadge.tsx` | Badge flat com cor semântica por status |
| `LabBadge.tsx` | Identifica origem (interno/apoio) |
| `ResultadoValidationBar.tsx` | Barra de validação clínica |
| `HtmlEditor.tsx` | Tiptap configurado |
| `EstadoCidadeFields.tsx` | Combo UF+Cidade do IBGE |
| `Pagination.tsx` | Paginação reusável |
| `ExameListWithFade.tsx` | Lista com fade-in/out scroll |
| `RoteamentoApoioPanel.tsx` | Painel de roteamento para apoio |
| `ExamesTerceirizadosPanel.tsx` | Gestão de exames terceirizados |

---

## 🗄️ Tabelas e Relacionamentos

### Schema Resumido (51 tabelas)

#### Núcleo Operacional
- `tenants` — clientes do SaaS
- `profiles` — usuários (1:1 com `auth.users`), perfil + permissões
- `user_roles` — roles (`admin`, `super_admin`, etc.) → enum `app_role`
- `unidades` — sede/filial/posto de coleta
- `setores_laboratoriais` — setores técnicos

#### Atendimento → Resultado
- `pacientes` ←─ `atendimentos` ─→ `convenios`
- `atendimentos` ─→ `atendimento_exames` ─→ `exames_catalogo`
- `atendimento_exames` ─→ `amostras` (1:1 ou compartilhada via `grupo_exame_id`)
- `atendimento_exames` ─→ `exame_pops` (versionamento de POP)
- `atendimento_exames` ─→ `labs_apoio` (terceirização)
- `atendimentos` ─→ `atendimento_pagamentos`

#### Catálogo de Exames
- `exames_catalogo` ─→ `exame_parametros`, `exame_layouts`, `exame_pops`
- `valores_referencia` (resolução clínica por sexo/idade)
- `tabela_preco_itens` (CBHPM/TUSS/Própria)

#### Financeiro
- `convenio_faturas` ─→ `convenio_fatura_itens` ─→ `atendimento_exames`
- `financeiro_entradas`, `financeiro_saidas`
- `financeiro_formas_pagamento`, `financeiro_destinos_pagamento`, `financeiro_tipos_despesa`

#### Estoque
- `estoque_fornecedores` ─→ `estoque_insumos` ─→ `estoque_lotes` ─→ `estoque_movimentacoes`

#### Soroteca / Amostras
- `amostras` (compartilhamento multi-exame via `grupo_exame_id`)
- `amostra_sequence` (sequencial diário por tenant)

#### Rastreabilidade RDC 978/2025
- `identidade_confirmacoes`
- `orientacoes_entregues`
- `criticos_comunicacoes`
- `resultados_entregas`
- `transporte_remessas`

#### Auditoria
- `atendimento_audit` (imutável)
- `app_settings_audit` (imutável)
- `protocolo_auditoria` (assinatura criptográfica)
- `protocolo_sequence`

#### Documentos & Mapas
- `documento_templates`
- `mapas_trabalho` ─→ `mapa_exames` ─→ `exames_catalogo`

#### Catálogos Auxiliares
- `motivos_cancelamento`, `recoletas_motivos`
- `states`, `cities` (IBGE)
- `app_settings`
- `orcamentos` ─→ `orcamento_exames`
- `especialistas`
- `recoletas`

> **Schema completo (colunas, tipos, constraints, índices, triggers, policies, enums e funções) está disponível em `sislac_database.json` exportado para `/mnt/documents/`.**

---

## 🎨 Design System

### Filosofia
Design **minimalista, flat e funcional** inspirado em Stripe, Linear, Notion e identidade Lovable AI. Cor primária **indigo** (`#4D41F3`), secundária **esmeralda**. Tipografia **Inter**. Bordas sutis, elevation discreto, espaçamento em grid de **8px**. **Sem gradientes pesados, sem sombras chamativas.**

### Tokens Semânticos (CSS Variables HSL)

| Token | Light | Dark | Uso |
|-------|-------|------|-----|
| `--background` | `220 20% 97%` | `230 22% 8%` | Fundo geral |
| `--foreground` | `230 25% 12%` | `220 16% 93%` | Texto principal |
| `--card` | `0 0% 100%` | `230 20% 12%` | Fundo de cards |
| `--primary` | `244 88% 60%` | `244 80% 64%` | Indigo — ações principais |
| `--secondary` | `152 55% 42%` | `152 50% 40%` | Esmeralda — destaques positivos |
| `--muted` | `220 16% 94%` | `230 18% 16%` | Áreas sutis |
| `--accent` | `244 70% 96%` | `230 20% 18%` | Fundo de destaque |
| `--destructive` | `0 72% 51%` | `0 62% 42%` | Erros / ações destrutivas |
| `--border` | `220 16% 91%` | `230 18% 18%` | Bordas |
| `--ring` | `244 88% 60%` | `244 80% 64%` | Focus ring |
| `--radius` | `0.75rem` | `0.75rem` | 12px padrão |

### Cores de Status (Flat)
| Status | Token | Uso |
|--------|-------|-----|
| Pendente | `--status-warning` (amarelo) | Pendente / Aguardando |
| Coletado / Em andamento | `--status-info` (azul) | Em fluxo |
| Liberado / Finalizado | `--status-success` (verde) | Concluído |
| Cancelado | `--status-danger` (vermelho) | Cancelado |
| IA / Especial | `--status-purple` (roxo) | Insight / IA |

### Elevation
| Classe | Uso |
|--------|-----|
| `shadow-elevation-xs` | Cards sutis |
| `shadow-elevation-sm` | Cards padrão |
| `shadow-elevation-md` | Dropdowns |
| `shadow-elevation-lg` | Modais |

Diálogos usam **backdrop-blur 6px** sobre overlay translúcido — sem sombras pesadas.

### Tipografia
- **Fonte**: `Inter, system-ui, sans-serif` (pesos 400/500/600/700/800)
- **Escala fluida**: `clamp()` para h1-h3
- **Tokens**: `src/styles/design-tokens.ts`

### Layout
- **Border-radius**: `0.75rem` (12px)
- **Sidebar**: 250px expandida / 76px colapsada (fundo escuro)
- **Container**: `max-w-7xl` (operacional) / `max-w-[1400px]` (global)
- **Grid**: 8px base, half-step 4px

### Animações
- **Lib**: framer-motion (`layoutId` para indicadores de aba/cards)
- **Listagens**: `.animate-fade-in-up`
- **Diálogos**: sem animação (performance)
- **AppLayout**: container NÃO usa `key={pathname}` (evita remount/flicker)

### Regras Obrigatórias
- ❌ Nunca usar `text-white`, `bg-black`, `bg-[#xxx]`, `text-red-500`
- ✅ Sempre tokens semânticos: `bg-primary`, `text-foreground`, `border-border`
- ✅ Cores em HSL no `index.css` (sem `hsl()` envolvendo)
- ✅ Novos tokens em `index.css` E `tailwind.config.ts`
- ✅ Verificar contraste em ambos os modos

---

## 🔐 Segurança e RLS

### Princípios
1. **Isolamento por tenant**: toda query passa por `tenant_id = current_tenant_id()`
2. **Roles em tabela separada** (`user_roles`) — nunca em `profiles`, evitando escalonamento
3. **Funções `SECURITY DEFINER`** (`has_role`, `has_permission`, `current_tenant_id`, `is_super_admin`) evitam recursão de RLS
4. **Tabelas de audit** (`*_audit`) só permitem SELECT — INSERTs vêm de triggers
5. **Storage privado**: PDFs servidos via signed URL (1h), validação estrita de path
6. **Edge functions com hardening**: CORS, request_id, retry/timeout, error responder padronizado

### Perfis e Permissões
- **Administrador**: acesso total
- **Analista**: análise + resultados + coleta
- **Recepcionista**: atendimentos + pacientes + coleta
- **Financeiro**: financeiro + faturas + relatórios
- **Super Admin**: gestão de tenants (rota separada `/super-admin`)

Permissões granulares em `profiles.permissoes_extras` / `permissoes_revogadas` (override do perfil).

---

## ☁️ Edge Functions

| Função | Descrição |
|--------|-----------|
| `_shared/hardening.ts` | Helpers: CORS, request_id, logger, timeout, retry, error responder |
| `upload-pdf` | Upload base64 → bucket privado, retorna signed URL |
| `create-atendimento` | Criação server-side de atendimento (resolve `tenant_id` via JWT) |
| `update-atendimento` | Atualização server-side de atendimento + audit |
| `ai-suggest-exames` | Sugestão de exames via Lovable AI Gateway (rate-limit por IP + JWT obrigatório) |
| `extract-paciente-doc` | OCR/extração de dados de documentos do paciente |
| `extract-requisicao-exames` | Leitura assistida de requisição de exames |
| `comprovante-shortlink` | Geração de shortlink público para comprovantes |
| `comprovante-resolve` | Resolução de shortlink → signed URL |
| `validate-protocolo` | Valida assinatura de protocolo |
| `signup-tenant` | Cadastro público de novo tenant + admin inicial |
| `tenant-domain-verify` | Verificação de domínio customizado por tenant |
| `sitemap` | Geração dinâmica de sitemap multi-tenant |
| `lab-apoio-adapter` | Adaptador para integração com labs de apoio |
| `lab-apoio-cron-fetch` | Job periódico de busca de resultados |
| `whatsapp-send` | Envio de mensagens via WhatsApp Cloud API |
| `whatsapp-webhook` | Recebimento de eventos WhatsApp (HMAC em modo soft / log-only) |
| `admin-invite-user` | Convida usuário (admin only) |
| `admin-update-user` | Atualiza perfil/permissões |
| `admin-delete-user` | Remove usuário |
| `super-admin-create-tenant` | Cria tenant + admin inicial |
| `super-admin-list-tenants` | Lista tenants (super admin) |
| `super-admin-update-tenant` | Atualiza tenant |
| `super-admin-metrics` | Métricas globais |
| `super-admin-reset-tenant-password` | Reset de senha do admin de um tenant |
| `super-admin-impersonate-tenant` | Impersonação assistida de tenant (auditada) |
| `super-admin-subscriptions` | Gestão de assinaturas dos tenants |
| `super-admin-test-integration` | Teste de integrações por tenant |

> Todas as funções `super-admin-*` revalidam `is_super_admin(uid)` server-side antes de usar a service-role key.

---

## 🛡️ LGPD e Privacidade

- **Consentimento**: cadastro de paciente exige checkbox de consentimento explícito; persistido em `pacientes.consentimento_lgpd` + `consentimento_em` (timestamp).
- **Política pública**: rota `/privacidade` acessível pelo rodapé da Landing e pelo checkbox de cadastro.
- **Suporte**: e-mail oficial `suporte@sislac.com.br` exibido no rodapé do `AppLayout` (todas as páginas internas) e da Landing.
- **Captura global de erros**: `main.tsx` registra `window.error` e `unhandledrejection` no `logger` estruturado para investigação.
- **Auditoria**: `app_settings_audit`, `atendimento_audit` e `protocolo_auditoria` formam trilha imutável de ações sensíveis.
- **Backup**: snapshots automáticos diários gerenciados pelo Lovable Cloud; tabela `backup_restores_log` registra execução de restores reais (acesso restrito a super admin).

---

## 🧪 Testes

- **Vitest** + **Testing Library** para unitários (`src/**/__tests__`)
- **Playwright** para E2E (`playwright.config.ts`)
- Cobertura focada em: `criticoChecker`, `criticoAudit`, `labApoio`, mapa-builder (renderLayout, buildRenderContext), `mapaSharedStyles`, `LabBadge`, `applyBorderScope`, `applyColumnWidth`, `columnWidthIntegrity`.

```bash
bun run test         # unit
bun run test:watch   # watch mode
```

---

## 🚦 Build e Deploy

```bash
bun run dev          # Vite dev (5173)
bun run build        # production
bun run build:dev    # dev build
bun run preview      # preview build
bun run lint         # ESLint
```

Deploy automático via Lovable Cloud. Edge functions e migrations são publicadas automaticamente.

---

## 📜 Conformidade Regulatória

- **RDC 978/2025 (Art. 128)**: rastreabilidade completa pré-analítica, analítica e pós-analítica.
- Dossiê PDF auditável exportável por protocolo.
- Auditoria imutável de toda ação clínica/financeira.
- Comunicação obrigatória de valores críticos antes da liberação.
- **LGPD**: consentimento explícito do titular no cadastro, política pública em `/privacidade`, canal de suporte ativo.
