# WhatsApp 2.0 — Fase 3F — Recoleta

## Resumo

Recoleta agora notifica o paciente pela mesma arquitetura consolidada
(Outbox → dispatcher → Meta), respeitando a política por laboratório.

## Respostas

**Qual evento dispara a recoleta?**
`SolicitarRecoletaDialog.handleConfirm` → após `criarRecoleta()`
persistir, chama `notifyRecoleta({ protocolo, motivo })`. Único ponto
de verdade: o mesmo dialog usado em Coleta, Triagem, Análise e
Liberação.

**Qual template foi utilizado?**
`recoleta` (UTILITY) com 4 variáveis:
1. Laboratório (`lab.nome`)
2. Paciente
3. Motivo da recoleta
4. Telefone do laboratório (`lab.telefone`)

Nada além disso — sem PDF, anexo, financeiro ou imagem.

**A política automático/manual foi respeitada?**
Sim. `notifyRecoleta` consulta `getNotificationMode(tenant, "recoleta")`.
Modo `automatic` (default): enfileira na hora.
Modo `manual`: retorna `policy_manual`; o dialog exibe toast com ação
"Enviar WhatsApp", que chama `notifyRecoleta({ ..., force: true })`.

**Opt-out / rate limit / auditoria / isolamento por tenant?**
Tudo via RPC `enqueue_whatsapp` (Fase 3A), sem código novo aqui.
`tipo = "recoleta"` registrado na Outbox para auditoria.

**Idempotência?**
`buildIdempotencyKey(["recoleta", tenantId, protocolo, motivo])`
em bucket de 5 min — repetidos viram o mesmo outbox.

**Código morto removido?**
Nenhum legado de recoleta enviava WhatsApp antes — só foi adicionado o
helper novo. Sem helpers órfãos, imports mortos ou tabelas adicionais.

**Referência ao legado?**
Zero. Sem wa.me, sem whatsapp-send, sem Cloud API por tenant.

**Regressão operacional?**
Não. Persistência da recoleta acontece antes do envio; falha no envio
não bloqueia o fluxo clínico (try/catch silencioso).
`tsc --noEmit` ✓, `vitest run` ✓ (22/22).

**Pronto para Confirmação de Consulta?**
Sim. Padrão `notifyXxx + política + manual via toast/menu` está
maduro e reaplicável 1:1 na Fase 3G.

## Arquivos

- **Criado:** `src/lib/whatsapp/notifyRecoleta.ts`
- **Editado:** `src/components/SolicitarRecoletaDialog.tsx`
