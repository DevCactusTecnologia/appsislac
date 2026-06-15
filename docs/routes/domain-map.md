# Mapa de Domínios das Rotas — SISLAC

> Fase 2 — Classificação por domínio (DDD). Auditoria pura, nenhum código alterado.

## Domínio: Clínico

Tudo que envolve paciente, exame, atendimento, coleta, análise e resultado.

### Sub-domínio: Cadastros Clínicos
| Rota atual | Entidade | Ação |
|---|---|---|
| `/pacientes` | Paciente | Listar |
| `/especialistas` | Especialista (médico) | Listar |

### Sub-domínio: Atendimento
| Rota atual | Entidade | Ação |
|---|---|---|
| `/atendimentos` | Atendimento | Listar |
| `/novo-atendimento` | Atendimento | Criar |
| `/editar-atendimento/:protocolo` | Atendimento | Editar |

### Sub-domínio: Coleta
| Rota atual | Entidade | Ação |
|---|---|---|
| `/registrar-coleta` | Coleta | Registrar |
| `/soroteca` | Amostra armazenada | Listar/gerenciar |

### Sub-domínio: Análise
| Rota atual | Entidade | Ação |
|---|---|---|
| `/analisar-amostra` | Análise | Bancada |

### Sub-domínio: Resultado / Laudo
| Rota atual | Entidade | Ação |
|---|---|---|
| `/resultados` | Resultado | Listar (liberação) |
| `/resultado/:id` | Resultado | Editar/Liberar |
| `/consultar-resultados` | Resultado | Listar (consulta) |
| `/consultar-resultado/:id` | Resultado | Consultar detalhe |

### Sub-domínio: Operacional Clínico
| Rota atual | Entidade | Ação |
|---|---|---|
| `/mapa` | Mapa de Trabalho | Listar |
| `/lab-apoio` | Exame terceirizado | Gerenciar |

---

## Domínio: Financeiro

| Rota atual | Entidade | Ação |
|---|---|---|
| `/orcamentos` | Orçamento | Listar/criar |
| `/financeiro` | Entradas/Saídas/Caixa | Hub |
| *(sem rota)* | Faturas de Convênio | Aba interna em `/financeiro` |
| *(sem rota)* | Recebimentos | Aba interna em `/financeiro` |

---

## Domínio: Relatórios

| Rota atual | Entidade | Ação |
|---|---|---|
| `/relatorios/impressao` | Impressão Geral | Listar |
| `/relatorios/producao` | Produção | Listar |
| `/relatorios/ocorrencias` | Ocorrências | Listar |
| `/relatorios/recoletas` | Recoletas | Listar |

---

## Domínio: Configuração (do tenant)

| Rota atual | Entidade | Ação |
|---|---|---|
| `/configuracoes` | Hub | Hub de abas internas |
| `/equipe` (alias: `/usuarios`) | Usuário | Gerenciar |
| `/estoque` | Insumo | Gerenciar |

Subentidades sem URL própria (vivem dentro de `/configuracoes`):
Convênios, Unidades, Exames, Modelos de Laudo, Tabelas de Preço, Documentos, Régua Etária, Setores Laboratoriais, Lab. Apoio (cadastro), Tema/Site Tenant.

---

## Domínio: Compliance / Auditoria

| Rota atual | Entidade | Ação |
|---|---|---|
| `/auditoria` | Auditoria | Listar logs do tenant |

---

## Domínio: Conta do Usuário

| Rota atual | Entidade | Ação |
|---|---|---|
| `/perfil` | Perfil | Editar |
| `/login` | Sessão | Login |
| `/reset-password` | Sessão | Recuperar |

---

## Domínio: Portal Público (paciente / médico externo)

| Rota atual | Entidade | Ação |
|---|---|---|
| `/verificar/:codigo` | Comprovante | Validar (QR) |
| `/p/:codigo` | Shortlink PDF | Redirect assinado |
| `/pedidos-site` (alias: `/solicitacoes-site`) | Pedido do site | Listar (lado interno) |

---

## Domínio: Site do Tenant (marketing público por laboratório)

| Rota atual | Entidade | Ação |
|---|---|---|
| `/site/:slug` | Site | Home |
| `/site/:slug/sobre` | Site | Sobre |
| `/site/:slug/contato` | Site | Contato |

---

## Domínio: Onboarding / Marketing

| Rota atual | Entidade | Ação |
|---|---|---|
| `/` | Landing institucional | Home pública |
| `/inscricao` | Inscrição de laboratório | Form público |
| `/privacidade` | LGPD | Política |

---

## Domínio: Super Admin (plataforma SaaS)

| Rota atual | Entidade | Ação |
|---|---|---|
| `/super-admin` | Plataforma | Dashboard |
| `/super-admin/login` | Sessão plataforma | Login |
| `/super-admin/laboratorios` | Tenant | Listar |
| `/super-admin/laboratorios/novo` | Tenant | Criar |
| `/super-admin/laboratorios/:id` | Tenant | Detalhe |
| `/super-admin/inscricoes` | Inscrição | Aprovar |
| `/super-admin/planos` | Plano | Gerenciar |
| `/super-admin/auditoria` | Auditoria global | Listar |
| `/super-admin/configuracoes` | Plataforma | Config |

---

## Domínio: Integrações

Atualmente **sem rotas próprias**. Configuração de provedores (DBSync, Hermes-Pardini, gateways de pagamento, WhatsApp) vive dentro de `/configuracoes` ou `/super-admin/configuracoes`.

---

## Domínio: Dev/QA

| Rota atual | Ação |
|---|---|
| `/admin/ckeditor-test` | Tela técnica de teste do CKEditor |

---

## Resumo de Cobertura por Domínio

| Domínio | Nº rotas | Cobertura | Observação |
|---|---|---|---|
| Clínico | 14 | Boa, mas com verbos | Maior volume — alvo principal de padronização |
| Financeiro | 2 | Insuficiente | Faturas/Recebimentos sem URL |
| Configuração | 3 | Pobre | Entidades viáveis (Exames, Modelos, Convênios, Unidades) escondidas em abas |
| Relatórios | 4 | Já segue padrão DDD (`/relatorios/*`) | Manter |
| Portal | 2 (públicas) + 1 interna | Disperso | Sem prefixo `/portal` |
| Super Admin | 9 | Já segue DDD | Apenas pequena limpeza de aliases |
| Site Tenant | 3 | OK | Manter prefixo `/site/:slug` |
| Onboarding | 3 | OK | Manter |
| Integrações | 0 | Inexistente | Avaliar criação futura |
