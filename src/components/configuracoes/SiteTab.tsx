import { useEffect, useMemo, useState } from "react";
import {
  Globe,
  Plus,
  Save,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  Copy,
  QrCode,
  Share2,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Monitor,
  Smartphone,
  Eye,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
// QRCode é carregado dinamicamente dentro de handleQR para não inflar o
// chunk inicial de /configuracoes (~50 KB).
import SectionShell from "@/components/configuracoes/_shared/SectionShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  BLOCK_LABELS,
  defaultBlock,
  sanitizeContent,
  type BlockType,
  type TBlock,
  type TPageContent,
} from "@/lib/tenantSite/blocks";
import {
  getPageForAdmin,
  savePage,
  updateTenantSiteConfig,
} from "@/lib/tenantSite/store";
import PageRenderer from "@/components/tenant-site/PageRenderer";
import BlockEditor from "@/components/configuracoes/site/BlockEditor";
import VitrinePublicaPanel from "@/components/configuracoes/site/VitrinePublicaPanel";
import IdentidadeVisualPanel from "@/components/configuracoes/site/IdentidadeVisualPanel";
import { tenantSiteUrl } from "@/lib/tenantSite/seoHelpers";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const BLOCK_TYPES: BlockType[] = ["hero", "texto", "servicos", "imagem"];

/** Slugs reservados — não podem ser usados como subdomínio público do tenant. */
const RESERVED_SLUGS = new Set([
  "admin", "api", "app", "auth", "login", "logout", "signup", "site",
  "super-admin", "superadmin", "dashboard", "configuracoes", "settings",
  "atendimentos", "pacientes", "financeiro", "resultados", "coleta",
  "analise", "mapa", "estoque", "auditoria", "orcamentos", "relatorios",
  "www", "root", "static", "public", "assets", "files", "storage",
  "sislac", "lovable", "supabase",
]);

type SlugStatus =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "available" }
  | { state: "taken" }
  | { state: "reserved" }
  | { state: "invalid"; reason: string };

