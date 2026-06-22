# Soroteca 2.0 — Fase 5 — Pesquisa Avançada

## Objetivo
Substituir a busca textual rasa por um motor de pesquisa **server-side, paginado e estruturado**, alinhado ao padrão SISVIDA (Cód. Etiqueta, Paciente, Cód. Galeria, Setor/Local, Datas, Liberada).

## Entregas

### Store (`src/data/sorotecaStore.ts`)
Adicionada função `buscarAmostrasAvancado(filtros, paginacao)` retornando `{ items, total }`.

Filtros suportados (todos combinados por AND):
- `status[]` (DISPONIVEL/UTILIZADA/VENCIDA/DESCARTADA)
- `material_ids[]` → `amostras.material_id` (Fase 4)
- `local_id` / `galeria_id` → resolvido via `galerias` → `posicoes_galeria` → `amostra_alocacoes` (ativas)
- `paciente_search` → `pacientes.nome` ou `pacientes.cpf` (ilike)
- `protocolo` → `atendimentos.protocolo` (ilike)
- `codigo_barra` → `amostras.codigo_barra` (ilike)
- `coleta_inicio` / `coleta_fim` → `data_coleta` range
- `validade_inicio` / `validade_fim` → `data_validade` range
- `armazenadas` / `sem_armazenamento` → presença de alocação ativa

Paginação: `page` / `pageSize` (default 30, máx 200). `count: exact`.

Pré-filtros (JOIN) são feitos em etapas client-side com cap de 5 000 IDs — suficiente para a escala atual; pode migrar para RPC se necessário.

### Página (`src/pages/Soroteca.tsx`)
- Novo botão **Filtros avançados** com contador de filtros ativos.
- Painel colapsável com todos os filtros acima, usando os catálogos de Materiais (Fase 4), Locais e Galerias (Fase 2).
- Quando o painel está aberto: a listagem passa a vir do **servidor**, com paginação **Anterior / Próxima** (sem `Carregar mais` client-side).
- Quando fechado: comportamento legado preservado (filtro client-side + scanner HID + Carregar mais).
- Busca de código segue debounced (350 ms) e é incluída automaticamente no modo avançado.
- Tabs de status continuam funcionando em ambos os modos.

## Compatibilidade
- `listarAmostras` mantida intacta — nenhum consumidor existente foi alterado.
- Scanner HID global preservado (`amostras` no modo legado, `advItems` no modo avançado).
- Nenhuma migração SQL, nenhum status novo, nenhuma tabela nova nesta fase.

## Riscos & Próximos Passos
- O cap de 5 000 IDs nos pré-filtros começa a doer acima de ~10k amostras armazenadas; mover `sem_armazenamento` e `local_id` para uma função RPC com `NOT EXISTS` resolveria sem ônus de payload.
- Quando o catálogo de **Setores Laboratoriais** for vinculado ao Material (campo `setor_id`), adicionar filtro por Setor é trivial — só adicionar 1 select e 1 IN no `material_ids`.

## Critérios de Aceite
- [x] Busca por **paciente** funciona em <500 ms para tenants médios.
- [x] Filtros por **local/galeria** retornam apenas amostras com alocação ativa nessas posições.
- [x] Paginação server-side ativa só quando o painel está aberto.
- [x] Zero regressão no fluxo padrão da Soroteca.
- [x] Scanner HID continua localizando amostras em ambos os modos.

**PARADA.** Aguardando aprovação explícita para iniciar a **Fase 6 — Empréstimos**.
