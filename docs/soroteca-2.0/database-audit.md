# Soroteca 2.0 — Fase 1.4 — Auditoria de Banco

## Tabela `public.amostras`

### Colunas
| Coluna | Tipo | Nullable | Default | Observação |
|---|---|---|---|---|
| `id` | uuid | NOT NULL | `gen_random_uuid()` | PK |
| `tenant_id` | uuid | NOT NULL | — | FK → tenants, ON DELETE CASCADE |
| `atendimento_id` | bigint | NULL | — | FK → atendimentos, ON DELETE SET NULL |
| `atendimento_exame_id` | bigint | NULL | — | FK → atendimento_exames, ON DELETE SET NULL |
| `exame_id` | uuid | NULL | — | FK → exames_catalogo |
| `paciente_id` | bigint | NULL | — | FK → pacientes |
| `codigo_barra` | text | NOT NULL | — | Único por tenant |
| `tipo_material` | text | NOT NULL | `''` | **Texto livre — sem catálogo** |
| `status` | text | NOT NULL | `'DISPONIVEL'` | CHECK in (DISPONIVEL/UTILIZADA/VENCIDA/DESCARTADA) |
| `data_coleta` | timestamptz | NOT NULL | `now()` | |
| `data_validade` | timestamptz | NOT NULL | — | |
| `localizacao` | text | NOT NULL | `''` | **Texto livre — sem estrutura física** |
| `observacao` | text | NOT NULL | `''` | Monolítica — guarda motivo de descarte, destino apoio, etc. |
| `created_at` | timestamptz | NOT NULL | `now()` | |
| `updated_at` | timestamptz | NOT NULL | `now()` | Trigger `amostras_updated_at` |

### Índices (9)
- `amostras_pkey` (id)
- `amostras_codigo_barra_tenant_unique` (tenant_id, codigo_barra) **UNIQUE**
- `idx_amostras_atex` (atendimento_exame_id)
- `idx_amostras_paciente_exame` (tenant_id, paciente_id, exame_id, status) — usado em busca de reutilização
- `idx_amostras_status` (status)
- `idx_amostras_tenant` (tenant_id)
- `idx_amostras_tenant_codigo` (tenant_id, codigo_barra) — **duplica** o índice único
- `idx_amostras_tenant_status_validade` (tenant_id, status, data_validade) — usado pelo job de vencidas
- `idx_amostras_validade` (data_validade)

**Dívida**: `idx_amostras_tenant_codigo` é redundante com `amostras_codigo_barra_tenant_unique`.

### Constraints
- CHECK status ∈ {DISPONIVEL, UTILIZADA, VENCIDA, DESCARTADA}
- FK para `atendimentos`, `atendimento_exames`, `exames_catalogo`, `pacientes`, `tenants`

### Triggers
- `amostras_updated_at` (BEFORE UPDATE)
- `audit_amostras` (AFTER INSERT/UPDATE/DELETE → `audit_trigger`)

## Tabela `public.amostra_sequence`
| Coluna | Tipo | Default |
|---|---|---|
| tenant_id | uuid | — |
| dia | date | — |
| ultimo_numero | int | 0 |
| updated_at | timestamptz | now() |

PK composta (tenant_id, dia). Sem trigger. Sem policy de WRITE — gravação só via `gerar_codigo_amostra()` SECURITY DEFINER.

## Funções SQL

| Função | Tipo | Função |
|---|---|---|
| `gerar_codigo_amostra(uuid, date)` | SECURITY DEFINER | Atomicamente incrementa `amostra_sequence` e retorna `A-YYYYMMDD-NNNNNN-D` |
| `_calc_dv_amostra(text)` | IMMUTABLE | Dígito verificador (pesos 3,1) |
| `marcar_amostras_vencidas()` | — | UPDATE em lote DISPONIVEL→VENCIDA por `data_validade < now()` |
| `proxima_amostra_seq(atendimento, exame, nome)` | — | Sequencial por exame dentro do atendimento |
| `tg_amostras_updated_at` | TRIGGER | atualiza `updated_at` |

## Volume atual (DEMO)
- 19 amostras, todas `DISPONIVEL`. Base ainda pequena, performance não é dor — mas será com volume real.

## Relacionamentos (entradas)
- `atendimento_exames.amostra_id` → `amostras.id` (ON DELETE SET NULL)
- Views: `vw_coletas_operacionais`, `vw_producao_operacional`

## Avaliação

| Critério | Resultado |
|---|---|
| Multi-tenant correto | ✅ `tenant_id NOT NULL` + RLS por `current_tenant_id()` |
| RLS coerente com perfis | ✅ 4 policies, baseadas em `has_permission` |
| Auditoria | ✅ `audit_trigger` cobre tudo |
| Modelagem para galeria/posição | ❌ Inexistente |
| Catálogo de material | ❌ Texto livre |
| Empréstimo | ❌ Inexistente |
| Expurgo (retenção pós-análise) | ❌ Inexistente |
| Duplicação | ⚠️ índice `idx_amostras_tenant_codigo` redundante |
| Acoplamento | ✅ Baixo — FKs com `ON DELETE SET NULL` evitam cascata destrutiva |
| Reentrância (reuso) | ⚠️ Não há histórico explícito de reusos múltiplos: `is_reutilizacao` é booleano no exame, não na amostra. Reusos sucessivos exigem reconstrução via `atendimento_exames.amostra_id` |

## Estrutura é suficiente para Soroteca 2.0?

**Parcialmente.** O núcleo (`amostras` + `amostra_sequence` + `audit_trigger`) é sólido e pode ser preservado. Precisa **acrescentar** (sem quebrar):

1. `materiais_amostra` (catálogo)
2. `locais_armazenamento` (geladeira/freezer)
3. `galerias` (bandeja/rack)
4. `posicoes_galeria` (orifício)
5. `amostra_alocacoes` (link amostra ↔ posição com histórico)
6. `amostra_emprestimos`
7. `amostra_expurgos` (políticas de retenção + execuções)
8. Colunas em `amostras`: `material_id`, `setor_id`, `posicao_id` (nullable, gradual)
