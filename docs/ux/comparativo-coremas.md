# UX — Comparativo SISLAC × Coremas/Laravel (Fase 5)

**Data:** 2026-06-12

## 1. Filosofia operacional

| Princípio Coremas | Estado SISLAC | Gap |
|---|---|---|
| Olhou → entende em 1s | Parcial (4 vocabulários de status) | Unificar vocabulário |
| Ação primária óbvia | Parcial (Salvar/Liberar separados) | Combinar |
| Tudo importante em 1 dobra | Não (lista exames + parâmetros + sidebar competem) | Reorganizar prioridades |
| Mouse opcional | Não (Tab não navega exames) | Atalhos teclado |
| Validação inline | Não (toast no avançar) | Validação no blur |

## 2. Métricas comparativas (estimadas)

| Métrica | Coremas | SISLAC | Delta |
|---|---:|---:|---:|
| Cliques para liberar 10 exames | 12 | 20 | +67% |
| Cliques novo atendimento (1 exame) | 6 | 8 | +33% |
| Telas para finalizar atendimento | 1 | 4 (wizard) | +300% |
| Vocabulários de status | 1 | 4 | +300% |
| Atalhos de teclado | 5+ | 0 críticos | — |

## 3. Onde SISLAC já é melhor

- OCR de requisição (Coremas não tem).
- Avaliação IA de exames (Coremas não tem).
- Soroteca integrada (Coremas tem separado).
- Realtime/multi-tenant (Coremas é single-tenant).
- Auditoria estruturada (Coremas é log textual).

## 4. Recomendações (sem executar)

### Alto impacto / baixo risco
1. Unificar vocabulário de status em **1 conjunto** (Liberado/Pendente/Retificado).
2. Combinar **Salvar + Liberar** em um botão (mantendo confirmação).
3. Validação inline no blur dos campos obrigatórios.
4. Highlight nos exames sem solicitante (vez de só toast).

### Alto impacto / risco médio (precisa aprovação)
5. Botão "Aplicar cobrança a todos" no step Exames.
6. "Expand all" + navegação Tab entre exames no ResultadoDetalhe.
7. Substituir analista default por usuário autenticado.

### Alto impacto / alto risco (precisa "sim" explícito)
8. NovoAtendimento como página única com blocos colapsáveis (vez de wizard).
9. ResultadoDetalhe em abas (Resultados / Anexos / Auditoria / Impressão).

## 5. Veredito

SISLAC tem **mais capacidades** que Coremas, mas paga em **densidade
operacional**. A maturidade arquitetural (auditada em
`docs/final-governance/`) já permite a simplificação. Falta apenas
**decisão de produto** sobre quais recomendações executar.

**Regressões funcionais identificadas pela auditoria:** nenhuma.  
**Bloqueios para piloto/homologação:** nenhum.
