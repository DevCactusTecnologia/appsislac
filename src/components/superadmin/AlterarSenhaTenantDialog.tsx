// Diálogo para super_admin redefinir e-mail e senha de um administrador
// de tenant. Filtra super_admins (defesa em profundidade) consultando
// public.user_roles — assim o e-mail do super admin nunca é exibido.
// A força da senha é apenas avisada; senhas fracas (ex: "12345678") são
// permitidas mediante confirmação explícita do operador.

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import StandardDialog from "@/components/ui/standard-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  KeyRound, Eye, EyeOff, ShieldCheck, AlertTriangle, Loader2, RefreshCw, Mail,
  ShieldAlert, LogIn,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminUser {
  user_id: string;
  email: string;
  nome: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  tenantNome: string;
}

function checkStrength(pw: string) {
  const checks = {
    length: pw.length >= 8,
    lower: /[a-z]/.test(pw),
    upper: /[A-Z]/.test(pw),
    number: /[0-9]/.test(pw),
    symbol: /[^A-Za-z0-9]/.test(pw),
  };
  const passed = Object.values(checks).filter(Boolean).length;
  // Aceita >= 6 chars (limite mínimo do Auth). Força é só visual.
  const acceptable = pw.length >= 6 && pw.length <= 72;
  const strong = passed >= 4 && checks.length;
  return { checks, passed, acceptable, strong };
}

function generateStrong(): string {
  const lowers = "abcdefghijkmnpqrstuvwxyz";
  const uppers = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const nums = "23456789";
  const syms = "!@#$%&*?";
  const all = lowers + uppers + nums + syms;
  const arr = new Uint32Array(16);
  crypto.getRandomValues(arr);
  let pw = "";
  pw += lowers[arr[0] % lowers.length];
  pw += uppers[arr[1] % uppers.length];
  pw += nums[arr[2] % nums.length];
  pw += syms[arr[3] % syms.length];
  for (let i = 4; i < 14; i++) pw += all[arr[i] % all.length];
  return pw.split("").sort(() => Math.random() - 0.5).join("");
}

