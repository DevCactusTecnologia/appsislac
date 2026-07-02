# 12 — Decision Points

## Recepção / Atendimento
- Paciente já existe? (CPF match) → reutiliza vs cria.
- Possui convênio? → resolve tabela vs "Própria".
- Preço tem `metaValor`? → usa; senão consulta tabela.
- Pagamento total? → status "quitado" (oculta QRCode).
- Solicitação vinda do site? → converte lead.

## Fluxo laboratorial
- `tenant_lab_config.registrar_coleta`? → sim vai coleta; não pula.
- `analisar_amostras`? → sim habilita etapa análise; não vai direto Resultado.
- Exame é `TERCEIRIZADO`? → dispara integração.
- Resultado é **crítico**? → aciona `criticos_comunicacoes` antes de liberar.
- Precisa recoleta? → gera fluxo paralelo.

## Validação/Assinatura
- Analisado_por ≠ Liberado_por? (dupla) — bloqueia se mesmo usuário.
- RT + CNES + CNPJ completos? → permite imprimir.
- Foi editado após liberação? → marca `pos_finalizacao`.
- Está dentro da janela de edição? → sem confirmação; fora → justificativa.

## Financeiro
- PIX? → gera QRCode dinâmico, aguarda webhook.
- Estorno? → exige justificativa.
- Convênio? → não gera entrada em caixa (vai faturamento).
- Caixa aberto? → operações permitidas.

## Convênios
- Competência aberta? → itens entram na fatura corrente.
- Glosa? → exige motivo do catálogo.

## Notificações
- Política = automatic? → enfileira ao evento.
- Política = manual? → aguarda clique operador.
- Paciente opt-out? → dispatcher descarta.

## Integrações
- Circuit `open`? → falha rápido.
- Job excedeu tentativas? → move para dead-letter.

## Super Admin / Migração
- Smoke test verde? → habilita flip.
- `runtime_mode` já é `isolated_db`? → bloqueia downgrade sem rollback.
- Tenant tem admin? → habilita "impersonate".

## Sidebar / Rotas
- Config coleta OFF? → "Rotina" leva direto a Resultados.
- Usuário é super admin? → menu de plataforma.

## IA
- Tool tem `needsApproval`? → UI exige confirmar.
- Usuário tem `capability.permission`? → tool aparece; senão oculta.

## LGPD
- Consentimento válido? → coleta prossegue.
- Solicitação de deleção? → anonimiza mantendo auditoria.
