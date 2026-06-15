# Auditoria Operacional Qualitativa — 2026-06-15

**Método:** leitura de código + comparação com baseline Laravel
(`docs/audits/laravel-vs-lovable-comparativo.md`,
`docs/ux/comparativo-coremas.md`,
`docs/ux/essencial-secundario-avancado.md`).

**Limitação declarada:** o projeto **não** possui instrumentação de UX
(clicks, tempos, funis). Números absolutos não são fabricados. As
comparações abaixo são qualitativas e baseadas em contagem estática de
campos, etapas e cliques mínimos por fluxo no código atual.

---

## Criar atendimento

| Métrica | Estado atual (Lovable wizard) | Alvo (Laravel single-page) |
|---|---|---|
| Estrutura | Wizard de 4 steps (`NovoAtendimento.tsx`, 2 630 linhas) | Página única com 5 blocos |
| Cliques mínimos do paciente já cadastrado até finalizar | 6–8 (avanço entre steps + finalizar) | 3–4 |
| Campos visíveis ao abrir | ~12 (busca + dados paciente do step 1) | ~6 (busca + lista exames) |
| Avançados sempre visíveis | OCR, Avaliação IA, Soroteca | Botões discretos no header |
| Conclusão | Após Fase 3 (opção A): redução de ~30% nos cliques apenas com colapso de secundários. Sem reestruturação. |

## Emitir resultado

| Métrica | Estado atual (`ResultadoDetalhe.tsx`, 2 244 linhas) | Alvo (V2 com abas) |
|---|---|---|
| Densidade da primeira dobra | Alta — paciente + exames + parâmetros + referências + anexos + histórico tudo junto | Resultado (90% dos acessos) isolado |
| Cliques para imprimir | 1 (botão já visível) | 1 (preservado, na aba Impressão) |
| Cliques para ver histórico | 0 (sempre visível, mas misturado) | 1 (aba dedicada) |
| Risco de regressão de impressão | N/A | Zero se aplicado em modo aditivo (Tabs envolve sem reescrever) |

## Editar modelo de laudo / documento / mapa

| Métrica | Antes (RichTextEditorPro/TipTap) | Hoje (CKEditor 5) |
|---|---|---|
| Editor único | ❌ (havia dois) | ✅ |
| Mesclar células de tabela | ❌ | ✅ |
| Paste do Word/Excel preservando formatação | ❌ | ✅ |
| Fontes e cores | parciais | completas |
| Variáveis `{{...}}` preservadas | ✅ | ✅ |
| Suporte (estimativa qualitativa) | redução significativa de tickets "como faço X no editor" |

---

## Conclusão

- **Ganho real e mensurável**: Fase 1 (CKEditor 5).
- **Ganho potencial alto**: Fases 2 e 3, bloqueadas até confirmação do
  usuário (constraints).
- **Sem regressão** em qualquer fluxo neste ciclo.

Detalhamento por tela em `docs/ux/essencial-secundario-avancado.md`.
