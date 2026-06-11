import { useEffect, useRef, useState } from "react";
import { Save, Loader2, Image as ImageIcon, Palette, Upload, X, Sparkles, Search, LayoutTemplate, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import SectionShell from "@/components/configuracoes/_shared/SectionShell";
import { getVitrineSettings, saveVitrineSettings, type VitrineSettings } from "@/lib/tenantSite/vitrineStore";
import { LANDING_THEME_LIST } from "@/lib/tenantSite/themePresets";
import { uploadTenantAsset, removeTenantAsset, type TenantAssetKind } from "@/lib/tenantSite/uploadAsset";

interface Props {
  tenantId: string;
}

export default function IdentidadeVisualPanel({ tenantId }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<VitrineSettings | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    let alive = true;
    (async () => {
      setLoading(true);
      const s = await getVitrineSettings(tenantId);
      if (!alive) return;
      setSettings(
        s ?? {
          tenant_id: tenantId,
          exibir_exames: false,
          permitir_reserva: true,
          mostrar_preco: true,
          titulo_vitrine: "Nossos exames",
          descricao_vitrine: "",
          whatsapp_contato: "",
          tema: "indigo",
          logo_url: null,
          favicon_url: null,
          seo_title: "",
          seo_description: "",
          og_image_url: null,
          hero_image_url: null,
          sobre_image_url: null,
          servicos_images: {},
          unidades_images: {},
          secoes_visiveis: {},
        }
      );
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [tenantId]);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    const res = await saveVitrineSettings(settings);
    setSaving(false);
    if (res.ok) toast.success("Identidade visual salva");
    else toast.error(res.error ?? "Erro ao salvar");
  };

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const servicos = (settings.servicos_images ?? {}) as Record<string, string | null>;
  const unidades = (settings.unidades_images ?? {}) as Record<string, string | null>;
  const secoes = (settings.secoes_visiveis ?? {}) as Record<string, boolean>;
  const isSecaoVisivel = (key: string) => secoes[key] !== false;
  const setSecaoVisivel = (key: string, visivel: boolean) =>
    setSettings((s) => (s ? { ...s, secoes_visiveis: { ...(s.secoes_visiveis ?? {}), [key]: visivel } } : s));
  const setServicoImg = (key: string, url: string | null) =>
    setSettings((s) => (s ? { ...s, servicos_images: { ...(s.servicos_images ?? {}), [key]: url } } : s));
  const setUnidadeImg = (key: string, url: string | null) =>
    setSettings((s) => (s ? { ...s, unidades_images: { ...(s.unidades_images ?? {}), [key]: url } } : s));

  return (
    <SectionShell
      icon={<Sparkles className="h-5 w-5 text-primary" />}
      title="Identidade visual & tema"
      description="Logo, favicon e cor principal aplicados na página pública. O app interno não é afetado."
      actions={
        <Button size="sm" onClick={handleSave} disabled={saving}>
          <Save className="h-3.5 w-3.5 mr-1.5" /> {saving ? "Salvando..." : "Salvar"}
        </Button>
      }
    >
      <div className="space-y-5">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <ImageIcon className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold text-foreground">Logo & favicon</h4>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <AssetUploader
              tenantId={tenantId}
              kind="logo"
              label="Logo do laboratório"
              hint="PNG ou SVG, fundo transparente. Exibido no topo da landing."
              currentUrl={settings.logo_url}
              onChange={(url) => setSettings((s) => (s ? { ...s, logo_url: url } : s))}
              previewClassName="h-16 w-16 rounded-full"
              onPersistRemove={async () => { await saveVitrineSettings({ ...settings, logo_url: null }); }}
            />
            <AssetUploader
              tenantId={tenantId}
              kind="favicon"
              label="Favicon"
              hint="ICO, PNG ou SVG quadrado (32×32 ou 64×64). Aparece na aba do navegador."
              currentUrl={settings.favicon_url}
              onChange={(url) => setSettings((s) => (s ? { ...s, favicon_url: url } : s))}
              previewClassName="h-12 w-12 rounded-md"
              onPersistRemove={async () => { await saveVitrineSettings({ ...settings, favicon_url: null }); }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            Lembre-se de clicar em <b>Salvar</b> depois de trocar as imagens.
          </p>
        </div>

        <div className="pt-5 border-t border-border">
          <div className="flex items-center gap-2 mb-3">
            <Palette className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold text-foreground">Paleta de cores da landing</h4>
          </div>
          <p className="text-[11px] text-muted-foreground mb-3">
            Cor principal aplicada em botões, destaques e brilhos da página pública.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {LANDING_THEME_LIST.map((t) => {
              const selected = settings.tema === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSettings((s) => (s ? { ...s, tema: t.id } : s))}
                  className={`group flex flex-col items-center gap-1.5 rounded-lg border px-2 py-3 transition-all ${
                    selected
                      ? "border-foreground/60 bg-accent shadow-sm"
                      : "border-border hover:border-foreground/30 hover:bg-accent/40"
                  }`}
                  aria-pressed={selected}
                >
                  <span
                    className="h-8 w-8 rounded-full ring-2 ring-background shadow-sm"
                    style={{ backgroundColor: t.swatch }}
                  />
                  <span className="text-[11px] font-medium text-foreground">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ============ SEO & compartilhamento ============ */}
        <div className="pt-5 border-t border-border">
          <div className="flex items-center gap-2 mb-3">
            <Search className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold text-foreground">SEO & compartilhamento</h4>
          </div>
          <p className="text-[11px] text-muted-foreground mb-3">
            Define como a landing aparece no Google e em redes sociais (WhatsApp, Facebook, Instagram).
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Título da aba (SEO)</Label>
              <Input
                value={settings.seo_title ?? ""}
                onChange={(e) => setSettings((s) => (s ? { ...s, seo_title: e.target.value.slice(0, 70) } : s))}
                placeholder="Ex.: Lab São Lucas — análises clínicas em Teresópolis"
                maxLength={70}
              />
              <p className="text-[10px] text-muted-foreground">{(settings.seo_title ?? "").length}/70 caracteres recomendados.</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Descrição (meta)</Label>
              <Textarea
                value={settings.seo_description ?? ""}
                onChange={(e) => setSettings((s) => (s ? { ...s, seo_description: e.target.value.slice(0, 160) } : s))}
                placeholder="Resumo curto que aparece nos resultados do Google e em compartilhamentos."
                rows={3}
                maxLength={160}
              />
              <p className="text-[10px] text-muted-foreground">{(settings.seo_description ?? "").length}/160 caracteres recomendados.</p>
            </div>
            <div className="lg:col-span-2">
              <AssetUploader
                tenantId={tenantId}
                kind="og"
                label="Imagem para compartilhamento (Open Graph)"
                hint="JPG/PNG 1200×630 recomendado. Aparece quando alguém compartilha o link no WhatsApp, Facebook etc."
                currentUrl={settings.og_image_url ?? null}
                onChange={(url) => setSettings((s) => (s ? { ...s, og_image_url: url } : s))}
                previewClassName="h-16 w-28 rounded-md"
                onPersistRemove={async () => { await saveVitrineSettings({ ...settings, og_image_url: null }); }}
              />
            </div>
          </div>
        </div>

        {/* ============ Seções visíveis na landing ============ */}
        <div className="pt-5 border-t border-border">
          <div className="flex items-center gap-2 mb-3">
            <Eye className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold text-foreground">Seções visíveis na landing</h4>
          </div>
          <p className="text-[11px] text-muted-foreground mb-3">
            Ative ou desative cada seção da página pública. O Hero (topo) e o rodapé são sempre exibidos.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              { key: "sobre", label: "Sobre nós", desc: "História do laboratório com imagem." },
              { key: "servicos", label: "Cards de serviços", desc: "Resultados, coleta, unidades e exames." },
              { key: "exames", label: "Vitrine de exames", desc: "Lista pública de exames disponíveis." },
              { key: "convenios", label: "Convênios", desc: "Faixa com convênios aceitos." },
              { key: "unidades", label: "Unidades", desc: "Cards com fotos das unidades." },
              { key: "depoimentos", label: "Depoimentos", desc: "Avaliações de pacientes." },
            ].map((s) => {
              const ativa = isSecaoVisivel(s.key);
              return (
                <label
                  key={s.key}
                  className="flex items-start justify-between gap-3 border border-border rounded-lg p-3 bg-card cursor-pointer hover:border-foreground/30 transition-colors"
                >
                  <div className="flex items-start gap-2 min-w-0">
                    {ativa ? (
                      <Eye className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground">{s.label}</div>
                      <div className="text-[11px] text-muted-foreground leading-snug">{s.desc}</div>
                    </div>
                  </div>
                  <Switch
                    checked={ativa}
                    onCheckedChange={(v) => setSecaoVisivel(s.key, v)}
                  />
                </label>
              );
            })}
          </div>
        </div>

        {/* ============ Imagens da landing ============ */}
        <div className="pt-5 border-t border-border">
          <div className="flex items-center gap-2 mb-3">
            <LayoutTemplate className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold text-foreground">Imagens da landing</h4>
          </div>
          <p className="text-[11px] text-muted-foreground mb-3">
            Substitua as imagens de demonstração pelas fotos do seu laboratório. Se nenhuma for enviada, usamos uma imagem padrão.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <AssetUploader
              tenantId={tenantId}
              kind="hero"
              label="Hero (topo da página)"
              hint="JPG horizontal. Foto da equipe ou da fachada."
              currentUrl={settings.hero_image_url ?? null}
              onChange={(url) => setSettings((s) => (s ? { ...s, hero_image_url: url } : s))}
              previewClassName="h-16 w-28 rounded-md"
              onPersistRemove={async () => { await saveVitrineSettings({ ...settings, hero_image_url: null }); }}
            />
            <AssetUploader
              tenantId={tenantId}
              kind="sobre"
              label="Seção 'Sobre nós'"
              hint="JPG quadrado/horizontal. Imagem que ilustra a história."
              currentUrl={settings.sobre_image_url ?? null}
              onChange={(url) => setSettings((s) => (s ? { ...s, sobre_image_url: url } : s))}
              previewClassName="h-16 w-28 rounded-md"
              onPersistRemove={async () => { await saveVitrineSettings({ ...settings, sobre_image_url: null }); }}
            />
          </div>

          <div className="mt-5">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Cards de serviços</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { key: "resultados", kind: "servico-resultados" as const, label: "Resultados de exames" },
                { key: "coleta", kind: "servico-coleta" as const, label: "Coleta domiciliar" },
                { key: "unidades", kind: "servico-unidades" as const, label: "Nossas unidades" },
                { key: "exames", kind: "servico-exames" as const, label: "Exames disponíveis" },
              ].map((s) => (
                <AssetUploader
                  key={s.key}
                  tenantId={tenantId}
                  kind={s.kind}
                  label={s.label}
                  hint="Imagem de fundo do card."
                  currentUrl={servicos[s.key] ?? null}
                  onChange={(url) => setServicoImg(s.key, url)}
                  previewClassName="h-14 w-20 rounded-md"
                  onPersistRemove={async () => {
                    const next = { ...servicos, [s.key]: null };
                    await saveVitrineSettings({ ...settings, servicos_images: next });
                  }}
                />
              ))}
            </div>
          </div>

          <div className="mt-5">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Unidades</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { key: "matriz", kind: "unidade-matriz" as const, label: "Matriz" },
                { key: "shopping", kind: "unidade-shopping" as const, label: "Filial Shopping" },
                { key: "clinica", kind: "unidade-clinica" as const, label: "Clínica" },
              ].map((u) => (
                <AssetUploader
                  key={u.key}
                  tenantId={tenantId}
                  kind={u.kind}
                  label={u.label}
                  hint="Foto da fachada ou interior."
                  currentUrl={unidades[u.key] ?? null}
                  onChange={(url) => setUnidadeImg(u.key, url)}
                  previewClassName="h-14 w-20 rounded-md"
                  onPersistRemove={async () => {
                    const next = { ...unidades, [u.key]: null };
                    await saveVitrineSettings({ ...settings, unidades_images: next });
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </SectionShell>
  );
}

function AssetUploader({
  tenantId, kind, label, hint, currentUrl, onChange, previewClassName, onPersistRemove,
}: {
  tenantId: string;
  kind: TenantAssetKind;
  label: string;
  hint: string;
  currentUrl: string | null;
  onChange: (url: string | null) => void;
  previewClassName: string;
  onPersistRemove?: () => Promise<void> | void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handlePick = () => inputRef.current?.click();

  const handleFile = async (file: File) => {
    setBusy(true);
    const res = await uploadTenantAsset({ tenantId, kind, file });
    setBusy(false);
    if (res.ok === false) { toast.error(res.error); return; }
    if (currentUrl) await removeTenantAsset(currentUrl);
    onChange(res.url);
    toast.success("Imagem enviada");
  };

  const handleRemove = async () => {
    setBusy(true);
    try {
      if (currentUrl) await removeTenantAsset(currentUrl);
      onChange(null);
      if (onPersistRemove) await onPersistRemove();
      toast.success("Imagem removida — voltou ao padrão");
    } catch {
      toast.error("Não foi possível remover");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border border-border rounded-lg p-3 space-y-2 bg-card">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Label className="text-sm">{label}</Label>
          <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className={`flex items-center justify-center bg-muted overflow-hidden border border-border ${previewClassName}`}>
          {currentUrl ? (
            <img src={currentUrl} alt={label} className="h-full w-full object-contain" />
          ) : (
            <ImageIcon className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="flex flex-col gap-1.5 flex-1">
          <Button type="button" size="sm" variant="outline" onClick={handlePick} disabled={busy} className="justify-start">
            {busy ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
            {currentUrl ? "Trocar imagem" : "Enviar imagem"}
          </Button>
          {currentUrl && (
            <Button type="button" size="sm" variant="ghost" onClick={handleRemove} disabled={busy} className="justify-start text-destructive hover:text-destructive">
              <X className="h-3.5 w-3.5 mr-1.5" /> Remover
            </Button>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon,image/vnd.microsoft.icon"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
