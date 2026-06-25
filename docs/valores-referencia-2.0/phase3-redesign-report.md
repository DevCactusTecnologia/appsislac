# Fase 3 — Redesign "Padrão + Variações"

**Origem:** REDESIGN_VALORES_REFERENCIA.md (anexo do usuário).
**Status:** implementado.

## O que mudou

### Banco
- `valores_referencia.categoria` (text, NOT NULL, default `'custom'`) com check enum:
  `padrao | gestante | recem_nascido | crianca | adolescente | adulto | idoso | masculino | feminino | custom`.
- `valores_referencia.prioridade` (int, derivado por trigger a partir da categoria).
- Backfill: registros pré-existentes ficam como `custom` (zero perda).
- Índice `(parametro_id, categoria)`.

### Store
- `ValorReferencia.categoria?: CategoriaVR`.
- `CATEGORIA_META` exporta label, icone, faixa etária e prioridade de cada categoria.
- `resolverReferencia(exame, parametro, sexo, idade, gestante?)`: novo algoritmo
  por prioridade. Mantém assinatura compatível (gestante opcional).
- `custom` continua honrando os campos legados (sexo + idadeMin/idadeMax + unidadeIdade).

### UI
- Novo `ValoresReferenciaPanel.tsx`: bloco por parâmetro com card `Padrão` em destaque
  + cards de variações + "+ Adicionar variação" (dropdown).
- Cada card edita inline: Normal min/max, Crítico min/max, unidade. Preview ao vivo com
  cores semânticas (verde/amarelo/vermelho).
- `FiltrosDialog`: agora abre direto no painel novo. Botão "Avançado" no header revela
  a Matriz por sexo × régua etária (para Sysmex/Lareval). Réguas só aparecem em Avançado.

## Lógica do resolver (prioridade)

```
gestante (100) → recem_nascido (90) → crianca (80) → adolescente (70)
              → idoso (60) → adulto (50) → masculino/feminino (40)
              → custom (30) → padrao (1)
```

Maior prioridade compatível vence. Empate: sexo específico > Ambos.

## Compatibilidade

- Resolver mantém assinatura → `criticoChecker`, `laudoResolver`, `ResultadoDetalhe`
  continuam funcionando sem alteração.
- Matriz, régua etária e modo Avançado preservados.
- Nenhuma coluna foi removida — fase 100% aditiva, reversível.

## Próximas fases (não executadas)

- Passar flag `gestante` do paciente para o resolver no fluxo de Resultado.
- Auditoria de conflitos (mesma categoria duplicada por parâmetro).
- Drop dos campos legados (`exame_nome`, `parametro_nome`, idade_min/max texto)
  só após validação real em produção.
