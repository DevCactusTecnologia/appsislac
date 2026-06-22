# Soroteca 2.0 — Fase 1.5 — Pesquisa e Armazenamento

## Pesquisa atual (`src/pages/Soroteca.tsx`)

### Filtros implementados
| Filtro | Tipo | Onde |
|---|---|---|
| Status | Tabs (Todas / Disponíveis / Utilizadas / Vencidas / Descartadas) | Topo |
| Busca textual | Free-text com `searchNormalize` (NFD) | Input do topo |
| Scanner HID | Captura global de teclado emulando leitor de código de barras | `useEffect` em window |

### Campos pesquisáveis (busca textual)
- `codigo_barra`
- `tipo_material`
- `localizacao`

### Filtros ausentes vs SISVIDA
| Filtro SISVIDA | Existe no SISLAC? |
|---|---|
| Cód. Atendimento | ❌ (só em detalhe) |
| Cód. Etiqueta | ✅ (codigo_barra) |
| Paciente | ❌ (não pesquisável em lista — só no detalhe) |
| Cód. Galeria | ❌ |
| Descrição Galeria | ❌ |
| Setor | ❌ |
| Data de Armazenamento (range) | ❌ |
| Data Prevista Expurgo (range) | ❌ |
| Liberada (sim/não) | ❌ |
| Solicitante | ❌ |
| Exame | ❌ |

## Armazenamento (físico)

### Como funciona hoje
- `amostras.localizacao` é texto livre.
- Não há grade visual.
- Não há prevenção de colisão (duas amostras no mesmo orifício).
- Não há "orifícios vazios".

### O que SISVIDA oferece
- Grade visual de orifícios (vide imagens anexadas).
- Galerias cadastradas com capacidade (`Orifícios: 90`).
- Local de armazenamento (geladeira) por galeria.
- Triagem para Armazenamento — leitura do código e alocação na próxima posição livre.
- Etiqueta da Galeria (impressa).

## Performance atual

| Aspecto | Estado |
|---|---|
| Carga inicial | `listarAmostras()` sem paginação no servidor — busca tudo do tenant |
| Paginação client | `PAGE_SIZE = 30`, "carregar mais" incremental |
| Índices úteis | `idx_amostras_paciente_exame`, `idx_amostras_tenant_status_validade` |
| Risco | Com >10k amostras, `listarAmostras()` virá tudo do servidor — precisa paginação SQL + filtros server-side |
| Scanner | Captura HID global. Boa UX. Cuidado para não interferir em modais |

## Recomendações (Fase 2+)

1. Paginação server-side em `listarAmostras` (range + count exact).
2. Filtros server-side: status, material, setor, range de datas, paciente, galeria, posição.
3. Indexar `(tenant_id, paciente_id, status)` e `(tenant_id, localizacao)` quando virar FK.
4. Manter scanner HID global — funciona bem.
5. Adicionar busca por **protocolo do atendimento** (join leve).
6. Substituir busca textual em `localizacao` por filtro estruturado quando a hierarquia existir.
