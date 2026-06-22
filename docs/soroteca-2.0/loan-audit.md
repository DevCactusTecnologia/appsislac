# Soroteca 2.0 — Fase 1.7 — Auditoria de Empréstimo

## Estado atual no SISLAC

**Não existe.** Nenhuma tabela, função, componente, hook ou rota cobre o conceito de empréstimo de amostra.

Buscas executadas:
- `rg -i "emprestim|emprestar" src/` → 0 resultados
- `pg_tables` ILIKE `%emprestim%` → 0 resultados
- `pg_proc` ILIKE `%emprestim%` → 0 resultados

## Estado no SISVIDA (imagens anexadas)

A grade "Pesquisa de Amostras" oferece, em cada linha, dois botões:
- **emprestar**
- **visualizar**

O botão "emprestar" é universal — disponível mesmo para amostras já liberadas/processadas. Indica que o SISVIDA modela:
- Retirada física da amostra para uso externo (reanálise externa, contraprova, perícia, transferência entre setores).
- Provavelmente registra: responsável, motivo, data retirada, prazo, data devolução.

A UX é apenas o gatilho — o formulário não foi mostrado, mas a presença do botão indica que **existe entidade própria**.

## Gap operacional

Operadores hoje contornam ausência de empréstimo via:
- Edição manual do campo `localizacao` ("emprestado para Dr. X").
- `observacao` livre.
- Nenhum controle de devolução.
- Nenhum prazo.

Riscos:
- Amostra "some" do controle.
- Reuso após empréstimo não bloqueado.
- Sem rastreabilidade de quem retirou.

## Recomendação (Fase 2+)

Tabela proposta:

```sql
CREATE TABLE amostra_emprestimos (
  id uuid PK,
  tenant_id uuid NOT NULL,
  amostra_id uuid NOT NULL FK,
  responsavel_user_id uuid,
  destinatario_nome text NOT NULL,    -- pode ser pessoa externa
  motivo text NOT NULL,
  data_retirada timestamptz NOT NULL DEFAULT now(),
  prazo_devolucao date,
  data_devolucao timestamptz,
  devolvido_por_user_id uuid,
  observacao text,
  created_at, updated_at
);
```

Regras:
- Bloquear `reutilizarAmostra` se houver empréstimo ABERTO.
- Novo status visual no card: **EMPRESTADA** (não conflita com enum atual — adicionar via ALTER + check).
- Alerta de prazo vencido.
- Histórico completo no `AmostraDetalheDialog`.

## Veredito

| Pergunta | Resposta |
|---|---|
| Existe? | ❌ Não |
| Existe parcialmente? | ❌ Nem parcial — gap total |
| Precisa? | ✅ Sim, para paridade com SISVIDA e controle real |
| Risco operacional sem isso? | Alto em laboratórios que retiram amostras para terceiros |
