# Equipe 2.0 — Complexidade

## O módulo está virando RH?

**Não.** Não há cargo, salário, contrato, ponto, escala, férias, banco de horas, anexos de documentos, dependentes, holerite. A tabela `profiles` armazena apenas o necessário para autenticação, identidade aplicacional, vínculo com unidade(s), permissão fina e assinatura no laudo.

## Excesso de cadastro?

Não. Diálogo único, campos diretos: nome, e-mail, senha (opcional), perfil, admin?, permissões, unidades, assinatura. Tudo operacional. Telefone existe na coluna `profiles.telefone` mas não é exposto no editor — provavelmente vestigial.

## Excesso de permissões?

- **32 permissões finas** em 7 grupos. Para um SaaS lab é coerente, mas o operador médio não toca em nenhuma — usa apenas defaults do perfil. 90% dos casos seriam atendidos com **só os 4 perfis sem ajuste fino**.
- Existem **3 permissões "fantasma"** no backend (`integracoes.gerenciar`, `gerenciar_soroteca`, `armazenar_amostra`) que nunca aparecem como toggle. Isso é dívida menor, não complexidade visível.

## Excesso de papéis?

Não. 3 roles fortes (`user`/`admin`/`super_admin`) + 4 perfis (`admin`/`analista`/`recepcionista`/`financeiro`). Total 7 conceitos, dos quais o operador vê 5 (`super_admin` nunca aparece em /equipe; `user` é implícito).

## Excesso de fontes?

Sim, ligeiro:
1. Catálogo de permissões em TS (`PERMISSOES_AGRUPADAS`).
2. Defaults por perfil em TS (`DEFAULTS_POR_PERFIL`).
3. Defaults por perfil em SQL (`has_permission`).
4. Mapa rota→permissão em `AppSidebar.tsx` + `App.tsx`.

Qualquer mudança exige tocar em 2–3 lugares. Sustentável porque mudanças são raras (~1×/trimestre), mas é fonte de drift.

## Classificação executiva

| Item | Decisão |
|---|---|
| Modelo de domínio (`profiles` + `user_roles`) | **Manter** — minimalista, suficiente. |
| Catálogo de 32 permissões finas | **Manter** — é a granularidade que o SISLAC oferece a clientes exigentes. |
| Toggle individual de permissões no diálogo | **Simplificar** — esconder atrás de "Permissões avançadas" colapsado. |
| Bloco "Assinatura no laudo" no editor de usuário | **Refatorar** — mover para a tela `/perfil` do próprio usuário (já que `profiles_update_self` permite). Admin só precisa configurar perfis, não assinaturas alheias. |
| Função `login` + `signInWithPassword` duplicadas | **Simplificar** — manter apenas uma. |
| Permissões fantasmas no SQL | **Simplificar** — expor no catálogo TS OU remover do SQL. |
| Caminho duplicado "senha agora" vs "convite por e-mail" | **Manter** — atende casos reais distintos. |
| Tabela ponte `user_unit` / `tenant_members` | **NUNCA criar** — não há demanda. |
| Cargo / salário / ponto / escala / RT-formal-pessoa | **NUNCA criar** — fora do escopo SISLAC. |

## O que nunca deveria existir

- Tabela de cargos clínicos formais (Biomédico, Bioquímico, Coletador, etc.).
- Workflow de aprovação de cadastro de usuário.
- Histórico de mudança de cargo/salário.
- Assinatura digital ICP-Brasil (não é demanda; carimbo + imagem basta para o público-alvo).
- Dashboard de "produtividade da equipe".
