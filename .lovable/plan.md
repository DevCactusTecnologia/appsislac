# Sexo e Idade editáveis por linha

## Problema

Hoje cada variação (Gestante, Recém-nascido, Criança, Adulto, Idoso, Masculino, Feminino…) tem **sexo e faixa etária fixos no código** (`CATEGORIA_META`). Isso não funciona na prática clínica: para "Hemácias" o usuário precisa de ~10 linhas — 5 Masculino e 5 Feminino — com faixas etárias específicas do exame, que mudam entre parâmetros.

A solução é simples: **cada linha vira uma regra livre** onde o próprio usuário escolhe o sexo e a faixa etária (de / até / unidade). As categorias atuais viram apenas atalhos para criar uma linha pré-preenchida que o usuário pode editar.

## O que muda na UI

Cada linha do bloco de um parâmetro passa a ter, antes da "Condição":

- **Sexo** (select): Ambos / Masculino / Feminino
- **Idade De** (input numérico) + **Idade Até** (input numérico) + **Unidade** (Dias / Meses / Anos)

Tudo editável e auto-salvo no blur, igual aos outros campos da matriz.

O chip colorido da categoria continua existindo (Gestante, Adulto, Masculino…) como **rótulo/atalho**, mas o sexo e a idade reais são os que o usuário digitou na linha — não mais os fixos do `CATEGORIA_META`.

O menu "Adicionar variação" continua oferecendo os presets (Recém-nascido 0–28d, Idoso ≥65a, etc.), mas agora eles **pré-preenchem** sexo + idade da nova linha; o usuário pode ajustar livremente em seguida. Acrescenta-se também a opção "Personalizada" para criar uma linha em branco.

Layout proposto da linha (grid 14 colunas, leve aumento da densidade):

```text
Categoria | Sexo | Idade De–Até + Un. | Condição | Normal | Crítica | Un. | Preview | Ações
```

## O que muda no resolver

`resolverReferencia` em `valoresReferenciaStore.ts` passa a usar, **para todas as categorias**, os campos `sexo`, `idadeMin`, `idadeMax`, `unidadeIdade` da própria linha (igual à categoria `custom` faz hoje). `CATEGORIA_META.idadeMinDias/idadeMaxDias/sexo` deixam de ser fonte da verdade — viram apenas defaults na criação.

Prioridade continua: Gestante > variações por sexo+idade > Padrão. Empate: linha com sexo específico vence "Ambos"; faixa etária mais estreita vence mais larga.

## Migração de dados

Para regras já cadastradas hoje sem `idadeMin/idadeMax` (recém-nascido, idoso, etc., que dependem do meta), uma migração SQL preenche esses campos a partir do `CATEGORIA_META` correspondente — assim nada muda de comportamento para o que já existe.

## Arquivos afetados

- `src/data/valoresReferenciaStore.ts` — resolver passa a ler sexo/idade da linha; manter compatibilidade.
- `src/components/configuracoes/ValoresReferenciaPanel.tsx` — `RegraLinha` ganha campos editáveis Sexo + Idade De/Até/Unidade; grid passa de 12 para 14 colunas; menu de adicionar usa presets como defaults; nova opção "Personalizada".
- Migração SQL — backfill de `idade_min/idade_max/unidade_idade/sexo` nas linhas existentes onde estão vazios.

## Fora do escopo

- Não mexer em catálogo de exames, parâmetros, layout do laudo, ou crítico global.
- Não remover as categorias existentes — continuam como presets visuais e rótulos.

Confirma para eu implementar?
