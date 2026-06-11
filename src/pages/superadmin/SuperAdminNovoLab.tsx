// Wizard de provisionamento de novo laboratório redesenhado.
// Substitui o fluxo complexo por um wizard de 5 etapas claras:
// Identidade → Estratégia → Banco → Integrações → Ativação.
// A configuração técnica detalhada (host/porta) é movida para o detalhe do laboratório.

import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, ArrowRight, Check, Building2, Globe, Hash, Mail, Phone,
  Server, Database, CreditCard, UserCog, KeyRound, Eye, EyeOff,
  Activity, Rocket, AlertTriangle, CheckCircle2,
} from "lucide-react";
import { PageHeader } from "@/components/superadmin/PageHeader";

type RuntimeChoice = "shared_db" | "isolated_db";

interface WizardForm {
  nome: string;
  slug: string;
  labCode: string;
  cnpj: string;
  emailContato: string;
  telefone: string;
  runtime: RuntimeChoice;
  plano: string;
  adminNome: string;
  adminEmail: string;
  adminSenha: string;
}

const EMPTY: WizardForm = {
  nome: "", slug: "", labCode: "", cnpj: "", emailContato: "", telefone: "",
  runtime: "shared_db", plano: "free",
  adminNome: "", adminEmail: "", adminSenha: "",
};

const PLANOS = [
  { value: "free", label: "Free" },
  { value: "starter", label: "Starter" },
  { value: "pro", label: "Pro" },
  { value: "business", label: "Business" },
  { value: "enterprise", label: "Enterprise" },
];

const STEPS = [
  { id: 1, label: "Identidade",   icon: Building2 },
  { id: 2, label: "Estratégia",   icon: Server },
  { id: 3, label: "Banco",        icon: Database },
  { id: 4, label: "Integrações",  icon: Activity },
  { id: 5, label: "Ativação",     icon: Rocket },
] as const;

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
}

