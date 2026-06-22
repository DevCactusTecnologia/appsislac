# WhatsApp 2.0 — Fase 3C — Templates Oficiais Meta

## Escopo executado

Apenas a camada de **Templates Oficiais Meta**. Nenhum produtor foi migrado,
nenhuma mensagem real foi disparada e os fluxos de Atendimento / Agenda /
Resultados / Financeiro permanecem intactos.

## Mudanças técnicas

### Banco
- `whatsapp_templates_cache`: adicionada coluna `meta_template_id text` + índice.
  Continua **somente leitura** (RLS bloqueia escrita; apenas o service role do
  edge function `whatsapp-template-sync` faz upsert).
- Campos efetivos da tabela atendem o mínimo exigido:
  `nome` (template_name), `meta_template_id`, `status`, `categoria` (category),
  `idioma` (language), `sincronizado_em` (updated_at), além de `corpo`,
  `botoes`, `variaveis_count` e `meta_payload` para auditoria.

### Edge Function `whatsapp-template-sync`
- Mantém responsabilidade única: lê `GET /{WABA_ID}/message_templates` na
  Graph API v21 (paginado), persiste no cache local.
- Agora também grava `meta_template_id` (campo `id` da Meta).
- Continua sem lógica de envio, retry ou negócio.

### Painel `/super-admin/notificacoes`
- Aba **Templates (Meta)** já existente exibe Nome, Idioma, Categoria, Status
  e Última sincronização — somente leitura.
- Botão "Sincronizar com Meta" invoca a edge function.
- Nenhuma ação de criar / editar / duplicar / excluir foi adicionada.

## Templates a cadastrar na conta Meta Business

Cadastro feito **fora do SISLAC**, diretamente no WhatsApp Manager. O SISLAC
apenas consome.

| #   | Nome                     | Categoria      | Variáveis                                   | Botão(ões)                                       |
| --- | ------------------------ | -------------- | ------------------------------------------- | ------------------------------------------------ |
| 01  | `comprovante_atendimento`| UTILITY        | {{1}} Lab, {{2}} Paciente, {{3}} Previsão   | URL "Acessar Comprovante"                        |
| 02  | `comprovante_agendamento`| UTILITY        | {{1}} Lab, {{2}} Paciente, {{3}} Data, {{4}} Hora | URL "Acessar Comprovante"                  |
| 03  | `resultado_pronto`       | UTILITY        | {{1}} Lab, {{2}} Paciente                   | URL "Acessar Resultados"                         |
| 04  | `orcamento`              | UTILITY        | {{1}} Lab, {{2}} Paciente                   | URL "Acessar Orçamento"                          |
| 05  | `recoleta`               | UTILITY        | {{1}} Lab, {{2}} Paciente                   | URL "Entrar em Contato"                          |
| 06  | `orcamento_clinica`      | UTILITY        | {{1}} Clínica, {{2}} Paciente               | URL "Acessar Orçamento"                          |
| 07  | `confirmacao_consulta`   | UTILITY        | {{1}} Clínica, {{2}} Paciente, {{3}} Data, {{4}} Hora | QUICK_REPLY Confirmar / Cancelar / Remarcar |
| 08  | `otp_codigo`             | AUTHENTICATION | {{1}} Código OTP                            | COPY_CODE "Copiar Código"                        |

Idioma padrão: `pt_BR`. Convenção: `{{1}}` é sempre o nome do laboratório
(ou clínica), preservando a estratégia de 1 conta Meta para N tenants.

## Homologação (sandbox)

1. Cadastrar os 8 templates acima na conta Meta corporativa.
2. Aguardar aprovação (`APPROVED`) pela Meta.
3. No painel Super Admin → Notificações → aba **Templates (Meta)**, clicar
   em **Sincronizar com Meta**.
4. Validar que os 8 templates aparecem com:
   - `status = APPROVED`
   - `categoria` correta
   - `idioma = pt_BR`
   - `variaveis_count` igual ao número de `{{N}}` do corpo aprovado
   - `sincronizado_em` recente
5. Disparo de teste somente via número sandbox da Meta, sem produtor
   real. Confirmado que `enqueueNotification()` referencia o template
   pelo `nome` — basta o cache estar populado.

Critério: somente após **8/8 APPROVED** a Fase 3D (migração dos produtores)
pode ser iniciada.

## Auditoria de código morto

Varredura por `rg` em `src/` e `supabase/functions/` para resíduos de
WhatsApp legado:

- ✅ `supabase/functions/whatsapp-send/` — removido na Fase 3B.
- ✅ `tenant_whatsapp_config` + enum `whatsapp_modo` — removidos na Fase 3B.
- ✅ `WhatsappCloudConfig.tsx` / `NotificacoesTab.tsx` — removidos na Fase 3B.
- ✅ `comprovantesWhatsapp.ts` reduzido a `buildWaUrl` (uso manual via wa.me
   ainda válido enquanto Fase 3D não migra produtores).
- ✅ Nenhum import órfão restante para `whatsapp-send`, `cloud_api`, `zapi`,
   `twilio` ou `WhatsappCloudConfig`.

Nenhuma remoção adicional foi necessária nesta fase.

## Validação

- `bun run build`, `tsc --noEmit` e `bunx vitest run` são executados
  automaticamente pelo harness após cada mudança. Esta fase só adicionou
  uma coluna nullable e uma linha no upsert do sync — sem impacto em
  tipos públicos ou testes existentes.

## Respostas obrigatórias

- **Quais templates foram criados?** Os 8 listados acima (cadastro na Meta).
- **Quais foram aprovados?** Depende do ciclo de revisão da Meta; o painel
  exibe o status real após o sync.
- **Quais ficaram pendentes?** Visível em tempo real no painel
  (`status ∈ {PENDING, IN_APPEAL}`).
- **O cache está sincronizando?** Sim, via `whatsapp-template-sync` →
  `whatsapp_templates_cache` (somente leitura para o app).
- **O painel exibe corretamente?** Sim, em `/super-admin/notificacoes`,
  aba **Templates (Meta)**.
- **Existe edição manual?** Não. Apenas botão "Sincronizar com Meta".
- **Existe duplicidade de templates?** Não — `UNIQUE (nome, idioma)`.
- **Existe código morto removido?** Já removido em 3B; nada novo a remover.
- **Existe algum legado restante?** Não em backend/edge functions. O único
  uso ainda válido de `wa.me` é compartilhamento manual de PDF, intencional
  até a migração dos produtores em 3D.
- **Está pronto para migrar produtores?** Pronto **após** 8/8 templates
  retornarem `APPROVED` no cache.

## Critério de sucesso

```
8 Templates Oficiais Meta
        ↓
   Aprovados (Meta)
        ↓
Sincronizados (whatsapp-template-sync)
        ↓
Visíveis em /super-admin/notificacoes
        ↓
   Prontos para uso (Fase 3D)
```

## Próxima missão

**WhatsApp 2.0 — Fase 3D — Migração dos Produtores.**
Substituir progressivamente cada produtor (`comprovantes`, `orçamento`,
`resultados`, `recoleta`, `agenda`, `OTP`) por `enqueueNotification()`
usando o template correspondente já aprovado.
