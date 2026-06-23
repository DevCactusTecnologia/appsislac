# Equipe 2.0 — Assinaturas e Responsabilidade Técnica

## Modelo de assinatura

Persistido **dentro de `profiles`** (não há tabela separada):

| Coluna | Tipo | Significado |
|---|---|---|
| `assinatura_tipo` | text | `'carimbo'` (texto gerado) ou `'imagem'` (PNG/JPG scaneada). Default: `carimbo`. |
| `assinatura_imagem_key` | text | Chave S3 da imagem (quando tipo=imagem). |
| `assinatura_conselho` | text | Texto livre (`CRBM/MG 12345`). |

UI: `src/components/usuarios/AssinaturaSection.tsx` (apenas no modo edição).
Edge: `upload-assinatura` (upload/delete), `assinatura-url` (signed URL).

## Quem pode assinar

Qualquer usuário com permissão `liberar_resultado` que tenha sua assinatura configurada. Liberação acontece em `src/pages/ResultadoDetalhe.tsx`. A assinatura usada no laudo é lida diretamente de `profiles` em `ResultadoDetalhe.tsx:149`.

Não há trava do tipo "só biomédico assina". Não há separação responsável técnico × executor. O “quem libera” no laudo é o `auth.uid()` corrente — quem clicou em liberar.

## Responsável técnico

Existe em outros lugares **fora** do módulo Equipe:

- `tenants.responsavel_tecnico` (+ `_conselho`, `_numero`, `_uf`) → exibido no super-admin (`SuperAdminTenants.tsx`). É o RT formal do laboratório como entidade.
- `tenant_lab_config` (não listado) provavelmente espelha. Não consumido em laudos por padrão.

→ **Responsável técnico do tenant é um único registro** (string), não um vínculo com um `profiles`. Não há FK. Não há rastreabilidade de "quem é o RT atual" como pessoa logável.

## Validação / auditoria

- Sem assinatura digital criptográfica (PAdES/CAdES). É carimbo visual + imagem escaneada.
- A liberação de resultado é registrada em `atendimento_exames` (status + data + user). Auditoria genérica via tabela `audit_logs` + `operational_audit`.
- Não há tabela "signatures" com hash do conteúdo assinado.

## Riscos

1. Trocar a imagem de assinatura em `profiles` **altera retroativamente** o que aparece em laudos antigos se eles forem reimpressos via `ResultadoDetalhe` (a busca é por `user_id`, não snapshot).
2. Inexistência de papel “responsável técnico” na Equipe significa que qualquer usuário com `liberar_resultado` é tratado como assinante — sem hierarquia clínica.

Ambos são decisões conscientes consistentes com a filosofia "Olhou. Entendeu. Resolveu." e não constituem bug — apenas devem ser documentados.
