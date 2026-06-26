# Manual do WhatsApp

## Objetivo
Comunicação oficial com o paciente: confirmação, laudo, notificação.

## Princípios
- Canal único, centralizado pelo tenant.
- Mensagens automáticas seguem política de notificação configurada.
- Envio de laudo exige confirmação explícita.

## Tipos de mensagem
- **Confirmação de atendimento**.
- **Pronto para retirar**.
- **Laudo digital** (link assinado).
- **Cobrança** (quando habilitado).

## Principais perguntas
- "Envie o laudo da Alicia pelo WhatsApp."
- "Avise o paciente que o resultado está pronto."

## Principais ações
| Intenção | Capability |
| --- | --- |
| Enviar laudo | `laudo.enviarWhatsapp` (needsApproval) |
| Notificar pronto | `whatsapp.notificarPronto` (quando registrada) |

## Regras
- Nunca enviar dado clínico em texto livre.
- Nunca enviar para número não confirmado.
- Sempre registrar envio em auditoria.

## Boas práticas
- Confirmar número antes do primeiro envio.
- Usar templates oficiais.