export function AlterarSenhaTenantDialog({ open, onOpenChange, tenantId, tenantNome }: Props) {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string>("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [autoLogin, setAutoLogin] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    setPassword("");
    setShowPw(false);
    setEmail("");

    (async () => {
      // 1) Carrega admins do tenant
      const { data: profs, error } = await supabase
        .from("profiles")
        .select("user_id, email, nome, perfil")
        .eq("tenant_id", tenantId)
        .eq("perfil", "admin")
        .order("nome", { ascending: true });

      if (!alive) return;
      if (error) {
        toast.error(error.message);
        setAdmins([]);
        setLoading(false);
        return;
      }

      const candidates = (profs ?? []) as AdminUser[];

      // 2) Filtra qualquer user_id que tenha role 'super_admin'
      // (proteção crítica: super_admins nunca devem aparecer aqui)
      let safeList: AdminUser[] = candidates;
      if (candidates.length > 0) {
        const ids = candidates.map((c) => c.user_id);
        const { data: superRows } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "super_admin")
          .in("user_id", ids);
        const superSet = new Set((superRows ?? []).map((r) => r.user_id));
        safeList = candidates.filter((c) => !superSet.has(c.user_id));
      }

      if (!alive) return;
      setAdmins(safeList);
      setSelected(safeList[0]?.user_id ?? "");
      setEmail(safeList[0]?.email ?? "");
      setLoading(false);
    })();

    return () => { alive = false; };
  }, [open, tenantId]);

  const strength = useMemo(() => checkStrength(password), [password]);
  const selectedUser = useMemo(
    () => admins.find((a) => a.user_id === selected) ?? null,
    [admins, selected]
  );

  // Sincroniza o campo de e-mail ao trocar o admin selecionado
  useEffect(() => {
    if (selectedUser) setEmail(selectedUser.email ?? "");
  }, [selectedUser]);

  const emailNormalized = email.trim().toLowerCase();
  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNormalized) && emailNormalized.length <= 254;
  const emailMudou = !!selectedUser && emailNormalized !== (selectedUser.email ?? "").toLowerCase();

  async function handleSubmit() {
    if (!selectedUser) { toast.error("Selecione um administrador"); return; }
    if (!strength.acceptable) {
      toast.error("Senha deve ter entre 6 e 72 caracteres");
      return;
    }
    if (!emailValido) { toast.error("Informe um e-mail válido"); return; }

    // Abre o modal de confirmação moderno em vez de prosseguir direto
    setConfirmOpen(true);
  }

  async function executarAlteracao() {
    if (!selectedUser) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "super-admin-reset-tenant-password",
        {
          body: {
            tenantId,
            userId: selectedUser.user_id,
            newPassword: password,
            ...(emailMudou ? { newEmail: emailNormalized } : {}),
          },
        }
      );
      if (error) throw new Error(error.message);
      const payload = data as { ok?: boolean; email?: string; error?: string };
      if (!payload?.ok) throw new Error(payload?.error || "Falha ao redefinir senha");

      toast.success(
        emailMudou
          ? `Credenciais atualizadas. Novo acesso: ${payload.email}`
          : `Senha de ${payload.email} atualizada com sucesso`
      );

      if (autoLogin && payload.email) {
        await supabase.auth.signOut();
        const { error: loginErr } = await supabase.auth.signInWithPassword({
          email: payload.email,
          password,
        });
        if (loginErr) {
          toast.error(`Credenciais alteradas, mas falhou ao entrar: ${loginErr.message}`);
        } else {
          toast.success("Sessão iniciada no laboratório");
          window.location.href = "/";
          return;
        }
      }

      setConfirmOpen(false);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro inesperado");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
    <StandardDialog
      open={open}
      onClose={() => !submitting && onOpenChange(false)}
      icon={<KeyRound className="h-4 w-4 text-primary" />}
      title="Alterar credenciais do administrador"
      subtitle={`Laboratório: ${tenantNome}`}
      maxWidth="lg"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              submitting || !strength.acceptable || !selectedUser || !emailValido
            }
          >
            {submitting ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Aplicando...</>
            ) : (
              <><ShieldCheck className="h-4 w-4 mr-2" /> Confirmar alteração</>
            )}
          </Button>
        </>
      }
    >
      <div className="px-6 py-5 space-y-5">
        <p className="text-xs text-muted-foreground -mt-1">
          Defina um novo e-mail e/ou senha para um administrador deste laboratório.
          Esta ação é registrada no log de auditoria.
        </p>

        {/* Seleção do admin */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Administrador
          </Label>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando...
            </div>
          ) : admins.length === 0 ? (
            <div className="text-sm text-amber-700 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>Este laboratório não tem nenhum administrador elegível para alteração.</span>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
              {admins.map((a) => (
                <button
                  key={a.user_id}
                  type="button"
                  onClick={() => setSelected(a.user_id)}
                  className={cn(
                    "w-full text-left rounded-xl border px-3 py-2.5 transition-all",
                    selected === a.user_id
                      ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                      : "border-border hover:border-foreground/30 bg-card"
                  )}
                >
                  <div className="text-sm font-semibold text-foreground truncate">
                    {a.nome || "(sem nome)"}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{a.email}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* E-mail de acesso */}
        {selectedUser && (
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Mail className="h-3 w-3" /> E-mail de acesso
            </Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@laboratorio.com"
              autoComplete="off"
              spellCheck={false}
              className={cn(
                "font-mono text-sm",
                emailMudou && "border-amber-500/50 ring-1 ring-amber-500/20"
              )}
            />
            {emailMudou && (
              <p className="text-[11px] text-amber-700">
                ⚠️ O e-mail de login será alterado para <strong>{emailNormalized || "—"}</strong>.
              </p>
            )}
            {!emailValido && email.length > 0 && (
              <p className="text-[11px] text-destructive">Formato de e-mail inválido</p>
            )}
          </div>
        )}

        {/* Nova senha */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Nova senha
            </Label>
            <button
              type="button"
              onClick={() => { setPassword(generateStrong()); setShowPw(true); }}
              className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
            >
              <RefreshCw className="h-3 w-3" /> Gerar segura
            </button>
          </div>
          <div className="relative">
            <Input
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite a nova senha (mín. 6 caracteres)"
              className="pr-10 font-mono"
              autoComplete="new-password"
              maxLength={72}
            />
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
              tabIndex={-1}
            >
              {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>

          {/* Barra de força */}
          <div className="flex gap-1 mt-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors",
                  i < strength.passed
                    ? strength.passed >= 5 ? "bg-emerald-500"
                      : strength.passed >= 3 ? "bg-amber-500"
                      : "bg-destructive"
                    : "bg-muted"
                )}
              />
            ))}
          </div>

          {/* Aviso de senha fraca (não bloqueia) */}
          {password.length > 0 && strength.acceptable && !strength.strong && (
            <div className="text-[11px] text-amber-700 bg-amber-500/10 border border-amber-500/30 rounded-lg px-2.5 py-2 flex gap-1.5">
              <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
              <span>
                Senha fraca. Será aceita, mas é facilmente descoberta. Para mais
                segurança, use 8+ caracteres com maiúsculas, números e símbolos.
              </span>
            </div>
          )}
          {password.length > 0 && !strength.acceptable && (
            <p className="text-[11px] text-destructive">
              Senha deve ter entre 6 e 72 caracteres.
            </p>
          )}
          <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-muted-foreground mt-1.5">
            <Req ok={strength.checks.length} label="8+ caracteres" />
            <Req ok={strength.checks.lower} label="letra minúscula" />
            <Req ok={strength.checks.upper} label="letra MAIÚSCULA" />
            <Req ok={strength.checks.number} label="número" />
            <Req ok={strength.checks.symbol} label="símbolo (!@#$...)" />
          </ul>
        </div>

        {/* Auto-login */}
        <label className="flex items-start gap-2.5 cursor-pointer rounded-xl border border-border bg-muted/30 p-3 hover:bg-muted/50 transition-colors">
          <Checkbox
            checked={autoLogin}
            onCheckedChange={(v) => setAutoLogin(!!v)}
            className="mt-0.5"
          />
          <div className="text-sm">
            <div className="font-semibold text-foreground">Entrar com este usuário após salvar</div>
            <div className="text-xs text-muted-foreground">
              Você será desconectado do super-admin e entrará no painel do laboratório com a nova senha.
            </div>
          </div>
        </label>
      </div>
    </StandardDialog>

      {/* Modal de confirmação moderno */}
      <ConfirmAlteracaoDialog
        open={confirmOpen}
        onClose={() => !submitting && setConfirmOpen(false)}
        onConfirm={executarAlteracao}
        submitting={submitting}
        nomeAdmin={selectedUser?.nome || "(sem nome)"}
        emailAtual={selectedUser?.email || ""}
        novoEmail={emailNormalized}
        emailMudou={emailMudou}
        senhaFraca={!strength.strong}
        autoLogin={autoLogin}
        tenantNome={tenantNome}
      />
    </>
  );
}

