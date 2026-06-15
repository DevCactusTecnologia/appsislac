
# SISLAC — UX & Operational Simplification Program

Antes de executar, preciso alinhar o escopo porque a missão colide com **constraints duras** já salvas em memória do projeto. Vou listar o estado real, o que é seguro fazer agora, e o que exige seu "sim" explícito.

---

## Estado atual (verificado em memória/docs)

| Fase pedida | Situação real no repo |
|---|---|
| **Fase 1 — CKEditor 5** | **Já está instalado e é o editor oficial** (`src/components/editor/CKEditor.tsx`, rota `/admin/ckeditor-test`, integrado em `MapaTrabalhoDialog`, `DocumentoTemplateDialog`, `LayoutDialog`). Toolbar, tabelas (mesclar/dividir/resize), Word/Excel paste, fontes, cores, BalloonToolbar, variáveis `{{...}}` preservadas, GPL. Relatório em `docs/editor/ckeditor-install-report.md`. |
| **Fase 2 — ResultadoDetalhe V2 (abas Resultado/Impressão/Histórico/Anexos)** | Reorganização estrutural de página crítica. Existe constraint **`layout-impressao-travado`** congelando margens, rodapé 4mm, assinatura e CSS de impressão em `ResultadoDetalhe.tsx`. |
| **Fase 3 — NovoAtendimento V2** | Existe constraint **"Wizard de 4 steps do NovoAtendimento como estrutura — só polimento interno é seguro sem aprovação"** (`docs/ux/essencial-secundario-avancado.md`). Reestruturar para "Paciente/Exames/Pagamento/Observações/Resumo" muda a estrutura. |
| **Fase 4 — Auditoria operacional (tempos, cliques)** | Mensurável só com instrumentação ou medição manual (sem analytics de UX no projeto). |
| **Fase 5 — Relatório executivo** | Documento puro, seguro. |

E há a regra global de memória: *"Mudanças estruturais (rotas, remoção/renomeação de páginas, boot, deps, contextos globais) só com confirmação explícita."*

---

## Plano proposto (faseado e reversível)

### Etapa 0 — Confirmação de escopo (agora, sem código)
Responder às perguntas no final deste plano. Sem elas, eu **não** mexo em `ResultadoDetalhe.tsx` nem no wizard de `NovoAtendimento`.

### Etapa 1 — Fase 1 (CKEditor) → fechar formalmente
Como já está pronto, eu:
- Reviso a integração ponta-a-ponta (test rendering, variáveis, paste, PDF/print) e abro um **changelog curto** em `docs/editor/ckeditor-status-2026-06.md` confirmando que a Fase 1 está **concluída**.
- **Não** reinstalo, não troco config, não mexo em CSS de impressão.

### Etapa 2 — Fase 2 (ResultadoDetalhe V2) — somente após "sim"
Modo **aditivo, zero risco de impressão**:
- Envolver o conteúdo **atual** da página em um `Tabs` (`Resultado | Impressão | Histórico | Anexos`) **sem reescrever** o markup existente.
- Aba **Impressão** = **mesmo** componente/handler atual (botão "Imprimir/Gerar PDF" exatamente como hoje). **Nada do CSS @print, rodapé 4mm, assinatura, margens** é tocado — respeita `mem://constraints/layout-impressao-travado.md`.
- Abas **Histórico** e **Anexos** = só realocam blocos que já existem na tela (timeline de retificações, lista de anexos). Sem novo backend.
- Modo `?modoConsulta` e regex de leitura preservados.
- Critério de aceite: diff de impressão (HTML do laudo) **byte-a-byte idêntico** antes/depois.

### Etapa 3 — Fase 3 (NovoAtendimento V2) — somente após "sim"
Modo **polimento interno** dentro do wizard atual (não substituo o wizard):
- Aplico a classificação **Essencial/Secundário/Avançado** já documentada em `docs/ux/essencial-secundario-avancado.md`:
  - **Essencial** sobe (busca paciente, lista exames + total, convênio, botão finalizar).
  - **Secundário** vira accordion fechado por padrão (solicitante por exame, cobrança híbrida, desconto, forma de pagamento).
  - **Avançado** vira botões discretos no header (OCR, Avaliação IA, Soroteca, cadastro paciente inline).
- **Nada** muda em: `atendimentoStore`, cálculos de preço (CBHPM/TUSS/Própria), regras de cobrança híbrida, validações, persistência, rotas Phase-A (`/atendimentos/novo`, `/atendimentos/:protocolo/editar`).
- Se você quiser realmente substituir o wizard pelo formato Laravel (single-page com 5 blocos), me confirme — é mudança estrutural e abro um plano separado.

### Etapa 4 — Auditoria operacional (Fase 4)
Sem analytics no projeto, faço auditoria **qualitativa**: contagem de cliques/campos/etapas via leitura de código + comparação com a baseline Laravel já documentada (`docs/audits/laravel-vs-lovable-comparativo.md`, `docs/ux/comparativo-coremas.md`). Sem números fabricados.

### Etapa 5 — Relatório executivo
Gerar `docs/ux/sislac-operational-simplification-report.md` consolidando Fases 1–4, com seções pedidas (complexidade removida, ganho operacional, comparação Laravel, próximos passos, prontidão para homologação). **Sem** afirmar regressão zero antes de validar Fase 2/3.

---

## O que **não** farei sem ordem explícita

- Trocar CSS de impressão do laudo, rodapé, margens ou assinatura.
- Substituir o wizard atual de `NovoAtendimento` por uma página única.
- Remover/renomear rotas, páginas, stores ou contextos.
- Reintroduzir PWA, dashboard legada, fallback mock de auth, ou qualquer item em `constraints/`.
- Alterar banco, RLS, edge functions, RPCs.

---

## Perguntas para destravar a execução

1. **Fase 2 (ResultadoDetalhe V2):** posso envolver o conteúdo em abas `Resultado | Impressão | Histórico | Anexos` **mantendo** o CSS/HTML de impressão e o handler de PDF intactos? (sim/não)
2. **Fase 3 (NovoAtendimento V2):** prefere **(A)** polimento interno dentro do wizard atual (Essencial/Secundário/Avançado, sem trocar estrutura) **ou (B)** reestruturação real para single-page estilo Laravel (Paciente / Exames / Pagamento / Observações / Resumo) — esta segunda derruba a constraint atual e exige plano dedicado.
3. **Fase 4:** aceita auditoria **qualitativa** (baseada em leitura de código + docs comparativos já existentes), já que o projeto não tem instrumentação de cliques/tempo?
4. **Fase 1:** confirma que considero **encerrada** (CKEditor já é o editor oficial) e só gero o changelog de status, sem retrabalho?

Respondendo essas 4, eu começo pela Etapa 1 já e sigo na ordem aprovada.
