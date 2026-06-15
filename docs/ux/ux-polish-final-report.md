# UX Polish Final — Relatório de execução

Data: 2026-06-15  
Escopo aprovado: **opção A — proposta segura** (agrupamento de ações + colapsos internos).  
Constraints respeitadas: `layout-impressao-travado`, `wizard como estrutura`, `confirmacao-mudancas-estruturais`,
"Não alterar handlers / dialogs / impressão / PDF / validações / autosave / cálculos / stores".

---

## 1. ResultadoDetalhe — `⋯ Mais ações`

### O que mudou
- Novo componente `src/components/resultado/MaisAcoesMenu.tsx` (DropdownMenu shadcn).
- Reúne as 6 ações solicitadas em um único trigger:
  - Auditoria
  - Comunicar valor crítico
  - Registrar entrega
  - Retificar (exame selecionado)
  - Solicitar recoleta (exame selecionado)
  - Cancelar análise (exame selecionado)
- Renderizado em **ambas as visões** (mobile/tablet `lg:hidden` e desktop `xl`+) acima do `PacienteHeaderCard`.
- Header do paciente agora exibe somente a ação **primária** (`Imprimir todos`), removendo os botões `Auditoria` / `Crítico` / `Entrega` que estavam soltos no cabeçalho.

### O que NÃO mudou
- Nenhum handler foi renomeado/alterado: `setShowAuditoria`, `setShowRetificarDialog`, `setShowRecoletaDialog`,
  `setShowCriticoDialog`, `setShowEntregaDialog`, `handleCancelarAnalise` permanecem intactos.
- Nenhum diálogo (RegistrarCriticoDialog, RegistrarEntregaDialog, SolicitarRecoletaDialog, AuditoriaPanel,
  CelebracaoLiberacaoDialog) foi tocado.
- Pipeline de impressão e PDF (`printHtmlInHiddenFrame`, `renderRodapePadrao`,
  `renderCabecalhoPadrao`, layout cientifico, assinatura, rodapé regulatório) **não foi alterado**.
- Não criamos abas (`Tabs`) — constraint `layout-impressao-travado` preservada.
- Botões inline de "Retificar / Cancelar análise / Recoleta" dentro do painel de exame **permanecem como atalho contextual** (não removidos, para evitar mudança de comportamento em fluxos memorizados).

### Carga cognitiva — elementos visíveis no cabeçalho
| Estado | Antes | Depois |
|---|---|---|
| Modo edição (não-consulta) | 4 botões header + 3 inline = **7 ações** | 1 botão primário + 1 trigger "Mais ações" = **2 ações visíveis** (6 ações via menu, mesmas 3 inline) |
| Modo consulta              | 2 botões header                | 1 primário + 1 "Mais ações" (Auditoria) |

Redução ≈ **70%** dos botões competindo por atenção no cabeçalho.

---

## 2. NovoAtendimento — Ferramentas avançadas + Ajustes por exame

### O que mudou
- Novo componente `src/components/atendimento/FerramentasAvancadasMenu.tsx`.
  - Substitui os dois botões soltos do header (`Ler requisição` + `Avaliação IA`) por **um único dropdown**.
  - Itens: OCR (`Ler requisição`), IA (`Avaliação IA`), Soroteca, Reaproveitamento de amostra.
  - Soroteca e Reaproveitamento aparecem como **itens informativos (disabled)** — ambos são automáticos no fluxo atual (acionados ao adicionar exame compatível), então a UI explicita isso em vez de prometer botão manual inexistente.

- Toggle único **"Ajustes por exame"** introduzido no cabeçalho da seção *Solicitar exames* (STEP 3).
  - Estado `mostrarAjustesPorExame` (default `false`).
  - Quando colapsado, oculta dois `<select>` por linha de exame: **Cobrança híbrida** (Paciente/Convênio) e **Solicitante por exame** (visível só quando `solicitantes.length > 1`).
  - Valores subjacentes em `exames[].cobrancaDestino`, `exames[].convenioCobrancaId` e `exames[].solicitanteExame` **não são alterados pelo toggle** — apenas a visibilidade muda.

### Desconto e Parcelamento (STEP 4)
- **Já estão colapsados**: ambos vivem dentro do `PagamentoDialog` (acionado por "Pagar agora" / "Editar pagamento").
  - A linha de "Desconto" no resumo financeiro só aparece quando `desconto > 0` (já condicional).
  - "Parcelamento" não é renderizado em STEP 4 — toda a UI mora no diálogo.
