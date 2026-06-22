# WhatsApp 2.0 — Fase 1.3 — Mapa de Templates Meta

## Situação atual

**Não existem templates Meta cadastrados no SISLAC.** Todas as mensagens são texto livre construído em código (`type: "text"` ou `type: "document"` com `caption`).

Isso significa que, fora da janela de 24h de conversa iniciada pelo cliente, **as mensagens não chegam** quando enviadas pela Cloud API oficial. Hoje o sistema funciona graças a:

- Modo `simples` (`wa.me`) — sem restrição da Meta, mas exige usuário clicar em "Send" no WhatsApp Web.
- Modo `zapi` — alguns laboratórios usam Z-API que contorna a restrição de templates (não oficial).
- Modo `cloud_api` — só funciona em sandbox/24h ou para contas em teste.

---

## Mensagens em código (a serem convertidas em templates Meta)

### T1 — Comprovante de Atendimento / Pagamento

Origem: `src/lib/comprovantes.ts → enviarComprovantePorWhatsapp()`

```
📋 *{tipoLabel}*
Protocolo: *{protocolo}*
Data: {data}

Olá *{nome}*, segue seu comprovante.
💰 *Total: {total}*

📎 *PDF:* {shortlink}
```

Variáveis: `tipoLabel`, `protocolo`, `data`, `nome`, `total`, `shortlink`.
Anexo: documento PDF (header `document`).

### T2 — Orçamento

Origem: `src/lib/comprovantes.ts → enviarOrcamentoPorWhatsapp()`

```
📋 *ORÇAMENTO {id}*

Olá *{paciente}*, segue o orçamento solicitado:

🏥 Convênio: {convenio}
👨‍⚕️ Solicitante: {solicitante}

🔬 *Exames ({n}):*
  1. {exame_1}
  ...

💰 *Total: {total}*

📎 *PDF:* {shortlink}
```

Variáveis: `id`, `paciente`, `convenio`, `solicitante`, `exames[]`, `total`, `shortlink`.
**Problema p/ Meta**: lista variável de exames não cabe em template estático — precisa ser resumida ou ir no PDF.

### T3 — OTP de inscrição

Origem: `supabase/functions/leads-manager/index.ts`

```
Seu código de confirmação SISLAC é: {code}
```

Variáveis: `code`. **Categoria Meta: AUTHENTICATION**.

---

## Templates PREVISTOS na visão 2.0 (a criar na Meta Business)

| ID sugerido                      | Categoria Meta | Variáveis                                                            | Header         | Botões                                            |
| -------------------------------- | -------------- | -------------------------------------------------------------------- | -------------- | ------------------------------------------------- |
| `sislac_comprovante_atendimento` | UTILITY        | `{lab}`, `{paciente}`, `{protocolo}`, `{previsao}`, `{link}`         | DOCUMENT (PDF) | URL "Ver comprovante"                             |
| `sislac_comprovante_agendamento` | UTILITY        | `{lab}`, `{paciente}`, `{data}`, `{hora}`, `{orientacoes}`, `{link}` | TEXT           | URL "Ver agendamento"                             |
| `sislac_resultados_prontos`      | UTILITY        | `{lab}`, `{paciente}`, `{link_portal}`                               | TEXT           | URL "Acessar portal"                              |
| `sislac_orcamento`               | UTILITY        | `{lab}`, `{paciente}`, `{total}`, `{link}`                           | DOCUMENT (PDF) | URL "Ver orçamento"                               |
| `sislac_recoleta`                | UTILITY        | `{lab}`, `{paciente}`, `{motivo}`, `{telefone_lab}`, `{instrucoes}`  | TEXT           | QUICK_REPLY "Confirmar"                           |
| `sislac_orcamento_clinica`       | UTILITY        | `{clinica}`, `{profissional}`, `{paciente}`, `{link}`                | DOCUMENT       | URL                                               |
| `sislac_confirmacao_consulta`    | UTILITY        | `{profissional}`, `{convenio}`, `{data}`, `{endereco}`, `{servicos}` | TEXT           | QUICK_REPLY × 3 (Confirmar / Cancelar / Remarcar) |
| `sislac_otp_inscricao`           | AUTHENTICATION | `{code}`                                                             | TEXT           | COPY_CODE                                         |

---

## Variáveis comuns (placeholders padronizados)

Para a centralização, todos os templates devem aceitar `{{1}} = nome_laboratorio` como primeiro parâmetro — o painel Super Admin substitui pelo lab correto antes do envio, mantendo 1 só conta Meta.

---

## Conclusão

- Hoje: **zero templates**. Risco operacional alto em modo `cloud_api` real.
- Para centralizar: criar e aprovar **8 templates** na conta Meta corporativa, com `{{1}}` reservado para o nome do laboratório.
