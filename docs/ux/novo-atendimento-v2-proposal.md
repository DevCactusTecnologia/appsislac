# NovoAtendimento V2 — Proposta Operacional (apenas prototipação)

**Data:** 2026-06-15
**Status:** Proposta — **nenhum código alterado**.
**Escopo:** classificar campos e comparar **wizard atual** (4 steps) vs
**tela única estilo SISLAC Laravel** (5 blocos), sem tocar em stores,
cálculos, validações, autosave ou rotas.

> Constraints respeitadas:
> - `mem://preferences/confirmacao-mudancas-estruturais` (qualquer
>   reestruturação real exige "sim" explícito).
> - `docs/ux/essencial-secundario-avancado.md` (wizard atual é a
>   estrutura aprovada até nova decisão).

---

## 1. Inventário de campos (`src/pages/NovoAtendimento.tsx`, 2 630 linhas)

| Campo / bloco | Step atual | Obrigatório? | Frequência de uso |
|---|---|---|---|
| Busca de paciente (autocomplete) | 1 | sim | 100% |
| Cadastro inline de paciente | 1 (dialog) | não | ~10% |
| Dados básicos do paciente (read-only) | 1 | — | 100% (exibido) |
| Solicitante padrão | 1 | sim | 100% |
| Solicitante por exame (override) | 2 | não | <15% |
| Convênio | 2 | sim | 100% |
| Lista de exames selecionados | 2 | sim | 100% |
| Preço por exame + total | 2 | — | 100% |
| Cobrança híbrida (paciente vs convênio por exame) | 2 | não | ~20% |
| Material / amostra (auto pelo catálogo) | 2 | — | 100% (exibido) |
| Repetição de amostra (amostraSeq) | 2 | não | <5% |
| Lab apoio override por exame | 2 | não | <5% |
| Tipo de processo (interno/terceirizado) snapshot | 2 | — | 100% (exibido) |
| Avaliação IA / sugestão de exames | 2 (botão) | não | <10% |
| OCR de requisição | 1 (botão) | não | <10% |
| Reaproveitar amostra (Soroteca) | 2 (botão) | não | <5% |
| Forma de pagamento | 3 | depende | ~70% |
| Desconto | 3 | não | ~25% |
| Parcelamento | 3 | não | ~15% |
| Alerta de débitos pendentes | 3 (popup) | — | 100% quando aplicável |
| Observações livres | 4 | não | ~30% |
| Resumo final | 4 | — | 100% |
| Botão Finalizar | 4 | sim | 100% |

---

## 2. Classificação Essencial / Secundário / Avançado

### Essencial (sempre visível)
- Busca de paciente (foco automático).
- Convênio.
- Lista de exames + preço total.
- Botão **Finalizar atendimento**.
- Solicitante (quando único).

### Secundário (recolhido, accordion fechado)
- Solicitante por exame (aparece só se houver >1).
- Cobrança híbrida (toggle por exame).
- Desconto / parcelamento.
- Forma de pagamento (expande ao registrar pagamento).
- Observações.

### Avançado (botão discreto no header)
- OCR de requisição.
- Avaliação IA.
- Reaproveitar amostra (Soroteca).
- Cadastro de paciente inline.
- Override de lab apoio / repetição de amostra.

### Candidatos a colapso (default fechado)
- Solicitante por exame, cobrança híbrida, desconto, parcelamento,
  observações, override de lab apoio.

### Candidatos a seção "Avançado"
- OCR, Avaliação IA, Soroteca, repetição de amostra.

---

## 3. Wizard atual (4 steps)

```text
[ 1. Paciente ] → [ 2. Exames ] → [ 3. Pagamento ] → [ 4. Resumo ]
```

- 6–8 cliques mínimos para um paciente já cadastrado.
- ~12 campos visíveis ao abrir o Step 1.
- Avançado misturado com Essencial em cada step.

---

## 4. Tela única proposta (estilo Laravel — 5 blocos)

```text
┌──────────────────────────────────────────────────────────────────┐
│ Novo Atendimento                       [OCR] [IA] [Soroteca] ⋯   │
├──────────────────────────────────────────────────────────────────┤
│ ▸ Paciente   Maria Silva · 42a · F · CPF 000…   [trocar]         │
├──────────────────────────────────────────────────────────────────┤
│ ▸ Exames                                                         │
│   + Hemograma         Particular   R$ 35,00   [⋯]                │
│   + Glicemia          Unimed       R$ 12,00   [⋯]                │
│   [+ adicionar exame]                          Total  R$ 47,00   │
├──────────────────────────────────────────────────────────────────┤
│ ▾ Pagamento (clicar para expandir)                               │
├──────────────────────────────────────────────────────────────────┤
│ ▾ Observações (clicar para expandir)                             │
├──────────────────────────────────────────────────────────────────┤
│ Resumo                                                           │
│                                            [ Finalizar ]         │
└──────────────────────────────────────────────────────────────────┘
```

- 3–4 cliques mínimos para um paciente já cadastrado.
- ~6 campos visíveis ao abrir.
- Avançado isolado no header.
- Secundário em accordion (Pagamento, Observações).

---

## 5. Comparativo

| Pergunta | Wizard atual | Tela única (proposta) |
|---|---|---|
| Menos cliques? | 6–8 | **3–4** ✅ |
| Menos treinamento? | Curva média (precisa entender 4 steps) | **Baixa** — tudo numa tela ✅ |
| Menos erros? | Erro só aparece ao avançar de step (atrito) | **Erro inline imediato** ✅; mas maior densidade visual pode confundir iniciantes |
| Melhor para laboratórios **pequenos**? | OK | **Tela única** ✅ — atendimento rápido, 1 recepcionista, fluxo direto |
| Melhor para laboratórios **grandes**? | **Wizard** ✅ — separação clara de responsabilidades (recepção × faturamento × coleta), padroniza treinamento de equipes maiores | Tela única exige operador mais sênior |

### Síntese
- **Tela única** ganha em velocidade, cliques e laboratórios pequenos.
- **Wizard** ganha em padronização de equipe e laboratórios grandes.
- Recomendação: opção híbrida — **manter o wizard como esqueleto** e
  aplicar Essencial/Secundário/Avançado **dentro** dele (subir
  essenciais, colapsar secundários, mover avançados para header). Esta é
  a única mudança segura sem derrubar a constraint atual.

---

## 6. Impacto esperado (qualitativo)

| Métrica | Wizard atual | Wizard polido (recomendado) | Tela única (opção B) |
|---|---|---|---|
| Cliques mínimos | 6–8 | 4–6 | 3–4 |
| Campos visíveis na abertura | ~12 | ~6 | ~6 |
| Risco de regressão de regra | — | **Zero** (só layout) | Médio (precisa revalidar cálculos e validações no mesmo render) |
| Compatível com constraints atuais | ✅ | ✅ | ❌ exige nova aprovação e atualização de memória |

---

## 7. Limitação declarada
Nenhum arquivo de código foi alterado nesta entrega. As duas abordagens
acima são apenas propostas operacionais. A escolha entre elas e a
implementação dependem de aprovação explícita em ciclo separado.
