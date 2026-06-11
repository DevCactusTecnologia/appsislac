# /novo-atendimento — UX Operacional

> Análise do fluxo do ponto de vista de um atendente real. Sem propor
> redesign.

## 1. Cliques mínimos (caminho feliz, paciente já cadastrado, 1 exame)

```text
1. Digitar nome/CPF do paciente (3+ chars)
2. Clicar no resultado do dropdown                       → 1 clique
3. Botão "Avançar"                                       → 1 clique
4. Digitar convênio → Enter/clique                       → 1 clique
5. Digitar solicitante → Enter/clique                    → 1 clique
6. Botão "Avançar"                                       → 1 clique
7. Digitar nome do exame → clique no resultado           → 1 clique
8. Botão "Avançar"                                       → 1 clique
9. (Opcional) Botão "Registrar pagamento" + valores      → 2–4 cliques
10. Botão "Finalizar atendimento"                        → 1 clique
```

**Total: 8 cliques** (sem pagamento) | **~12 cliques** (com pagamento).

## 2. Passos do wizard

4 steps formais: **Paciente → Convênio → Exames → Resumo**.
Mais 1 step "implícito" de sucesso (modal de confirmação).

## 3. Campos do formulário (caminho feliz)

| Step | Campos obrigatórios | Campos opcionais |
|---|---|---|
| 1 | Paciente | — |
| 2 | Convênio (1+), Solicitante (1+) | — |
| 3 | Exame (1+) | Solicitante por exame (só se >1 solicitante), cobrança convênio/paciente, lab apoio override |
| 4 | — | Desconto, Valor pago, Forma de pagamento |

**Total: 4 obrigatórios** + N opcionais (cobrança/desconto/pagamento).

## 4. Atalhos e produtividade

| Atalho/Função | Local | Avaliação |
|---|---|---|
| Ler requisição (OCR/IA) | header | ✅ economiza digitação de 5–15 exames |
| Avaliação IA | header | ✅ sugere exames adicionais com justificativa |
| Reaproveitar amostra (Soroteca) | popup ao adicionar exame | ✅ evita nova punção |
| Prefill de solicitação web | automático via `location.state` | ✅ zero retrabalho |
| Cadastro de paciente inline | `CadastroPacienteDialog` | ✅ não precisa sair da página |
| Alerta de débitos | banner no step 1 | ✅ evita esquecer cobrança antiga |

## 5. Fricções operacionais identificadas

### 5.1 Step 2 quase sempre obriga 2 buscas iguais
- Convênio e Solicitante usam o mesmo padrão visual e quase sempre são
  digitados juntos. Atendente precisa clicar fora/Enter entre os dois.
- **Evidência**: linhas 264–293 mostram duplicação estrutural.

### 5.2 Dropdown de paciente renderizado em portal
- `:117–137` posiciona via `getBoundingClientRect` em scroll/resize.
  Funciona, mas em layouts com `overflow: hidden` no card pode causar
  "salto visual" perceptível.

### 5.3 Validação só ocorre no botão "Avançar"
- Erros aparecem como `toast` (`:744–773`). Não há indicador visual nos
  campos. Atendente precisa ler toast para entender o que faltou.

### 5.4 Solicitante por exame só obrigatório com >1 solicitante
- Regra correta, mas a UI só sinaliza o erro **ao tentar avançar**
  (`:761–771`). Não há highlight nos exames sem solicitante até esse momento.

### 5.5 Repetição de exame abre diálogo modal
- Ao adicionar exame já presente, abre `novaAmostraDialog` perguntando
  "nova amostra ou substituir?". 2 cliques extras por repetição. Esperado
  para evitar erro, mas frequente em pacientes com perfil complexo.

### 5.6 Cobrança híbrida (paciente/convênio) por exame
- Para atendimento com 10 exames e 2 convênios, alterar cobrança individual
  exige 10 toggles. Não há "aplicar a todos" visível no código.

### 5.7 Desconto sem campo de motivo
- `desconto` é livre (`:359`). Sem campo de justificativa nem limite
  configurável. Risco operacional (uso indevido).

### 5.8 Valor pago é input numérico simples
- Sem máscara de moeda BRL nativa (usa `fmtBRL` só para exibição). Em
  digitação manual pode aceitar formatos inconsistentes.

### 5.9 Botão "Avaliação IA" no header (sempre visível)
- Acessível mesmo sem paciente/exames selecionados. Usuário pode clicar
  cedo demais e não obter sugestões úteis.

### 5.10 Modo edição esconde busca de paciente
- `showPacienteSearch = !isEditing` (`:374`). Correto, mas trocar o
  paciente em uma edição exige clicar em "Trocar paciente" — fluxo OK,
  apenas pouco descoberto.

## 6. Etapas que **funcionam bem**

- Stepper clicável (qualquer step revisitável).
- Lazy loading de dialogs (carregamento percebido rápido).
- Soroteca e IA estão no fluxo natural, não em telas separadas.
- Modal de sucesso entrega protocolo + contagem de etiquetas + alerta de
  terceirizados (downstream visível).
- Validação clínica bloqueia edição de finalizados (evita corrupção).

## 7. Resumo

| Métrica | Valor |
|---|---|
| Cliques (mínimo) | 8 |
| Cliques (com pagamento) | ~12 |
| Steps | 4 |
| Campos obrigatórios | 4 |
| Atalhos de produtividade | 6 |
| Fricções identificadas | 10 |
| Fricções críticas | 0 (todas são polimento) |

**Veredito UX**: fluxo robusto e produtivo. Fricções são de **polimento**,
não de **bloqueio**. Nenhuma justifica refatoração isolada.
