# /novo-atendimento — Complexity Audit

> Somente leitura. Cada item cita arquivo:linha como evidência.

## 1. Código legado / compatibilidade

### 1.1 `examesCatalogoLegado` (array vazio)
- `src/pages/NovoAtendimento/helpers.ts:12` — exportado como `[]` apenas
  como "referência tipada para fallbacks defensivos".
- `src/pages/NovoAtendimento.tsx:56` — importado, **nunca usado** no corpo
  do componente.
- **Status**: morto. Pode ser removido (mas requer pedido explícito do
  usuário — esta auditoria não altera código).

### 1.2 Catálogo `examesCatalogoLegado` mencionado em comentário
- `helpers.ts:7–10` — comentário descreve um catálogo "agora 100% derivado
  das tabelas de preço". A coexistência catálogo + tabela de preço é
  intencional, mas o símbolo legado polui o import surface.

### 1.3 Bridge prefill `from=solicitacao`
- `NovoAtendimento.tsx:189–262` — código de retro-compatibilidade com o
  fluxo `/solicitacoes-site`. Funcional e em uso; **não é morto**, mas
  acopla a página a um caso de borda externo.

### 1.4 Hidratação dupla em modo edição (fallback de cache)
- `NovoAtendimento.tsx:381–470` — busca no store legado E faz fallback para
  `fetchAtendimentoByProtocolo`. Usa `setEditAtendimentoData` como "sinal"
  para re-disparar o effect. **Hack documentado em comentário** (linhas
  389–391); funcional mas frágil.

## 2. Código duplicado

### 2.1 Resolução de preço replicada 4× no mesmo arquivo
Padrão `getPrecoExame(nome, tabela) ?? getPrecoExame(nome, "Própria") ?? 0`
aparece em:
- `NovoAtendimento.tsx:159–162` (cálculo de débitos do paciente)
- `NovoAtendimento.tsx:424–427` (hidratação de edição — totalFromExames)
- `NovoAtendimento.tsx:455–457` (hidratação de edição — valor exibido)
- `NovoAtendimento.tsx:650` (`resolvePreco`)

Existe `resolvePreco` local mas só 1 dos 4 sítios o usa. **Hotspot real**
de duplicação.

### 2.2 Normalizador de string redefinido inline
- `NovoAtendimento.tsx:325` e `:342` — `(s) => s.normalize("NFD")...`
  redefinido dentro de 2 effects. Existe `searchNormalize` em `@/lib/utils`
  (já importado).

### 2.3 Status de pagamento derivado em 2 lugares
- Bloco `addAtendimento` (linhas 554–558) e `updateAtendimento`
  (linhas 518–522) computam o mesmo ternário. Já mapeado como hotspot
  global em `docs/governance/single-source-of-truth-audit.md §2` (extrair
  `lib/finance/statusPagamento.ts`).

### 2.4 Construção do payload `examesCobranca` duplicada
- `NovoAtendimento.tsx:531–545` (update) vs `:570–584` (create) — 14 linhas
  praticamente idênticas. Risco: divergência se um lado evoluir.

### 2.5 Click-outside handlers repetidos
- 3 effects de click-outside (`:170–180`, `:309–321`, `:123–137`) com a
  mesma forma. Existe `use-body-scroll-lock` mas não há `useClickOutside`
  compartilhado.

## 3. Código morto / não utilizado

| Símbolo | Local | Evidência |
|---|---|---|
| `examesCatalogoLegado` | importado em `:56`, nunca referenciado | grep no arquivo |
| `solicitanteInputRef`, `convenioInputRef` | declarados em `:306–307`; verificar uso real (refs criadas, possivelmente sem leitor) | requer `rg` confirmatório |
| Comentário "Helpers" placeholder | `:75` vazio | resíduo |
| `lastEtiquetasTerc` | usado apenas em UI de sucesso; verificar se a tela consome | uso pontual, OK |

## 4. Volume

- **2.598 linhas em um único componente**. ~38 `useState`, ~12 `useEffect`,
  3 dropdowns "custom" inline (paciente, convênio, solicitante, exames).
- Step 3 (Exames) concentra ~600 linhas de JSX + lógica de IA + soroteca +
  cobrança híbrida + lab apoio + repetição de amostra.

## 5. Acoplamentos perigosos

- Componente conhece **9 stores**, **3 libs financeiras**, **1 política
  clínica**, **fluxo de soroteca**, **fluxo de orçamento**, **fluxo de IA**,
  **PDF/WhatsApp**, **leitura de requisição (OCR/IA)**, **prefill web**.
- Qualquer mudança em qualquer um desses domínios tem chance de quebrar
  esta página.

## 6. Resumo

| Categoria | Itens | Severidade |
|---|---|---|
| Legado morto | `examesCatalogoLegado` | Baixa |
| Duplicação real | `resolvePreco` 4×, payload `examesCobranca` 2×, status pag. 2× | **Alta** |
| Normalizador inline | 2× | Baixa |
| Hacks documentados | hidratação `setEditAtendimentoData` como sinal | Média |
| Volume | 2.598 linhas, ~38 useState | **Alta** |
| Acoplamento | 9 stores em 1 componente | **Alta** |
