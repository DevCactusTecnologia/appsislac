# Soroteca 2.0 — Fase 1.2 — Mapa de Domínio

## Entidades existentes hoje

| Entidade | Tabela / objeto | Existe? | Observação |
|---|---|---|---|
| **Amostra** | `public.amostras` | ✅ Sim | Núcleo do domínio |
| **Etiqueta (código de barras)** | `amostras.codigo_barra` | ✅ Sim | Atributo, não entidade própria. Formato `A-YYYYMMDD-NNNNNN-D` |
| **Material** | `amostras.tipo_material` (text livre) | ⚠️ Parcial | Texto livre, sem catálogo. Lista de "não-reutilizáveis" é hard-coded no client |
| **Setor laboratorial** | `setores_laboratoriais` (existe) | ❌ Não vinculado a Soroteca | Não há FK de amostra → setor; SISVIDA expõe coluna "Setor" |
| **Galeria / Bandeja / Rack** | — | ❌ Não existe | SISVIDA possui; SISLAC trata como string em `localizacao` |
| **Posição / Orifício** | — | ❌ Não existe | SISVIDA mapeia visualmente; SISLAC não modela |
| **Local de armazenamento** (geladeira, freezer) | — | ❌ Não existe | SISVIDA possui CRUD próprio |
| **Expurgo** (descarte programado) | `status='DESCARTADA'` | ⚠️ Parcial | Descarte é manual, individual, sem janela "data prevista de expurgo" |
| **Empréstimo de amostra** | — | ❌ Não existe | SISVIDA possui botão "emprestar" |
| **Sequencial diário** | `amostra_sequence` | ✅ Sim | Suporte ao gerador de código |
| **Auditoria** | `auditoria` + `audit_trigger` | ✅ Sim | Cobre INSERT/UPDATE/DELETE em `amostras` |

## Ownership (quem é dono da informação)

| Informação | Dono lógico | Quem atualiza |
|---|---|---|
| Existência da amostra | **Coleta** (`RegistrarColeta`) | Coletor — via `criarAmostraParaExame` |
| `codigo_barra` | **Backend** (`gerar_codigo_amostra`) | Função SECURITY DEFINER |
| `data_validade` | **Coleta** | Calculada a partir de `VALIDADE_PADRAO_HORAS` (client-side, hoje 24h) |
| `localizacao` | **Soroteca** (modal de detalhe) | Operador — texto livre |
| `status` | **Coleta** (cria DISPONIVEL) / **Análise** (UTILIZADA) / **Job** (VENCIDA) / **Soroteca** (DESCARTADA) | Múltiplos |
| Vínculo `atendimento_exame.amostra_id` | **Coleta** / **Atendimento** (reuso) | Coletor / fluxo de reuso |
| `is_reutilizacao` | **Atendimento** | Marcado ao chamar `reutilizarAmostra` |

## Consumers (quem lê)

| Consumidor | Lê o quê |
|---|---|
| Tela Soroteca | Tudo — listagem geral |
| AmostraDetalheDialog | Amostra + paciente + atendimento + exames vinculados + auditoria + dados de terceirizado |
| NovoAtendimento | `buscarAmostrasReutilizaveis*` — apenas DISPONIVEL no prazo |
| AnalisarAmostra | Lê `amostra_id` do exame para reimprimir etiqueta |
| ImpressaoLotePorLab | Agrupa amostras de exames terceirizados |
| Views `vw_coletas_operacionais` / `vw_producao_operacional` | `amostra_id` para join |

## Lacunas estruturais

1. **Falta hierarquia física**: Local → Galeria → Posição → Amostra. Hoje é apenas texto.
2. **Falta cadastro de Material** com regras (validade padrão, reutilizável, foto, ícone).
3. **Falta entidade Expurgo** como evento programado (janela de retenção por material/setor).
4. **Falta entidade Empréstimo** (saída temporária com motivo, responsável, devolução).
5. **Falta vínculo Setor** — diferentes setores podem ter regras de retenção distintas.
6. **`amostras.observacao` é monolítico** — recebe motivo de descarte, destino de envio, etc. Sem campo específico.

## Diagrama (atual)

```text
atendimentos ──┬─< atendimento_exames ──> amostras
               │                            │
               │                            ├──> exames_catalogo
               │                            ├──> pacientes
               │                            └──> tenants
               │
               └─< (lab_apoio_id) ──> labs_apoio
```

## Diagrama (proposto — Fase 2+)

```text
locais_armazenamento ──< galerias ──< posicoes_galeria ──< amostras
                                                              ├──> materiais_amostra
                                                              ├──> setores_laboratoriais
                                                              └──< amostra_emprestimos
                                                              └──< amostra_expurgos
```
