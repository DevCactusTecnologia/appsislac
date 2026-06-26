# Performance — Fase 2.1

## Cache do Manifest
- Camada única: memória do módulo `manifestClient.ts`.
- Chave: `userId :: tenantId :: hash(permissões)`.
- TTL: 5 minutos.
- Invalidação automática: troca de usuário, troca de tenant, mudança de permissões, mudança de versão (`x-manifest-version`).
- Função pública `invalidateManifestCache()` disponível para logout/troca explícita.

## Custo de rede
- 1 GET por sessão (e após TTL/mudança).
- `cache-control: private, max-age=60` no Edge.
- Payload: somente metadados (~1KB para o Registry atual).

## Cold start
- Validação do Registry roda uma vez na inicialização do Edge.
- Falha "fail-fast" se faltar campo obrigatório ou houver `id` duplicado.
