# Atendimento 2.0 — Fase 1.7 — UX Operacional por Perfil

## Recepção
**Telas**: `NovoAtendimento.tsx`, `Pacientes.tsx`, `Orcamentos.tsx`.
- Fluxo principal: paciente → solicitante → exames → cobrança → pagamento → salvar.
- **Excesso de cliques**: NovoAtendimento concentra wizard + edição + cobrança + IA + leitura de requisição em um arquivo de 2801 linhas — todas as decisões em uma única página.
- **Retrabalho**: cadastro de paciente abre dialog em meio ao fluxo; volta perde foco do exame em digitação se não houver resync.
- **Gargalo**: digitação livre de exames (autocompletar) é responsiva, mas pricing distribuído (CBHPM/TUSS/Própria + desconto distribuído) recalcula em cascata — atraso percebido em pedidos com 20+ exames.

## Coleta
**Telas**: `RegistrarColeta.tsx` (1197 linhas) + `etiquetaAmostra`.
- Fluxo: localizar atendimento → conferir paciente → coletar (gera amostra + DV) → imprimir etiqueta → mudar status.
- **Excesso de cliques**: cada exame muda status individualmente; ações em lote existem mas estão escondidas.
- **Gargalo**: impressão de etiquetas por exame não é batched por padrão.

## Triagem / Bancada
**Telas**: `Mapa.tsx`, `AnalisarAmostra.tsx`.
- Fluxo: mapa de trabalho diário → seleciona analista → exames entram em bancada.
- **Complexidade**: layouts de mapa são template-driven; preview e impressão são pesados (testes Playwright cobrem).
- **Gargalo**: AnalisarAmostra (994 linhas) acumula validação clínica + ações de status + atribuição de analista.

## Produção
**Tela**: `Producao.tsx` (413 linhas) + `producaoMetricsStore`.
- Painel de KPIs derivados — leitura.
- **Gargalo**: cálculo dos KPIs em runtime (sem materialização) — lento em tenants grandes; sem agregação por dia/responsável formalizada.

## Biomédico / Resultados
**Telas**: `Resultados.tsx` (644), `ResultadoDetalhe.tsx` (2648).
- Fluxo: localizar exame → preencher Layout Científico → conferir VR → liberar.
- **Excesso de cliques**: ResultadoDetalhe é a maior tela do sistema. Liberação exige assinatura, layout congelado, snapshots — interface densa.
- **Retrabalho**: retificação reabre o exame, exige justificativa, marca `retificado=true` — UX clara mas com 3+ confirmações.
- **Gargalo**: render do laudo com VR resolvida + críticos + parâmetros tipados pode ser lento em exames grandes.

## Gestor (operacional)
**Telas**: `Dashboard.tsx`, `RelatorioOcorrencias.tsx`, `RelatorioRecoletas.tsx`, `Auditoria.tsx`.
- KPIs (`useDashboardKpis` + `dashboard_kpis` RPC) — Fase 7 do Financeiro consolidou A Receber.
- **Gargalo**: ainda não há painel único cruzando produção × liberação × entrega.

## Admin
**Telas**: `Configuracoes.tsx`, `Usuarios.tsx`, `TabelasPreco.tsx`, `Convenios.tsx`, `Unidades.tsx`, `LabApoio.tsx`, `Especialistas.tsx`, `Documentos.tsx`, `Soroteca.tsx`, `Estoque.tsx`, `admin/AuditoriaVR.tsx`, `admin/CKEditorTest.tsx`.
- Fluxo bem segmentado. Sem gargalos críticos identificados.

## Síntese
| Área | Cliques | Retrabalho | Complexidade | Gargalo |
|---|---|---|---|---|
| Recepção | 🔶 médio | 🔶 paciente inline | 🔴 alta (NovoAtendimento gigante) | pricing em cascata |
| Coleta | 🔶 alto (por exame) | ✅ baixo | 🔶 média | etiqueta lote |
| Bancada | 🔶 médio | ✅ baixo | 🔴 alta (AnalisarAmostra grande) | preview de mapa |
| Produção | ✅ baixo | ✅ baixo | ✅ baixa | KPI em runtime |
| Resultados | 🔴 alto | 🔶 retificação | 🔴 muito alta (ResultadoDetalhe 2648) | render laudo |
| Gestor | ✅ baixo | ✅ baixo | ✅ baixa | painel cruzado |
| Admin | ✅ baixo | ✅ baixo | ✅ baixa | — |

## Maiores oportunidades de UX
1. Quebrar `NovoAtendimento.tsx` em sub-rotas/steps reais.
2. Quebrar `ResultadoDetalhe.tsx` em painéis colocáveis (parâmetros / críticos / liberação / impressão).
3. Ações em lote na Coleta (batch print + batch status).
4. Painel do gestor cruzando produção × liberação × entrega.
5. Materializar KPIs operacionais (view ou tabela agregada).

— FIM —
