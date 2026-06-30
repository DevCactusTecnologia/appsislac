# 13 — Smoke Test (arquitetural)

Cenário: 3 laboratórios, cada um em um projeto Supabase distinto.

| Passo | Resultado |
|-------|-----------|
| Lab A faz login | Funciona (vai ao projeto shared). |
| Lab A lê pacientes | Funciona (RLS no projeto shared). |
| Sysadmin marca Lab B como `database_strategy='dedicated'` apontando para `db.xxx.supabase.co` | Linha gravada em `tenant_registry`. App continua usando projeto shared. |
| Lab B faz login | Vai ao Auth do projeto shared (não ao Auth do banco dedicado). |
| Lab B lê pacientes | Continua lendo do banco shared. Banco dedicado fica vazio. |
| Edge function `create-atendimento` é chamada para Lab B | Insere no banco shared. |
| `super-admin-test-tenant-db` para Lab B | Faz `SELECT 1` no banco dedicado e retorna ok — sem nenhum dado real. |

Conclusão do smoke: **o sistema NÃO funcionaria hoje** com clientes em projetos Supabase diferentes sem alterar código.
