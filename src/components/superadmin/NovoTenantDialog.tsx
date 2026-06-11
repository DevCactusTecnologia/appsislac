// Modal de criação de novo tenant + admin inicial.
// Segue o padrão visual de SuperAdminTenantDetalhe (sections, ícones, plano em pílulas).

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import StandardDialog from "@/components/ui/standard-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Building2, Globe, Hash, Mail, Phone, CreditCard, UserCog, Sparkles,
  KeyRound, Eye, EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface NovoTenantDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (tenantId?: string) => void;
}

const EMPTY_FORM = {
  nome: "",
  slug: "",
  cnpj: "",
  emailContato: "",
  telefone: "",
  plano: "free",
  adminEmail: "",
  adminNome: "",
  adminSenha: "",
};

const PLANOS = [
  { value: "free", label: "Free" },
  { value: "starter", label: "Starter" },
  { value: "pro", label: "Pro" },
  { value: "business", label: "Business" },
  { value: "enterprise", label: "Enterprise" },
];

export default function NovoTenantDialog({ open, onClose, onCreated }: NovoTenantDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showPassword, setShowPassword] = useState(false);

  const update = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));
  const reset = () => setForm(EMPTY_FORM);

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const submit = async () => {
    if (!form.nome.trim()) return toast.error("Nome do laboratório obrigatório");
    if (!form.adminEmail.trim() || !form.adminEmail.includes("@")) return toast.error("E-mail do admin inválido");
    if (!form.adminNome.trim()) return toast.error("Nome do admin obrigatório");
    if (!form.adminSenha || form.adminSenha.length < 6) {
      return toast.error("Senha do admin deve ter pelo menos 6 caracteres");
    }

    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("super-admin-create-tenant", { body: form });
    setSubmitting(false);

    if (error) return toast.error(error.message);
    if (data?.warning) toast.warning(data.warning);
    else toast.success("Laboratório criado. Admin pode acessar com as credenciais definidas.");

    reset();
    onClose();
    onCreated?.(data?.tenant?.id);
  };

  return (
    <StandardDialog
      open={open}
      onClose={handleClose}
      icon={<Building2 className="h-5 w-5 text-primary" />}
      title="Novo laboratório"
      subtitle="Cria o tenant e envia convite por e-mail para o admin inicial."
      maxWidth="2xl"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={submitting}>
            <Sparkles className="h-4 w-4 mr-2" />
            {submitting ? "Criando..." : "Criar laboratório"}
          </Button>
        </>
      }
    >
      <div className="px-6 py-6 space-y-6">
        {/* Identificação */}
        <Section title="Identificação" description="Dados principais do laboratório" icon={Building2}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Nome do laboratório" required icon={Building2}>
              <Input
                value={form.nome}
                onChange={e => update("nome", e.target.value)}
                placeholder="Nome fantasia"
              />
            </Field>
            <Field label="Slug" hint="Gerado automaticamente se vazio." icon={Globe}>
              <Input
                value={form.slug}
                onChange={e => update("slug", e.target.value)}
                placeholder="lab-exemplo"
              />
            </Field>
            <Field label="CNPJ" icon={Hash}>
              <Input
                value={form.cnpj}
                onChange={e => update("cnpj", e.target.value)}
                placeholder="00.000.000/0001-00"
              />
            </Field>
            <Field label="E-mail de contato" icon={Mail}>
              <Input
                type="email"
                value={form.emailContato}
                onChange={e => update("emailContato", e.target.value)}
                placeholder="contato@laboratorio.com"
              />
            </Field>
            <Field label="Telefone" icon={Phone}>
              <Input
                value={form.telefone}
                onChange={e => update("telefone", e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </Field>
          </div>
        </Section>

        {/* Plano */}
        <Section title="Plano de assinatura" description="Selecione o plano comercial inicial" icon={CreditCard}>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {PLANOS.map(p => (
              <button
                key={p.value}
                type="button"
                onClick={() => update("plano", p.value)}
                className={cn(
                  "h-11 px-3 rounded-xl border text-sm font-semibold transition-all",
                  form.plano === p.value
                    ? "bg-primary text-primary-foreground border-primary shadow-[0_4px_12px_-4px_hsl(var(--primary)/0.5)] scale-[1.02]"
                    : "bg-card border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </Section>

        {/* Admin inicial */}
        <Section
          title="Admin inicial"
          description="Esta pessoa acessará o sistema com as credenciais definidas abaixo."
          icon={UserCog}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Nome do admin" required icon={UserCog}>
              <Input
                value={form.adminNome}
                onChange={e => update("adminNome", e.target.value)}
                placeholder="Nome completo"
              />
            </Field>
            <Field label="E-mail do admin" required icon={Mail}>
              <Input
                type="email"
                value={form.adminEmail}
                onChange={e => update("adminEmail", e.target.value)}
                placeholder="admin@laboratorio.com"
              />
            </Field>
            <Field
              label="Senha de acesso"
              required
              icon={KeyRound}
              hint="Mínimo de 6 caracteres. Compartilhe com o admin de forma segura."
            >
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={form.adminSenha}
                  onChange={e => update("adminSenha", e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>
          </div>
        </Section>
      </div>
    </StandardDialog>
  );
}

/* ---------- helpers ---------- */

function Section({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start gap-3 mb-4">
        {Icon && (
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className="h-4.5 w-4.5 text-primary" />
          </div>
        )}
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-foreground tracking-tight">{title}</h3>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  hint,
  required,
  icon: Icon,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}