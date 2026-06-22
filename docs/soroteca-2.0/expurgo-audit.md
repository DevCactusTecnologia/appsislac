# Soroteca 2.0 — Fase 1.6 — Auditoria de Expurgo

## Como funciona hoje

### Dois conceitos misturados
1. **Validade biológica** → `marcar_amostras_vencidas()` (job/RPC) muda DISPONIVEL → VENCIDA quando `data_validade < now()`. Reversível? Não.
2. **Descarte físico** → operador clica "Descartar" na tela Soroteca → `atualizarAmostra(id, { status: 'DESCARTADA' })`. Reversível? Não há UX. Tecnicamente sim (UPDATE).

### Fluxo do botão "Descartar"
- `Soroteca.tsx` → `AlertDialog` confirmação
- `handleDescartar` → `atualizarAmostra(id, { status: 'DESCARTADA' })`
- `observacao` pode ser editada, mas **não há campo dedicado para motivo do descarte**.
- Nenhum vínculo com responsável: o `audit_trigger` registra `user_id`, mas a aplicação não exibe isso na timeline de descarte.

### Auditoria
- `audit_trigger` grava em `public.auditoria` toda mudança em `amostras`.
- `getAmostraDetalhe` reconstrói eventos a partir de:
  - `amostra.created_at` → CRIACAO
  - `atendimento_exames.is_reutilizacao` → REUTILIZACAO
  - `atendimento_exames.data_analise` → ANALISE
  - `atendimento_exames.data_liberacao` → LIBERACAO
  - `amostra.status` final → DESCARTE / VENCIDA
- A auditoria **não** consulta `public.auditoria` — usa apenas dados derivados. Histórico de alterações intermediárias não aparece para o operador.

## Comparativo com SISVIDA (imagens anexadas)

| Recurso SISVIDA | SISLAC |
|---|---|
| **Galerias para Expurgo** (lista por galeria com "Data prevista para Expurgo") | ❌ |
| **Amostras para Expurgo** (grade visual + checkbox + "Expurgar Selecionados") | ❌ |
| **Expurgo de Amostras** (lista geral + filtro por data, galeria, atendimento) | ❌ (parcial — só "Descartadas" no filtro) |
| Janela de retenção configurável por galeria/material | ❌ |
| Expurgo em lote | ❌ |
| Etiqueta da galeria com data prevista | ❌ |
| Histórico de quem expurgou e quando | ⚠️ Existe em `auditoria`, não na UI |

## Avaliação

| Pergunta | Resposta |
|---|---|
| O expurgo é seguro? | ⚠️ Parcial — não exige motivo, não vincula responsável visualmente |
| O expurgo é auditável? | ⚠️ Tecnicamente sim (audit_trigger), operacionalmente não (UI não mostra) |
| É definitivo? | ❌ Tecnicamente reversível — não há flag `irreversible` nem trigger que bloqueie UPDATE pós-DESCARTADA |
| Existe planejamento (data prevista)? | ❌ |
| Existe expurgo em lote? | ❌ |
| Existe política por material/setor? | ❌ |

## Recomendações (Fase 2+)

1. Separar **VENCIDA** (validade biológica, automático) de **EXPURGADA** (decisão programada).
2. Tabela `amostra_expurgos`: política (material, setor, dias_retencao), execução (data_prevista, data_executada, responsavel, motivo, lote_id).
3. UI: "Expurgo programado" — lista com data prevista, ação em lote.
4. Trigger que bloqueia transição reversa de `EXPURGADA`/`DESCARTADA` (`RAISE EXCEPTION` se status anterior já era terminal).
5. Campo `motivo_descarte` (text) obrigatório em transição manual.
6. Exibir timeline real (`public.auditoria`) no `AmostraDetalheDialog`.
