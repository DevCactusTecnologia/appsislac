# Soroteca 2.0 — Fase 1.1 — Inventário de Código

> Auditoria 100% leitura. Nada foi alterado.

## 1. Frontend

### Páginas
| Arquivo | Linhas | Função |
|---|---|---|
| `src/pages/Soroteca.tsx` | 745 | Tela única operacional: lista, busca, filtros por status, scanner HID global, descarte, "atualizar vencidas", ajuda contextual |
| `src/pages/AnalisarAmostra.tsx` | 994 | Tela de análise — consome `imprimirEtiquetaPorAtendimentoExame` (não é tela de Soroteca, mas é consumidora) |

### Componentes (`src/components/soroteca/`)
| Arquivo | Linhas | Função |
|---|---|---|
| `AmostraDetalheDialog.tsx` | 558 | Modal de detalhe — paciente, atendimento, exames vinculados, timeline de eventos, vínculo terceirizado, reimpressão de etiqueta |
| `BarcodeScannerDialog.tsx` | 204 | Captura código de barras via input dedicado |
| `ReutilizarAmostraDialog.tsx` | 108 | Diálogo de reaproveitamento de amostra disponível (consumido por `NovoAtendimento`) |

### Stores / Serviços
| Arquivo | Função |
|---|---|
| `src/data/sorotecaStore.ts` (676 linhas) | Store oficial. Exporta: `criarAmostraParaExame`, `criarAmostrasParaExames`, `buscarAmostrasReutilizaveis`, `buscarAmostrasReutilizaveisPorNome`, `reutilizarAmostra`, `listarAmostras`, `atualizarAmostra`, `marcarVencidas`, `statusVisual`, `validarCodigoAmostra`, `getAmostraDetalhe` |
| `src/lib/etiquetaAmostra.ts` (290 linhas) | Geração e impressão de etiqueta física da amostra |
| `src/lib/imprimirEtiquetaPorAtendimentoExame.ts` (144 linhas) | Wrapper: resolve amostra a partir de um `atendimento_exame.id` |
| `src/lib/labApoio.ts` | `resolveAmostrasPorLab` — agrupa exames por (material + lab apoio) para criar 1 amostra por destino |

### Consumidores externos da store
| Tela / Componente | Função chamada |
|---|---|
| `RegistrarColeta.tsx` | `criarAmostraParaExame` (linha 330), `imprimirEtiquetaPorAtendimentoExame` (768, 942, 960) |
| `NovoAtendimento.tsx` | `buscarAmostrasReutilizaveisPorNome` (862), `reutilizarAmostra` (2557), `ReutilizarAmostraDialog` (lazy) |
| `AnalisarAmostra.tsx` | `imprimirEtiquetaPorAtendimentoExame` (644) |
| `ImpressaoLotePorLab.tsx` | `imprimirEtiquetaPorAtendimentoExame` (135) |
| `AmostraDetalheDialog` | `imprimirEtiquetaAmostra` |

### Hooks
Nenhum hook dedicado a Soroteca. Toda lógica é acessada diretamente pela store.

## 2. Backend (banco)

### Tabelas
| Tabela | Função |
|---|---|
| `public.amostras` | Tabela núcleo — 1 linha = 1 amostra física |
| `public.amostra_sequence` | Sequencial diário (`tenant_id`, `dia`, `ultimo_numero`) usado para emitir códigos |

### Funções SQL
| Função | Assinatura | Função |
|---|---|---|
| `gerar_codigo_amostra` | `(_tenant_id uuid, _data date DEFAULT CURRENT_DATE)` | Emite `A-YYYYMMDD-NNNNNN-D` sequencial |
| `_calc_dv_amostra` | `(_digitos text)` | Dígito verificador (pesos alternados 3,1) |
| `marcar_amostras_vencidas` | `()` | Transição em lote `DISPONIVEL → VENCIDA` por `data_validade < now()` |
| `proxima_amostra_seq` | `(_atendimento_id, _exame_id, _nome_exame)` | Sequência por exame (`amostra_seq`) — usada no fluxo de múltiplas amostras por exame |
| `tg_amostras_updated_at` | trigger | Atualiza `updated_at` |
| `audit_trigger` | trigger (compartilhada) | Grava em `auditoria` toda INSERT/UPDATE/DELETE em `amostras` |