/** Normaliza um texto livre em um slug seguro para URL. */
function slugify(input: string): string {
  return (input || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** Garante que o slug proposto seja único na tabela tenants;
 *  se já existir em outro tenant, sufixa -2, -3, ... */
async function ensureUniqueSlug(base: string, tenantId: string): Promise<string> {
  const root = slugify(base) || "lab";
  let candidate = root;
  let n = 1;
  // Loop curto e seguro (até 50 tentativas).
  while (n < 50) {
    const { data } = await supabase
      .from("tenants" as never)
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    const row = data as { id?: string } | null;
    if (!row || row.id === tenantId) return candidate;
    n += 1;
    candidate = `${root}-${n}`;
  }
  return `${root}-${Date.now().toString(36)}`;
}

/** Conjunto mínimo de blocos para um site recém-publicado. */
function buildSeedBlocks(): TPageContent {
  const hero = defaultBlock("hero");
  const texto = defaultBlock("texto");
  return [
    { ...hero, props: { ...hero.props, titulo: "Bem-vindo ao nosso laboratório", subtitulo: "Resultados rápidos, confiáveis e com atendimento humanizado." } } as TBlock,
    { ...texto, props: { ...texto.props, texto: "Somos um laboratório de análises clínicas comprometido com qualidade e cuidado com cada paciente.", alinhamento: "center" } } as TBlock,
    defaultBlock("servicos"),
    defaultBlock("exames_lista"),
  ];
}

export default function SiteTab() {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? "";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [publicado, setPublicado] = useState(true);
  const [blocos, setBlocos] = useState<TPageContent>([]);
  const [novoBloco, setNovoBloco] = useState<BlockType>("hero");

  // Configurações do site
  const [slug, setSlug] = useState("");
  const [dominio, setDominio] = useState("");
  const [dominioVerificado, setDominioVerificado] = useState(false);
  const [slugInicial, setSlugInicial] = useState("");
  const [dominioInicial, setDominioInicial] = useState("");
  const [slugStatus, setSlugStatus] = useState<SlugStatus>({ state: "idle" });
  const [dnsDiag, setDnsDiag] = useState<{
    cnames: string[];
    a_records: string[];
    expected_targets: string[];
    verified: boolean;
  } | null>(null);

  // UI: avançado (editor de blocos) recolhido por padrão.
  const [avancadoAberto, setAvancadoAberto] = useState(false);
  const [qrAberto, setQrAberto] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [previewAberto, setPreviewAberto] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    let active = true;
    (async () => {
      setLoading(true);
      const [pageRes, tenantRes] = await Promise.all([
        getPageForAdmin(tenantId, "home"),
        supabase
          .from("tenants" as never)
          .select("slug, dominio_custom, dominio_verificado")
          .eq("id", tenantId)
          .maybeSingle(),
      ]);
      if (!active) return;
      if (pageRes) {
        setTitulo(pageRes.titulo || "Página inicial");
        setPublicado(pageRes.publicado);
        setBlocos(sanitizeContent(pageRes.conteudo));
      } else {
        setTitulo("Página inicial");
        setPublicado(true);
        setBlocos([]);
      }
      const t = (tenantRes.data ?? {}) as Record<string, unknown>;
      const slugAtual = (t.slug as string) ?? "";
      setSlug(slugAtual);
      setSlugInicial(slugAtual);
      setDominio((t.dominio_custom as string) ?? "");
      setDominioInicial((t.dominio_custom as string) ?? "");
      setDominioVerificado(Boolean(t.dominio_verificado));
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [tenantId]);

  // Verifica disponibilidade do slug com debounce (300ms).
  useEffect(() => {
    if (!tenantId) return;
    const valor = slug.trim();
    if (!valor) { setSlugStatus({ state: "idle" }); return; }
    if (valor === slugInicial) { setSlugStatus({ state: "available" }); return; }
    if (valor.length < 3) { setSlugStatus({ state: "invalid", reason: "Mínimo de 3 caracteres" }); return; }
    if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(valor)) {
      setSlugStatus({ state: "invalid", reason: "Use letras, números e hífens (sem hífens nas pontas)" });
      return;
    }
    if (RESERVED_SLUGS.has(valor)) { setSlugStatus({ state: "reserved" }); return; }
    setSlugStatus({ state: "checking" });
    const timer = window.setTimeout(async () => {
      try {
        const { data } = await supabase
          .from("tenants" as never)
          .select("id")
          .eq("slug", valor)
          .maybeSingle();
        const row = data as { id?: string } | null;
        if (!row || row.id === tenantId) setSlugStatus({ state: "available" });
        else setSlugStatus({ state: "taken" });
      } catch {
        setSlugStatus({ state: "idle" });
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [slug, slugInicial, tenantId]);

  const previewUrl = useMemo(() => (slug ? tenantSiteUrl(slug) : ""), [slug]);
  const dominioUrl = useMemo(
    () => (dominio.trim() ? `https://${dominio.trim()}` : ""),
    [dominio],
  );
  const linkPublico = dominioVerificado && dominioUrl ? dominioUrl : previewUrl;

  const examesNaVitrine = useMemo(
    () => blocos.some((b) => b.type === "exames_lista"),
    [blocos],
  );

  const handleCopiar = async () => {
    if (!linkPublico) {
      toast.error("Configure um slug e salve antes de copiar o link.");
      return;
    }
    try {
      await navigator.clipboard.writeText(linkPublico);
      toast.success("Link copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const handleQR = async () => {
    if (!linkPublico) {
      toast.error("Configure um slug e salve antes de gerar o QR.");
      return;
    }
    try {
      const QRCode = (await import("qrcode")).default;
      const dataUrl = await QRCode.toDataURL(linkPublico, {
        width: 600,
        margin: 2,
        errorCorrectionLevel: "L",
        color: {
          dark: "#000000",
          light: "#ffffff"
        }
      });
      setQrDataUrl(dataUrl);
      setQrAberto(true);
    } catch {
      toast.error("Não foi possível gerar o QR Code");
    }
  };

  const handleWhatsApp = () => {
    if (!linkPublico) {
      toast.error("Configure um slug e salve antes de compartilhar.");
      return;
    }
    const msg = encodeURIComponent(
      `Conheça nosso laboratório e solicite seus exames online: ${linkPublico}`,
    );
    window.open(`https://wa.me/?text=${msg}`, "_blank", "noopener,noreferrer");
  };

  const updateBlock = (idx: number, next: TBlock) => {
    setBlocos((prev) => prev.map((b, i) => (i === idx ? next : b)));
  };
  const removeBlock = (idx: number) => setBlocos((prev) => prev.filter((_, i) => i !== idx));
  const moveBlock = (idx: number, dir: -1 | 1) => {
    setBlocos((prev) => {
      const next = [...prev];
      const tgt = idx + dir;
      if (tgt < 0 || tgt >= next.length) return prev;
      [next[idx], next[tgt]] = [next[tgt], next[idx]];
      return next;
    });
  };
  const addBlock = () => {
    if (blocos.length >= 50) {
      toast.error("Limite de 50 blocos por página");
      return;
    }
    setBlocos((prev) => [...prev, defaultBlock(novoBloco)]);
  };

  const handleSave = async () => {
    if (!tenantId) return;
    if (slugStatus.state === "taken" || slugStatus.state === "reserved" || slugStatus.state === "invalid") {
      toast.error("Resolva o problema do slug antes de salvar.");
      return;
    }
    setSaving(true);
    // Garante que ao publicar exista um slug consistente.
    // Se o usuário não preencheu, derivamos do nome do tenant
    // (ou do título da página) e checamos unicidade.
    let slugFinal = slug.trim();
    if (publicado && !slugFinal) {
      const base = titulo.trim() || "lab";
      slugFinal = await ensureUniqueSlug(base, tenantId);
      setSlug(slugFinal);
      toast.info(`Slug gerado automaticamente: /site/${slugFinal}`);
    }

    const cfg = await updateTenantSiteConfig({
      tenant_id: tenantId,
      slug: slugFinal || null,
      dominio_custom: dominio.trim().toLowerCase() || null,
    });
    if (!cfg.ok) {
      setSaving(false);
      toast.error(cfg.error ?? "Erro ao salvar configurações");
      return;
    }
    // Se trocou o domínio, invalida verificação local também.
    setDominioVerificado(false);

    // Se o usuário ativou "Publicada" mas a página está vazia,
    // semeia automaticamente um conjunto mínimo de blocos.
    let conteudoFinal = blocos;
    if (publicado && blocos.length === 0) {
      conteudoFinal = buildSeedBlocks();
      setBlocos(conteudoFinal);
      toast.info("Adicionamos blocos iniciais à sua página. Edite quando quiser.");
    }

    const res = await savePage({
      tenant_id: tenantId,
      slug: "home",
      titulo: titulo.trim() || "Página inicial",
      conteudo: conteudoFinal,
      publicado,
    });
    setSaving(false);
    if (res.ok) {
      setSlugInicial(slugFinal);
      setDominioInicial(dominio.trim().toLowerCase());
      toast.success("Site salvo com sucesso");
    }
    else toast.error(res.error ?? "Erro ao salvar página");
  };

  const handleVerifyDomain = async () => {
    if (!tenantId) return;
    // Garante sessão real autenticada — anon JWT não tem `sub` e a edge function rejeita com 401.
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) {
      toast.error("Sessão expirada. Faça login novamente para verificar o domínio.");
      return;
    }
    // tenant_id precisa ser um UUID válido.
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) {
      toast.error("Tenant inválido para verificação de domínio.");
      return;
    }
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("tenant-domain-verify", {
        body: { tenant_id: tenantId },
      });
      if (error) throw error;
      const payload = (data ?? {}) as {
        verified?: boolean;
        cnames?: string[];
        a_records?: string[];
        expected_targets?: string[];
      };
      const ok = Boolean(payload.verified);
      setDominioVerificado(ok);
      setDnsDiag({
        cnames: payload.cnames ?? [],
        a_records: payload.a_records ?? [],
        expected_targets: payload.expected_targets ?? [],
        verified: ok,
      });
      if (ok) toast.success("Domínio verificado com sucesso");
      else toast.error("DNS ainda não aponta para o destino correto");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha na verificação");
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ====== Status + ações rápidas ====== */}
      <SectionShell
        icon={<Globe className="h-5 w-5 text-primary" />}
        title="Status do site público"
        description="Visão rápida do que está publicado e atalhos para divulgar a landing."
        actions={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  publicado ? "bg-success" : "bg-muted-foreground/50"
                }`}
              />
              <Label className="text-xs text-muted-foreground">
                {publicado ? "No ar" : "Offline"}
              </Label>
              <Switch checked={publicado} onCheckedChange={setPublicado} />
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleSave}
              disabled={saving}
              className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
              title="Salvar status"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          {/* Link público + ações inline */}
          <div className="flex items-center gap-2 border border-border rounded-lg pl-3 pr-1 py-1 bg-muted/10">
            <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0 text-xs font-mono truncate text-foreground">
              {linkPublico || "—"}
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                onClick={() => linkPublico && window.open(linkPublico, "_blank", "noopener,noreferrer")}
                disabled={!linkPublico}
                title="Abrir"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                onClick={handleCopiar}
                disabled={!linkPublico}
                title="Copiar"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                onClick={handleQR}
                disabled={!linkPublico}
                title="QR Code"
              >
                <QrCode className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Chips de status — flat, horizontais */}
          <div className="flex flex-wrap gap-1.5">
            <StatusChip ok={publicado} label={publicado ? "Publicada" : "Despublicada"} />
            <StatusChip
              ok={Boolean(slug)}
              label={slug ? `/site/${slug}` : "Sem slug"}
            />
            <StatusChip
              ok={!dominio || dominioVerificado}
              warn={Boolean(dominio) && !dominioVerificado}
              label={
                dominio
                  ? dominioVerificado
                    ? dominio
                    : `${dominio} (aguardando DNS)`
                  : "Domínio padrão"
              }
            />
            <StatusChip
              ok={examesNaVitrine}
              label={examesNaVitrine ? "Vitrine ativa" : "Vitrine vazia"}
            />
          </div>
        </div>
      </SectionShell>

      <SectionShell
        icon={<Globe className="h-5 w-5 text-primary" />}
        title="Endereço público"
        description="Configure o slug e o domínio próprio onde a landing do laboratório fica acessível."
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* === Slug público === */}
          <div className="space-y-1">
            <Label className="text-xs">Slug público (sislac.com/site/<b>seu-slug</b>)</Label>
            <Input
              value={slug}
              onChange={(e) =>
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40))
              }
              placeholder="meu-laboratorio"
              aria-invalid={
                slugStatus.state === "taken" ||
                slugStatus.state === "reserved" ||
                slugStatus.state === "invalid"
              }
            />
            <SlugStatusHint status={slugStatus} slug={slug} slugInicial={slugInicial} />
          </div>

          {/* === Domínio próprio === */}
          <div className="space-y-1">
            <Label className="text-xs">Domínio próprio (opcional)</Label>
            <div className="flex gap-2">
              <Input
                value={dominio}
                onChange={(e) => {
                  setDominio(e.target.value.toLowerCase().slice(0, 200));
                  setDnsDiag(null);
                }}
                placeholder="lab.com.br"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleVerifyDomain}
                disabled={verifying || !dominio.trim()}
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${verifying ? "animate-spin" : ""}`} />
                Verificar
              </Button>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] mt-1">
              {dominioVerificado ? (
                <>
                  <ShieldCheck className="h-3.5 w-3.5 text-success" />
                  <span className="text-success">Domínio verificado</span>
                </>
              ) : dominio.trim() ? (
                <>
                  <ShieldAlert className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    Configure os registros DNS abaixo e clique em verificar.
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">
                  Sem domínio próprio (usando sislac.lovable.app).
                </span>
              )}
            </div>
          </div>
        </div>

        {/* === Instruções DNS dinâmicas === */}
        {dominio.trim() ? (
          <DnsInstructions dominio={dominio.trim()} diag={dnsDiag} />
        ) : null}

        {(slug.trim() !== slugInicial || dominio.trim().toLowerCase() !== dominioInicial) && (
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border mt-2">
            <span className="text-[11px] text-muted-foreground mr-auto">Alterações não salvas neste card.</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setSlug(slugInicial);
                setDominio(dominioInicial);
              }}
              disabled={saving}
            >
              Descartar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              <Save className="h-3.5 w-3.5 mr-1.5" /> {saving ? "Salvando..." : "Salvar endereço"}
            </Button>
          </div>
        )}
      </SectionShell>

      {tenantId ? <IdentidadeVisualPanel tenantId={tenantId} /> : null}

      {tenantId ? <VitrinePublicaPanel tenantId={tenantId} /> : null}

      {/* ====== Personalização avançada (recolhida) ====== */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setAvancadoAberto((v) => !v)}
          className="w-full flex items-center justify-between px-5 sm:px-6 py-4 hover:bg-muted/20 transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-primary/10 shrink-0">
              <Globe className="h-5 w-5 text-primary" />
            </div>
            <div className="text-left min-w-0">
              <div className="text-base sm:text-lg font-bold text-foreground leading-tight">
                Personalização avançada da página
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Edite blocos manualmente (hero, textos, imagens, serviços). A maioria dos labs não precisa abrir esta seção.
              </div>
            </div>
          </div>
          {avancadoAberto ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
        </button>

        {avancadoAberto && (
          <div className="border-t border-border">
            <div className="px-5 sm:px-6 py-3 border-b border-border bg-muted/10">
              <div className="flex items-center gap-2 flex-wrap">
                <Input
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Título da página"
                  className="max-w-xs"
                  maxLength={120}
                />
                <div className="flex items-center gap-2 ml-auto">
                  <Select value={novoBloco} onValueChange={(v) => setNovoBloco(v as BlockType)}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BLOCK_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {BLOCK_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={addBlock}>
                    <Plus className="h-3.5 w-3.5 mr-1.5" /> Adicionar bloco
                  </Button>
                </div>
              </div>
            </div>
            <div className="p-5 sm:p-6">
              <div className="space-y-3">
                  {blocos.length === 0 ? (
                    <div className="text-center text-xs text-muted-foreground py-12 border border-dashed border-border rounded-xl">
                      Nenhum bloco. Use "Adicionar bloco" acima para começar.
                    </div>
                  ) : (
                    blocos.map((b, i) => (
                      <BlockEditor
                        key={i}
                        block={b}
                        index={i}
                        total={blocos.length}
                        onChange={(n) => updateBlock(i, n)}
                        onRemove={() => removeBlock(i)}
                        onMove={(d) => moveBlock(i, d)}
                      />
                    ))
                  )}
              </div>
              <div className="mt-4 flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!slug) {
                      toast.error("Defina uma slug para visualizar a landing.");
                      return;
                    }
                    setPreviewAberto(true);
                  }}
                >
                  <Eye className="h-3.5 w-3.5 mr-1.5" /> Pré-visualizar landing
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ====== QR dialog ====== */}
      <Dialog open={qrAberto} onOpenChange={setQrAberto}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>QR Code da landing</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="QR Code" className="w-64 h-64 border border-border rounded-lg" />
            ) : null}
            <div className="text-xs font-mono break-all text-center text-muted-foreground">
              {linkPublico}
            </div>
            <Button
              size="sm"
              variant="outline"
              asChild
            >
              <a href={qrDataUrl} download="qrcode-landing.png">
                Baixar PNG
              </a>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ====== Preview dialog ====== */}
      <Dialog open={previewAberto} onOpenChange={setPreviewAberto}>
        <DialogContent className="max-w-6xl w-[95vw] p-0 gap-0">
          <DialogHeader className="px-5 py-3 border-b border-border flex-row items-center justify-between gap-2 space-y-0">
            <DialogTitle className="text-base">Pré-visualização da landing</DialogTitle>
            <div className="inline-flex rounded-md border border-border bg-background p-0.5 mr-8">
              <button
                type="button"
                onClick={() => setPreviewMode("desktop")}
                className={`inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-medium transition-colors ${previewMode === "desktop" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                aria-pressed={previewMode === "desktop"}
              >
                <Monitor className="h-3.5 w-3.5" /> Desktop
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode("mobile")}
                className={`inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-medium transition-colors ${previewMode === "mobile" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                aria-pressed={previewMode === "mobile"}
              >
                <Smartphone className="h-3.5 w-3.5" /> Mobile
              </button>
            </div>
          </DialogHeader>
          {slug ? (
            <div className="bg-muted/30 flex justify-center p-4 h-[80vh] overflow-auto">
              <iframe
                key={slug + previewMode}
                src={`/site/${slug}`}
                title="Pré-visualização da landing"
                className={`bg-background border border-border rounded-md shadow-sm transition-all ${previewMode === "mobile" ? "w-[390px] h-[844px] max-w-full" : "w-full h-full"}`}
              />
            </div>
          ) : (
            <div className="p-6 text-xs text-muted-foreground text-center">
              Defina uma slug para visualizar a landing.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusRow({ ok, warn, label }: { ok: boolean; warn?: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
      ) : warn ? (
        <ShieldAlert className="h-4 w-4 text-warning shrink-0" />
      ) : (
        <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />
      )}
      <span className={ok ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}

function StatusChip({ ok, warn, label }: { ok: boolean; warn?: boolean; label: string }) {
  const tone = warn
    ? "border-warning/30 bg-warning/10 text-warning"
    : ok
    ? "border-success/30 bg-success/10 text-success"
    : "border-border bg-muted/30 text-muted-foreground";
  const Icon = warn ? ShieldAlert : ok ? CheckCircle2 : XCircle;
  return (
    <span
      className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border text-[11px] font-medium ${tone}`}
    >
      <Icon className="h-3 w-3 shrink-0" />
      <span className="truncate max-w-[200px]">{label}</span>
    </span>
  );
}

function SlugStatusHint({
  status,
  slug,
  slugInicial,
}: {
  status: SlugStatus;
  slug: string;
  slugInicial: string;
}) {
  if (!slug.trim()) {
    return (
      <div className="text-[11px] text-muted-foreground mt-1">
        Use letras minúsculas, números e hífens. Mínimo de 3 caracteres.
      </div>
    );
  }
  switch (status.state) {
    case "checking":
      return (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-1">
          <Loader2 className="h-3 w-3 animate-spin" /> Verificando disponibilidade…
        </div>
      );
    case "available":
      return (
        <div className="flex items-center gap-1.5 text-[11px] text-success mt-1">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {slug.trim() === slugInicial ? "Slug atual em uso por este laboratório." : "Slug disponível."}
        </div>
      );
    case "taken":
      return (
        <div className="flex items-center gap-1.5 text-[11px] text-destructive mt-1">
          <XCircle className="h-3.5 w-3.5" /> Este slug já está em uso por outro laboratório.
        </div>
      );
    case "reserved":
      return (
        <div className="flex items-center gap-1.5 text-[11px] text-destructive mt-1">
          <XCircle className="h-3.5 w-3.5" /> Slug reservado pelo sistema. Escolha outro.
        </div>
      );
    case "invalid":
      return (
        <div className="flex items-center gap-1.5 text-[11px] text-destructive mt-1">
          <XCircle className="h-3.5 w-3.5" /> {status.reason}
        </div>
      );
    default:
      return null;
  }
}

/** Detecta se o host é apex (lab.com.br) ou subdomínio (site.lab.com.br). */
function isApexDomain(host: string): boolean {
  // Heurística simples: apex tem 2 partes (lab.com) ou 3 com TLD composto (lab.com.br/.co.uk).
  const parts = host.replace(/^www\./, "").split(".");
  if (parts.length <= 2) return true;
  const composite = new Set(["com.br", "co.uk", "com.au", "com.mx", "co.jp", "com.ar"]);
  const last2 = parts.slice(-2).join(".");
  if (composite.has(last2) && parts.length === 3) return true;
  return false;
}

function DnsRow({ tipo, nome, valor }: { tipo: string; nome: string; valor: string }) {
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(valor);
      toast.success("Valor copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };
  return (
    <div className="grid grid-cols-[60px_80px_1fr_auto] items-center gap-2 text-[11px] py-1.5 border-b border-border last:border-0">
      <span className="font-mono font-semibold text-foreground">{tipo}</span>
      <span className="font-mono text-muted-foreground">{nome}</span>
      <span className="font-mono text-foreground break-all">{valor}</span>
      <Button size="sm" variant="ghost" className="h-6 px-1.5" onClick={copiar}>
        <Copy className="h-3 w-3" />
      </Button>
    </div>
  );
}

function DnsInstructions({
  dominio,
  diag,
}: {
  dominio: string;
  diag: {
    cnames: string[];
    a_records: string[];
    expected_targets: string[];
    verified: boolean;
  } | null;
}) {
  const apex = isApexDomain(dominio);
  return (
    <div className="mt-4 border border-border rounded-xl bg-muted/10 p-4 space-y-3">
      <div>
        <div className="text-xs font-semibold text-foreground mb-1">
          {apex ? "Registro DNS para domínio raiz (apex)" : "Registro DNS para subdomínio"}
        </div>
        <div className="text-[11px] text-muted-foreground">
          Acesse o painel do seu provedor de DNS (Registro.br, GoDaddy, Cloudflare etc.) e adicione:
        </div>
      </div>
      <div className="bg-background border border-border rounded-md p-2">
        <div className="grid grid-cols-[60px_80px_1fr_auto] gap-2 text-[10px] uppercase tracking-wide text-muted-foreground border-b border-border pb-1.5 mb-1">
          <span>Tipo</span>
          <span>Nome</span>
          <span>Valor</span>
          <span></span>
        </div>
        {apex ? (
          <DnsRow tipo="A" nome="@" valor="185.158.133.1" />
        ) : (
          <DnsRow tipo="CNAME" nome={dominio.split(".")[0]} valor="sislac.lovable.app" />
        )}
      </div>
      <div className="text-[11px] text-muted-foreground">
        A propagação do DNS pode levar de alguns minutos até 72 horas.
      </div>

      {diag ? (
        <div className="border-t border-border pt-3 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            {diag.verified ? (
              <>
                <ShieldCheck className="h-3.5 w-3.5 text-success" />
                <span className="text-success">Diagnóstico: DNS apontando corretamente</span>
              </>
            ) : (
              <>
                <ShieldAlert className="h-3.5 w-3.5 text-warning" />
                <span className="text-warning">Diagnóstico: DNS ainda não bate com o esperado</span>
              </>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground">
            <div>
              <span className="font-semibold">CNAME encontrado:</span>{" "}
              <code className="font-mono">{diag.cnames.length ? diag.cnames.join(", ") : "—"}</code>
            </div>
            <div>
              <span className="font-semibold">Registro A encontrado:</span>{" "}
              <code className="font-mono">{diag.a_records.length ? diag.a_records.join(", ") : "—"}</code>
            </div>
            <div>
              <span className="font-semibold">Alvos aceitos:</span>{" "}
              <code className="font-mono">{diag.expected_targets.join(", ")}</code>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}