# 🧠 MISSÃO — SISLAC HARDENING & ARCHITECTURE SIMPLIFICATION

Objetivo:
Transformar o SISLAC em uma plataforma segura, previsível e escalável para Database-per-Tenant.

---

## 🔒 Security & Governance

### RLS & Policies (Hardened)
- **RLS Ativado**: Todas as tabelas de auditoria e logs agora possuem Row Level Security.
- **SECURITY DEFINER**: Funções críticas foram corrigidas com `SET search_path = public` para evitar ataques de sequestro de caminho.
- **Permissões**: GRANTs revisados para garantir que apenas usuários autenticados acessem dados operacionais.

### Tenant Governance
- **Fonte de Verdade**: `tenant_registry` consolidado como o control-plane para roteamento.
- **Runtime Mode**: Preparado para chaveamento entre `shared_db` e `isolated_db`.

---

## 🏗️ Architecture & Simplification

### Single Source of Truth
- **Auth & Permissões**: Centralizado no `AuthContext` e espelhado no banco.
- **Data Access**: Migração gradual para `src/lib/db` para abstrair a conexão com o banco.

### Developer Experience
- **Consolidação**: Removidos componentes órfãos e arquivos legados.
- **Edge Functions**: Padronizado o uso de `_shared` para tratamento de erros e resolução de contexto.

---

## 📝 Document Engine & Infrastructure
- **Cron Jobs**: Monitoramento de saúde integrado.
- **Multi-Tenant**: Fluxo de login em 2 etapas (Login V2) para branding dinâmico.

---

**Status Atual:** 🟢 Maturidade Arquitetural Elevada
**Próximos Passos:** Implementação do primeiro tenant em Dedicated DB.
