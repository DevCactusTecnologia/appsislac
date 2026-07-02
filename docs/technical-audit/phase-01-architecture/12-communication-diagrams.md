# 12 — Communication Diagrams

Diagramas refletindo o estado atual do sistema (rotas, providers, stores, edge functions e integrações efetivamente presentes).

## Diagrama macro (visão geral)

Artefato Mermaid separado (renderizável): `/mnt/documents/sislac-arch.mmd`.

```mermaid
graph TD
  U[Usuário / Navegador]
  subgraph Frontend[Frontend React 18 + Vite]
    RT[React Router 6<br/>src/App.tsx]
    CTX[Contexts<br/>Auth / MenuLayout / SuperAdminPrefs]
    PG[Pages ~114]
    CMP[Components ~160]
    HK[Hooks 20]
    ST[Stores 39<br/>src/data/*Store.ts]
    LIB[lib/ services + adapters]
    RQ[TanStack Query]
  end
  subgraph Runtime[Runtime Layer]
    DBR[src/runtime/db.ts]
    IDN[tenant_registry]
  end
  subgraph Integrations[Integrations]
    SBC[Supabase JS Client]
    PROV[Providers dbsync / hermes-pardini]
    CONTR[contracts/*]
  end
  subgraph Backend[Lovable Cloud]
    PG_DB[(PostgreSQL<br/>355 migrations)]
    RLS[RLS + has_role + current_tenant_id]
    EDGE[Edge Functions 74]
    STO[Storage buckets]
    AUTH[Supabase Auth]
    RLT[Realtime]
  end
  subgraph External[Serviços externos]
    AI[Lovable AI Gateway]
    PIX[PIX QR/Webhook]
    APOIO[Labs de apoio]
    S3[S3-compat]
  end
  U --> RT --> PG --> CMP
  PG --> HK --> ST
  ST --> LIB
  ST --> RQ
  LIB --> SBC
  RQ --> SBC
  SBC --> DBR --> IDN --> PG_DB
  SBC --> AUTH
  SBC --> RLT
  SBC --> EDGE
  EDGE --> PG_DB
  EDGE --> STO
  EDGE --> AI
  EDGE --> APOIO
  EDGE --> S3
  PG_DB --> RLS
  PROV --> EDGE
  CONTR --> PROV
```

## Diagrama de fluxo — Autenticação
```mermaid
sequenceDiagram
  autonumber
  participant UI as LoginV2
  participant Auth as Supabase Auth
  participant Ctx as AuthContext
  participant DB as PostgreSQL
  participant App as App.tsx / Router
  UI->>Auth: signInWithPassword
  Auth-->>UI: session
  Auth-->>Ctx: onAuthStateChange
  Ctx->>DB: select profiles / user_roles
  DB-->>Ctx: perfil + roles
  Ctx-->>App: user + tenantId + roles
  App->>App: installQueryClientTenantReset
  App->>App: bootDataStores()
  App-->>UI: Navigate /dashboard | /super-admin
```

## Diagrama de fluxo — Criação de atendimento
```mermaid
sequenceDiagram
  autonumber
  participant Wiz as NovoAtendimento
  participant Store as atendimentoStore
  participant Runtime as runtime/db.ts
  participant Fn as edge create-atendimento
  participant DB as PostgreSQL
  Wiz->>Store: submit()
  Store->>Runtime: getUserTenantClient()
  Runtime->>Fn: invoke create-atendimento
  Fn->>DB: BEGIN + validações + INSERT
  DB-->>Fn: id + protocolo
  Fn-->>Store: payload
  Store-->>Wiz: sucesso + navigate
  Store->>DB: invalidate queries ["tenant", id, "atendimentos"]
```

## Diagrama de fluxo — Resultado / Laudo
```mermaid
sequenceDiagram
  participant P as ResultadoDetalhe
  participant Stores as (parametros, layouts, VR, réguas)
  participant Res as laudoResolver
  participant T as laudoTemplate
  participant Sh as printHtml/printShell
  participant Fn as sign-resultado
  P->>Stores: ensureLoaded
  P->>Res: resolve VR + tokens
  P->>T: montar HTML
  T->>Sh: paged.js/html2pdf
  P->>Fn: liberar (auditoria dupla)
  Fn-->>P: laudo assinado
```

## Diagrama de fluxo — Lab de apoio
```mermaid
sequenceDiagram
  participant UI as LabApoio
  participant Job as integration-dispatch
  participant Run as integration-jobs-runner
  participant Prov as provider (dbsync|hermes-pardini)
  participant Poll as integration-poll-results
  participant PDF as integration-pdf-resolve
  UI->>Job: enfileira job
  Run->>Prov: envia amostra
  Prov-->>Run: protocolo externo
  Poll->>Prov: consulta resultado
  Prov-->>Poll: XML/PDF
  Poll->>PDF: registra PDF
  PDF-->>UI: link Storage
```

## Diagrama de fluxo — Super Admin / Migração runtime
```mermaid
sequenceDiagram
  participant UI as SuperAdminMigration
  participant Chk as super-admin-check-tenant-schema
  participant Prov as super-admin-provision-tenant-schema-full
  participant MigA as super-admin-migrate-tenant-auth
  participant MigD as super-admin-migrate-tenant-data
  participant MigS as super-admin-migrate-tenant-storage
  participant Flip as super-admin-migration-flip
  participant Smoke as super-admin-migration-smoke-test
  participant Purge as super-admin-purge-tenant-from-shared
  UI->>Chk: preflight
  UI->>Prov: cria schema dedicado
  UI->>MigA: copia auth.users
  UI->>MigD: copia dados (batches)
  UI->>MigS: copia buckets
  UI->>Flip: runtime_mode = isolated_db
  UI->>Smoke: valida
  UI->>Purge: purge shared
```
