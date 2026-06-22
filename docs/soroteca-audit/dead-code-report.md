# Soroteca — Código Morto

> Apenas documentação. Nada será removido.

## Frontend

| Símbolo | Definido em | "Chamado" em | Situação |
|---|---|---|---|
| `atualizarLocal` | `sorotecaEstruturaStore.ts:122` | `SorotecaEstrutura.tsx:712` (`void`) | Importado mas não chamado — UI sem edição inline |
| `atualizarGaleria` | `sorotecaEstruturaStore.ts:179` | `SorotecaEstrutura.tsx:713` (`void`) | Idem |
| `atualizarPosicao` | `sorotecaEstruturaStore.ts:262` | `SorotecaEstrutura.tsx:714` (`void`) | Idem |
| `reutilizarAmostra` | `sorotecaStore.ts:322` | `NovoAtendimento.tsx:2557` (`void`) | Importado mas não chamado |
| `listarAmostras` | `sorotecaStore.ts:356` | nenhum consumidor | Substituído por `buscarAmostrasAvancado` |

## Duplicação real (não morta, mas redundante)

| O quê | Onde | Observação |
|---|---|---|
| Listener HID `keydown` global com `hidBufferRef` | `Soroteca.tsx:216-248` e `SorotecaTriagem.tsx:114-140` | Idêntico, sem hook compartilhado |
| Bloqueio de empréstimo ativo | client em `sorotecaStore.ts:309-315` vs RPC `amostra_em_emprestimo_ativo` no banco | Lógica duplicada cliente/banco; RPC não consumida |
| Listas hardcoded | `MATERIAIS_NAO_REUTILIZAVEIS` em `sorotecaStore.ts:39-44` e `MATERIAIS` em `Producao.tsx` | Deveria ler `materiais_amostra.reutilizavel` |

## Backend

- **Primeira versão de `aplicar_expurgo_amostra`** em `migration 20260622225950` usa coluna inexistente `ativa`. Sobrescrita em `20260622230056`. Código permanece no arquivo de migration, sem efeito em produção.
- **RPC `amostra_em_emprestimo_ativo(uuid)`** definida em `migration 20260622225429` mas não consumida pelo frontend.
- **Triggers de auditoria explícitos** para `amostras`, `amostra_alocacoes`, `amostra_emprestimos`, `expurgo_*` — não localizados nas migrations lidas; só `materiais_amostra` está confirmado.
