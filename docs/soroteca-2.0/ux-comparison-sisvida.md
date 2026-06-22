# Soroteca 2.0 — Fase 1.8 — Comparativo UX: SISLAC × SISVIDA

## Telas comparadas (imagens anexadas)

1. **Galerias Disponíveis** — lista de galerias com orifícios livres + botão "armazenar"
2. **Triagem para Armazenamento** — grade visual de orifícios + leitura de etiqueta + lista de amostras pendentes
3. **Pesquisa de Amostras** — grade com 11 colunas + 10+ filtros estruturados
4. **Galerias para Expurgo** — lista por galeria com data prevista
5. **Amostras para Expurgo** — grade visual + checkbox em lote + "Expurgar Selecionados"
6. **Expurgo de Amostras** — pesquisa de amostras já expurgadas
7. **Locais de Armazenamento de Galeria** — CRUD simples (geladeira/freezer)

## Matriz comparativa

| Recurso | SISVIDA | SISLAC atual | Vale manter? | Vale modernizar? |
|---|---|---|---|---|
| Grade visual de orifícios | ✅ | ❌ | — | ✅ Sim — versão moderna com cores por status e tooltips |
| Cadastro de Local (geladeira) | ✅ | ❌ | — | ✅ Sim — mas integrar com `unidades` existentes |
| Cadastro de Galeria | ✅ | ❌ | — | ✅ Sim — com tipos (bandeja, rack, criotubo, microplaca) |
| Leitura de código no armazenamento | ✅ (manual) | ⚠️ scanner global na lista | ✅ scanner global é melhor | ✅ unificar — uma única captura HID |
| Triagem como passo separado | ✅ | ❌ (vai direto p/ DISPONIVEL) | — | ✅ Sim — fila de "aguardando armazenamento" |
| Pesquisa com 11 filtros | ✅ | ⚠️ 1 busca + tabs | — | ✅ Sim — filtros server-side + drawer lateral compacto |
| Botão "emprestar" inline | ✅ | ❌ | — | ✅ Sim — mas em menu de ação, não botão por linha (poluição) |
| Botão "visualizar" inline | ✅ | ✅ (clique abre detalhe) | ✅ | ⚪ Manter |
| "Amostra Processada" / "Amostra Liberada" colunas | ✅ | ⚠️ derivado | — | ✅ Sim — mostrar como badges discretos |
| Expurgo em lote com grade visual | ✅ | ❌ | — | ✅ Sim — mas com confirmação multi-fator (não checkbox simples) |
| Janela "data prevista para expurgo" | ✅ | ❌ | — | ✅ Sim — política por material/setor |
| Etiqueta da Galeria | ✅ | ❌ | — | ⚪ Útil mas baixa prioridade |
| Layout "anos 2000" (roxo/amarelo pesado) | ✅ | ❌ | ❌ NÃO copiar | — |
| Tabelão denso com 50+ linhas/tela | ✅ | ❌ | ❌ NÃO copiar | — |

## O que **NÃO** vale a pena copiar

- Estética: paleta roxo/amarelo, botões 3D, tabelas densas, modais em página inteira.
- Filtros como tabelão amarelo no topo — usar drawer/popover discreto.
- "Adicionar" como botão grande amarelo flutuante — usar padrão SISLAC (`PageHeader actions`).
- Múltiplos botões por linha — virar menu de ação `MoreHorizontal`.
- Confirmação de descarte por checkbox simples — exigir motivo + tipo.

## O que vale a pena modernizar (e como)

### 1. Estrutura física hierárquica
**Como:** breadcrumb visual `Local → Galeria → Posição`, com mini-mapa SVG da galeria selecionada (cores por status). Drag-to-allocate opcional.

### 2. Triagem como pipeline
**Como:** tela `Soroteca > Triagem` lista amostras `EM_TRIAGEM` (auto-criadas pela coleta). Operador lê código → sugere próxima posição livre → confirma.

### 3. Pesquisa avançada
**Como:** manter a busca rápida atual; adicionar drawer "Filtros avançados" (status, material, setor, range de datas, paciente, galeria, posição). Server-side com paginação.

### 4. Expurgo programado
**Como:** nova rota `Soroteca > Expurgo`. Lista amostras com `data_retencao_fim < hoje + 7d`. Seleção múltipla com confirmação textual.

### 5. Empréstimo
**Como:** ação `Emprestar` no menu da linha + diálogo (responsável, motivo, prazo). Card colorido distinto no estado EMPRESTADA.

### 6. Timeline real
**Como:** consumir `public.auditoria` no `AmostraDetalheDialog` — substituir derivações por verdade auditada.

### 7. Permissões granulares
**Como:** novas permissões dedicadas (ver `security-audit.md`).

## Resumo: filosofia "melhor, não clone"

| SISVIDA | Soroteca 2.0 |
|---|---|
| Funcional, denso, datado | Funcional, denso onde precisa, moderno onde escala |
| Tudo na mesma tela | Pipeline em etapas + busca unificada |
| Texto cru | Cores por estado + ícones contextuais |
| Botões por linha | Ações em menu + atalhos por seleção múltipla |
| Decisões livres | Políticas de retenção configuráveis |
| Validade fixa | Catálogo de material com estabilidade própria |
