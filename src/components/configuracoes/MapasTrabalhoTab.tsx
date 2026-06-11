// ============================================================================
// OWNERSHIP OFICIAL — Mapa de Trabalho (workflow operacional de bancada).
// Lista, busca, criar, editar, duplicar, vincular exames, ativar/desativar e
// excluir. NÃO controla ciência (VR/metodologia/cálculo/snapshot).
// Catch-all = flag explícita `isCatchAll` (não mais regex sobre o nome).
// Cardinalidade: 1 exame → 0 ou 1 mapa (UNIQUE em mapa_exames.exame_id).
// ============================================================================

import { useEffect, useMemo, useState } from "react";
import {
  FileText, Plus, Search, MoreVertical, Edit, Copy,
  Trash2, FlaskConical, Power,
} from "lucide-react";
import SectionShell from "@/components/configuracoes/_shared/SectionShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  getMapasTrabalho, subscribeMapasTrabalho,
  removeMapaTrabalho, updateMapaTrabalho, duplicarMapaTrabalho,
  getExameIdsDoMapa, getMapaIdDoExame, type MapaTrabalho,
} from "@/data/mapaTrabalhoStore";
import { getExamesCatalogoAtivos } from "@/data/exameCatalogoStore";
import MapaTrabalhoDialog from "./mapas/MapaTrabalhoDialog";
import VincularExamesDialog from "./mapas/VincularExamesDialog";
import { useEnsureStore } from "@/hooks/useEnsureStore";

const normalize = (v: string) =>
  v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/** Identifica o mapa "padrão" (catch-all) oficial via flag explícita. */
const isMapaPadrao = (m: MapaTrabalho) => m.tipo === "LOTE" && m.isCatchAll;

const tipoLabel: Record<string, string> = {
  INDIVIDUAL: "Individual",
  LOTE: "Lote",
};

