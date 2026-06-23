# Cleanup 1.0 — Fase 1: Inventário Completo de Arquivos e Pastas

> Radiografia somente. **Nada removido, nada renomeado, nada consolidado.**

## Volumetria global

| Métrica | Valor |
|---|---:|
| Arquivos `.ts` / `.tsx` em `src/` | **453** |
| Linhas de código em `src/` (excluindo `types.ts` gerado) | **103.546** |
| Edge functions (`supabase/functions/**/*.ts`) | 81 |
| Migrations SQL (`supabase/migrations/*.sql`) | 294 |
| Documentos `docs/**` | 184 .md (740 KB) |
| Pages (`src/pages/*.tsx`) | 47 |
| Components (`src/components/**/*.tsx`) | 158 |
| Componentes shadcn UI (`src/components/ui`) | 25 |
| Data stores (`src/data/*.ts`) | 41 |
| Hooks (`src/hooks`) | 17 |
| Edge functions distintas | 54 |
| `src/integrations/supabase/types.ts` (gerado) | 8.657 linhas |
| Assets em `src/assets` + `public` | 1,4 MB + 5,5 KB |

## Estrutura de pastas (depth 2)

```
src/
├── assets/           (landing/, favicon.png, hero-flower.png)
├── components/       (24 subdomínios: atendimento, configuracoes, soroteca…)
├── contexts/         (Auth, MenuLayout, SuperAdminPrefs)
├── data/             (41 stores + atendimentoStore/ split)
├── domains/          (DDD-style: appointment, auth, exam, finance,
│                       notification, patient, print, result, tenant)
├── hooks/
├── integrations/     (contracts/, providers/, supabase/)
├── lib/              (db/, integration/, tenantSite/, whatsapp/ + 50+ utils)
├── pages/            (47 pages + Financeiro/, NovoAtendimento/,
│                       ResultadoDetalhe/, admin/, producao/, superadmin/)
├── test/
└── types/
```

## Top 10 maiores arquivos (LOC)

| LOC | Arquivo |
|----:|---------|
| 2.764 | `src/pages/NovoAtendimento.tsx` |
| 2.685 | `src/pages/ResultadoDetalhe.tsx` |
| 1.456 | `src/pages/SorotecaEstrutura.tsx` |
| 1.245 | `src/pages/Soroteca.tsx` |
| 1.237 | `src/pages/Index.tsx` |
| 1.213 | `src/pages/superadmin/SuperAdminTenantDetalhe.tsx` |
| 1.201 | `src/pages/RegistrarColeta.tsx` |
| 1.146 | `src/pages/Financeiro.tsx` |
| 1.143 | `src/pages/Mapa.tsx` |
| 994 | `src/pages/AnalisarAmostra.tsx` |

- Arquivos > 800 linhas: **18**
- Arquivos > 600 linhas: **36**
- Allowlist atual (`scripts/file-size-allowlist.txt`): 11 entradas

## Pastas vazias estruturais

`src/domains/**` contém **32 arquivos `.gitkeep`** em subpastas vazias
(`repositories/`, `services/`, `types/`, `validators/`) preparadas para
expansão DDD mas hoje não utilizadas. Conteúdo real só em:
`appointment/services/pricing.ts`, `print/printContext.ts`,
`result/services/*` (6 arquivos), `tenant/services/operationalAuditReader.ts`.

## Distribuição de docs por domínio

| Domínio | Arquivos .md |
|---------|---:|
| whatsapp-2.0 | 21 |
| soroteca-2.0 | 18 |
| plataforma-2.0 | 15 |
| exames-2.0 | 15 |
| soroteca-audit | 14 |
| estoque-2.0 | 13 |
| atendimento-2.0 | 13 |
| equipe-2.0 | 12 |
| convenios-2.0 | 12 |
| plataforma-2.1 | 10 |
| financeiro + financeiro-audit | 18 |
| documentos | 8 |
| pdf | 7 |
| (fases curtas: exames-2.1/2/3/4, equipe-2.1, soroteca-2.1, ux) | 7 |
