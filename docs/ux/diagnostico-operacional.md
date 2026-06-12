# UX — Diagnóstico Operacional (Fase 3)

**Data:** 2026-06-12  
**Escopo:** ResultadoDetalhe e NovoAtendimento  
**Modo:** read-only — nenhuma alteração de código, regra, banco ou segurança.

> Esta análise foca **operação real** (cliques, rolagem, carga visual,
> hierarquia), não arquitetura. Para arquitetura, ver
> `docs/final-governance/`.

---

## 1. ResultadoDetalhe (2 241 linhas)

### 1.1 Cliques por liberação (caminho feliz)
| Cenário | Cliques | Observação |
|---|---:|---|
| Liberar 1 exame normal | 2 | Assinar → Confirmar |
| Liberar 1 exame crítico | 6 | + conduta + 3 checkboxes |
| Liberar 10 exames normais | 20 | Sem ação em lote segura |
| Liberar 10 exames com 2 críticos | 28 | Lote bypassa crítico (risco) |

### 1.2 Rolagem
- Lista de exames vertical, **sem expand all**.
- Cada exame requer clique no header para expandir parâmetros.
- Em atendimento com >8 exames a tela rola **2–3 telas inteiras**.

### 1.3 Carga visual
- Sidebar de exames + painel de parâmetros + referências + assinatura +
  anexos + auditoria + retificações **na mesma tela**.
- Sem agrupamento visual claro entre "ação clínica" e "metadados".
- Status com 4 vocabulários (`finalizado`/`Digitado`/`Liberado`/`Impresso`).

### 1.4 Fricções que mais doem (segundo auditoria UX existente)
1. Salvar e Liberar são botões separados → risco de release de dado obsoleto.
2. Analista default hardcoded ("Felipe Andrade Melo") → todo outro usuário
   precisa trocar manualmente.
3. Sem validação de campos obrigatórios antes de salvar.
4. Retificação não mostra diff (caixa-preta).
5. Campos "Fórmula" renderizam como inputs cinzas sem aviso de que não
   calculam.

---

## 2. NovoAtendimento (2 527 linhas)

### 2.1 Cliques (caminho feliz)
| Cenário | Cliques |
|---|---:|
| Paciente cadastrado + 1 exame, sem pagamento | 8 |
| Idem + pagamento | ~12 |
| Paciente novo + 5 exames + pagamento | ~20 |

### 2.2 Rolagem
- Wizard de 4 steps + step implícito de sucesso.
- Cada step cabe em ~1 tela em desktop ≥1366px.
- Step "Exames" rola quando há ≥6 exames (lista vertical).

### 2.3 Fricções
- Step 2 obriga duas buscas quase idênticas (convênio + solicitante).
- Validação só dispara no botão "Avançar" (toast, sem highlight).
- Solicitante por exame só sinaliza erro ao avançar.
- Cobrança híbrida exige toggle por exame (sem "aplicar a todos").
- Desconto sem campo de motivo.

### 2.4 O que funciona bem
- Stepper clicável (qualquer step revisitável).
- OCR de requisição + Avaliação IA economizam digitação em cargas grandes.
- Soroteca embutida no fluxo natural.
- Prefill via `location.state` zera retrabalho vindo de solicitação web.
- Modal de sucesso entrega protocolo + etiquetas + alerta terceirizado.

---

## 3. Comparação com Coremas/Laravel

| Dimensão | Laravel/Coremas | SISLAC hoje |
|---|---|---|
| Telas críticas | 1 página densa, sem wizard | Wizard de 4 steps |
| Liberação | 1 clique por exame + confirmação inline | 2–6 cliques por exame |
| Validação | Inline ao campo | Toast no botão "Avançar" |
| Salvar + Liberar | Combinado | Separados |
| Status | 1 vocabulário | 4 vocabulários |
| Atalhos teclado | Tab navega tudo | Mouse-heavy |

---

## 4. Conclusão (Fase 3)

- **Bloqueante operacional:** nenhum.
- **Polimentos de alto impacto:** ver `essencial-secundario-avancado.md`.
- **Constraints respeitadas:** layout de impressão (`mem://constraints/layout-impressao-travado`) e mudanças estruturais (`mem://preferences/confirmacao-mudancas-estruturais`).
