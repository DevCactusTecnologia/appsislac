# 11 — Layout Engine (Layout Científico)

Arquivo: `src/lib/laudoLayout.ts` (284 linhas) + `src/data/exameLayoutsStore.ts`.

## Função

Para cada exame do laudo, antes de chamar `buildLaudoHtml`:

```
resolveCustomLayouts(printable)
  → preloadLayoutsParaExames(nomes)        ← carrega exame_layouts (somente "padrão")
  → para cada exame: renderExameComLayout(nome, valores, sexo, idade, paciente, dataColeta)
       ├─ se NÃO existe layout cadastrado → retorna null
       │   → builder usa fallback de tabela hardcoded (linhas 449-479)
       └─ se existe layout cadastrado:
           ├─ pega HTML do CKEditor (exame_layouts.html)
           ├─ substitui placeholders ##CHAVE##, #chave, {{chave}}, {chave}
           ├─ resolve referência por sexo+idade via resolverReferencia()
           ├─ aplica preserveVisibleTextSpacing() + splitPlaceholderSpacing()
           └─ retorna { html, margins }
```

## Margens

`renderExameComLayout` devolve `margins` por exame, mas em `resolveCustomLayouts` (linhas 989-993) **o `pageMargins` final é sobrescrito pelo último layout do loop**:

```ts
for (const entry of entries) {
  if (entry.html) {
    map[entry.id] = entry.html;
    pageMargins = entry.margins;   // ← só o ÚLTIMO conta
  }
}
```

Se exames diferentes têm margens diferentes no layout cadastrado, prevalece a do último → **bug latente**.

## Placeholders suportados

`##CHAVE##` (recomendado) · `#chave` (legacy) · `{{chave}}` (mustache) · `{chave}` (curto)

Lookup tolerante: chave exata → normalizada (NFD, sem acentos, sem `#{}`) → `rotulo` do parâmetro → `rotulo` normalizado.

## Referência (`##REF_X##` / `##UNID_X##` / `##FLAG_X##`)

Resolvido por `resolverReferencia(sexo, idade, …)` — substitui múltiplos layouts por sexo/idade num único template (ver `mem://features/resultados/referencia-por-paciente.md`).

## Riscos

1. Bug do `pageMargins` (último vence).
2. Fórmulas: a substituição de placeholders depende de `evaluateFormula` em runtime — se a fórmula falhar (parâmetro vazio), o placeholder é substituído por string vazia silenciosamente.
3. CKEditor pode introduzir `<figure>`, `<p>:empty`, margens de browser — toda a normalização agressiva do CSS de impressão existe para compensar isso.