function Req({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className={cn("flex items-center gap-1.5", ok && "text-emerald-600")}>
      <span className={cn(
        "h-1.5 w-1.5 rounded-full",
        ok ? "bg-emerald-500" : "bg-muted-foreground/40"
      )} />
      {label}
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Modal de confirmação                                                */
/* ------------------------------------------------------------------ */

interface ConfirmProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  submitting: boolean;
  nomeAdmin: string;
  emailAtual: string;
  novoEmail: string;
  emailMudou: boolean;
  senhaFraca: boolean;
  autoLogin: boolean;
  tenantNome: string;
}

function ConfirmAlteracaoDialog({
  open, onClose, onConfirm, submitting,
  nomeAdmin, emailAtual, novoEmail, emailMudou,
  senhaFraca, autoLogin, tenantNome,
}: ConfirmProps) {
  return (
    <StandardDialog
      open={open}
      onClose={onClose}
      icon={
        senhaFraca
          ? <ShieldAlert className="h-4 w-4 text-amber-600" />
          : <ShieldCheck className="h-4 w-4 text-primary" />
      }
      title={senhaFraca ? "Atenção: senha fraca" : "Confirmar alteração de credenciais"}
      subtitle={`Laboratório: ${tenantNome}`}
      maxWidth="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Voltar
          </Button>
          <Button
            onClick={onConfirm}
            disabled={submitting}
            className={cn(
              senhaFraca && "bg-amber-600 hover:bg-amber-600/90 text-white"
            )}
          >
            {submitting ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Aplicando...</>
            ) : senhaFraca ? (
              <><ShieldAlert className="h-4 w-4 mr-2" /> Aplicar mesmo assim</>
            ) : (
              <><ShieldCheck className="h-4 w-4 mr-2" /> Confirmar e aplicar</>
            )}
          </Button>
        </>
      }
    >
      <div className="px-6 py-5 space-y-4">
        {senhaFraca && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 flex gap-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 leading-relaxed">
              A senha definida é considerada <strong>fraca</strong> e pode ser
              facilmente descoberta por ataques automatizados. Recomendamos usar
              senhas com 8+ caracteres, misturando maiúsculas, números e símbolos.
            </div>
          </div>
        )}

        <p className="text-sm text-muted-foreground">
          Revise as alterações que serão aplicadas:
        </p>

        <div className="rounded-xl border border-border bg-muted/30 divide-y divide-border/60 overflow-hidden">
          <ResumoRow label="Administrador" value={nomeAdmin} />
          {emailMudou ? (
            <ResumoRow
              label="E-mail de acesso"
              value={
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground line-through truncate">{emailAtual || "—"}</span>
                  <span className="font-mono text-sm text-foreground truncate">{novoEmail}</span>
                </div>
              }
              icon={<Mail className="h-3.5 w-3.5 text-muted-foreground" />}
              changed
            />
          ) : (
            <ResumoRow
              label="E-mail de acesso"
              value={<span className="font-mono text-sm">{emailAtual || "—"}</span>}
              icon={<Mail className="h-3.5 w-3.5 text-muted-foreground" />}
            />
          )}
          <ResumoRow
            label="Senha"
            value={
              <span className={cn(
                "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border",
                senhaFraca
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-700"
                  : "bg-emerald-500/10 border-emerald-500/30 text-emerald-700"
              )}>
                <span className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  senhaFraca ? "bg-amber-500" : "bg-emerald-500"
                )} />
                {senhaFraca ? "Será redefinida (fraca)" : "Será redefinida (forte)"}
              </span>
            }
            icon={<KeyRound className="h-3.5 w-3.5 text-muted-foreground" />}
            changed
          />
          {autoLogin && (
            <ResumoRow
              label="Após salvar"
              value={
                <span className="inline-flex items-center gap-1.5 text-sm text-foreground">
                  <LogIn className="h-3.5 w-3.5 text-primary" />
                  Entrar como este usuário
                </span>
              }
            />
          )}
        </div>

        <div className="text-[11px] text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 leading-relaxed">
          ⓘ Esta ação é registrada no log de auditoria com o identificador do
          super administrador responsável.
        </div>
      </div>
    </StandardDialog>
  );
}

function ResumoRow({
  label, value, icon, changed,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  changed?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 px-3.5 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground w-32 shrink-0 pt-1">
        {icon}
        {label}
      </div>
      <div className="flex-1 min-w-0 text-sm text-foreground">
        {value}
      </div>
      {changed && (
        <span className="text-[9px] uppercase tracking-wider font-bold text-amber-600 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30">
          Alterado
        </span>
      )}
    </div>
  );
}
