# Plano — Unidade, Data e Número de Guia no /novo-atendimento

Esta é uma mudança **estrutural** (banco + edge function + UI), por isso preciso da confirmação explícita antes de aplicar.

## 1. UI — `src/pages/NovoAtendimento.tsx`

Adicionar, no início do card único, uma linha com 2 campos lado a lado (acima da seção Paciente):

- **Unidade de atendimento** (Select): lista `getUnidadesAtivas()` (SEDE + FILIAL + PONTO_DE_COLETA). Default = `user.unidadeAtiva` ou a unidade marcada `padrao`. Obrigatório.
- **Data do atendimento** (Input `datetime-local`): default = "agora" no fuso `America/Sao_Paulo` (Horário de Brasília). Editável.

O número de **Guia** NÃO entra no formulário — é gerado server-side no momento do salvamento (igual ao protocolo) e exibido na tela de sucesso.

## 2. Backend — número de guia diário por unidade

### 2.1 Migration
Criar tabela `guia_sequence` (contador diário por tenant + unidade):

```text
guia_sequence
  tenant_id    uuid
  unidade_id   uuid
  data         date           -- data local Brasília
  ultimo       int  default 0
  PK (tenant_id, unidade_id, data)
```

Adicionar 2 colunas em `atendimentos`:
- `guia_numero text` (ex.: `SE-001`)
- `guia_data date`

Função SQL `next_guia_numero(_tenant_id uuid, _unidade_id uuid)`:
1. `data := (now() AT TIME ZONE 'America/Sao_Paulo')::date`
2. `prefixo`: 2 primeiras letras (sem acento/espaço) da `unidades.nome` em uppercase — ex.: "SEDE" → `SE`, "João Pessoa" → `JP`.
3. `INSERT … ON CONFLICT (tenant_id, unidade_id, data) DO UPDATE SET ultimo = guia_sequence.ultimo + 1 RETURNING ultimo`
4. Retorna `prefixo || '-' || lpad(ultimo::text, 3, '0')`.

Atualizar a RPC `create_atendimento_tx`:
- aceitar `unidade_id` no payload `_atendimento` (já aceita), salvar
- chamar `next_guia_numero(...)` e gravar `guia_numero`/`guia_data`
- retornar `guia_numero` junto do `protocolo`

GRANTs + RLS por `current_tenant_id()` na `guia_sequence` (sem acesso anon).

### 2.2 Edge function
Sem mudanças de contrato — só repassa `unidade_id` e `data` que já estão no payload.

## 3. Store / tipos

- `addAtendimento` (`src/data/atendimentoStore/mutations.ts`): incluir `unidade_id` e `data` no payload (já existe `unidadeId`/`data`, conferir mapeamento).
- Após resposta da RPC, gravar `guiaNumero` no objeto de atendimento em memória.

## 4. Exibição

- Tela de sucesso do `/novo-atendimento`: mostrar `Protocolo: … • Guia: SE-001`.
- Demais telas que listam atendimento ficam fora desse escopo (posso adicionar coluna depois, se pedir).

## 5. Regras preservadas
- `tenant_id` continua resolvido server-side.
- RLS + GRANTs em toda tabela nova.
- Sem mock; sem mexer em coleta/resultado.

Confirma para eu aplicar (migration + edge function + UI)?