const MapasTrabalhoTab = () => {
  useEnsureStore("mapasTrabalho");

  const { toast } = useToast();
  const { user } = useAuth();
  const [, force] = useState(0);
  const [busca, setBusca] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MapaTrabalho | null>(null);
  const [vincularOpen, setVincularOpen] = useState(false);
  const [vincularMapaId, setVincularMapaId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<MapaTrabalho | null>(null);

  useEffect(() => subscribeMapasTrabalho(() => force((n) => n + 1)), []);

  const mapas = getMapasTrabalho();

  const filtrados = useMemo(() => {
    const q = normalize(busca);
    if (!q) return mapas;
    return mapas.filter(
      (m) => normalize(m.nome).includes(q) || normalize(m.descricao).includes(q)
    );
  }, [mapas, busca]);

  const handleNovo = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const handleEditar = (m: MapaTrabalho) => {
    setEditing(m);
    setDialogOpen(true);
  };

  const handleVincular = (m: MapaTrabalho) => {
    setVincularMapaId(m.id);
    setVincularOpen(true);
  };

  const handleDuplicar = async (m: MapaTrabalho) => {
    const novo = await duplicarMapaTrabalho(m.id);
    if (novo) toast({ title: "Mapa duplicado", description: novo.nome });
    else toast({ title: "Falha ao duplicar", variant: "destructive" });
  };

  const handleToggle = async (m: MapaTrabalho) => {
    const ok = await updateMapaTrabalho(m.id, { ativo: !m.ativo });
    if (ok) toast({ title: m.ativo ? "Mapa inativado" : "Mapa ativado" });
  };

  const handleExcluir = async () => {
    if (!confirmDelete) return;
    if (confirmDelete.sistema) {
      toast({ title: "Mapa do sistema não pode ser excluído", variant: "destructive" });
      setConfirmDelete(null);
      return;
    }
    const ok = await removeMapaTrabalho(confirmDelete.id);
    setConfirmDelete(null);
    if (ok) toast({ title: "Mapa excluído" });
    else toast({ title: "Falha ao excluir", variant: "destructive" });
  };

  return (
    <>
      <SectionShell
        icon={<FileText className="h-5 w-5 text-primary" />}
        title="Mapas de Trabalho — Workflow operacional"
        description="Templates do fluxo de bancada (triagem, agrupamento, ordem operacional e impressão para o analista). Não controlam metodologia, unidade, VR ou cálculo — esses pertencem ao Layout Científico do exame."
        meta={<Badge variant="secondary" className="text-[10px]">{mapas.length} mapa(s)</Badge>}
        actions={
          <Button onClick={handleNovo} size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> Novo mapa
          </Button>
        }
        toolbar={
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar mapa por nome ou descrição..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9"
            />
          </div>
        }
        bodyless
      >
        {filtrados.length === 0 ? (
          <div className="py-16 px-6 text-center">
            <div className="mx-auto h-12 w-12 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
              <FileText className="h-6 w-6 text-muted-foreground/60" />
            </div>
            <p className="text-sm font-medium text-foreground">
              {busca ? "Nenhum mapa encontrado" : "Nenhum mapa cadastrado"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {busca ? "Tente outro termo de busca." : "Clique em \"Novo mapa\" para começar."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtrados.map((m) => {
              let qtdExames: number;
              if (isMapaPadrao(m)) {
                // Mapa padrão = todos os exames ativos SEM vínculo a qualquer mapa.
                const ativos = getExamesCatalogoAtivos();
                qtdExames = ativos.filter((ex) => getMapaIdDoExame(ex.id) === null).length;
              } else {
                qtdExames = getExameIdsDoMapa(m.id).length;
              }
              return (
                <div
                  key={m.id}
                  className="px-5 sm:px-6 py-3.5 flex items-center gap-3 hover:bg-muted/20 transition-colors"
                >
                  <div className={`p-2 rounded-lg shrink-0 ${m.ativo ? "bg-primary/10" : "bg-muted"}`}>
                    <FileText className={`h-4 w-4 ${m.ativo ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-foreground truncate">{m.nome}</p>
                      <Badge variant="outline" className="text-[10px]">{tipoLabel[m.tipo]}</Badge>
                      {isMapaPadrao(m) && <Badge variant="secondary" className="text-[10px]">Padrão</Badge>}
                      {m.sistema && <Badge variant="secondary" className="text-[10px]">Sistema</Badge>}
                      {!m.ativo && <Badge variant="secondary" className="text-[10px]">Inativo</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {qtdExames} exame(s) {isMapaPadrao(m) ? "automaticamente atribuído(s)" : "vinculado(s)"}{m.descricao ? ` • ${m.descricao}` : ""}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => handleEditar(m)}>
                        <Edit className="h-3.5 w-3.5 mr-2" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleVincular(m)}>
                        <FlaskConical className="h-3.5 w-3.5 mr-2" /> Vincular exames
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDuplicar(m)}>
                        <Copy className="h-3.5 w-3.5 mr-2" /> Duplicar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleToggle(m)}>
                        <Power className="h-3.5 w-3.5 mr-2" /> {m.ativo ? "Inativar" : "Ativar"}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => !m.sistema && setConfirmDelete(m)}
                        disabled={m.sistema}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>
        )}
      </SectionShell>

      <MapaTrabalhoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mapa={editing}
        criadoPor={user?.email ?? ""}
        onSaved={(novo) => {
          // Para mapas novos, abre direto o vínculo de exames
          if (!editing) {
            setVincularMapaId(novo.id);
            setVincularOpen(true);
          }
        }}
      />

      <VincularExamesDialog
        open={vincularOpen}
        onOpenChange={setVincularOpen}
        mapaId={vincularMapaId}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir mapa de trabalho?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{confirmDelete?.nome}</strong> será excluído permanentemente.
              Os vínculos com exames também serão removidos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleExcluir} className="bg-destructive hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default MapasTrabalhoTab;
