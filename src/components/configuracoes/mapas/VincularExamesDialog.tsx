// Dialog para vincular exames a um Mapa de Trabalho (N:N).
// UX: lista de exames ativos com busca + checkbox + contador.

import { useEffect, useMemo, useState } from "react";
import { Search, FlaskConical, Check } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  getExamesCatalogoAtivos, subscribeExamesCatalogo,
} from "@/data/exameCatalogoStore";
import {
  getExameIdsDoMapa, setExamesDoMapa, getMapaTrabalhoById,
} from "@/data/mapaTrabalhoStore";

const normalize = (v: string) =>
  v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mapaId: string | null;
  onSaved?: () => void;
}

const VincularExamesDialog = ({ open, onOpenChange, mapaId, onSaved }: Props) => {
  const { toast } = useToast();
  const [, force] = useState(0);
  const [busca, setBusca] = useState("");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [salvando, setSalvando] = useState(false);

  useEffect(() => subscribeExamesCatalogo(() => force((n) => n + 1)), []);

  // Hidrata seleção quando abre
  useEffect(() => {
    if (open && mapaId) {
      setSelecionados(new Set(getExameIdsDoMapa(mapaId)));
      setBusca("");
    }
  }, [open, mapaId]);

  const exames = getExamesCatalogoAtivos();
  const mapa = mapaId ? getMapaTrabalhoById(mapaId) : null;

  const filtrados = useMemo(() => {
    const q = normalize(busca);
    if (!q) return exames;
    return exames.filter(
      (e) => normalize(e.nome).includes(q) || normalize(e.mnemonico).includes(q)
    );
  }, [exames, busca]);

  const toggle = (id: string) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSalvar = async () => {
    if (!mapaId) return;
    setSalvando(true);
    const ok = await setExamesDoMapa(mapaId, Array.from(selecionados));
    setSalvando(false);
    if (ok) {
      toast({ title: "Vínculos atualizados", description: `${selecionados.size} exame(s) vinculado(s).` });
      onSaved?.();
      onOpenChange(false);
    } else {
      toast({ title: "Falha ao salvar vínculos", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary" />
            Vincular exames
          </DialogTitle>
          {mapa && (
            <p className="text-xs text-muted-foreground">
              Mapa: <span className="font-medium text-foreground">{mapa.nome}</span>
            </p>
          )}
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar exame..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{filtrados.length} exame(s) disponíveis</span>
            <Badge variant="secondary">{selecionados.size} selecionado(s)</Badge>
          </div>

          <div className="border border-border rounded-lg max-h-[360px] overflow-auto divide-y divide-border">
            {filtrados.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">Nenhum exame encontrado.</p>
            ) : (
              filtrados.map((e) => {
                const checked = selecionados.has(e.id);
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => toggle(e.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                      checked ? "bg-primary/5" : "hover:bg-muted/30"
                    }`}
                  >
                    <div className={`h-5 w-5 rounded border flex items-center justify-center shrink-0 ${
                      checked ? "bg-primary border-primary text-primary-foreground" : "border-border"
                    }`}>
                      {checked && <Check className="h-3.5 w-3.5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{e.nome}</p>
                      <p className="text-xs text-muted-foreground truncate">{e.mnemonico} {e.material && `• ${e.material}`}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>Cancelar</Button>
          <Button onClick={handleSalvar} disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar vínculos"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default VincularExamesDialog;