- Nenhuma ação adicional foi necessária. Registrado como **bloqueio leve**: não há superfície inline para colapsar.

### O que NÃO mudou
- Stores (`atendimentoStore`, `pagamentoRealizadosStore`, `sorotecaStore`, `distribuirDescontoEntreExames`) — intocados.
- Validações em `handleSalvar`/`handleConfirmar` (solicitante obrigatório, semSolicitante check, etc.) — intactas.
- Autosave / hidratação / `originalSolicitantes` — sem mudança.
- Cálculos de `subtotal`, `total`, `saldoDevedor`, `distribuirDescontoEntreExames` — sem mudança.
- Diálogos `PagamentoDialog`, `AvaliacaoIADialog`, `LeituraRequisicaoDialog`, `ReutilizarAmostraDialog` — sem mudança.
- Campos não foram movidos entre steps.

### Carga cognitiva — controles por linha de exame
| Estado | Antes | Depois (default) | Depois (com toggle ON) |
|---|---|---|---|
| Multi-convênio + multi-solicitante | nome + 2 selects + valor + remover = **5 elementos** | nome + valor + remover = **3 elementos** | igual ao "antes" |
| Convênio único + solicitante único | nome + 1 select + valor + remover = **4 elementos** | nome + valor + remover = **3 elementos** | 4 |

Redução ≈ **40%** dos controles por linha no caso multi-convênio (caso mais cognitivamente caro).

### Carga cognitiva — header do NovoAtendimento
| Antes | Depois |
|---|---|
| 2 botões soltos (`Ler requisição`, `Avaliação IA`) | 1 dropdown `Ferramentas avançadas` |

---

## 3. Bloqueios encontrados

| # | Item | Bloqueio | Mitigação aplicada |
|---|---|---|---|
| 1 | Soroteca / Reaproveitamento como "ferramentas avançadas" manuais | Não existe handler/botão atual para abrir esses fluxos manualmente — eles são automáticos (`buscarAmostrasReutilizaveisPorNome`, `setReuseDialog` disparado por `addExameByTemplate`). Criar handlers violaria "Não alterar handlers / stores". | Itens aparecem no dropdown como **informativos (disabled)** explicando o comportamento automático. |
| 2 | Parcelamento em STEP 4 | Toda a UI já vive dentro do `PagamentoDialog`. Não há superfície inline para colapsar. | Documentado: já está implicitamente colapsado atrás de "Pagar agora". |
| 3 | Desconto em STEP 4 | Mostrado no resumo apenas como linha read-only condicional (`desconto > 0`). Edição ocorre no dialog. | Documentado: já minimal. |
| 4 | Botões inline Retificar/Cancelar/Recoleta dentro do painel de exame em ResultadoDetalhe | Remover romperia muscle-memory + risco de regressão em handlers compartilhados (`handleCancelarAnalise` depende de `selectedExameId`). | Mantidos como atalhos contextuais; também acessíveis via "Mais ações". Duplicação intencional para zero risco. |

---

## 4. Arquivos alterados

Criados:
- `src/components/resultado/MaisAcoesMenu.tsx`
- `src/components/atendimento/FerramentasAvancadasMenu.tsx`
- `docs/ux/ux-polish-final-report.md` (este arquivo)

Editados:
- `src/pages/ResultadoDetalhe.tsx` — import + render do MaisAcoesMenu (mobile + desktop) + actions arrays do PacienteHeaderCard reduzidos.
- `src/pages/NovoAtendimento.tsx` — import + render do FerramentasAvancadasMenu (substitui dois botões) + estado `mostrarAjustesPorExame` + toggle no header da STEP 3 + wrap condicional dos dois `<select>` por exame.

## 5. Verificações

- `tsc --noEmit` → **0 erros**.
- Nenhum handler renomeado/removido.
- Nenhum diálogo modificado.
- Nenhuma store / RPC / edge function / banco / RLS tocada.
- Nenhuma rota alterada.
- Layout de impressão / PDF / assinatura / rodapé regulatório intactos.

---

## 6. Status

Concluído conforme aprovação "opção A". Nenhuma refatoração adicional iniciada.
