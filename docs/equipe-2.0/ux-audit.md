# Equipe 2.0 — UX e Operação

## Tela única `/equipe`

Conteúdo:
- PageHeader “Usuários · Governança”, com botão `Convidar usuário`.
- Banner de inconsistências (`tenant_users_integrity`) quando há.
- Tabs (Todos / Ativos / Inativos) + busca por nome/email.
- Tabela desktop (Usuário, Perfil, Unidades, Status, Ações) + cards mobile.
- Diálogo único de criar/editar com 7 blocos: nome, e-mail, senha, perfil, toggle admin, permissões agrupadas, **assinatura no laudo** (só em edição), unidades.
- Diálogos secundários: desativar, reset senha, excluir definitivamente (digite EXCLUIR).

## Tempo para o operador entender

Para "Quem trabalha aqui?", "Qual a função?", "Está ativo?" — **< 10 segundos**. A tabela mostra tudo na linha.

Para "Quais permissões?" — exige abrir o editor (~3 cliques) e percorrer 7 grupos de toggles. Não há **visão somente leitura** de permissões na tabela. Aceitável para um painel de governança, mas o diff entre defaults e overrides não é mostrado.

## Campos questionáveis para um operador

- **friendly_id (USR-000001)**: bem útil para suporte/log, mas ocupa espaço em todas as linhas. Mantém.
- **Assinatura no laudo** dentro do diálogo de usuário: misturado com permissões. Operador frequentemente confunde com "assinatura digital ICP". Poderia virar um sub-card visualmente isolado.
- **Toggle Administrador + dropdown Perfil**: redundância visual. Quando admin está ligado, dropdown fica disabled. UX OK, mas o usuário leigo demora a entender que admin "ignora" o perfil.
- **Excluir definitivo** com confirmação "EXCLUIR": fricção apropriada para ação destrutiva. OK.

## Conceitos de RH

Nenhum. Não há cargo, salário, escala, ponto, férias, contrato. **A tela é puramente operacional**.

## Poluição visual

- O diálogo de edição é longo (~7 blocos). Em telas pequenas requer muito scroll. Em desktop, lg dialog acomoda bem.
- Permissões em 2 colunas com 7 grupos = ~32 toggles. É a maior fonte de complexidade visual. Faz sentido manter agrupado, mas o usuário típico nunca mexe nisso (90% dos casos: usa defaults do perfil).

## Classificação

| Item | Decisão sugerida |
|---|---|
| Tabela principal + tabs + busca | **Preservar** |
| Diálogo único criar/editar | **Preservar** |
| Bloco de permissões finas | **Simplificar** (mostrar collapse "Permissões avançadas" fechado por padrão; defaults do perfil bastam) |
| Bloco assinatura embarcado no editor | **Refatorar** (mover para tela /perfil do próprio usuário ou aba dedicada) |
| friendly_id na tabela | **Preservar** |
| Banner de inconsistências | **Preservar** |
| Aviso "EXCLUIR" digitado | **Preservar** |
| `/usuarios` → redirect `/equipe` | **Preservar** (alias) |

Nenhum item para **remover**. Nenhum item para **rebatizar**.
