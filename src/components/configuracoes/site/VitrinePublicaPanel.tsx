import { useEffect, useMemo, useState } from "react";
import { searchNormalize } from "@/lib/utils";
import { Search, Star, StarOff, Eye, EyeOff, Save, Loader2, Trash2, Plus, ListPlus, ShoppingCart, CalendarClock, Info, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SectionShell from "@/components/configuracoes/_shared/SectionShell";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  getVitrineSettings,
  saveVitrineSettings,
  listExamesPublicosAdmin,
  upsertExamePublico,
  removeExamePublico,
  type ExamePublicoAdmin,
  type VitrineSettings,
} from "@/lib/tenantSite/vitrineStore";
import { getExamesCatalogo } from "@/data/exameCatalogoStore";
import { getItensByTabela } from "@/data/tabelaPrecoStore";

interface Props {
  tenantId: string;
}

export default function VitrinePublicaPanel({ tenantId }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<VitrineSettings>({
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
    permitir_compra_online: false,
    permitir_agendamento: true,
    exigir_aprovacao_manual: true,
    auto_criar_atendimento: false,
  });
  const [publicos, setPublicos] = useState<ExamePublicoAdmin[]>([]);
  const [busca, setBusca] = useState("");
  const buscaDeb = useDebouncedValue(busca, 200);
  const [publicandoTodos, setPublicandoTodos] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    let alive = true;
    (async () => {
      setLoading(true);
      const [s, lst] = await Promise.all([
        getVitrineSettings(tenantId),
        listExamesPublicosAdmin(tenantId),
      ]);
      if (!alive) return;
      if (s) setSettings({ ...s, tenant_id: tenantId });
      setPublicos(lst);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [tenantId]);

  const examesCatalogo = useMemo(() => getExamesCatalogo().filter((e) => e.ativo), []);
  const precosParticular = useMemo(() => getItensByTabela("Própria"), []);
  const precoMap = useMemo(() => new Map(precosParticular.map((p) => [p.exameId, p.valor])), [precosParticular]);
  const publicosMap = useMemo(() => new Map(publicos.map((p) => [p.exame_id, p])), [publicos]);

  const examesFiltrados = useMemo(() => {
    const q = searchNormalize(buscaDeb);
    const base = q
      ? examesCatalogo.filter(
          (e) =>
            searchNormalize(e.nome).includes(q) ||
            searchNormalize((e.mnemonico ?? "")).includes(q),
        )
      : examesCatalogo;
    // Publicados primeiro (destaques antes), depois os demais por nome.
    const ordenados = [...base].sort((a, b) => {
      const pa = publicosMap.get(a.id);
      const pb = publicosMap.get(b.id);
      if (!!pa !== !!pb) return pa ? -1 : 1;
      if (pa && pb) {
        if (pa.destaque !== pb.destaque) return pa.destaque ? -1 : 1;
        if (pa.ordem !== pb.ordem) return pa.ordem - pb.ordem;
      }
      return a.nome.localeCompare(b.nome, "pt-BR");
    });
    return ordenados.slice(0, q ? 100 : 80);
  }, [examesCatalogo, buscaDeb, publicosMap]);

  const handleSaveSettings = async () => {
    setSaving(true);
    const res = await saveVitrineSettings(settings);
    setSaving(false);
    if (res.ok) toast.success("Configuração da vitrine salva");
    else toast.error(res.error ?? "Erro ao salvar");
  };

  const togglePublico = async (exameId: string) => {
    const existing = publicosMap.get(exameId);
    if (existing) {
      const res = await removeExamePublico(tenantId, exameId);
      if (!res.ok) { toast.error(res.error ?? "Erro"); return; }
      setPublicos((prev) => prev.filter((p) => p.exame_id !== exameId));
    } else {
      const res = await upsertExamePublico({ tenant_id: tenantId, exame_id: exameId, ativo: true, destaque: false, ordem: publicos.length, modo_publicacao: "INFORMAR" });
      if (!res.ok) { toast.error(res.error ?? "Erro"); return; }
      setPublicos((prev) => [...prev, { id: crypto.randomUUID(), tenant_id: tenantId, exame_id: exameId, destaque: false, ativo: true, ordem: prev.length, modo_publicacao: "INFORMAR" }]);
    }
  };

  const toggleDestaque = async (exameId: string) => {
    const existing = publicosMap.get(exameId);
    if (!existing) return;
    const next = !existing.destaque;
    const res = await upsertExamePublico({ tenant_id: tenantId, exame_id: exameId, destaque: next, ativo: existing.ativo, ordem: existing.ordem });
    if (!res.ok) { toast.error(res.error ?? "Erro"); return; }
    setPublicos((prev) => prev.map((p) => p.exame_id === exameId ? { ...p, destaque: next } : p));
  };

  const toggleAtivo = async (exameId: string) => {
    const existing = publicosMap.get(exameId);
    if (!existing) return;
    const next = !existing.ativo;
    const res = await upsertExamePublico({ tenant_id: tenantId, exame_id: exameId, destaque: existing.destaque, ativo: next, ordem: existing.ordem });
    if (!res.ok) { toast.error(res.error ?? "Erro"); return; }
    setPublicos((prev) => prev.map((p) => p.exame_id === exameId ? { ...p, ativo: next } : p));
  };

  const setModoPublicacao = async (exameId: string, modo: "COMPRAR" | "AGENDAR" | "INFORMAR") => {
    const existing = publicosMap.get(exameId);
    if (!existing) return;
    const res = await upsertExamePublico({ tenant_id: tenantId, exame_id: exameId, destaque: existing.destaque, ativo: existing.ativo, ordem: existing.ordem, modo_publicacao: modo });
    if (!res.ok) { toast.error(res.error ?? "Erro"); return; }
    setPublicos((prev) => prev.map((p) => p.exame_id === exameId ? { ...p, modo_publicacao: modo } : p));
  };

  const handlePublicarTodos = async () => {
    const candidatos = examesCatalogo.filter((e) => !publicosMap.has(e.id) && (precoMap.get(e.id) ?? 0) > 0);
    if (candidatos.length === 0) {
      toast.info("Nenhum exame novo com preço particular para publicar.");
      return;
    }
    setPublicandoTodos(true);
    let ok = 0;
    let fail = 0;
    let ordemAtual = publicos.length;
    const novos: ExamePublicoAdmin[] = [];
    for (const e of candidatos) {
      const res = await upsertExamePublico({ tenant_id: tenantId, exame_id: e.id, ativo: true, destaque: false, ordem: ordemAtual });
      if (res.ok) {
        novos.push({ id: crypto.randomUUID(), tenant_id: tenantId, exame_id: e.id, destaque: false, ativo: true, ordem: ordemAtual });
        ordemAtual += 1;
        ok += 1;
      } else {
        fail += 1;
      }
    }
    if (novos.length) setPublicos((prev) => [...prev, ...novos]);
    setPublicandoTodos(false);
    if (ok && !fail) toast.success(`${ok} exame(s) publicado(s) na landing.`);
    else if (ok && fail) toast.warning(`${ok} publicado(s), ${fail} falharam.`);
    else toast.error("Não foi possível publicar os exames.");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionShell
        icon={<Star className="h-5 w-5 text-primary" />}
        title="Vitrine de exames"
        description="Apresentação dos exames na página pública do laboratório."
        actions={
          <Button size="sm" onClick={handleSaveSettings} disabled={saving}>
            <Save className="h-3.5 w-3.5 mr-1.5" /> {saving ? "Salvando..." : "Salvar"}
          </Button>
        }
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-3">
            <Field label="Título da vitrine">
              <Input
                value={settings.titulo_vitrine}
                onChange={(e) => setSettings((s) => ({ ...s, titulo_vitrine: e.target.value.slice(0, 120) }))}
              />
            </Field>
            <Field label="Descrição">
              <Textarea
                rows={3}
                value={settings.descricao_vitrine}
                onChange={(e) => setSettings((s) => ({ ...s, descricao_vitrine: e.target.value.slice(0, 500) }))}
              />
            </Field>
            <Field label="WhatsApp para contato (opcional)">
              <Input
                value={settings.whatsapp_contato}
                onChange={(e) => setSettings((s) => ({ ...s, whatsapp_contato: e.target.value.slice(0, 20) }))}
                placeholder="5511999999999"
              />
            </Field>
          </div>
          <div className="space-y-2">
            <ToggleRow label="Exibir vitrine de exames" checked={settings.exibir_exames}
              onChange={(v) => setSettings((s) => ({ ...s, exibir_exames: v }))} />
            <ToggleRow label="Permitir reserva pelo site" checked={settings.permitir_reserva}
              onChange={(v) => setSettings((s) => ({ ...s, permitir_reserva: v }))} />
            <ToggleRow label="Mostrar preços particulares" checked={settings.mostrar_preco}
              onChange={(v) => setSettings((s) => ({ ...s, mostrar_preco: v }))} />
            <p className="text-[11px] text-muted-foreground mt-2">
              Apenas o preço da tabela <b>Particular</b> é exposto publicamente. Preços de convênio nunca aparecem na landing.
            </p>
          </div>
        </div>
      </SectionShell>

      <SectionShell
        icon={<Settings2 className="h-5 w-5 text-primary" />}
        title="Compras & Agendamento"
        description="Toggles centrais do fluxo Web → Atendimento. Source of truth única — não duplicar em outras telas."
        actions={
          <Button size="sm" onClick={handleSaveSettings} disabled={saving}>
            <Save className="h-3.5 w-3.5 mr-1.5" /> {saving ? "Salvando..." : "Salvar"}
          </Button>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <ToggleRow
            label="Permitir compra online (checkout + pagamento)"
            checked={!!settings.permitir_compra_online}
            onChange={(v) => setSettings((s) => ({ ...s, permitir_compra_online: v }))}
          />
          <ToggleRow
            label="Permitir agendamento sem pagamento"
            checked={settings.permitir_agendamento ?? true}
            onChange={(v) => setSettings((s) => ({ ...s, permitir_agendamento: v }))}
          />
          <ToggleRow
            label="Exigir aprovação manual da recepção"
            checked={settings.exigir_aprovacao_manual ?? true}
            onChange={(v) => setSettings((s) => ({ ...s, exigir_aprovacao_manual: v }))}
          />
          <ToggleRow
            label="Auto-criar atendimento ao confirmar pagamento"
            checked={!!settings.auto_criar_atendimento}
            onChange={(v) => setSettings((s) => ({ ...s, auto_criar_atendimento: v }))}
          />
        </div>
        <p className="text-[11px] text-muted-foreground mt-3">
          O fluxo real de pagamento (Mercado Pago / Pix) será conectado na próxima onda. Estes toggles já controlam a semântica do site e dos badges em <b>/pedidos-site</b>.
        </p>
      </SectionShell>

      <SectionShell
        icon={<Eye className="h-5 w-5 text-primary" />}
        title="Exames disponíveis na landing"
        description={`${publicos.length} exame(s) publicado(s). Marque para incluir na landing e destaque os principais.`}
        toolbar={
          <div className="flex items-center gap-2 w-full">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar exame no catálogo..." className="pl-8" />
            </div>
            <Button size="sm" variant="outline" onClick={handlePublicarTodos} disabled={publicandoTodos}>
              {publicandoTodos ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <ListPlus className="h-3.5 w-3.5 mr-1.5" />}
              Publicar todos
            </Button>
          </div>
        }
      >
        <div className="space-y-1 max-h-[55vh] overflow-y-auto">
          {examesFiltrados.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">Nenhum exame encontrado.</p>
          ) : examesFiltrados.map((e) => {
            const pub = publicosMap.get(e.id);
            const preco = precoMap.get(e.id) ?? 0;
            return (
              <div key={e.id} className="flex items-center justify-between gap-2 border border-border rounded-lg px-3 py-2 bg-card">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{e.nome}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {e.mnemonico} · Particular: {preco > 0 ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(preco) : "sem preço"}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {pub ? (
                    <>
                      <Select value={pub.modo_publicacao ?? "INFORMAR"} onValueChange={(v) => setModoPublicacao(e.id, v as "COMPRAR" | "AGENDAR" | "INFORMAR")}>
                        <SelectTrigger className="h-8 w-[130px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="INFORMAR"><span className="inline-flex items-center gap-1.5"><Info className="h-3 w-3" /> Informar</span></SelectItem>
                          <SelectItem value="AGENDAR"><span className="inline-flex items-center gap-1.5"><CalendarClock className="h-3 w-3" /> Agendar</span></SelectItem>
                          <SelectItem value="COMPRAR"><span className="inline-flex items-center gap-1.5"><ShoppingCart className="h-3 w-3" /> Comprar</span></SelectItem>
                        </SelectContent>
                      </Select>
                      <Button size="sm" variant="ghost" onClick={() => toggleDestaque(e.id)} title={pub.destaque ? "Remover destaque" : "Marcar destaque"}>
                        {pub.destaque ? <Star className="h-4 w-4 text-warning fill-warning" /> : <StarOff className="h-4 w-4" />}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => toggleAtivo(e.id)} title={pub.ativo ? "Desativar" : "Ativar"}>
                        {pub.ativo ? <Eye className="h-4 w-4 text-success" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => togglePublico(e.id)} title="Remover">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => togglePublico(e.id)} disabled={preco <= 0} title={preco <= 0 ? "Cadastre o preço particular primeiro" : "Publicar"}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Publicar
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </SectionShell>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-2 border border-border rounded-lg px-3 py-2">
      <Label className="text-sm">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
