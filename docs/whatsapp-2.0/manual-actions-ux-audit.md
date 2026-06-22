# WhatsApp 2.0 — Auditoria de UX e Ações Manuais

Escopo: descobrir onde o operador *espera* clicar para enviar uma
notificação WhatsApp manualmente e colocar o botão exatamente ali.
Sem mudar regras de negócio, Meta, Outbox ou Dispatcher.

---

## Fase 1 — Inventário

| Notificação            | Helper                                   | Tela / Rota                                | Componente                          | Acionamento atual                                                                                          |
| ---------------------- | ---------------------------------------- | ------------------------------------------ | ----------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Resultado pronto       | `notifyResultadoPronto()`                | `/resultado/:protocolo` (`ResultadoDetalhe.tsx`) | `PacienteHeaderCard` + `MaisAcoesMenu` | Automático na liberação; manual antes só via dropdown **Mais ações → Enviar WhatsApp ao paciente**.        |
| Recoleta               | `notifyRecoleta()`                       | `SolicitarRecoletaDialog`                  | Toast após "Recoleta registrada"    | Automático; em modo manual, toast com ação **Enviar WhatsApp**.                                            |
| Orçamento → comprovante | `enqueueNotification()` (template `comprovante_atendimento`) | `Orcamentos.tsx` (pós-conversão) | `StandardDialog` "Enviar confirmação" | Botão verde **Enviar via WhatsApp** em destaque após conversão.                                            |
| Comprovante (PDF)      | `enqueueNotification()` via `PdfPreviewDialog` | `/atendimentos` etc.                       | `PdfPreviewDialog`                  | Botão **Enviar WhatsApp** na barra inferior do preview do PDF.                                             |

Outros pontos auditados (sem mudança necessária):

- `Pacientes.tsx` / `Especialistas.tsx` → botões `wa.me` são **diálogo
  livre humano-a-humano**, não notificação transacional. Não entram no
  fluxo Outbox e ficam como estão.
- `comprovantes.ts` (helpers `enviarComprovantePorWhatsapp` /
  `enviarOrcamentoPorWhatsapp`) já foram removidos nas Fases 3D/3D.2 —
  hoje só restam funções de download local.

---

## Fase 2 — UX operacional (antes × depois)

### Resultado Pronto
- **Antes:** Manual disponível, mas escondido em `Mais ações → Enviar
  WhatsApp ao paciente`. **2 cliques** (abrir dropdown + selecionar).
- **Depois:** Botão dedicado **Enviar WhatsApp** (verde WhatsApp, ícone
  `Send`) renderizado no slot `actionsExtraLeft` do `PacienteHeaderCard`,
  ao lado de "Imprimir todos", sempre que `todosLiberados === true` e
  fora de `modoConsulta`. **1 clique.**
- Item duplicado removido de `MaisAcoesMenu`.

### Recoleta
- **Antes:** Toast com ação **Enviar WhatsApp** imediatamente após
  `criarRecoleta()` (modo manual). **1 clique.**
- **Depois:** Mantido. Já estava no ponto correto (logo após a ação que
  criou a recoleta).

### Orçamento (notificação ao paciente)
- **Antes:** Dialog dedicado pós-conversão com botão **Enviar via
  WhatsApp** em destaque. **1 clique.**
- **Depois:** Mantido. Local intuitivo — o operador acabou de converter
  o orçamento.

### Comprovante de atendimento
- **Antes:** Botão **Enviar WhatsApp** primário em `PdfPreviewDialog`
  (mesma barra de Imprimir / Baixar). **1 clique.**
- **Depois:** Mantido. Atende a diretriz "próximo de Imprimir / Baixar /
  Enviar WhatsApp".

---

## Padronização visual

Todos os disparadores manuais usam:

- Ícone `Send` (lucide).
- Texto **Enviar WhatsApp** (nunca "Notificar", "Comunicar",
  "Disparar", "Mensagem").
- Cor verde WhatsApp `hsl(142,70%,45%)` quando há espaço para botão
  primário (Resultado Pronto, Orçamento). Em toasts/dialog actions o
  estilo segue o componente hospedeiro.

---

## Limpeza

| Item                                                                                 | Status |
| ------------------------------------------------------------------------------------ | ------ |
| Botão "Enviar WhatsApp ao paciente" duplicado em `MaisAcoesMenu`                     | Removido (`src/components/resultado/MaisAcoesMenu.tsx`). |
| Props `onEnviarWhatsapp` / `podeEnviarWhatsapp` em `MaisAcoesMenu`                   | Removidas. |
| Chamadas obsoletas dessas props em `ResultadoDetalhe.tsx` (2 ocorrências)            | Removidas. |
| Novos helpers/serviços/hooks                                                         | Nenhum criado — reuso 100% do `notifyResultadoPronto` existente. |
| Helpers órfãos / imports mortos                                                      | Nenhum identificado. |

---

## Validação

- `bunx vitest run` → 22/22 passaram.
- Build/typecheck limpo após remoção das props.
- Fluxo Outbox / Dispatcher / Meta inalterado.
- Política `automatic | manual` por tenant inalterada — botão manual
  segue chamando `notifyResultadoPronto({ force: true })`.

---

## Respostas finais

- **Onde cada ação estava?** Resultado Pronto escondido em "Mais ações";
  Recoleta, Orçamento e Comprovante já estavam visíveis.
- **Quantos cliques exigia?** Resultado Pronto = 2 cliques. Demais = 1.
- **Onde foi reposicionada?** Resultado Pronto promovido a botão primário
  no cabeçalho do paciente em `ResultadoDetalhe`, ao lado de
  "Imprimir todos".
- **Existe duplicação?** Não — botão removido de `MaisAcoesMenu`.
- **Código morto removido?** Sim (props + branch do dropdown).
- **Resultado Pronto ficou intuitivo?** Sim — 1 clique, visível assim
  que todos os exames estão liberados.
- **Recoleta ficou intuitiva?** Sim — toast imediato após a ação.
- **Orçamento ficou intuitivo?** Sim — diálogo pós-conversão.
- **Comprovante ficou intuitivo?** Sim — barra inferior do preview do PDF.
- **UX consistente?** Sim — ícone `Send`, rótulo "Enviar WhatsApp",
  verde WhatsApp onde há botão primário; máximo 1 clique do contexto
  até o envio.
