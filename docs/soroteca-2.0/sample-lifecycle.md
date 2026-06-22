# Soroteca 2.0 — Fase 1.3 — Ciclo de Vida da Amostra

## Estado atual

```text
[Atendimento criado]
        │
        ▼
[Coleta marcada]  ─────────────►  amostras.INSERT (status=DISPONIVEL)
   RegistrarColeta                 codigo_barra = gerar_codigo_amostra()
                                   data_validade = now() + 24h (default)
        │
        ▼
[Reuso opcional]  ◄────  NovoAtendimento  ──► reutilizarAmostra()
                                              status = UTILIZADA
        │
        ▼
[Análise]  ─────► AnalisarAmostra (não muda status — só consome)
        │
        ▼
[Validade expira]  ──► job marcar_amostras_vencidas()  ──► VENCIDA
        │
        ▼
[Descarte manual]  ──► Soroteca (botão descartar)  ──► DESCARTADA
```

### Estados oficiais (CHECK constraint)
- `DISPONIVEL`
- `UTILIZADA`
- `VENCIDA`
- `DESCARTADA`

### Eventos auditados
Disparados pelo `audit_trigger` em `amostras`. Tipos derivados no client (`getAmostraDetalhe`):
- `CRIACAO`
- `STATUS`
- `REUTILIZACAO`
- `ANALISE`
- `LIBERACAO`
- `DESCARTE`
- `AUDITORIA`

## Etapas faltantes (estado desejado)

| Etapa | Existe hoje? | Comentário |
|---|---|---|
| **Recepção / Triagem** | ❌ | SISVIDA tem "Triagem para Armazenamento" — alocação visual em galeria. SISLAC pula direto p/ disponível |
| **Armazenamento físico** (alocar em posição) | ❌ | Só campo `localizacao` livre |
| **Empréstimo** (saída temporária) | ❌ | Não modelado |
| **Devolução de empréstimo** | ❌ | — |
| **Expurgo programado** (vencimento de retenção) | ⚠️ | Existe `VENCIDA` mas é validade biológica, não retenção pós-análise |
| **Reanálise / reabertura** | ❌ | Não há transição reversa de UTILIZADA → DISPONIVEL |
| **Transferência entre unidades** | ❌ | Não modelado |

## Ciclo proposto (Soroteca 2.0)

```text
COLETADA ──► EM_TRIAGEM ──► ARMAZENADA ──┬─► UTILIZADA ──► RETENCAO
                                          ├─► EMPRESTADA ──► (devolvida) ARMAZENADA
                                          ├─► VENCIDA (validade biológica)
                                          └─► EXPURGADA (descarte programado)
                                              EXPURGADA ──► (irreversível)
```

## Transições e regras

| De | Para | Quem dispara | Regra |
|---|---|---|---|
| `COLETADA` | `EM_TRIAGEM` | Coletor finaliza coleta | Automática |
| `EM_TRIAGEM` | `ARMAZENADA` | Operador aloca posição | Manual com leitura de código |
| `ARMAZENADA` | `UTILIZADA` | Analista | Idempotente |
| `ARMAZENADA` | `EMPRESTADA` | Operador autorizado | Registra motivo + responsável |
| `EMPRESTADA` | `ARMAZENADA` | Devolução | Auditável |
| `UTILIZADA` | `EXPURGADA` | Job de retenção | Após N dias do material |
| `*` | `VENCIDA` | Job validade biológica | Imutável |

## Riscos do ciclo atual
- Sem etapa de triagem: o operador não consegue saber onde a amostra física está.
- Validade hard-coded em 24h ignora exames com estabilidade de dias/meses.
- Não há diferença entre "vencida biologicamente" e "expurgada por retenção" — ambas viram só `VENCIDA` / `DESCARTADA`.
