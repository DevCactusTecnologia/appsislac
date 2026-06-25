# Plano OECV — Resolução Inteligente de Valores de Referência

## Objetivo
Estender o resolver de Valores de Referência para cobrir os 3 padrões reais observados (só número, sexo+idade, idade+condição clínica como jejum), mantendo retrocompatibilidade total e UI moderna.

## Fase 1 — OLHOU (já concluída)
Mapeados 3 padrões em uso:
- **A.** Só número (ex.: Ácido Úrico por sexo)
- **B.** Sexo + Faixa Etária (ex.: Ferro RN/Lactente/Criança/Adulto M/F)
- **C.** Idade + Condição clínica (ex.: Triglicérides com/sem jejum, Colesterol HDL/LDL por faixa de risco)

Estado atual: `valores_referencia` já tem `sexo`, `idade_min_dias`, `idade_max_dias`, `categoria` (enum), `prioridade`. Resolver já prioriza Gestante > Idade > Sexo > Padrão.

Lacunas:
1. **Jejum** não é dimensão de filtro (só Gestante existe como condição).
2. **Operador comparativo** (`< 100`, `≥ 190`) não é primeira-classe — hoje é texto livre em `texto_laudo`.
3. Painel não permite criar variação por jejum nem operadores.

## Fase 2 — ENTENDEU
Decisão arquitetural: **aditiva, sem breaking changes**.
- Novas colunas com default neutro ("qualquer" / "entre") preservam todas as regras existentes.
- Resolver ganha 1 nível extra na chave de prioridade (jejum) e 1 modo de exibição (operador).
- UI ganha 2 controles novos no editor de variação; nada muda para quem não usa.

## Fase 3 — CONFIGURAR

### 3.1 Banco
Migração aditiva em `public.valores_referencia`:
```sql
ALTER TABLE public.valores_referencia
  ADD COLUMN jejum text NOT NULL DEFAULT 'qualquer'
    CHECK (jejum IN ('qualquer','com_jejum','sem_jejum')),
  ADD COLUMN operador text NOT NULL DEFAULT 'entre'
    CHECK (operador IN ('entre','menor','menor_igual','maior','maior_igual','igual'));
```
Atualizar trigger de `prioridade` para somar +1 quando `jejum <> 'qualquer'`.
Índice parcial para acelerar lookups com jejum.

### 3.2 Resolver (`src/data/valoresReferenciaStore.ts`)
- Função `resolverReferencia(...)` recebe novo parâmetro opcional `jejum?: boolean`.
- Ranking atualizado: **Gestante > Jejum específico > Idade > Sexo > Padrão**.
- Filtragem: regras com `jejum='qualquer'` sempre elegíveis; regras com `jejum` específico só entram se contexto bate.

### 3.3 Integração com Resultado
- `ResultadoDetalhe.tsx` já tem `jejum` no atendimento (memória existente). Passar valor ao resolver.

### 3.4 UI — `ValoresReferenciaPanel.tsx`
Adicionar no editor de cada card de variação:
- **Select "Jejum"**: Qualquer / Com jejum / Sem jejum.
- **Select "Operador"**: Entre (default, mostra Min/Max) / < / ≤ / > / ≥ / =.
  - Quando operador ≠ "entre": esconde Min, renomeia Max para "Valor".
- Badge contextual no card resumindo as condições ativas (ex.: "Adulto • Com jejum • < 150").

### 3.5 Menu "Adicionar variação"
Adicionar opção **"Por jejum"** que cria card pré-configurado com `jejum='com_jejum'`.

## Fase 4 — VALIDAR
- Cadastrar Triglicérides Adulto com jejum (< 150) e sem jejum (< 175); abrir resultado com `jejum=true` e conferir referência exibida.
- Cadastrar Colesterol HDL com operador `≥ 40` (homem) e `≥ 50` (mulher); validar resolução por sexo + operador.
- Regressão: abrir Hemograma (regras antigas sem jejum) e confirmar que continua resolvendo idêntico.
- Conferir trigger de prioridade: regra com jejum específico vence regra sem jejum em empate de idade/sexo.

## Fora de escopo (próxima fase, se aprovado)
- Parser HTML que extrai faixas dos layouts antigos do Hemograma e migra para `valores_referencia` automaticamente.
- Dimensão "Etnia" (não apareceu nos exemplos reais).
