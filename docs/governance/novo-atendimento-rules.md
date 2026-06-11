# Regras de Manutenção — /novo-atendimento

> Documento de governança. Define as **fontes únicas de verdade** do
> fluxo de criação/edição de atendimentos. Quem mexer nessa página deve
> respeitar estas regras — caso contrário os testes em
> `src/pages/NovoAtendimento/*.test.ts` quebram.

---

## 1. Como o preço de um exame é calculado

**Fonte única:** `src/pages/NovoAtendimento/pricing.ts` →
`calculateExamPrice({ nomeExame, convenioNome, metaValor? })`.

Ordem de resolução (preservada literalmente da regra de negócio
auditada):

1. Se `metaValor` (= `examesCobranca[i].valor` persistido) está definido,
   ele é a verdade — **nunca recalcular**. Inclui `0` como valor válido.
2. Caso contrário, consulta a tabela do convênio
   (`getTabelaByConvenioNome(convenioNome)`).
3. Se a tabela do convênio não tem o exame, cai para a tabela `"Própria"`.
4. Se não houver cadastro, retorna `0` (UI mostra "sem preço") — **nunca
   chutar um valor**.

**Proibido**:

- Reimplementar o padrão
  `getPrecoExame(nome, tabela) ?? getPrecoExame(nome, "Própria") ?? 0`
  inline em qualquer lugar da página.
- Aplicar desconto/acréscimo dentro de `calculateExamPrice`. Esses são
  aplicados pelo fluxo do wizard (`finalizarAtendimento`), em distribuição
  proporcional sobre os exames cobrados do paciente.

---

## 2. Como o payload `examesCobranca` é montado

**Fonte única:** `src/pages/NovoAtendimento/buildExamesCobranca.ts` →
`buildExamesCobranca(exames, solicitantes)`.

Defaults (preservados literalmente):

| Campo | Default |
|---|---|
| `amostraSeq` | `1` |
| `grupoExameId` | `null` |
| `tipoProcesso` | `"INTERNO"` |
| `convenioCobrancaId` | `null` |
| `labApoioId` (INTERNO) | sempre `null` |
| `labApoioId` (TERCEIRIZADO) | `override ?? padrão ?? null` |
| `solicitante` (1 solicitante no atendimento) | `""` |
| `solicitante` (>1 solicitantes) | `solicitanteExame`, com `"__ambos"` ⇒ `""` |

**Proibido**:

- Construir o payload `examesCobranca` inline em `addAtendimento` /
  `updateAtendimento` (ou em qualquer outro caller). Use sempre o builder.

---

## 3. O que NÃO é fonte de verdade desta página

- **Status do atendimento**: derivado server-side por triggers no banco.
  A página apenas marca `"Pedido Realizado"` na criação.
- **Tenant**: resolvido server-side por `current_tenant_id()`. O cliente
  nunca envia `tenant_id`.
- **Desconto/total/saldo persistidos**: o backend confia em
  `examesCobranca[i].valor` já abatido pelo cliente. A regra de
  distribuição de desconto vive em `finalizarAtendimento` (proporcional,
  só sobre exames do paciente, nunca toca convênio).

---

## 4. Código morto / proibido reintroduzir

- `examesCatalogoLegado` (removido). O catálogo é 100% derivado das
  tabelas de preço via `buildAvailableExames()` em `helpers.ts`.
- Stores novas, contextos globais e re-arquiteturas para "resolver" o
  tamanho da página: estão fora do escopo de manutenção desta tela.

---

## 5. Testes que protegem estas regras

- `src/pages/NovoAtendimento/pricing.test.ts` — todas as transições de
  fallback de preço.
- `src/pages/NovoAtendimento/buildExamesCobranca.test.ts` — defaults,
  TERCEIRIZADO override/padrão, sentinel `"__ambos"`, multi-solicitantes,
  cobrança híbrida.

Se você precisar alterar a regra de negócio (e o produto autorizou),
atualize **primeiro** o teste, depois o código. Se você está só
refatorando, nenhum teste deve quebrar.
