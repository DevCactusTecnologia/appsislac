# FASE 7 — Teste de Regressão Lógica

> Inspeção estática + histórico das últimas refatorações registradas.

### Alguma regra mudou?
**NÃO.** Migrações foram de localização (lib → domains) e read-path (stores → `useDicionario`). Funções permanecem com mesmas assinaturas; `src/lib/comprovantes.ts` virou fachada re-exportando dos novos serviços.

### Algum fluxo foi alterado?
**NÃO.** Rotas (`App.tsx`) inalteradas. Boot e contextos (`AuthContext`, `MenuLayoutContext`, `SuperAdminPrefsContext`) preservados. Constraints estruturais (mem://preferences/confirmacao-mudancas-estruturais) respeitadas.

### Alguma funcionalidade perdeu comportamento?
**NÃO** identificado. Evidências:
- `useSelectOptions` marcado `@deprecated` mas ainda exportado — consumidores legados continuam funcionando.
- `financeiroListasStore` mantém `createItem`/`deleteItem` e invalida cache do React Query — mutações continuam refletindo na UI.
- Layout de impressão de laudo intocado (constraint travado).
- Dashboard legada permanece removida (constraint mantido), `/dashboard` oficial preservado.

### Alguma simplificação gerou regressão?
**NÃO** identificado. Pontos a vigiar em smoke test:
1. **Mapping de IDs em `select_options`** — usa `legacyId` para mapear back para `ListaItem`. Validar com dado real que combos do Financeiro carregam.
2. **Cache invalidation** após criar/excluir item de dicionário no Financeiro — confirmar visualmente.
3. **PDF de comprovante** após split em `comprovantesHtml`/`comprovantesRender` — gerar 1 PDF de teste e comparar com referência.
4. **Critico checker** após mover para `domains/result/services` — disparar 1 valor crítico e verificar `criticos_comunicacoes`.

**Veredito:** Sem regressão detectada por inspeção estática. **Recomenda-se smoke test funcional dos 4 pontos** antes de homologação.
