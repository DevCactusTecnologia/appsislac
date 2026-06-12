# UX — Classificação Essencial / Secundário / Avançado (Fase 4)

**Data:** 2026-06-12  
**Filosofia-alvo:** "Olhou. Entendeu. Manteve." (Coremas)

Cada item indica **frequência de uso real** e **prioridade visual sugerida**.
Implementação **NÃO** executada — depende de aprovação explícita por constraint
de mudanças estruturais.

---

## ResultadoDetalhe

### Essencial (sempre visível, primeira dobra)
- Identificação do paciente + protocolo + idade + sexo.
- Lista de exames com status colorido.
- Painel de parâmetros do exame selecionado.
- Botão **Salvar + Liberar** (ação primária).
- Indicador de "valor crítico" inline no parâmetro.

### Secundário (visível mas recolhido / segunda dobra)
- Referências clínicas (accordion por parâmetro).
- Anexos (contador + abrir).
- Histórico de retificações (timeline lateral).
- Assinatura digital (rodapé).

### Avançado (menu/aba dedicada, sob demanda)
- Auditoria detalhada.
- Cancelar liberação.
- Retificar com diff.
- Exportar PDF customizado.
- Trocar analista responsável.

---

## NovoAtendimento

### Essencial (sempre visível)
- Busca de paciente (autocomplete grande, foco automático).
- Lista de exames selecionados com preço.
- Convênio aplicado (badge).
- Botão **Finalizar atendimento**.

### Secundário (recolhido por padrão)
- Solicitante por exame (só aparece se >1 solicitante).
- Cobrança híbrida (toggle por exame).
- Desconto.
- Forma de pagamento (só ao registrar pagamento).

### Avançado (botão no header / dialog)
- OCR de requisição.
- Avaliação IA.
- Reaproveitar amostra (Soroteca).
- Cadastro de paciente inline.
- Alerta de débitos pendentes.

---

## Princípios aplicados

1. **Essencial cabe em 1 dobra** (sem rolagem em 1366×768).
2. **Secundário fica a 1 clique** (accordion/popover, não nova página).
3. **Avançado fica a 2 cliques** (menu/dialog dedicado).
4. **Ação primária é única e óbvia** por tela.
5. **Status com 1 vocabulário** por superfície.

---

## O que NÃO mudar (constraints estritos)

- Layout de impressão do laudo (margens, rodapé 4mm, assinatura, CSS).
- Wizard de 4 steps do NovoAtendimento como **estrutura** (só polimento
  visual interno por step é seguro sem aprovação).
- Regras de negócio (precificação, cobrança, validação clínica).
- Banco, RLS, edge functions.
