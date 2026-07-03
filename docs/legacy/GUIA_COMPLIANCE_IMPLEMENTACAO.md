# 🚀 GUIA PRÁTICO - LGPD + RDC EM 3 PASSOS (Copiar/Colar)

**Projeto:** xhaeozwdfjuvpxgguqqp  
**Tempo estimado:** 30-45 minutos  
**Complexidade:** Copiar/colar apenas

---

## PASSO 1️⃣: RODAR SQL NO SUPABASE (15 min)

### 1.1 Abrir Supabase Dashboard

```
Abrir em nova aba:
https://app.supabase.com/project/xhaeozwdfjuvpxgguqqp
```

### 1.2 Ir para SQL Editor

```
Esquerda → SQL Editor (ícone de código)
Ou clique em: + New Query
```

### 1.3 Copiar TODO este SQL e colar:

**Ver arquivo:** `supabase/migrations/20260624_lgpd_rdc_compliance.sql`

**Pegar as primeiras 344 linhas (até "-- ✅ FIM DO SQL")**

### 1.4 Executar

```
Clicar em: "Run" (botão azul)
OU pressionar: Ctrl+Enter
```

### 1.5 Verificar que funcionou

```
Resultado esperado:
✅ Query executed successfully (sem erros)
✅ 5 tabelas criadas
✅ 6 funções criadas

Se vir erro de "já existe":
✅ Tudo bem! Significa que já rodou antes
```

---

## PASSO 2️⃣: DEPLOY EDGE FUNCTIONS (15 min)

### 2.1 Abrir Terminal/PowerShell no seu computador

```bash
# Windows: PowerShell
# Mac/Linux: Terminal

cd caminho/para/appsislac
```

### 2.2 Deploy automático

```bash
# Rodar este comando:
supabase functions deploy

# Resultado esperado:
# ✅ Deploying 10 functions...
# ✅ sign-resultado ✓
# ✅ lgpd-consentimento ✓
# ✅ lgpd-deletar-paciente ✓
# ✅ lgpd-auditoria-relatorio ✓
```

### 2.3 Se der erro "supabase command not found"

```bash
# Instalar CLI:
npm install -g @supabase/cli

# Depois rodar novamente:
supabase functions deploy
```

---

## PASSO 3️⃣: TESTAR QUE FUNCIONOU (15 min)

### 3.1 Testar no seu App (Mais fácil)

No seu componente React:

```tsx
import { useCompliance } from '@/hooks/useCompliance';

export function TesteCompliance() {
  const { assinarResultado, loading } = useCompliance();
  
  const handleTest = async () => {
    const result = await assinarResultado(1);
    console.log('Resultado:', result);
  };
  
  return (
    <button onClick={handleTest} disabled={loading}>
      {loading ? 'Testando...' : '🧪 Testar Compliance'}
    </button>
  );
}
```

Clicar no botão → deve aparecer sucesso ou erro específico ✅

### 3.2 Verificar que tabelas foram criadas

```bash
# No Supabase SQL Editor, executar:

SELECT COUNT(*) as tabelas FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('audit_log', 'consentimento_paciente', 'resultado_assinado', 'deletacao_paciente_log', 'resultado_acesso_log');

-- Resultado esperado: 5 (cinco tabelas)
-- ✅ Tudo criado!
```

---

## ✅ CHECKLIST FINAL

```
☐ SQL rodou no Supabase sem erros
☐ 5 tabelas criadas
☐ 6 funções criadas
☐ supabase functions deploy rodou
☐ 4 Edge Functions deployadas
☐ Teste no React funcionou
☐ Tabelas visíveis no Supabase Dashboard
```

---

## 🎯 PRÓXIMO: Usar no Frontend

### Importar Hook

```tsx
import { useCompliance } from '@/hooks/useCompliance';

export function MeuComponente() {
  const { assinarResultado, solicitarConsentimento, loading } = useCompliance();
  
  return (
    <div>
      <button onClick={() => assinarResultado(123)}>
        Assinar Resultado
      </button>
    </div>
  );
}
```

### Usar Componentes Prontos

```tsx
import { 
  ComplianceResultadoCard,
  ComplianceConsentimentoCard,
  ComplianceDeletarPacienteCard 
} from '@/hooks/useCompliance';

<ComplianceResultadoCard resultadoId={123} />
<ComplianceConsentimentoCard pacienteId={456} />
<ComplianceDeletarPacienteCard pacienteId={456} pacienteNome="João" />
```

---

## ❓ DÚVIDAS?

### "Qual é meu TOKEN?"

```
No Lovable (automático):
✅ Hook já usa seu token automático
✅ Não precisa fazer nada

No seu computador (se testar com curl):
1. Abrir Console (F12)
2. Ir para: Application → Cookies
3. Procurar por: "supabase-auth-token"
4. Copiar o valor
```

### "Curl não funciona"

```
Alternativa: Testar direto no seu app React
import { useCompliance } from '@/hooks/useCompliance';
const { assinarResultado } = useCompliance();
await assinarResultado(123);

Muito mais fácil! Use assim.
```

### "Erro ao rodar SQL"

```
Se erro disser "já existe":
✅ Tudo bem! Significa que rodou antes

Se der outro erro:
1. Copiar mensagem de erro
2. Procurar na primeira linha onde falhou
3. Verificar se sintaxe está correta
4. Tentar novamente
```

---

## 🎉 PRONTO!

Quando terminar os 3 passos:
- ✅ SQL rodado
- ✅ Functions deployadas  
- ✅ Testes passando

**Você está pronto para usar LGPD + RDC no seu app!**

---

## 📁 Arquivos de Referência

```
SQL Migration:
→ supabase/migrations/20260624_lgpd_rdc_compliance.sql

Edge Functions:
→ supabase/functions/sign-resultado/index.ts
→ supabase/functions/lgpd-consentimento/index.ts
→ supabase/functions/lgpd-deletar-paciente/index.ts
→ supabase/functions/lgpd-auditoria-relatorio/index.ts

Hook React:
→ src/hooks/useCompliance.ts
```

Me avisa quando terminar! 🚀
