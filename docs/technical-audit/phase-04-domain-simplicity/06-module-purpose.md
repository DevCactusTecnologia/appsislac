# 06 — Module Purpose

Base: 20 módulos funcionais (Fase 01/02) + dependências (Fase 03 · `07-module-dependencies.md`).

Legenda: **DOM** domínio · **INFRA** · **PLAT** plataforma SaaS · **OPE** operação · **ADM** administração · **UX**.

| Módulo | Classe | Observação |
|---|---|---|
| Paciente | DOM | Entidade central |
| Atendimento | DOM | Núcleo transacional |
| Coleta | DOM (opcional via CFG) | |
| Análise / Resultado | DOM | |
| Assinatura / Laudo | DOM + INFRA (Document Engine) | |
| Entrega | DOM | |
| Financeiro (Caixa) | DOM | |
| Convênios / Faturamento | DOM | |
| Produção / Mapa | OPE | Gestão operacional, não clínica |
| Estoque | OPE | |
| Soroteca | DOM (guarda de amostra) | |
| Integrações lab apoio | INFRA | |
| WhatsApp | INFRA | Canal, não domínio |
| Auditoria | DOM + regulatório | Transversal |
| Super Admin | PLAT | Fora do domínio laboratorial |
| Migração | PLAT | |
| IA (assistente) | UX + PLAT | |
| LGPD | DOM regulatório | |
| Landing / TenantSite | ADM (comercial) | |
| Cadastro público de paciente | DOM | Ponto de entrada |

**Observação:** os módulos com classificação PLAT/INFRA (Super Admin, Migração, Integrações, WhatsApp, IA) são todos identificáveis por prefixos ou pastas isoladas (`super-admin-*`, `integration-*`, `whatsapp-*`, `ai-*`), o que reforça que a separação domínio × plataforma já existe no código.
