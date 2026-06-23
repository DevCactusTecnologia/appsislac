/**
 * Soroteca 2.0 — Fase 2: Estrutura Física
 *
 * CRUD simples em três colunas (Local → Galeria → Posição).
 * Sem drag-and-drop, sem abstrações desnecessárias.
 */

import { useEffect, useState } from "react";
import { Plus, Trash2, Boxes, Layers, MapPin, Loader2, RefreshCw, Pencil, Snowflake, Thermometer, ListPlus, Hash } from "lucide-react";
import {
  SorotecaDialogHeader,
  SorotecaDialogBody,
  SorotecaDialogFooter as SDFooter,
  Field,
  Section,
} from "@/components/soroteca/SorotecaDialogShell";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { SorotecaShell } from "@/components/soroteca/SorotecaShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import {
  type Galeria,
  type LocalArmazenamento,
  type LocalTipo,
  type PosicaoGaleria,
  atualizarGaleria,
  atualizarLocal,
  criarGaleria,
  criarLocal,
  criarPosicao,
  criarPosicoesEmLote,
  listarGalerias,
  listarLocais,
  listarPosicoes,
  removerGaleria,
  removerLocal,
  removerPosicao,
} from "@/data/sorotecaEstruturaStore";

const TIPOS: { value: LocalTipo; label: string }[] = [
  { value: "geladeira", label: "Geladeira" },
  { value: "freezer", label: "Freezer" },
  { value: "armario", label: "Armário" },
  { value: "sala", label: "Sala" },
  { value: "outro", label: "Outro" },
];

