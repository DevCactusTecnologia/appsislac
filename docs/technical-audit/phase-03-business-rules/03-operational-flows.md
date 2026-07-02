# 03 — Operational Flows

Fluxos ponta-a-ponta observados no código.

## F1. Atendimento presencial (happy path)
1. Recepcionista abre `/novo-atendimento`.
2. Busca/cria paciente (`pacienteStore.upsert`).
3. Seleciona convênio + unidade → preço resolvido (`pricing.calculateExamPrice`).
4. Adiciona exames (`exames_catalogo` filtrado por convênio).
5. Registra pagamento parcial/total (`PagamentoDialog`); se PIX → `pixBrCode` gera QRCode dinâmico.
6. Finaliza → `create-atendimento` (edge) → RPC transacional.
7. Fluxo bifurca por config:
   - `registrar_coleta=true` → status "Aguardando coleta".
   - senão → pula para "Em análise" ou direto "Resultados" conforme `analisar_amostras`.

## F2. Coleta
1. Coletador abre `/rotina/coleta`.
2. Marca amostras coletadas em lote; sistema gera `amostras.codigo` via `amostra_sequence`.
3. Status muda automaticamente para próxima etapa.

## F3. Análise & Resultado
1. Analista abre `/rotina/analise` → `AnalisarAmostra`.
2. Digita valores por parâmetro; VR resolvido por sexo/idade/regra (`resolucao-de-referencia-clinica`).
3. Salva → registra `analisado_por/at`; bloqueia edição.
4. Validador libera → `liberado_por/at`; laudo entra em fila de assinatura.

## F4. Assinatura & liberação
1. Responsável técnico assina (`sign-resultado`).
2. PDF renderizado via Paged.js + Layout Engine.
3. Se política = automatic → `enqueueNotification` → `whatsapp_outbox` → dispatcher.

## F5. Entrega ao paciente
- Portal público `/consultar` (CPF+protocolo) ou link WhatsApp com shortlink (`comprovante-shortlink`).
- Registra `resultados_entregas`.

## F6. Financeiro
1. Abertura de caixa → `caixa_sessoes.status='aberto'`.
2. Entradas propagam de atendimentos (read-only).
3. Saídas manuais registradas.
4. Fechamento consolida totais; gera comprovante.

## F7. Convênio (faturamento)
1. Competência aberta mensalmente (`convenio_competencias`).
2. Atendimentos com `cobranca_destino=convenio` entram em `convenio_fatura_itens`.
3. Fatura fechada; glosas registradas (`convenio_glosas`).

## F8. Integração com laboratório de apoio
1. Exame marcado `TIPO=TERCEIRIZADO` + `lab_apoio_id`.
2. `integration-dispatch` cria `integration_jobs`.
3. Runner envia; polling coleta resultados; PDF anexado (`integration_pdfs`).
4. Falhas persistentes → `integration_dead_jobs`; circuit breaker.

## F9. Migração Shared → Dedicated (super admin)
Provisionar schema → migrar dados → migrar auth (preserva `password_hash`) → migrar storage → smoke → flip `runtime_mode='isolated_db'` → purge shared.

## F10. Site público do tenant
Visitante → landing tenant (`TenantSite`) → solicita exame → lead persistido → recepção converte.
