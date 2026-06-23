# Plano — Soroteca inteligente + responsivo

Entrega em 3 frentes paralelas, sem mexer em rotas, boot, deps globais ou no contrato do banco da Fase 2.

---

## Frente A — Camada 1: inteligência determinística (sem IA)

### A1. Mapa visual 2D da galeria (`SorotecaEstrutura.tsx`)
- Substituir a lista chapada de posições por um **grid responsivo** (auto-fit, min 44px) com tiles coloridos:
  - 🟢 livre · 🔵 ocupada · 🟡 vencendo (<7d p/ expurgo) · 🔴 vencida · ⚫ inativa
- Hover/tap → tooltip com: paciente, protocolo, material, data armazenamento, prox. expurgo.
- Clique → abre `EditarPosicaoDialog` existente.
- Header da galeria mostra contadores ("18/96 ocupadas · 22% · 3 vencendo").

### A2. Heatmap de ocupação por Local (header da página)
- Strip horizontal: cada local vira uma barra com % ocupação + cor (verde<70%, âmbar 70–90%, vermelho >90%).
- Alerta visual quando >90%.

### A3. Criação em lote 2D (`NovaPosicaoDialog`)
- Adicionar 3º modo no segmented control existente:
  - **Linear** (atual: prefixo + N)
  - **Individual** (atual)
  - **Grid 2D** (novo): linhas A–H × colunas 1–12 → gera `A1, A2…H12` com `ordem` calculada (linha*100+coluna).
- Preview live do total e dos 6 primeiros códigos.

### A4. Loader único enriquecido
- Novo helper em `sorotecaEstruturaStore.ts`: `listarPosicoesComOcupacao(galeria_id)` que faz 1 query joinando `posicoes_galeria` + `amostra_alocacoes` ativa + `amostras` + `atendimentos` + `pacientes` + `materiais_amostra` (prazo retenção).
- Devolve `PosicaoEnriquecida[]` com `status: 'livre'|'ocupada'|'vencendo'|'vencida'|'inativa'` + metadados.

---

## Frente B — Camada 2: Assistente IA de alocação na Triagem

### B1. Edge function `soroteca-sugerir-posicao`
- Input: `amostra_id`.
- Carrega: material (temperatura/prazo), exames pendentes, locais ativos + compatibilidade de temperatura, ocupação por galeria, prazos das amostras vizinhas.
- Modelo: `google/gemini-3-flash-preview` via Lovable AI Gateway (sem chave do usuário).
- Prompt estruturado pede retorno via `Output.object` com Zod:
  ```
  { posicao_id, posicao_caminho, score (0-100), motivo (string curta), alternativas: [{posicao_id, caminho, motivo}] }
  ```
- Validação: posição precisa estar livre e compatível com temperatura do material; se IA devolver inválida, fallback determinístico (`proximaPosicaoLivre`).
- CORS + corsHeaders padrão. Erros 402/429 surfaced.

### B2. UI na tela `/soroteca/triagem`
- Após escanear amostra, painel "Sugestão IA":
  - posição recomendada (caminho completo Local > Galeria > Posição) + score + justificativa
  - 2 alternativas em chip clicável
  - botão **Aceitar sugestão** (chama `alocarAmostra` existente)
  - botão **Escolher manualmente** (mantém fluxo atual)
- Estado de loading discreto (skeleton 200ms); fallback silencioso para próxima posição livre se IA falhar.

### B3. Sem persistência adicional
- Sugestões não vão para o banco. Apenas o resultado da alocação aceita (já gravado em `amostra_alocacoes`).

---

## Frente C — Responsividade total `/soroteca/*`

Aplicar em `Soroteca.tsx`, `SorotecaEstrutura.tsx`, `SorotecaMateriais.tsx`, `SorotecaTriagem.tsx`, `SorotecaExpurgo.tsx`:

- **Header da página**: stack vertical <640px (título em cima, ações em segunda linha full-width); horizontal ≥640px.
- **Tabs**: scroll horizontal `.no-scrollbar` em mobile; flex-wrap em tablet.
- **KPI strips**: grid `grid-cols-2 sm:grid-cols-3 lg:grid-cols-5`.
- **Estrutura 3 colunas (Local/Galeria/Posição)**:
  - Desktop ≥1024px: 3 colunas lado a lado.
  - Tablet 640–1023px: 2 colunas + drawer para posições.
  - Mobile <640px: 1 coluna com breadcrumb back/forward entre níveis.
- **Cards de amostra**: já em grid; revisar para `grid-cols-1 sm:grid-cols-2 xl:grid-cols-3` e padding compacto em mobile.
- **Dialogs Soroteca** (`SorotecaDialogShell`): `max-h-[90vh]`, body com `overflow-y-auto`, footer sticky, padding reduzido em <640px.
- **Toolbars de busca/filtros**: full-width em mobile, inline em ≥md.
- Validar com viewport `375×667`, `768×1024`, `1280×800` via Playwright (3 screenshots por página).

---

## Restrições preservadas

- Schema do banco da Fase 2 **inalterado** — nenhuma migration nova nesta entrega.
- Contratos de `sorotecaEstruturaStore.ts` mantidos; só adições (`listarPosicoesComOcupacao`).
- Sem novas rotas, sem mudanças em `App.tsx` boot.
- Dialogs continuam no padrão `SorotecaDialogShell` (flat, blur 6px).
- Cores via tokens semânticos (sem hex hardcoded).
- Padrão de busca/animação seguindo memórias core.

## Detalhes técnicos

- Edge function em `supabase/functions/soroteca-sugerir-posicao/index.ts` reusando `_shared/ai-gateway.ts` (criar se não existir, conforme `ai-sdk-lovable-gateway`).
- Cliente chama via `supabase.functions.invoke("soroteca-sugerir-posicao", { body: { amostra_id }})`.
- Sem novos secrets: `LOVABLE_API_KEY` já gerenciado pela plataforma.
- Sem alterações no `vite.config.ts`, `index.css` tokens já cobrem as cores de status (success/warning/destructive/muted).

## Fora de escopo desta entrega

- Drag-and-drop para mover amostra entre posições (próximo passo).
- Otimizador "Reorganizar galeria com IA" (próximo passo).
- Linguagem natural para cadastro estrutural (próximo passo).
- Busca semântica global (próximo passo).
