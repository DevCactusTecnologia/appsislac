# Plano Mestre — Domain Driven Routes (SISLAC)

> Fase 5 + Fase 6. Documento executivo. **Nenhuma rota foi modificada.**
> Este plano é apenas para aprovação posterior.

---

## 1. Resposta Executiva

| Pergunta | Resposta |
|---|---|
| Quantas rotas existem hoje? | **46** (incluindo aliases/redirects e públicas). |
| Quantas estão fora do padrão DDD/Laravel? | **18** (≈ 39%). Verbos em URL, singular vs plural, sub-entidades sem URL própria, portal sem prefixo. |
| Quais módulos mais precisam de reorganização? | **Configurações** (esconde Convênios, Unidades, Exames, Modelos de Laudo, Tabelas de Preço); **Atendimento** (verbos `novo-/editar-/registrar-/analisar-`); **Portal público** (sem prefixo `/portal`); **Financeiro** (Faturas/Recebimentos sem URL). |
| Qual o risco da migração? | **Médio**. Crítico apenas em duas rotas com exposição externa (`/verificar/:codigo`, `/p/:codigo`). |
| Qual o ganho operacional? | URLs autoexplicativas, CRUD navegável (deep link em paciente/exame/modelo), telemetria coerente por domínio, onboarding de devs mais rápido, base preparada para Laravel/portal externo. |
| Quais rotas devem permanecer como estão? | Site Tenant (`/site/:slug/*`), Landing (`/`), `/inscricao`, `/privacidade`, `/login`, `/reset-password`, `/super-admin/*`, `/relatorios/*`, `/dashboard`, `/perfil`, `/financeiro`, `/atendimentos`, `/resultados`, `/pacientes`, `/especialistas`, `/lab-apoio`, `/soroteca`, `/estoque`, `/configuracoes` (como hub), `/equipe`, `/auditoria`. |
| Quais podem ser migradas imediatamente? | Fase A (sem dependência externa): `/novo-atendimento`, `/editar-atendimento/:protocolo`, `/registrar-coleta`, `/analisar-amostra`, `/consultar-resultados`, `/consultar-resultado/:id`, `/resultado/:id` (com redirect). |
| Existe risco para homologação? | **Baixo**, desde que os redirects 301 sejam plantados ANTES de remover as URLs antigas. |
| Existe risco para produção? | **Médio** somente nas rotas expostas em QR/PDF (`/verificar/:codigo`, `/p/:codigo`). Restante: baixo. |
| Recomenda executar a migração? | **Sim — em fases**, começando por Fase A (interna, sem exposição). Faseamento detalhado abaixo. |

---

## 2. Estrutura Alvo (Resumo)

```text
Clínico
  /pacientes
  /pacientes/novo
  /pacientes/:id
  /pacientes/:id/editar
  /especialistas (+ CRUD análogo)
  /atendimentos
  /atendimentos/novo
  /atendimentos/:protocolo
  /atendimentos/:protocolo/editar
  /atendimentos/:protocolo/coleta
  /atendimentos/:protocolo/analise
  /atendimentos/:protocolo/resultado
  /resultados            (lista de liberação)
  /resultados/:id        (detalhe)
  /resultados/consulta   (lista consulta)
  /resultados/:id/consulta
  /coletas               (operacional)
  /analises              (bancada)
  /mapa-trabalho
  /soroteca
  /lab-apoio

Financeiro
  /financeiro
  /financeiro/entradas
  /financeiro/saidas
  /financeiro/a-receber
  /financeiro/orcamentos
  /financeiro/orcamentos/:id
  /financeiro/faturas
  /financeiro/faturas/:id
  /financeiro/recebimentos

Configuração (sub-entidades promovidas)
  /configuracoes              (hub)
  /exames
  /exames/novo
  /exames/:id
  /exames/:id/editar
  /exames/:id/modelos
  /exames/:id/modelos/novo
  /exames/:id/modelos/:modelId
  /exames/:id/modelos/:modelId/editar
  /convenios (+ CRUD)
  /unidades (+ CRUD)
  /tabelas-preco (+ CRUD)
  /documentos (+ CRUD)
  /regua-etaria
  /setores
  /equipe
  /estoque

Relatórios     /relatorios/{impressao,producao,ocorrencias,recoletas}
Compliance     /auditoria
Conta          /perfil, /login, /reset-password, /dashboard

Portal público
  /portal/verificar/:codigo
  /portal/p/:codigo
  /portal/protocolo/:codigo    (novo — consulta paciente)
  /portal/pedidos              (interna)

Site tenant    /site/:slug, /site/:slug/sobre, /site/:slug/contato
Onboarding     /, /inscricao, /privacidade
Super Admin    /super-admin, /super-admin/laboratorios[/...], /super-admin/{inscricoes,planos,auditoria,configuracoes}
```

