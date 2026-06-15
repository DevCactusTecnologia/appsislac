# Domain Driven Routes — Fase A — Relatório de Execução

**Status:** ✅ Executada com sucesso
**Escopo:** Apenas Fase A aprovada (rotas internas de baixo risco).
**Regra de parada respeitada:** sem início de Fase B; sem alterações em DB, RLS, RBAC, Edge Functions, Portal, WhatsApp, QR Codes, PDFs, comprovantes ou fluxos clínicos.

## 1. Rotas migradas (canônicas)

| Domínio       | Rota antiga                              | Rota canônica (nova)                        |
| ------------- | ---------------------------------------- | ------------------------------------------- |
| Atendimentos  | `/novo-atendimento`                      | `/atendimentos/novo`                        |
| Atendimentos  | `/editar-atendimento/:protocolo`         | `/atendimentos/:protocolo/editar`           |
| Resultados    | `/consultar-resultados`                  | `/resultados/consulta`                      |
| Resultados    | `/consultar-resultado/:id`               | `/resultados/:id/consulta`                  |

Rotas intencionalmente **não migradas** nesta fase (conforme escopo):
`/registrar-coleta`, `/analisar-amostra`, `/verificar/:codigo`, `/p/:codigo`,
`/resultados`, `/resultado/:id`, rotas públicas e Portal do Paciente.

## 2. Redirects criados (compatibilidade total)

Implementados em `src/App.tsx`. Páginas legadas continuam acessíveis e fazem
redirect transparente via React Router (`<Navigate replace />`) preservando
parâmetros dinâmicos:

- `/novo-atendimento` → `/atendimentos/novo` (`<Navigate>` simples)
- `/editar-atendimento/:protocolo` → `/atendimentos/:protocolo/editar` (componente `LegacyEditarAtendimentoRedirect`, preserva `:protocolo` com `encodeURIComponent`)
- `/consultar-resultados` → `/resultados/consulta` (`<Navigate>` simples)
- `/consultar-resultado/:id` → `/resultados/:id/consulta` (componente `LegacyConsultarResultadoRedirect`, preserva `:id`)

Os redirects usam `replace` para que a URL antiga não polua o histórico do navegador.

## 3. Links/Navegações atualizadas

| Arquivo                                              | Antes                                   | Depois                                   |
| ---------------------------------------------------- | --------------------------------------- | ---------------------------------------- |
| `src/App.tsx`                                        | 4 rotas legadas como entrypoints        | 4 rotas canônicas + 4 redirects legados  |
| `src/components/AppSidebar.tsx`                      | `/consultar-resultados` (menu Resultados → Consultar) | `/resultados/consulta`         |
| `src/components/AppSidebar.tsx` (PERMISSION_BY_PATH) | chave `/consultar-resultados`           | chave `/resultados/consulta`             |
| `src/pages/SolicitacoesSite.tsx`                     | `navigate("/novo-atendimento", …)`      | `navigate("/atendimentos/novo", …)`      |
| `src/pages/NovoAtendimento.tsx` (2 ocorrências)      | `navigate("/novo-atendimento", …)`      | `navigate("/atendimentos/novo", …)`      |
| `src/pages/Index.tsx` (4 ocorrências)                | `navigate("/novo-atendimento")` e `navigate(\`/editar-atendimento/…\`)` | rotas canônicas |
| `src/pages/LabApoio.tsx`                             | `navigate(\`/consultar-resultado/…\`)`  | `navigate(\`/resultados/…/consulta\`)`   |
| `src/pages/ConsultarResultados.tsx`                  | `navigate(\`/consultar-resultado/…\`)`  | `navigate(\`/resultados/…/consulta\`)`   |
| `src/components/dashboard/RecepcionistaDashboard.tsx`(2) | `navigate("/novo-atendimento")`     | `navigate("/atendimentos/novo")`         |
| `src/components/dashboard/AnalistaDashboard.tsx` (2) | `to="/consultar-resultados"`            | `to="/resultados/consulta"`              |
| `src/pages/ResultadoDetalhe.tsx`                     | botão "voltar" para `/consultar-resultados` em modo consulta | `/resultados/consulta`        |

### Detalhe técnico — `modoConsulta` em `ResultadoDetalhe.tsx`

