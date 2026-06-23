# Auditoria de Campos — `exames_catalogo`

Total de colunas: **64**. Classificação:

| Classe | Definição |
|---|---|
| 🟢 **Obrigatório** | Sem ele o laboratório não opera |
| 🔵 **Importante** | Agrega valor operacional, alto uso |
| 🟡 **Técnico** | Necessário para integrações ou regulatório |
| 🟠 **Legado** | Usado em poucos lugares, candidato a refactor |
| 🔴 **Morto** | 0 consumidores fora do próprio formulário |

## 🟢 Obrigatórios (operação não funciona sem)
| Campo | Por quê |
|---|---|
| `id` | Chave em todas as relações |
| `tenant_id` | Multi-tenant |
| `nome` | Exibição em qualquer tela |
| `mnemonico` | Busca, etiqueta, atalho |
| `ativo` | Filtro de seleção |
| `tipo_processo` | Roteia interno vs apoio |
| `analise` | Fluxo analítico vs descritivo |
| `setor_id` (ou `categoria`) | Produção e mapa |
| `material` | Coleta |
| `recipiente` + `cor_tampa` | Coleta |
| `prazo_entrega_dias` | Atendimento (previsão) |
| `quantidade_etiquetas` | Coleta |
| `sexo_aplicavel` | Validação clínica |

## 🔵 Importantes (alto uso operacional)
| Campo | Onde é usado |
|---|---|
| `codigo` | Etiqueta, busca |
| `codigo_cbhpm`, `codigo_tuss`, `porte_cbhpm` | Faturamento / convênios |
| `lab_apoio_id` | Roteamento de apoio |
| `integracao_ativa` | Pipeline de integração |
| `requer_jejum`, `horas_jejum`, `preparo_paciente` | Atendimento |
| `volume_minimo_ml`, `estabilidade` | Coleta |
| `grupo_etiquetas`, `informacoes_coleta` | Coleta |
| `exibir_portal` | Vitrine |
| `usado_em_atendimento` | Estatística / cleanup |
| `urgencia_disponivel`, `prazo_urgencia_horas` | Atendimento urgente |

## 🟡 Técnicos (regulatórios / integrações)
| Campo | Justificativa |
|---|---|
| `codigo_loinc` | Padrão internacional — **lido 0 vezes hoje** mas necessário p/ interfaceamento |
| `codigo_sus` | SUS / SIA — **lido 0 vezes hoje** mas necessário p/ SUS |
| `codigo_exame_apoio` | Driver de apoio (lê) |
| `provider_integracao` | Driver de apoio (lê) |
| `requer_assinatura_medica` | Laudo |
| `template_laudo_id` | Layout (pertence ao Layout Científico) |

## 🟠 Legado / acoplados ao Layout Científico
Estes pertencem conceitualmente a `exame_layouts.config`:
- `metodologia` *(3 leituras — pricing, snapshot)*
- `unidade_padrao`
- `texto_interpretativo_padrao`
- `exibir_metodologia_laudo`
- `exibir_unidade_laudo`
- `exibir_material_laudo`
- `grupo_impressao`
- `ordem_impressao`

## 🟠 Legado / duplicados do Provider de Apoio
Os campos `*_apoio` deveriam estar no driver (provider), não no catálogo:
- `material_apoio`, `recipiente_apoio`, `volume_apoio_ml`, `preparo_apoio`,
  `prazo_apoio_dias`, `exige_protocolo_externo`, `permite_envio_apoio`.

## 🔴 Mortos (0 consumidores fora do próprio formulário)
Conferência via `grep -rn` em `src/`:

| Campo | Leituras fora do dialog/store |
|---|---:|
| `codigo_loinc` | 0 |
| `codigo_sus` | 0 |
| `exame_calculado` | 0 |
| `exame_oculto` | 0 |
| `exige_protocolo_externo` | 0 |
| `grupo_impressao` | 0 |
| `idade_minima_meses` | 0 |
| `idade_maxima_meses` | 0 |
| `material_apoio` | 0 |
| `observacoes_coleta` | 0 |
| `ordem_coleta` | 0 |
| `ordem_impressao` | 0 |
| `ordem_setor` | 0 |
| `prazo_apoio_dias` | 0 |
| `preparo_apoio` | 0 |
| `protegido_luz` | 0 |
| `recipiente_apoio` | 0 |
| `sexo_aplicavel` * | 0 (definido, nunca filtrado) |
| `temperatura_transporte` | 0 |
| `template_laudo_id` | 0 |
| `texto_interpretativo_padrao` | 0 |
| `tipo_mapa` | 0 |
| `tuss_sem_equivalente` | 0 |
| `urgencia_padrao` | 0 |
| `volume_apoio_ml` | 0 |

\* `sexo_aplicavel` é **persistido** mas nenhuma tela bloqueia o agendamento
por divergência de sexo — efetivamente morto. Recomenda-se decidir: ou
implementar a validação, ou remover.

## Resumo
- **Obrigatórios:** 13 colunas
- **Importantes:** 12 colunas
- **Técnicos válidos:** 4 colunas
- **Legados (migrar):** 15 colunas
- **Mortos (remover):** 25 colunas (~39 % do schema)
