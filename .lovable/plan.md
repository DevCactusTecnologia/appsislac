## Contexto

Você quer **1 único Layout Científico por exame** (não 10 como no LARAVEL0), com a coluna "Valores de Referência" trocando automaticamente conforme sexo + idade do paciente.

O motor já existe no SISLAC e resolve `##REF_CHAVE##` em runtime via `src/lib/laudoLayout.ts:buildValueMap` (linhas 119‑135), consultando `valores_referencia` por sexo + faixa etária. Falta apenas: (1) o **autor do layout** usar o placeholder em vez de texto fixo, (2) **3 melhorias** no resolver para cobrir casos reais do hemograma, (3) **uma melhora de UX** na tela de matriz VR.

## O que muda

### 1. Convenção de autoria do Layout Científico (documentação + exemplo)
- Na célula "Valores de Referência" do layout, em vez de escrever `Normal: Inferior a 5.7%`, o usuário escreve `##REF_HBA1C##` (ou `##REF_HBA1C## ##UNID_HBA1C##`).
- Atualizar a memória do projeto (`mem://features/resultados/`) com a convenção.
- No HEMOGRAMA COMPLETO (auto-seed do layout padrão em `layoutScientificRuntime.ts`), trocar VR fixo por placeholders nos parâmetros: Hemácias, Hemoglobina, Hematócrito, VCM, HCM, CHCM, RDW, Leucócitos, Plaquetas, etc.

### 2. Três correções no resolver (`src/lib/laudoLayout.ts` e `src/data/valoresReferenciaStore.ts`)

**2a. Fallback REF_ por rótulo, não só por chave (linha 130)** 
Hoje: `if (p.chave) setBoth(\`REF_${p.chave}\`, refTexto)`. 
Adicionar: também emitir `REF_<rotulo_normalizado>` e `REF_<abreviacao>` para layouts antigos que usam o nome do parâmetro como placeholder.

**2b. Suporte ao campo `descricao` da VR como texto livre (linha 122)** 
Hoje só monta `"min - max"`. Se a linha de `valores_referencia` tiver `descricao` preenchida (ex.: `"Normal: Inferior a 5.7%"`, `"Pré-diabetes: 5.7% a 6.4%"`), usar `descricao` em vez de `min - max`. Permite VR textual por faixa (caso HbA1c, glicemia).

**2c. Match de parametro_nome mais tolerante** 
Hoje `resolverReferencia` casa por `p.rotulo` exato. Trocar por match case-insensitive contra `chave | abreviacao | rotulo` — alinha com a lógica já usada em `selectParametrosForLayout` (`layoutScientificRuntime.ts:94‑99`).

### 3. UX da Matriz de Valores de Referência
- `src/components/configuracoes/MatrizValoresReferencia.tsx`: hoje gera grade sexo × faixa-etária mas não tem o campo `descricao` por célula. Adicionar input opcional "Texto exibido" (descricao) ao lado de `valorMin/valorMax`. Quando preenchido, o laudo imprime esse texto; quando vazio, cai no `min - max` padrão.
- Botão "Pré-visualizar como aparecerá no laudo" mostrando a string resolvida.

### 4. O que NÃO muda
- Schema de `valores_referencia` (todos os campos necessários já existem, inclusive `descricao`).
- Estrutura de `exame_parametros.valor_referencia` (continua como fallback global).
- Pipeline de impressão `ResultadoDetalhe.tsx` (já passa sexo+idade corretos).
- Nada no super-admin / RLS / tenant.

## Resultado para o usuário

- Cria **1 layout** do HEMOGRAMA com placeholders `##REF_HEMOGLOBINA##` etc.
- Cadastra na Matriz VR de cada parâmetro **as 10 linhas** (sexo × faixa-etária) equivalentes aos 10 filtros do LARAVEL0.
- Na impressão, paciente masculino de 8 anos vê os limites da linha "M / 5‑11a"; feminina de 30 anos vê "F / 12+". Sem duplicar layout.

## Detalhes técnicos

- Edições isoladas em 3 arquivos: `src/lib/laudoLayout.ts`, `src/data/valoresReferenciaStore.ts`, `src/components/configuracoes/MatrizValoresReferencia.tsx`.
- Auto-seed do HEMOGRAMA: ajustar template em `src/lib/laudoTemplate.ts` (ou onde estiver o seed do hemograma) — verificar antes.
- Sem migração de banco. Sem mexer em rotas/contextos globais/boot. Sem PWA.
- Testes: rodar `bunx vitest run` após as mudanças no resolver e validar com o exame HEMOGRAMA via browser preview (paciente M jovem vs F adulta).

## Fora de escopo (proponho fazer depois, se necessário)

- Blocos condicionais por faixa (`##IF_FAIXA:...##`) — só se você precisar de texto/estrutura variável (não apenas valor numérico).
- Migração automática dos VRs do LARAVEL0 — depende de você ter o dump.

Confirma que prossigo com **1 + 2 + 3** nesta ordem?