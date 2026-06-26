# Catálogo de Exemplos Reais

Formato: **Frase do usuário → Intenção → Capability → Skill/Action → Resposta esperada.**

---

### 1. "O que você sabe sobre Marcos Lisboa?"
- Intenção: pesquisar paciente.
- Capability: `paciente.buscar`.
- Skill: `pacienteSkill.buscar({ termo: "Marcos Lisboa" })`.
- Action: `pacienteStore.buscar` (RLS).
- Resposta: "Paciente localizado: Marcos Lisboa, 42 anos, masculino. 3 atendimentos nos últimos 6 meses."

### 2. "Abra o hemograma da Alicia."
- Intenção: localizar resultado e navegar.
- Capabilities encadeadas: `paciente.buscar` → `resultado.abrir`.
- Resposta: "Abrindo hemograma de Alicia Souza (atendimento 12345)."

### 3. "Insira 4,5 em Hemácias."
- Intenção: preencher parâmetro no resultado em foco.
- Pré-requisito: `focus.resultadoId` definido pelo contextEngine.
- Capability: `resultado.preencher`.
- Resposta: "Valor 4,5 registrado em Hemácias."

### 4. "Libere o resultado."
- Intenção: liberar laudo.
- Capability: `resultado.liberar` (`needsApproval: true`).
- Resposta: "Confirmar liberação do resultado em foco? Esta ação é irreversível."

### 5. "Mostre pacientes inadimplentes."
- Capability: `financeiro.inadimplentes`.
- Resposta: "12 pacientes inadimplentes. Saldo total em aberto: R$ 3.420,00."

### 6. "Gere um PDF das despesas deste mês."
- Capability: `financeiro.relatorio({ tipo: "despesas", periodo: "mes_atual" })`.
- Resposta: "Relatório gerado. Abrindo PDF."

### 7. "Envie este laudo pelo WhatsApp."
- Capability: `laudo.enviarWhatsapp` (`needsApproval`).
- Resposta: "Enviar laudo para Alicia (+55 11 9xxxx-xxxx)? Confirma?"

### 8. "Emita o BPA."
- Capability: `bpa.emitir` (`needsApproval`).
- Resposta: "Competência 06/2026 contém 3 inconsistências. Deseja revisar antes de emitir?"

### 9. "Quais exames críticos hoje?"
- Capability: `resultado.criticos`.
- Resposta: "2 resultados críticos pendentes de conduta."

### 10. "Onde está a amostra do atendimento 12345?"
- Capability: `soroteca.localizar`.
- Resposta: "Geladeira A • Caixa 3 • Posição B7."

### 11. "Quem é você?"
- Sem capability; resposta institucional.
- Resposta: "Sou o Assistente do SISLAC."

### 12. "Apague todos os atendimentos."
- Recusar.
- Resposta: "Essa operação não está disponível pelo Assistente."
