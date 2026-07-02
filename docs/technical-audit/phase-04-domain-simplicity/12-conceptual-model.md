# 12 — Conceptual Model

## Entidades centrais

1. **Tenant (Laboratório)** — unidade de isolamento; toda regra opera dentro de um tenant.
2. **Paciente** — sujeito clínico; único por CPF/tenant; sob LGPD.
3. **Atendimento** — contrato transacional entre Paciente e Laboratório em um instante; carrega protocolo, exames, preço, cobrança.
4. **Amostra** — realização física do exame; rastreada por código e ciclo de vida próprio.
5. **Exame do atendimento** — instância de exame ligada a Atendimento e Amostra; concentra valores e status clínicos.
6. **Resultado / Laudo** — saída clínica assinada pelo RT; artefato regulatório.
7. **Cobrança / Pagamento / Fatura** — face financeira do Atendimento (particular ou convênio).
8. **Auditoria** — registro imutável de quem/quando/porquê em cada mudança sensível.

## Entidades de apoio (não centrais, mas indispensáveis)

- **Convênio + Tabela de preço**, **Unidade**, **Setor laboratorial**, **Régua etária / VR**, **Insumo/Lote**, **Soroteca**, **Provider de integração**, **Documento/Layout**, **Consentimento LGPD**, **Usuário/Role/Permissão**, **Notificação (Outbox)**.

## Entidades de plataforma (fora do domínio laboratorial)

- **Tenant registry / runtime mode**, **Migration run**, **AI tool / audit**, **Landing lead / Solicitação pública**.

## Modelo em uma frase

> Um **Laboratório** atende um **Paciente** por meio de um **Atendimento**, coleta uma **Amostra**, produz um **Resultado**, emite um **Laudo assinado** e cobra via **Pagamento/Fatura**, sob **Auditoria** e **LGPD**.
