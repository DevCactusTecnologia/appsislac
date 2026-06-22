# Soroteca — Triagem e Armazenamento

## Arquivos
- `src/pages/SorotecaTriagem.tsx` (533 linhas)
- Dependências: `sorotecaEstruturaStore.ts` (alocação, sugestão), `sorotecaStore.ts` (busca por código).

## Fluxo
1. Foco automático no `<input>` (`SorotecaTriagem.tsx:104`).
2. Listener global de teclas detecta bipe e dispara `buscar(code)` (`:98,114-140`).
3. `buscar` chama `buscarAmostraPorCodigo`, depois em paralelo: paciente, exame, alocação ativa (`:178-194`).
4. Se já armazenada → bloqueia com `getPosicaoCaminho`.
5. Se livre → `proximaPosicaoLivre` sugere posição.
6. Botão "Armazenar" chama `alocarAmostra(amostra_id, posicao_id)`.

## Diálogo de troca manual
`TrocaPosicaoDialog` (`SorotecaTriagem.tsx:408`) — exceção para escolha manual de local/galeria/posição quando a sugestão automática não serve.

## Scanner — três canais separados
| Canal | Implementação | Onde |
|---|---|---|
| HID keydown global | `hidBufferRef` + listener `window` | `Soroteca.tsx:159,216-248` |
| HID keydown global | `hidBufferRef` + listener `window` | `SorotecaTriagem.tsx:98,114-140` |
| Câmera `BarcodeDetector` | `BarcodeScannerDialog` | `src/components/soroteca/BarcodeScannerDialog.tsx` (usado apenas em `Soroteca.tsx:1138`) |

**Duplicação real:** os dois HIDs são idênticos em lógica (intervalo 50ms, `Enter` dispara, `code.length >= 4`). Bug exige correção em dois lugares.

## Caminhos alternativos
- O usuário pode digitar manualmente no input em vez de bipar (mesmo `submit`).
- Se `proximaPosicaoLivre` retornar null, há mensagem mas não fallback automático para outra galeria.
