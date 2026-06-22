# Soroteca — Ciclo de Vida da Amostra

## Criação
1. **Coleta individual:** `src/pages/RegistrarColeta.tsx:36` → `criarAmostraParaExame` (`sorotecaStore.ts:147`).
2. **Coleta em lote:** `criarAmostrasParaExames` (`sorotecaStore.ts:195`) — agrupa por laboratório via `resolveAmostrasPorLab`, faz `INSERT` (`:240`) e vincula `atendimento_exames.amostra_id` (`:253`).
3. **Código de barras** via RPC `gerar_codigo_amostra` com fallback client-side (`sorotecaStore.ts:84-101`).
4. **Status inicial:** `DISPONIVEL` (`sorotecaStore.ts:137`).

## Transições de status

| De | Para | Onde |
|---|---|---|
| `DISPONIVEL` | `UTILIZADA` | `reutilizarAmostra:328` (update direto) |
| `DISPONIVEL` | `VENCIDA` | RPC `marcar_amostras_vencidas()` quando `data_validade < now()` |
| `DISPONIVEL` | `DESCARTADA` | trigger `aplicar_expurgo_amostra` ao executar item |
| qualquer | qualquer | `atualizarAmostra:557` (patch admin via UI) |

## Fluxo real implementado

```
Atendimento → Coleta → (auto) criar amostra DISPONIVEL
                          ↓
              Triagem (bipe → alocar em posição)
                          ↓
              Pesquisa / Reutilização / Empréstimo
                          ↓
              Expurgo programado → DESCARTADA
```

## Etapas inexistentes
- **Recepção** explícita: não há etapa entre criação e triagem; amostra nasce `DISPONIVEL` e fica disponível para alocação imediatamente.
- **Movimentação** entre posições: `retirarAmostra` existe (`sorotecaEstruturaStore.ts:344`) mas não há fluxo UI para "mover para outra posição"; só é chamado indiretamente pelo trigger de expurgo.
- **Reversão de descarte:** inexistente.
- **Status `EMPRESTADA`:** não existe na tabela. Empréstimo ativo é controlado por `amostra_emprestimos`; bloqueio de reutilização é client-side (`sorotecaStore.ts:309-315`).

## Etapas duplicadas
- Scanner HID em `Soroteca.tsx` e `SorotecaTriagem.tsx` — mesmo padrão de captura, sem hook compartilhado (ver `triagem-audit.md`).
