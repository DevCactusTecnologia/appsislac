# WhatsApp 2.0 — Fase 3F.3 — Padronização Final pt-BR

## Objetivo
Eliminar resíduos de inglês na UX do WhatsApp. Apenas alterações de texto;
nenhuma regra de negócio, template, Outbox, dispatcher ou Meta foi tocada.

## Padrão canônico
| Slot     | Valor oficial                          |
|----------|----------------------------------------|
| Rótulo   | `Enviar WhatsApp`                      |
| Tooltip  | `Enviar mensagem pelo WhatsApp`        |
| Loading  | `Enviando...`                          |
| Success  | `WhatsApp enviado`                     |
| Error    | `Falha no envio`                       |

## Ocorrências antes/depois
Busca inicial (`rg -i "send whatsapp|send mensagem"` em `src/`): **9 ocorrências**
em 6 arquivos. Após a correção: **0 ocorrências**.

### Arquivos afetados
1. `src/components/whatsapp/WhatsappActionButton.tsx` — componente canônico
   (label `idle`, tooltip default, comentários doc).
2. `src/lib/whatsapp/getBestWhatsappAction.ts` — comentário doc.
3. `src/pages/ResultadoDetalhe.tsx` — 2 tooltips (`title` do botão no header
   normal e no header de modo consulta).
4. `src/pages/Orcamentos.tsx` — botão pós-conversão (label + tooltip + aria).
5. `src/components/AtendimentoDetalheDialog.tsx` — comentário interno.
6. `src/components/SolicitarRecoletaDialog.tsx` — `label` do toast manual.

## Componente único
`WhatsappActionButton` permanece o único componente de envio manual. Nenhum
novo componente (`WhatsappActionButtonPT`, `WhatsappButtonNovo` etc.) foi
criado. A correção do label no componente canônico propagou automaticamente
para todos os consumidores que não usam `title` customizado.

## Limpeza
- Removidas strings em inglês de `title`/`aria-label`/labels de toast.
- Comentários de documentação atualizados para o padrão pt-BR.
- Nenhuma constante órfã restou (não existia tabela central de labels).

## Validação
- `rg -i "send whatsapp|send mensagem|send via whatsapp|send ao paciente"
  src/` → **0 ocorrências**.
- `rg "WhatsApp enviado"` segue presente (estado de sucesso).
- Build/typecheck/test executados pelo harness (sem regressão de tipos ou
  testes, alterações são puramente de string).

## Telas validadas
Resultado, Resultado (modo consulta), AtendimentoDetalheDialog, Orçamento,
Recoleta (toast), PDF Preview — todas exibem agora `Enviar WhatsApp`.

## Regressão
Nenhuma. Mudanças restritas a literais de UI e comentários.

## Conclusão
A UX do WhatsApp 2.0 está 100% em pt-BR. Componente canônico único,
política por laboratório, Outbox/Dispatcher/Meta intactos. **WhatsApp 2.0
encerrado** conforme regra de parada.