export default function SorotecaEstrutura() {
  const navigate = useNavigate();

  const [locais, setLocais] = useState<LocalArmazenamento[]>([]);
  const [galerias, setGalerias] = useState<Galeria[]>([]);
  const [posicoes, setPosicoes] = useState<PosicaoGaleria[]>([]);

  const [localSel, setLocalSel] = useState<string | null>(null);
  const [galeriaSel, setGaleriaSel] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);

  // dialogs
  const [novoLocalOpen, setNovoLocalOpen] = useState(false);
  const [novaGaleriaOpen, setNovaGaleriaOpen] = useState(false);
  const [novaPosicaoOpen, setNovaPosicaoOpen] = useState(false);
  const [editarLocal, setEditarLocal] = useState<LocalArmazenamento | null>(null);
  const [editarGaleria, setEditarGaleria] = useState<Galeria | null>(null);
  const [confirmar, setConfirmar] = useState<{ tipo: "local" | "galeria" | "posicao"; id: string; nome: string } | null>(null);

  // ---------- carregamento ----------
  async function refreshLocais() {
    setLoading(true);
    const data = await listarLocais();
    setLocais(data);
    setLoading(false);
    if (!data.find((l) => l.id === localSel)) {
      setLocalSel(data[0]?.id ?? null);
    }
  }

  async function refreshGalerias(localId: string | null) {
    if (!localId) {
      setGalerias([]);
      setGaleriaSel(null);
      return;
    }
    const data = await listarGalerias(localId);
    setGalerias(data);
    if (!data.find((g) => g.id === galeriaSel)) {
      setGaleriaSel(data[0]?.id ?? null);
    }
  }

  async function refreshPosicoes(galeriaId: string | null) {
    if (!galeriaId) {
      setPosicoes([]);
      return;
    }
    const data = await listarPosicoes(galeriaId);
    setPosicoes(data);
  }

  useEffect(() => {
    refreshLocais();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    refreshGalerias(localSel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localSel]);

  useEffect(() => {
    refreshPosicoes(galeriaSel);
  }, [galeriaSel]);

  // ---------- deleções ----------
  async function executarRemocao() {
    if (!confirmar) return;
    let res: { ok: boolean; error?: string } = { ok: false };
    if (confirmar.tipo === "local") res = await removerLocal(confirmar.id);
    if (confirmar.tipo === "galeria") res = await removerGaleria(confirmar.id);
    if (confirmar.tipo === "posicao") res = await removerPosicao(confirmar.id);
    if (!res.ok) {
      toast.error(`Não foi possível remover: ${res.error ?? "erro desconhecido"}`);
    } else {
      toast.success("Removido com sucesso");
      if (confirmar.tipo === "local") refreshLocais();
      if (confirmar.tipo === "galeria") refreshGalerias(localSel);
      if (confirmar.tipo === "posicao") refreshPosicoes(galeriaSel);
    }
    setConfirmar(null);
  }

  const localAtual = locais.find((l) => l.id === localSel);
  const galeriaAtual = galerias.find((g) => g.id === galeriaSel);

  return (
    <SorotecaShell
      title="Estrutura Física"
      description="Hierarquia de armazenamento — Local → Galeria → Posição."
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refreshLocais()}>
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/soroteca")}>
            Voltar
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">


        {/* ------------- LOCAIS ------------- */}
        <section className="rounded-lg border bg-card">
          <header className="flex items-center justify-between px-3 py-2 border-b">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              Locais
              <span className="text-xs text-muted-foreground font-normal">({locais.length})</span>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setNovoLocalOpen(true)}>
              <Plus className="h-4 w-4" />
            </Button>
          </header>
          <ul className="max-h-[60vh] overflow-y-auto">
            {loading && (
              <li className="px-3 py-6 text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
              </li>
            )}
            {!loading && locais.length === 0 && (
              <li className="px-3 py-8 text-center text-muted-foreground text-sm">
                Nenhum local cadastrado.
              </li>
            )}
            {locais.map((l) => (
              <li
                key={l.id}
                className={cn(
                  "group flex items-center gap-2 px-3 py-2 border-b last:border-b-0 cursor-pointer text-sm",
                  localSel === l.id ? "bg-muted/60" : "hover:bg-muted/30",
                )}
                onClick={() => setLocalSel(l.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium">{l.nome}</div>
                  <div className="text-[11px] text-muted-foreground capitalize">
                    {l.tipo}
                    {l.temperatura_min != null && l.temperatura_max != null && (
                      <> • {l.temperatura_min}°C a {l.temperatura_max}°C</>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditarLocal(l);
                    }}
                    aria-label="Editar local"
                  >
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmar({ tipo: "local", id: l.id, nome: l.nome });
                    }}
                    aria-label="Remover local"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* ------------- GALERIAS ------------- */}
        <section className="rounded-lg border bg-card">
          <header className="flex items-center justify-between px-3 py-2 border-b">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Layers className="h-4 w-4 text-muted-foreground" />
              Galerias
              <span className="text-xs text-muted-foreground font-normal">({galerias.length})</span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setNovaGaleriaOpen(true)}
              disabled={!localSel}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </header>
          {!localSel ? (
            <div className="px-3 py-8 text-center text-muted-foreground text-sm">
              Selecione um local.
            </div>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto">
              {galerias.length === 0 && (
                <li className="px-3 py-8 text-center text-muted-foreground text-sm">
                  Nenhuma galeria em <strong>{localAtual?.nome}</strong>.
                </li>
              )}
              {galerias.map((g) => (
                <li
                  key={g.id}
                  className={cn(
                    "group flex items-center gap-2 px-3 py-2 border-b last:border-b-0 cursor-pointer text-sm",
                    galeriaSel === g.id ? "bg-muted/60" : "hover:bg-muted/30",
                  )}
                  onClick={() => setGaleriaSel(g.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">{g.nome}</div>
                    <div className="text-[11px] text-muted-foreground">Ordem {g.ordem}</div>
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditarGaleria(g);
                      }}
                      aria-label="Editar galeria"
                    >
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmar({ tipo: "galeria", id: g.id, nome: g.nome });
                      }}
                      aria-label="Remover galeria"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ------------- POSIÇÕES ------------- */}
        <section className="rounded-lg border bg-card">
          <header className="flex items-center justify-between px-3 py-2 border-b">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Boxes className="h-4 w-4 text-muted-foreground" />
              Posições
              <span className="text-xs text-muted-foreground font-normal">({posicoes.length})</span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setNovaPosicaoOpen(true)}
              disabled={!galeriaSel}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </header>
          {!galeriaSel ? (
            <div className="px-3 py-8 text-center text-muted-foreground text-sm">
              Selecione uma galeria.
            </div>
          ) : posicoes.length === 0 ? (
            <div className="px-3 py-8 text-center text-muted-foreground text-sm">
              Nenhuma posição em <strong>{galeriaAtual?.nome}</strong>.
            </div>
          ) : (
            <div className="p-3 grid grid-cols-4 sm:grid-cols-5 gap-1.5 max-h-[60vh] overflow-y-auto">
              {posicoes.map((p) => (
                <div
                  key={p.id}
                  className="group relative rounded-md border bg-background px-2 py-1.5 text-center text-xs"
                >
                  <span className="font-mono">{p.codigo}</span>
                  <button
                    type="button"
                    className="absolute -top-1.5 -right-1.5 hidden group-hover:flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
                    onClick={() => setConfirmar({ tipo: "posicao", id: p.id, nome: p.codigo })}
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ----- dialogs ----- */}
      <NovoLocalDialog
        open={novoLocalOpen}
        onOpenChange={setNovoLocalOpen}
        onCreated={() => refreshLocais()}
      />
      <NovaGaleriaDialog
        open={novaGaleriaOpen}
        onOpenChange={setNovaGaleriaOpen}
        localId={localSel}
        onCreated={() => refreshGalerias(localSel)}
      />
      <NovasPosicoesDialog
        open={novaPosicaoOpen}
        onOpenChange={setNovaPosicaoOpen}
        galeriaId={galeriaSel}
        onCreated={() => refreshPosicoes(galeriaSel)}
      />

      <EditarLocalDialog
        local={editarLocal}
        onOpenChange={(o) => !o && setEditarLocal(null)}
        onSaved={() => refreshLocais()}
      />
      <EditarGaleriaDialog
        galeria={editarGaleria}
        onOpenChange={(o) => !o && setEditarGaleria(null)}
        onSaved={() => refreshGalerias(localSel)}
      />

      <AlertDialog open={!!confirmar} onOpenChange={(open) => !open && setConfirmar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover {confirmar?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Itens filhos (galerias/posições) também serão
              removidos. Itens com amostras alocadas não podem ser apagados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={executarRemocao}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SorotecaShell>
  );

}

// =================================================================
// Subdialogs
// =================================================================

function NovoLocalDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<LocalTipo>("geladeira");
  const [tmin, setTmin] = useState("");
  const [tmax, setTmax] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setNome("");
      setTipo("geladeira");
      setTmin("");
      setTmax("");
    }
  }, [open]);

  async function submit() {
    if (!nome.trim()) {
      toast.error("Informe o nome do local.");
      return;
    }
    setSaving(true);
    const res = await criarLocal({
      nome,
      tipo,
      temperatura_min: tmin ? Number(tmin) : null,
      temperatura_max: tmax ? Number(tmax) : null,
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(`Falha ao criar local: ${res.error ?? "erro"}`);
      return;
    }
    toast.success("Local criado");
    onCreated();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo local</DialogTitle>
          <DialogDescription>Cadastre uma geladeira, freezer, armário ou sala.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label htmlFor="local-nome">Nome</Label>
            <Input
              id="local-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Geladeira 01"
            />
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as LocalTipo)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="tmin">Temp. mín (°C)</Label>
              <Input
                id="tmin"
                type="number"
                value={tmin}
                onChange={(e) => setTmin(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="tmax">Temp. máx (°C)</Label>
              <Input
                id="tmax"
                type="number"
                value={tmax}
                onChange={(e) => setTmax(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NovaGaleriaDialog({
  open,
  onOpenChange,
  localId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  localId: string | null;
  onCreated: () => void;
}) {
  const [nome, setNome] = useState("");
  const [ordem, setOrdem] = useState("0");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setNome("");
      setOrdem("0");
    }
  }, [open]);

  async function submit() {
    if (!localId || !nome.trim()) return;
    setSaving(true);
    const res = await criarGaleria({ local_id: localId, nome, ordem: Number(ordem) || 0 });
    setSaving(false);
    if (!res.ok) {
      toast.error(`Falha ao criar galeria: ${res.error ?? "erro"}`);
      return;
    }
    toast.success("Galeria criada");
    onCreated();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova galeria</DialogTitle>
          <DialogDescription>Subdivisão do local (bandeja, rack, prateleira).</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label htmlFor="g-nome">Nome</Label>
            <Input
              id="g-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Bandeja A"
            />
          </div>
          <div>
            <Label htmlFor="g-ordem">Ordem</Label>
            <Input
              id="g-ordem"
              type="number"
              value={ordem}
              onChange={(e) => setOrdem(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving || !nome.trim()}>
            {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NovasPosicoesDialog({
  open,
  onOpenChange,
  galeriaId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  galeriaId: string | null;
  onCreated: () => void;
}) {
  const [modo, setModo] = useState<"individual" | "lote">("lote");
  const [codigo, setCodigo] = useState("");
  const [prefixo, setPrefixo] = useState("A");
  const [inicio, setInicio] = useState("1");
  const [fim, setFim] = useState("10");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setCodigo("");
      setPrefixo("A");
      setInicio("1");
      setFim("10");
    }
  }, [open]);

  async function submit() {
    if (!galeriaId) return;
    setSaving(true);
    if (modo === "individual") {
      if (!codigo.trim()) {
        toast.error("Informe o código.");
        setSaving(false);
        return;
      }
      const res = await criarPosicao({ galeria_id: galeriaId, codigo });
      setSaving(false);
      if (!res.ok) {
        toast.error(`Falha: ${res.error ?? "erro"}`);
        return;
      }
      toast.success("Posição criada");
    } else {
      const ini = Number(inicio);
      const fi = Number(fim);
      if (!Number.isFinite(ini) || !Number.isFinite(fi) || fi < ini) {
        toast.error("Intervalo inválido.");
        setSaving(false);
        return;
      }
      const res = await criarPosicoesEmLote({ galeria_id: galeriaId, prefixo, inicio: ini, fim: fi });
      setSaving(false);
      if (!res.ok) {
        toast.error(`Falha: ${res.error ?? "erro"}`);
        return;
      }
      toast.success(`${res.total} posições criadas`);
    }
    onCreated();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novas posições</DialogTitle>
          <DialogDescription>Crie posições individualmente ou em lote.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2 text-sm">
          <button
            type="button"
            className={cn(
              "flex-1 rounded-md border px-3 py-1.5",
              modo === "lote" ? "bg-primary text-primary-foreground border-primary" : "bg-card",
            )}
            onClick={() => setModo("lote")}
          >
            Em lote
          </button>
          <button
            type="button"
            className={cn(
              "flex-1 rounded-md border px-3 py-1.5",
              modo === "individual" ? "bg-primary text-primary-foreground border-primary" : "bg-card",
            )}
            onClick={() => setModo("individual")}
          >
            Individual
          </button>
        </div>
        {modo === "individual" ? (
          <div>
            <Label htmlFor="pos-codigo">Código</Label>
            <Input
              id="pos-codigo"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="Ex.: A12"
            />
          </div>
        ) : (
          <div className="grid gap-3">
            <div>
              <Label htmlFor="pref">Prefixo</Label>
              <Input
                id="pref"
                value={prefixo}
                onChange={(e) => setPrefixo(e.target.value)}
                placeholder="A"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Resultado: <span className="font-mono">{prefixo}{inicio}</span> ... <span className="font-mono">{prefixo}{fim}</span>
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="ini">De</Label>
                <Input id="ini" type="number" value={inicio} onChange={(e) => setInicio(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="fi">Até</Label>
                <Input id="fi" type="number" value={fim} onChange={(e) => setFim(e.target.value)} />
              </div>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function EditarLocalDialog({
  local,
  onOpenChange,
  onSaved,
}: {
  local: LocalArmazenamento | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<LocalTipo>("geladeira");
  const [tmin, setTmin] = useState("");
  const [tmax, setTmax] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (local) {
      setNome(local.nome);
      setTipo(local.tipo);
      setTmin(local.temperatura_min != null ? String(local.temperatura_min) : "");
      setTmax(local.temperatura_max != null ? String(local.temperatura_max) : "");
    }
  }, [local]);

  async function submit() {
    if (!local) return;
    if (!nome.trim()) {
      toast.error("Informe o nome do local.");
      return;
    }
    setSaving(true);
    const res = await atualizarLocal(local.id, {
      nome,
      tipo,
      temperatura_min: tmin ? Number(tmin) : null,
      temperatura_max: tmax ? Number(tmax) : null,
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(`Falha ao salvar: ${res.error ?? "erro"}`);
      return;
    }
    toast.success("Local atualizado");
    onSaved();
    onOpenChange(false);
  }

  return (
    <Dialog open={!!local} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar local</DialogTitle>
          <DialogDescription>Atualize os dados de {local?.nome}.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label htmlFor="edit-local-nome">Nome</Label>
            <Input id="edit-local-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as LocalTipo)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="edit-tmin">Temp. mín (°C)</Label>
              <Input id="edit-tmin" type="number" value={tmin} onChange={(e) => setTmin(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="edit-tmax">Temp. máx (°C)</Label>
              <Input id="edit-tmax" type="number" value={tmax} onChange={(e) => setTmax(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditarGaleriaDialog({
  galeria,
  onOpenChange,
  onSaved,
}: {
  galeria: Galeria | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState("");
  const [ordem, setOrdem] = useState("0");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (galeria) {
      setNome(galeria.nome);
      setOrdem(String(galeria.ordem));
    }
  }, [galeria]);

  async function submit() {
    if (!galeria || !nome.trim()) return;
    setSaving(true);
    const res = await atualizarGaleria(galeria.id, { nome, ordem: Number(ordem) || 0 });
    setSaving(false);
    if (!res.ok) {
      toast.error(`Falha ao salvar: ${res.error ?? "erro"}`);
      return;
    }
    toast.success("Galeria atualizada");
    onSaved();
    onOpenChange(false);
  }

  return (
    <Dialog open={!!galeria} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar galeria</DialogTitle>
          <DialogDescription>Atualize os dados de {galeria?.nome}.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label htmlFor="edit-g-nome">Nome</Label>
            <Input id="edit-g-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="edit-g-ordem">Ordem</Label>
            <Input id="edit-g-ordem" type="number" value={ordem} onChange={(e) => setOrdem(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={submit} disabled={saving || !nome.trim()}>
            {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