A página `ResultadoDetalhe` é usada simultaneamente pelo fluxo de liberação
(`/resultado/:id`) e pelo fluxo de consulta somente-leitura. A detecção do modo
foi ampliada para reconhecer **tanto a rota canônica nova quanto a legada**
(durante a janela de compatibilidade):

```ts
const modoConsulta =
  location.pathname.startsWith("/consultar-resultado/") ||
  /^\/resultados\/[^/]+\/consulta\/?$/.test(location.pathname);
```

Isso garante que, mesmo enquanto bookmarks/históricos antigos coexistirem com
a nova URL, o comportamento read-only é preservado.

## 4. Quebras encontradas e correções

| Quebra                                                                       | Status     |
| ---------------------------------------------------------------------------- | ---------- |
| Build TS: `LegacyEditarAtendimentoRedirect` / `LegacyConsultarResultadoRedirect` ainda não existiam ao referenciar nas rotas | ✅ Corrigido: componentes criados em `App.tsx` com `useParams`, e import de `useParams` adicionado |
| Risco de divergência do `modoConsulta` ao migrar `/consultar-resultado/:id` para `/resultados/:id/consulta` | ✅ Corrigido: regex inclui a nova rota canônica |
| Risco de bookmarks antigos quebrarem                                         | ✅ Mitigado: redirects 100% client-side com preservação de parâmetros |

Nenhuma outra ocorrência das strings legadas foi encontrada em `src/` fora de:
- `App.tsx` (redirects intencionais)
- `ResultadoDetalhe.tsx` (detecção dupla intencional)
- comentários (`NovoAtendimento.tsx`, `ConsultarResultados.tsx`, `PacienteHeaderCard.tsx`, `domains/appointment/services/pricing.ts`) — não afetam runtime.

## 5. Validação funcional (smoke test)

Fluxos validados via inspeção estática + navegação no preview:

1. **Atendimento — criar**
   `Index → botão "Novo Atendimento" → /atendimentos/novo → NovoAtendimento` ✅
2. **Atendimento — editar**
   `Index → ação Editar → /atendimentos/:protocolo/editar → NovoAtendimento (modo edição)` ✅
3. **Atendimento — pós-salvar**
   `NovoAtendimento → success dialog → "Novo atendimento" → /atendimentos/novo` ✅
4. **Resultados — consulta (lista)**
   `Sidebar → Resultados → Consultar → /resultados/consulta → ConsultarResultados` ✅
5. **Resultados — consulta (detalhe)**
   `ConsultarResultados → linha → /resultados/:id/consulta → ResultadoDetalhe em modoConsulta` ✅
6. **Resultados — voltar**
   `ResultadoDetalhe (modoConsulta) → seta "Voltar" → /resultados/consulta` ✅
7. **Deep links diretos (URL digitada)** ✅
   - `/atendimentos/novo`
   - `/atendimentos/<protocolo>/editar`
   - `/resultados/consulta`
   - `/resultados/<id>/consulta`
8. **Compatibilidade — URLs legadas digitadas/bookmarks** ✅
   - `/novo-atendimento` redireciona
   - `/editar-atendimento/<protocolo>` redireciona preservando o parâmetro
   - `/consultar-resultados` redireciona
   - `/consultar-resultado/<id>` redireciona preservando o parâmetro
9. **Menus / Sidebar / Atalhos**: todos os links operacionais visíveis apontam para as canônicas. ✅

## 6. Critérios de sucesso

- ✅ URLs mais aderentes ao domínio (substantivo no plural + ação como segmento).
- ✅ Compatibilidade total (4/4 redirects funcionais e preservando params).
- ✅ Nenhum link interno aponta mais para as rotas legadas (exceto os redirects).
- ✅ Nenhuma alteração em regra de negócio, RLS, RBAC, Supabase ou Edge Functions.
- ✅ Nenhuma alteração em `/registrar-coleta`, `/analisar-amostra`, `/verificar/:codigo` ou `/p/:codigo`.
- ✅ ResultadoDetalhe continua diferenciando `modoConsulta` corretamente em ambas as URLs.

## 7. Próximos passos (NÃO executados — fora do escopo)

- Fase B: promover sub-entidades de `/configuracoes`.
- Fase C: prefixar rotas públicas (`/portal/...`) — requer 301 server-side por causa de QR/PDF.
- Fase D: limpeza definitiva dos aliases legados (somente após período de observação).

**Parada respeitada.** Nada além da Fase A foi tocado.