### Policies (RLS) — `amostras`
| Nome | Cmd | Regra |
|---|---|---|
| `amostras_select` | SELECT | `super_admin` OU (`tenant_id = current_tenant_id()` E permissão `visualizar_atendimentos` / `registrar_coleta` / `analisar_amostra`) |
| `amostras_insert` | INSERT | `current_tenant_id()` + permissão `registrar_coleta` / `editar_atendimento` / `criar_atendimento` / `admin` |
| `amostras_update` | UPDATE | mesma do INSERT + `analisar_amostra` |
| `amostras_delete` | DELETE | apenas `admin` no tenant |

### Policies `amostra_sequence`
- `amostra_sequence_select` (SELECT) — super_admin ou mesmo tenant. **Não há policy de INSERT/UPDATE** — gravação feita via `gerar_codigo_amostra` (SECURITY DEFINER).

### Views relacionadas
- `vw_coletas_operacionais` e `vw_producao_operacional` referenciam `amostras_atendimento_exame_id_fkey`.

### Storage / Buckets
Nenhum bucket dedicado a Soroteca.

### Integrações de outras tabelas
- `atendimento_exames.amostra_id (uuid)` → FK `amostras(id)` ON DELETE SET NULL
- `atendimento_exames.is_reutilizacao (bool)` — marca reaproveitamento
- `atendimento_exames.tipo_processo / lab_apoio_id / data_envio / data_retorno` — usados para mostrar vínculo terceirizado no detalhe da amostra

## 3. Integrações por módulo

| Módulo | Como toca Soroteca |
|---|---|
| **Atendimento** (`NovoAtendimento`) | Oferece reuso de amostra existente ao criar exame |
| **Coleta** (`RegistrarColeta`) | Cria amostra automaticamente ao marcar `Amostra Coletada`; imprime etiqueta |
| **Análise** (`AnalisarAmostra`) | Reimprime etiqueta a partir do exame |
| **Produção / Resultados** | Não tocam diretamente — leem `amostra_id` indiretamente via views |
| **Lab. Apoio** (`ExamesTerceirizadosPanel`, `ImpressaoLotePorLab`) | Imprime etiquetas; agrupa amostras por destino |
| **Financeiro** | Nenhum acoplamento |
| **Portal do Paciente** | Nenhum acoplamento |

## 4. Código morto / órfão (identificado)

Nenhum arquivo de Soroteca está sem consumidores. Pontos de atenção:

- `void reutilizarAmostra;` em `NovoAtendimento.tsx:2557` — chamada **morta** (no-op `void`). A chamada efetiva acontece no `ReutilizarAmostraDialog` — confirmar e remover na Fase 2.
- `buscarAmostrasReutilizaveis` (assinatura por `exameId`) é usada apenas indiretamente por `buscarAmostrasReutilizaveisPorNome`. Pode permanecer como API pública.
- Constantes `MATERIAIS_NAO_REUTILIZAVEIS` e `VALIDADE_PADRAO_HORAS` estão hard-coded — não são código morto, mas são candidatos a virar configuração de tenant.

## 5. Resumo numérico

- 2 páginas, 3 componentes, 1 store, 3 helpers (`labApoio`, `etiquetaAmostra`, `imprimirEtiquetaPorAtendimentoExame`)
- 2 tabelas, 5 funções SQL, 4 policies RLS na tabela núcleo
- 5 telas/consumidores externos
- 0 hooks, 0 buckets, 0 edge functions
