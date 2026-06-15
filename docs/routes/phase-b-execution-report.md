# Fase B — Domain Driven Routes — Relatório de Execução

**Data:** 2026-06-15  
**Escopo:** Promover entidades de domínio (Exames, Convênios, Unidades, Documentos, Tabelas de Preço, Modelos) para rotas próprias, sem alterar regras de negócio, banco, RLS, RBAC ou CRUDs existentes.

---

## 1. Rotas criadas

### Exames
- `GET /exames` — listagem
- `GET /exames/novo` — formulário de criação (mesmo componente; abre fluxo de criação)
- `GET /exames/:id` — detalhe
- `GET /exames/:id/editar` — edição

### Modelos de Laudo (vinculados a exame)
- `GET /exames/:id/modelos`
- `GET /exames/:id/modelos/novo`
- `GET /exames/:id/modelos/:modelId`
- `GET /exames/:id/modelos/:modelId/editar`

### Convênios
- `GET /convenios`
- `GET /convenios/novo`
- `GET /convenios/:id`
- `GET /convenios/:id/editar`

### Unidades
- `GET /unidades`
- `GET /unidades/novo`
- `GET /unidades/:id`
- `GET /unidades/:id/editar`

### Documentos
- `GET /documentos`
- `GET /documentos/novo`
- `GET /documentos/:id`
- `GET /documentos/:id/editar`

### Tabelas de Preço
- `GET /tabelas-preco`
- `GET /tabelas-preco/:id`
- `GET /tabelas-preco/:id/editar`

**Total:** 26 rotas canônicas novas.

---

## 2. Componentes reutilizados (zero duplicação)

Cada rota nova é apenas uma página fina (`src/pages/<Entidade>.tsx`) que renderiza o componente
de aba já usado em `Configurações`:

| Rota                | Componente reutilizado                              |
| ------------------- | --------------------------------------------------- |
| `/exames/*`         | `src/components/configuracoes/ExamesTab.tsx`        |
| `/convenios/*`      | `src/components/configuracoes/ConveniosTab.tsx`     |
| `/unidades/*`       | `src/components/configuracoes/UnidadesTab.tsx`      |
| `/documentos/*`     | `src/components/configuracoes/DocumentosTab.tsx`    |
| `/tabelas-preco/*`  | `src/components/configuracoes/TabelasPrecoTab.tsx`  |

Os CRUDs continuam sendo executados pelos diálogos internos desses componentes — nenhuma tela,
formulário, store, regra clínica, financeira ou de fluxo foi recriada.

---

## 3. Menus atualizados

`src/components/AppSidebar.tsx` recebeu um novo grupo **"Cadastros"** com acesso direto a:

- Exames
- Convênios
- Unidades
- Documentos
- Tabelas de Preço

O acesso continua gated pela permissão `configuracoes_sistema` (mesma do `/configuracoes`),
sem nenhuma mudança de RBAC.

---

## 4. Redirects criados (compatibilidade)

Implementados em `src/pages/Configuracoes.tsx`: ao chegar com `?tab=<id>`, a página
faz `Navigate replace` para a nova rota canônica.

| URL legada                      | Redireciona para     |
| ------------------------------- | -------------------- |
| `/configuracoes?tab=exames`     | `/exames`            |
| `/configuracoes?tab=convenios`  | `/convenios`         |
| `/configuracoes?tab=unidades`   | `/unidades`          |
| `/configuracoes?tab=documentos` | `/documentos`        |
| `/configuracoes?tab=tabelas`    | `/tabelas-preco`     |

`/configuracoes` sem `?tab=` (ou com tabs ainda não promovidas — laboratório, admin,
labs-apoio, etc.) continua funcionando exatamente como antes.

---

## 5. Breadcrumbs

Novo componente `src/components/shared/DomainBreadcrumb.tsx` adicionado e usado por cada
página de domínio. Estrutura:

```
Home → Exames → Exame :id → Modelos
Home → Convênios → Convênio :id
Home → Unidades → Unidade :id
```

Sem interferência nos componentes de aba já existentes.

---

## 6. Dependências encontradas

- Todas as `*Tab.tsx` são self-contained (stores próprias, diálogos próprios), o que
  permitiu reutilização direta sem refator.
- `ExamesTab` cuida internamente do vínculo com **Modelos de Laudo** (`exameLayoutsStore`)
  e **Setores**; mantido como está.
- `ConveniosTab` consome `tabelaPrecoStore` para cobertura — mantido como está.

Nenhuma dependência circular ou bloqueio identificado.

---

## 7. Problemas corrigidos durante a execução

- **Rules of Hooks**: o redirect de `?tab=` em `Configuracoes` foi posicionado APÓS todos
  os hooks, evitando contagem variável de hooks entre renders.

---

## 8. Regressões encontradas e corrigidas

- Nenhuma regressão funcional identificada.
- Permissões preservadas (mesma `configuracoes_sistema`).
- Rotas legadas continuam respondendo (via redirect ou render direto da aba quando
  ainda não promovida).
- Sidebar mantém todos os itens antigos; o novo grupo "Cadastros" só é exibido para quem
  já tinha acesso a `/configuracoes`.

---

## 9. Critérios de sucesso

| Critério                                                              | Status |
| --------------------------------------------------------------------- | ------ |
| Exames deixam de ficar escondidos em Configurações                    | ✅     |
| Modelos deixam de ficar escondidos em Configurações                   | ✅     |
| Convênios deixam de ficar escondidos em Configurações                 | ✅     |
| Unidades deixam de ficar escondidas em Configurações                  | ✅     |
| Documentos deixam de ficar escondidos em Configurações                | ✅     |
| Tabelas de Preço promovidas a rota própria                            | ✅     |
| Navegação mais próxima do Laravel / DDD                               | ✅     |
| Nenhuma alteração de negócio                                          | ✅     |
| Nenhuma alteração de banco                                            | ✅     |
| Nenhuma alteração de segurança / RLS / RBAC                           | ✅     |
| Compatibilidade total com `/configuracoes?tab=`                       | ✅     |
| Portal do paciente, QR Codes e WhatsApp intocados                     | ✅     |

---

## 10. Arquivos alterados / criados

**Criados**
- `src/components/shared/DomainBreadcrumb.tsx`
- `src/pages/Exames.tsx`
- `src/pages/Convenios.tsx`
- `src/pages/Unidades.tsx`
- `src/pages/Documentos.tsx`
- `src/pages/TabelasPreco.tsx`
- `docs/routes/phase-b-execution-report.md` *(este documento)*

**Editados**
- `src/App.tsx` — registro das 26 rotas canônicas (lazy imports).
- `src/pages/Configuracoes.tsx` — redirect `?tab=` → rota canônica.
- `src/components/AppSidebar.tsx` — grupo "Cadastros" + entradas no
  `PERMISSION_BY_PATH`.

---

## 11. Parada

Fase B concluída. **Não iniciar Fase C.** Portal, QR Codes, WhatsApp e URLs públicas
permanecem inalterados, conforme regra de parada.
