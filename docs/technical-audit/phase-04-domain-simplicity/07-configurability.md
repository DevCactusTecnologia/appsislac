# 07 — Configurability

Configurações identificadas no código (`tenant_lab_config`, `app_settings`, `tenant_registry`, políticas WhatsApp, layouts, providers).

| Configuração | Classe | Fonte |
|---|---|---|
| `registrar_coleta` (on/off) | Configurável | `tenant_lab_config` |
| `analisar_amostras` (on/off) | Configurável | `tenant_lab_config` |
| `edit_window_hours` | Configurável | `app_settings` |
| Marca d'água global | Opcional | `app_settings` |
| Política de notificação (auto/manual) por tipo | Configurável | `notification_policy` |
| Token/URL/Phone Meta WhatsApp | Obrigatória (por tenant, se WhatsApp ativo) | secrets |
| PIX chave + provider | Configurável | financeiro |
| Provider de lab de apoio + credenciais | Configurável | `providers registry` |
| Layouts de exame/laudo | Configurável | `exame_layouts` |
| Templates de documento | Configurável | `documento_templates` |
| Tabelas de preço por convênio | Obrigatória (se convênio existir) | `tabelaPrecoStore` |
| Régua etária / VR | Obrigatória laboratorial | `reguas_etarias` |
| Fluxo de assinatura + RT | Obrigatória regulatória | config lab |
| `runtime_mode` (shared/dual/isolated_db) | Operacional plataforma | `tenant_registry` |
| Plano do tenant | Operacional plataforma | `tenant_registry` |
| Unidades/pontos de coleta | Obrigatória se >1 endereço | `unidade` |
| Setores laboratoriais | Configurável | `setores_laboratoriais` |
| Motivos de recoleta / cancelamento | Configurável (dicionário) | select_options / recoletasMotivos |
| CBHPM/TUSS ativo | Configurável | preço |
| Convênio Particular = 0 | Histórica | convenção |
| Bucket/storage | Infra | Cloud |

**Padrão:** SISLAC concentra variabilidade real em `tenant_lab_config` e políticas por tenant, o que evita "feature flags" espalhadas.