---

## 3. Plano de Migração em 4 Fases

### Fase A — Interna, sem exposição externa (RISCO BAIXO)

Objetivo: padronizar verbos→substantivos e singular→plural sem afetar QR/PDF/WhatsApp.

Rotas:
- `/novo-atendimento` → `/atendimentos/novo`
- `/editar-atendimento/:protocolo` → `/atendimentos/:protocolo/editar`
- `/registrar-coleta` → `/coletas`
- `/analisar-amostra` → `/analises`
- `/consultar-resultados` → `/resultados/consulta`
- `/consultar-resultado/:id` → `/resultados/:id/consulta`
- `/resultado/:id` → `/resultados/:id`

Entrega obrigatória:
- Redirects 301 das URLs antigas.
- Atualização de `AppSidebar`, `MenuLayoutContext`, breadcrumbs.
- Atualização de todos os `navigate(...)` e `<Link>` internos.
- Testes E2E dos fluxos críticos (novo atendimento, coleta, análise, resultado).

### Fase B — Promoção de sub-entidades para URLs próprias (RISCO BAIXO, ESFORÇO ALTO)

Objetivo: tornar Exames, Modelos de Laudo, Convênios, Unidades, Tabelas de Preço, Documentos, Régua Etária, Setores navegáveis por URL.

- `/configuracoes` permanece como hub e passa a linkar para as novas rotas (sem perder funcionalidade).
- Cada abas vira página real com sua própria rota e CRUD.
- Adicionar CRUDs faltantes em Pacientes e Especialistas (`/pacientes/:id`, `/pacientes/:id/editar`, etc.).
- Adicionar `/financeiro/faturas`, `/financeiro/faturas/:id`, `/financeiro/recebimentos`, `/financeiro/orcamentos` (mover `/orcamentos`).

Entrega obrigatória:
- Componentização: extrair cada aba atual em página dedicada.
- Manter `/orcamentos` como redirect 301 → `/financeiro/orcamentos`.
- Atualização de menus e busca global.

### Fase C — Portal público (RISCO ALTO)

Objetivo: prefixar portal sob `/portal/*` e padronizar.

- `/verificar/:codigo` → `/portal/verificar/:codigo`
- `/p/:codigo` → `/portal/p/:codigo`
- `/pedidos-site` → `/portal/pedidos` (interna ao tenant)

Pré-requisitos críticos:
- Redirect 301 **permanente** das URLs antigas (sem prazo de expiração — QR físicos já circulam).
- Atualizar geração de novos QR/PDF/WhatsApp para já usar `/portal/*`.
- Smoke test com QR antigo + QR novo antes do rollout.

### Fase D — Limpeza de aliases (RISCO BAIXO, fazer só após métricas)

Após 6 meses de telemetria nos redirects 301, remover aliases sem tráfego:
- `/auth`
- `/solicitacoes-site`
- `/usuarios`
- `/super-admin/tenants` e `/super-admin/tenants/*`
- Verbos antigos da Fase A se uso ≈ 0.

**Aliases públicos (`/verificar/:codigo`, `/p/:codigo`) NÃO devem ser removidos jamais** — QR/PDF impressos não podem ser revogados.

---

## 4. Compatibilidade & Deep Links

Para cada migração:
1. **Plantar redirect 301 ANTES de mover** (mesmo deploy).
2. Manter por no mínimo **6 meses** com telemetria de acesso.
3. Decidir descomissionamento com base em métricas (Fase D).
4. Para rotas com QR/PDF externos: redirect **permanente**, sem janela de descomissionamento.
5. Favoritos do navegador: cobertos automaticamente pelos 301.

---

## 5. Recomendação Final

| Item | Recomendação |
|---|---|
| Executar a migração? | **Sim, em 4 fases.** |
| Começar por? | **Fase A**, sem exposição externa, ganho imediato de clareza. |
| Bloqueio? | Nenhum. Requer apenas planejamento de redirects e janela de QA. |
| Quem aprova? | Dono do produto + responsável técnico (a definir). |
| Próximo passo após aprovação | Detalhar Fase A em tasks (1 PR por sub-fase: rotas, redirects, menus, testes) e iniciar. |

---

## 6. Regra de Parada (cumprida)

Nesta entrega:
- Nenhum arquivo de código foi alterado.
- Nenhuma rota foi criada, removida ou redirecionada.
- Nenhum menu, breadcrumb, PDF ou QR foi tocado.

Os 4 documentos da auditoria estão em `docs/routes/`:
- `current-routes-inventory.md`
- `domain-map.md`
- `impact-analysis.md`
- `domain-driven-routes-master-plan.md` (este)
