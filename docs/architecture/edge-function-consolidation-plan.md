# Edge Function Consolidation Plan

> Mapeamento e proposta. **Nada será removido sem aprovação.**

---

## 1. Classificação

### 1.1 Domínio — Atendimento/Resultado
- `create-atendimento` (transacional)
- `comprovante-resolve`
- `comprovante-shortlink`
- `upload-pdf`
- `integration-pdf-resolve`
- `whatsapp-send`

### 1.2 Domínio — Integração externa
- `integration-jobs-runner`
- `integration-credentials-*`
- `provider-*`

### 1.3 Plataforma — Super Admin
- `super-admin-tenant-*`
- `super-admin-provision`
- `super-admin-billing`
- `super-admin-auditoria`

### 1.4 Plataforma — Auth/Tenant
- `tenant-resolve`
- `leads-manager`
- `signup-*`

### 1.5 Suspeitas de duplicação
| Grupo | Funções | Proposta |
|---|---|---|
| Comprovantes | `comprovante-resolve`, `comprovante-shortlink`, `integration-pdf-resolve` | Avaliar fusão em `documents-resolve` com `type` discriminator. |
| Super Admin tenant | múltiplas `super-admin-tenant-*` | Avaliar router único `super-admin-tenant` com `action`. |

---

## 2. Critérios de consolidação

Consolidar somente se:
1. Mesma autorização (mesmas verificações de role).
2. Mesma latência aceitável.
3. Mesma superfície de erro.
4. Manter logs/metrics separados via campo `action`.

**Não consolidar** se cold-start de uma função penaliza a outra.

---

## 3. Funções órfãs (a marcar)

Critério: zero chamadas em `src/` por 30 dias.
**Ação:** marcar com header `@deprecated` + métrica de invocações 0 por 60d → remover.

---

## 4. Plano

| Sprint | Ação | Risco |
|---|---|---|
| 1 | Inventário completo + chamadas/dia por função (analytics). | Nenhum |
| 2 | Marcar órfãs candidatas. | Nenhum |
| 3 | Avaliar consolidação `documents-resolve`. | Médio |
| 4 | Avaliar router `super-admin-tenant`. | Médio |
| 5 | Deprecar órfãs após 60d sem chamadas. | Baixo |

---

## 5. Regra permanente

Adicionar a `ENGINEERING_RULES.md`:

```text
Toda Edge Function deve ter, no header do index.ts:
  - @owner: time/pessoa responsável
  - @purpose: 1 linha do que faz
  - @callers: arquivos/funções que invocam
Sem isso = órfã candidata.
```

---

## 6. Não fazer

- ❌ Consolidar funções com permissões diferentes.
- ❌ Fundir `super-admin-*` com funções de tenant (boundary crítico).
- ❌ Remover qualquer função antes de 60d com 0 chamadas.
