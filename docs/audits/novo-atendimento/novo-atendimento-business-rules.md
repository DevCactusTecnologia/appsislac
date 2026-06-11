# /novo-atendimento — Business Rules (Engenharia Reversa)

> Auditoria somente-leitura.

## 1. Como nasce um atendimento

```text
Paciente (busca/cadastro)        ← Step 1
       ↓
Convênio(s) + Solicitante(s)     ← Step 2
       ↓
Exames (catálogo + IA + leitura  ← Step 3
       de requisição + soroteca)
       ↓
Resumo + Desconto + Pagamento    ← Step 4
       ↓
addAtendimento / updateAtendimento
       ↓
edge function create|update-atendimento
       ↓
RPC create|update_atendimento_tx (BEGIN..COMMIT)
       ↓
status inicial: "Pedido Realizado" (neutro)
status pagamento: pendente | parcial | efetuado
       ↓
Etapas downstream (fora desta página):
Coleta → Processamento → Resultado
```

A página NÃO é responsável por coleta/processamento/resultado — ela apenas
**cria** o atendimento e dispara o restante do fluxo via status persistido.

## 2. Dados obrigatórios

Validados em `goNext(target)` (linhas 744–773):

| Step | Campo | Regra |
|---|---|---|
| 1→2 | Paciente | `selectedPaciente` definido OU (em edição) `pacienteQuery` preservado |
| 2→3 | Convênios | `convenios.length ≥ 1` |
| 2→3 | Solicitantes | `solicitantes.length ≥ 1` |
| 3→4 | Exames | `exames.length ≥ 1` |
| 3→4 | Solicitante por exame | Quando `solicitantes.length > 1`, todo exame precisa de `solicitanteExame` (ou `__ambos`) |

## 3. Dados opcionais

- `desconto`, `valorPago`, `pagamentosRealizados` (pode finalizar sem pagar).
- `observacaoIA`, `justificativaIA`, `confiancaIA` (apenas exames adicionados pela IA).
- `labApoioIdOverride` (apenas para exames `TERCEIRIZADO`).
- `amostraSeq` / `grupoExameId` (gerados automaticamente em repetições).
- `origem` (defaults: `INTERNO`; vira `WEB_APROVADO` em prefill de
  solicitação pública).

## 4. Validações

- **CPF**: `isValidCPF` / `sanitizeCPF` / `looksLikeCPF` (na busca de paciente
  e no prefill `from=solicitacao`).
- **Edição clínica bloqueada**: `isEdicaoClinicaBloqueada(statusAtendimento)`
  impede edição de atendimentos finalizados/cancelados (linhas 397–406);
  redireciona para `/atendimentos` com toast destrutivo.
- **Convênio inexistente**: ao trocar a lista de convênios, exames cobrados
  de um convênio removido voltam para `cobrancaDestino: "paciente"`
  (effect linhas 627–645).
- **Repetição de exame**: dispara diálogo `novaAmostraDialog` perguntando se
  é nova amostra do mesmo exame.
- **Soroteca**: antes de inserir, busca amostras reutilizáveis do paciente
  para o exame (`buscarAmostrasReutilizaveisPorNome`).
- **Débitos do paciente**: histórico filtrado por "Pagamento parcial" exibe
  alerta com saldo devedor (`pacienteDebitos`, linhas 149–168).

## 5. Regras financeiras

### Valor total
```text
subtotal           = Σ exames com cobrancaDestino ≠ 'convenio'
subtotalConvenio   = Σ exames com cobrancaDestino = 'convenio'
total              = subtotal − desconto
saldoDevedor       = max(0, total − valorPago)
```

### Cobrança híbrida (Fase 2 — `resolveCobrancaDefault`)
- Se houver convênio ≠ Particular selecionado → exame default é cobrado do
  primeiro convênio não-Particular.
- Caso contrário → cobrado do paciente.
- Override manual por exame (UI permite alternar).

### Tabela de preço (`resolvePreco`)
```text
preço = getPrecoExame(nome, tabelaDoConvenio)
     ?? getPrecoExame(nome, 'Própria')
     ?? 0
```
**Nunca inventar preço**. Sem cadastro → 0 (UI mostra "sem preço").

### Distribuição de desconto (linhas 490–513)
- Desconto **só abate exames cobrados do paciente** (convênio não absorve).
- Distribuído proporcionalmente em centavos; última parcela recebe o resto
  para evitar erro de arredondamento.
- Persiste o valor já abatido em `examesCobranca[i].valor` (não cria entidade
  separada de "desconto").

### Status de pagamento (derivado no submit)
```text
pagamentoEfetuado=true → "Pagamento efetuado" (success)
valorPago > 0          → "Pagamento parcial"  (info)
caso contrário         → "Pagamento pendente" (warning)
```

## 6. Regras laboratoriais

- **Material**: vem de `examesCatalogo[].material`; default `"Sangue"`.
- **Tipo de processo**: `INTERNO` (padrão) | `TERCEIRIZADO` (do catálogo).
- **Lab apoio**: `labApoioIdPadrao` (catálogo) com override por atendimento
  em `labApoioIdOverride` (Fase 3). Persistido só quando `TERCEIRIZADO`.
- **Amostra**: ao repetir o mesmo exame, calcula `amostraSeq = max+1` e
  reusa `grupoExameId` para ligar repetições (linhas 695–699).
- **Etiquetas**: contagem estimada por `examesCatalogo[].quantidadeEtiquetas`
  (default 1, clamp 1..20). Usada na tela de sucesso para roteamento de
  impressão (`lastEtiquetasTotal`, `lastEtiquetasTerc`).
- **Solicitante por exame**: obrigatório quando há mais de um solicitante;
  `__ambos` é sentinel que persiste como string vazia.
- **Status inicial**: sempre `"Pedido Realizado"` (neutro). Setor/prioridade/
  prazo NÃO são definidos nesta página — derivam do catálogo e dos triggers
  downstream.

## 7. Origem do atendimento

- `INTERNO` (default).
- `WEB_APROVADO` (prefill de `/solicitacoes-site` via `location.state.from = "solicitacao"`).
  Defaults aplicados: convênio Particular, "SEM SOLICITANTE", best-effort de exames.

## 8. Persistência (transacional)

`addAtendimento` / `updateAtendimento` (na store) → edge function →
`create_atendimento_tx` / `update_atendimento_tx`. Tudo em transação única:
atendimento + exames + pagamentos. Erros causam ROLLBACK automático no
PostgreSQL. `tenant_id` resolvido server-side por `current_tenant_id()` —
frontend nunca envia.

## 9. RBAC (defesa em profundidade)

Validado em `update-atendimento` por `requiredPermissionForUpdate`:
- cancelamento → `cancelar_atendimento`
- só pagamentos → `registrar_pagamento`
- demais → `editar_atendimento`

`create-atendimento` exige `criar_atendimento`.