export default function SuperAdminNovoLab() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<WizardForm>(EMPTY);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [healthcheck, setHealthcheck] = useState<null | { ok: boolean; checks: { label: string; ok: boolean; hint?: string }[] }>(null);

  const set = <K extends keyof WizardForm>(k: K, v: WizardForm[K]) =>
    setForm(p => ({ ...p, [k]: v }));

  const effectiveSlug = form.slug.trim() || slugify(form.nome);

  const errorsByStep: Record<number, string | null> = useMemo(() => ({
    1: !form.nome.trim() ? "Informe o nome" : null,
    2: null,
    3: null,
    4: null,
    5: null,
  }), [form]);

  const canAdvance = !errorsByStep[step];

  const next = () => {
    if (!canAdvance) {
      toast.error(errorsByStep[step] ?? "Preencha os campos obrigatórios");
      return;
    }
    setStep(s => Math.min(5, s + 1));
  };
  const prev = () => setStep(s => Math.max(1, s - 1));

  const runHealthcheck = () => {
    const checks = [
      { label: "Nome definido", ok: !!form.nome.trim() },
      { label: "Slug válido", ok: /^[a-z0-9-]{2,50}$/.test(effectiveSlug), hint: effectiveSlug },
      { label: "E-mail do admin", ok: !!form.adminEmail.includes("@") },
      { label: "Nome do admin", ok: !!form.adminNome.trim() },
      { label: "Senha inicial (≥ 6 caracteres)", ok: form.adminSenha.length >= 6 },
      {
        label: form.runtime === "isolated_db"
          ? "Runtime isolated_db: configurar banco após criação"
          : "Runtime shared_db: pronto",
        ok: true,
        hint: form.runtime === "isolated_db" ? "Cadastre host/porta/usuário na aba de detalhe" : undefined,
      },
    ];
    const ok = checks.every(c => c.ok);
    setHealthcheck({ ok, checks });
  };

  const submit = async () => {
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("super-admin-create-tenant", {
      body: {
        nome: form.nome,
        slug: form.slug,
        labCode: form.labCode.trim().toUpperCase() || undefined,
        cnpj: form.cnpj,
        emailContato: form.emailContato,
        telefone: form.telefone,
        plano: form.plano,
        adminEmail: form.adminEmail,
        adminNome: form.adminNome,
        adminSenha: form.adminSenha,
      },
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    const finalCode = (data as { labCode?: string } | null)?.labCode;
    if (data?.warning) toast.warning(data.warning);
    else if (finalCode) {
      toast.success(`Laboratório criado — código ${finalCode}`, {
        description: "Compartilhe este código com o cliente para acesso ao login.",
        action: {
          label: "Copiar",
          onClick: () => { void navigator.clipboard.writeText(finalCode); },
        },
      });
    } else toast.success("Laboratório provisionado com sucesso");
    const tenantId = data?.tenant?.id;
    navigate(tenantId ? `/super-admin/laboratorios/${finalCode || tenantId}` : "/super-admin/laboratorios");
  };

  return (
    <div className="pb-32">
      <Button variant="ghost" size="sm" asChild className="mb-3 -ml-2 text-muted-foreground hover:text-foreground">
        <Link to="/super-admin/laboratorios"><ArrowLeft className="h-4 w-4 mr-1.5" />Laboratórios</Link>
      </Button>

      <PageHeader
        title="Novo laboratório"
        description="Provisionamento guiado em 5 etapas — identidade, estratégia, banco, integrações e ativação."
      />

      {/* Stepper */}
      <Stepper currentStep={step} onJump={setStep} />

      {/* Body */}
      <div className="mt-6 grid lg:grid-cols-[1fr_280px] gap-5 items-start">
        <div className="rounded-xl border border-border bg-card p-6 sm:p-8 min-w-0 shadow-sm">
          {step === 1 && <StepIdentidade form={form} set={set} effectiveSlug={effectiveSlug} />}
          {step === 2 && <StepRuntime runtime={form.runtime} onChange={(r) => set("runtime", r)} />}
          {step === 3 && <StepBanco runtime={form.runtime} />}
          {step === 4 && <StepIntegracoes />}
          {step === 5 && <StepAtivacao form={form} effectiveSlug={effectiveSlug} />}
        </div>

        {/* Sidebar resumo */}
        <aside className="rounded-xl border border-border bg-card p-5 lg:sticky lg:top-6 space-y-4 text-[11px] shadow-sm">
          <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em]">Draft do laboratório</h3>
          <Row label="Laboratório" value={form.nome || "A definir"} />
          <Row label="URL" value={`/${effectiveSlug || "..."}`} mono />
          <Row label="Estratégia" value={form.runtime === "isolated_db" ? "Dedicado" : "Compartilhado"} />
          <Row label="Plano" value={PLANOS.find(p => p.value === form.plano)?.label ?? form.plano} />
        </aside>
      </div>

      {/* Footer fixo */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-border/50 bg-background/95 backdrop-blur-md">
        <div className="max-w-[1200px] mx-auto px-6 py-4 flex items-center justify-between gap-3">
          <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
            Etapa <span className="text-primary tabular-nums">{step}</span> / 5
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={prev} disabled={step === 1 || submitting} className="rounded-full">
              <ArrowLeft className="h-4 w-4 mr-2" />Voltar
            </Button>
            {step < 5 ? (
              <Button size="sm" onClick={next} disabled={!canAdvance} className="rounded-full px-6">
                Próxima<ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button size="sm" onClick={submit} disabled={submitting} className="rounded-full px-8 shadow-lg shadow-primary/20">
                <Rocket className="h-4 w-4 mr-2" />
                {submitting ? "Provisionando..." : "Ativar laboratório"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ────────────── Stepper ────────────── */

function Stepper({ currentStep, onJump }: { currentStep: number; onJump: (n: number) => void }) {
  return (
    <ol className="flex items-center gap-2 overflow-x-auto no-scrollbar py-2">
      {STEPS.map((s, i) => {
        const isActive = s.id === currentStep;
        const isDone = s.id < currentStep;
        return (
          <li key={s.id} className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onJump(s.id)}
              className={cn(
                "flex items-center gap-2 h-10 px-4 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all duration-200",
                isActive
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                  : isDone
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {s.id}. {s.label}
            </button>
            {i < STEPS.length - 1 && <span className="h-px w-4 bg-border/50" />}
          </li>
        );
      })}
    </ol>
  );
}

/* ────────────── Step bodies ────────────── */

function StepIdentidade({ form, set, effectiveSlug }: {
  form: WizardForm; set: <K extends keyof WizardForm>(k: K, v: WizardForm[K]) => void; effectiveSlug: string;
}) {
  return (
    <StepShell title="Identidade do laboratório" description="Esses dados aparecem no painel e na fatura.">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Nome do laboratório" required icon={Building2}>
          <Input value={form.nome} onChange={e => set("nome", e.target.value)} placeholder="Nome fantasia" autoFocus />
        </Field>
        <Field label="Slug" icon={Globe} hint={`URL: /lab/${effectiveSlug || "..."} — gerado automaticamente se vazio`}>
          <Input value={form.slug} onChange={e => set("slug", e.target.value)} placeholder={slugify(form.nome) || "lab-exemplo"} />
        </Field>
        <Field label="Código do laboratório" icon={Hash} hint="Identificador operacional (ex.: 1001, 1002). Deixe em branco para gerar automaticamente.">
          <Input
            value={form.labCode}
            onChange={e => set("labCode", e.target.value.replace(/[^0-9]/g, "").slice(0, 8))}
            placeholder="1001"
            className="font-mono tracking-wider"
            maxLength={8}
          />
        </Field>
        <Field label="CNPJ" icon={Hash}>
          <Input value={form.cnpj} onChange={e => set("cnpj", e.target.value)} placeholder="00.000.000/0001-00" />
        </Field>
        <Field label="E-mail de contato" icon={Mail}>
          <Input type="email" value={form.emailContato} onChange={e => set("emailContato", e.target.value)} placeholder="contato@laboratorio.com" />
        </Field>
        <Field label="Telefone" icon={Phone}>
          <Input value={form.telefone} onChange={e => set("telefone", e.target.value)} placeholder="(00) 00000-0000" />
        </Field>
      </div>
    </StepShell>
  );
}

function StepRuntime({ runtime, onChange }: { runtime: RuntimeChoice; onChange: (r: RuntimeChoice) => void }) {
  return (
    <StepShell title="Modo de runtime" description="Define como o tenant compartilha infraestrutura.">
      <div className="grid sm:grid-cols-2 gap-3">
        <RuntimeOption
          active={runtime === "shared_db"}
          onClick={() => onChange("shared_db")}
          icon={Server} title="Compartilhado"
          desc="Laboratório operando em infraestrutura multi-tenant."
          tag="Padrão"
        />
        <RuntimeOption
          active={runtime === "isolated_db"}
          onClick={() => onChange("isolated_db")}
          icon={Database} title="Dedicado"
          desc="Banco de dados exclusivo por laboratório. Máximo isolamento."
          tag="Enterprise"
        />
      </div>
    </StepShell>
  );
}

function RuntimeOption({ active, onClick, icon: Icon, title, desc, tag }: {
  active: boolean; onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  title: string; desc: string; tag?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-left rounded-lg border p-4 transition-colors",
        active ? "border-primary bg-primary/5" : "border-border hover:border-border/80 hover:bg-accent/40",
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className={cn("h-8 w-8 rounded-md flex items-center justify-center",
          active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
          <Icon className="h-4 w-4" />
        </div>
        {tag && <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{tag}</span>}
      </div>
      <div className="text-sm font-semibold text-foreground">{title}</div>
      <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">{desc}</p>
    </button>
  );
}

function StepIntegracoes() {
  return (
    <StepShell title="Integrações da plataforma" description="Configure os serviços federados para este laboratório.">
       <div className="grid sm:grid-cols-2 gap-4">
         <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-2 opacity-60">
            <div className="flex items-center gap-2 font-bold text-xs"><Database className="h-4 w-4" /> DB Diagnósticos</div>
            <p className="text-[11px] text-muted-foreground">Sincronização de pedidos e resultados (DBSync).</p>
         </div>
         <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-2 opacity-60">
            <div className="flex items-center gap-2 font-bold text-xs"><Mail className="h-4 w-4" /> WhatsApp Gateway</div>
            <p className="text-[11px] text-muted-foreground">Envio automático de laudos e notificações.</p>
         </div>
       </div>
       <p className="mt-6 text-[11px] text-amber-500 font-medium italic">* Integrações podem ser ativadas individualmente após o provisionamento.</p>
    </StepShell>
  );
}

function StepBanco({ runtime }: { runtime: RuntimeChoice }) {
  if (runtime === "shared_db") {
    return (
      <StepShell title="Banco de dados" description="Configuração automática para shared DB.">
        <div className="rounded-md border border-border bg-muted/40 p-4 flex items-start gap-3">
          <CheckCircle2 className="h-4 w-4 text-status-success mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">Nada a configurar.</p>
            <p className="text-[12px] text-muted-foreground mt-1">
              Tenants em <span className="font-mono">shared_db</span> compartilham o banco principal, isolados via RLS por <span className="font-mono">tenant_id</span>.
            </p>
          </div>
        </div>
      </StepShell>
    );
  }
  return (
    <StepShell title="Banco de dados (isolated)" description="A configuração do banco dedicado é feita após a criação.">
      <div className="rounded-md border border-status-warning/30 bg-status-warning-bg/40 p-4 flex items-start gap-3">
        <AlertTriangle className="h-4 w-4 text-status-warning mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-foreground">Configuração diferida.</p>
          <p className="text-[12px] text-muted-foreground mt-1">
            O laboratório será criado em modo <strong>Dedicado</strong>. A configuração da conexão (host/porta) é realizada na tela de gerenciamento após a ativação.
          </p>
        </div>
      </div>
    </StepShell>
  );
}

function StepBranding({ form, set, showPassword, onTogglePassword }: {
  form: WizardForm;
  set: <K extends keyof WizardForm>(k: K, v: WizardForm[K]) => void;
  showPassword: boolean;
  onTogglePassword: () => void;
}) {
  return (
    <StepShell title="Plano & admin inicial" description="Plano comercial vigente e credenciais do primeiro administrador.">
      <div className="space-y-5">
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-[0.12em] mb-2">Plano</p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {PLANOS.map(p => (
              <button
                key={p.value}
                type="button"
                onClick={() => set("plano", p.value)}
                className={cn(
                  "h-9 px-3 rounded-md border text-sm font-medium transition-colors",
                  form.plano === p.value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-border text-muted-foreground hover:border-border/80 hover:text-foreground hover:bg-accent/40",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Nome do admin" required icon={UserCog}>
            <Input value={form.adminNome} onChange={e => set("adminNome", e.target.value)} placeholder="Nome completo" />
          </Field>
          <Field label="E-mail do admin" required icon={Mail}>
            <Input type="email" value={form.adminEmail} onChange={e => set("adminEmail", e.target.value)} placeholder="admin@laboratorio.com" />
          </Field>
          <Field label="Senha inicial" required icon={KeyRound} hint="Mínimo de 6 caracteres. Compartilhe com segurança.">
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={form.adminSenha}
                onChange={e => set("adminSenha", e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={onTogglePassword}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>
        </div>
      </div>
    </StepShell>
  );
}

function StepHealthcheck({ result, onRun }: { result: ReturnType<typeof useState<null | { ok: boolean; checks: { label: string; ok: boolean; hint?: string }[] }>>[0]; onRun: () => void }) {
  return (
    <StepShell title="Healthcheck pré-ativação" description="Validação local antes de chamar o provisionador.">
      {!result ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/40 p-4">
          <div>
            <p className="text-sm font-medium text-foreground">Pronto para validar.</p>
            <p className="text-[12px] text-muted-foreground mt-1">
              Rode os checks de slug, admin e runtime. Nenhuma alteração é feita no banco.
            </p>
          </div>
          <Button size="sm" onClick={onRun}><Activity className="h-4 w-4 mr-1.5" />Rodar healthcheck</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {result.checks.map((c, i) => (
            <div key={i} className="flex items-start gap-3 rounded-md border border-border bg-card p-3">
              {c.ok
                ? <CheckCircle2 className="h-4 w-4 text-status-success mt-0.5 shrink-0" />
                : <AlertTriangle className="h-4 w-4 text-status-danger mt-0.5 shrink-0" />}
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm", c.ok ? "text-foreground" : "text-status-danger font-medium")}>{c.label}</p>
                {c.hint && <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{c.hint}</p>}
              </div>
            </div>
          ))}
          <div className="pt-1">
            <Button variant="outline" size="sm" onClick={onRun}>Rodar novamente</Button>
          </div>
        </div>
      )}
    </StepShell>
  );
}

function StepAtivacao({ form, effectiveSlug }: { form: WizardForm; effectiveSlug: string }) {
  return (
    <StepShell title="Revisar & ativar" description="Confira o resumo antes de provisionar o tenant.">
      <div className="grid sm:grid-cols-2 gap-3 text-[13px]">
        <ReviewCard title="Identidade">
          <Row label="Nome" value={form.nome || "—"} />
          <Row label="Slug" value={effectiveSlug || "—"} mono />
          <Row label="CNPJ" value={form.cnpj || "—"} />
          <Row label="E-mail" value={form.emailContato || "—"} />
          <Row label="Telefone" value={form.telefone || "—"} />
        </ReviewCard>
        <ReviewCard title="Runtime & plano">
          <Row label="Runtime" value={form.runtime === "isolated_db" ? "Isolated DB" : "Shared DB"} />
          <Row label="Plano" value={PLANOS.find(p => p.value === form.plano)?.label ?? form.plano} />
        </ReviewCard>
        <ReviewCard title="Admin inicial">
          <Row label="Nome" value={form.adminNome || "—"} />
          <Row label="E-mail" value={form.adminEmail || "—"} mono />
          <Row label="Senha" value={form.adminSenha ? "•".repeat(Math.min(form.adminSenha.length, 10)) : "—"} mono />
        </ReviewCard>
      </div>
    </StepShell>
  );
}

/* ────────────── helpers UI ────────────── */

function StepShell({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div>
      <header className="mb-5">
        <h2 className="text-[16px] font-semibold text-foreground tracking-tight">{title}</h2>
        {description && <p className="text-[12px] text-muted-foreground mt-1">{description}</p>}
      </header>
      {children}
    </div>
  );
}

function Field({ label, hint, required, icon: Icon, children }: {
  label: string; hint?: string; required?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.1em] mb-1.5 flex items-center gap-1.5">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

function ReviewCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 p-3 space-y-1.5">
      <p className="text-[10px] font-semibold text-muted-foreground/80 uppercase tracking-[0.1em]">{title}</p>
      {children}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-2 justify-between">
      <span className="text-[11px] text-muted-foreground shrink-0">{label}</span>
      <span className={cn("text-[12px] text-foreground truncate text-right", mono && "font-mono")}>{value}</span>
    </div>
  );
}