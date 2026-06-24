import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Search,
  Filter,
  CheckCircle2,
  Clock,
  MessageCircle,
  TrendingUp,
  UserCheck,
  Building2,
  Trash2,
  MoreVertical,
  Calendar,
  Eye,
  RefreshCw,
  MapPin,
  User,
  Phone,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, PageSkeleton } from "@/components/superadmin/PageHeader";
import { StatusBadge, type StatusTone } from "@/components/superadmin/StatusBadge";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import StandardDialog from "@/components/ui/standard-dialog";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
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

type InscricaoStatus = 'Nova' | 'Confirmada' | 'Em contato' | 'Qualificada' | 'Implantação' | 'Convertida' | 'Descartada';

interface Lead {
  id: string;
  created_at: string;
  nome_responsavel: string;
  whatsapp: string;
  nome_laboratorio: string;
  cidade: string;
  estado: string;
  quantidade_unidades: string;
  whatsapp_confirmado: boolean;
  status: InscricaoStatus;
  observacoes: string | null;
}

const STATUS_CONFIG: Record<InscricaoStatus, { label: string; tone: StatusTone }> = {
  'Nova': { label: 'Nova', tone: 'pending' },
  'Confirmada': { label: 'Confirmada', tone: 'active' },
  'Em contato': { label: 'Em contato', tone: 'info' },
  'Qualificada': { label: 'Qualificada', tone: 'active' },
  'Implantação': { label: 'Implantação', tone: 'active' },
  'Convertida': { label: 'Convertida', tone: 'active' },
  'Descartada': { label: 'Descartada', tone: 'failed' },
};

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function DataRow({
  label,
  icon: Icon,
  children,
  action,
}: {
  label: string;
  icon: React.ElementType;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 py-3 px-4 -mx-4 rounded-xl hover:bg-muted/40 transition-colors group">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          {label}
        </p>
        <div className="text-sm text-foreground font-medium leading-snug break-words mt-0.5">
          {children}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export default function SuperAdminInscricoes() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("Todos");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isStatusChanging, setIsStatusChanging] = useState(false);

  const loadLeads = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("inscricoes")
        .select("*")
        .order("created_at", { ascending: false });

      if (statusFilter !== "Todos") {
        query = query.eq("status", statusFilter as any);
      }

      if (q) {
        query = query.or(`nome_responsavel.ilike.%${q}%,nome_laboratorio.ilike.%${q}%,whatsapp.ilike.%${q}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setLeads(data as Lead[]);
    } catch (err: any) {
      toast.error("Erro ao carregar inscrições: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeads();
  }, [statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadLeads();
  };

  const updateStatus = async (leadId: string, newStatus: InscricaoStatus) => {
    setIsStatusChanging(true);
    try {
      const { error } = await supabase
        .from("inscricoes")
        .update({ status: newStatus as any })
        .eq("id", leadId);

      if (error) throw error;
      toast.success(`Status atualizado para ${newStatus}`);
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
      if (selectedLead?.id === leadId) setSelectedLead(prev => prev ? { ...prev, status: newStatus } : null);
    } catch (err: any) {
      toast.error("Erro ao atualizar status: " + err.message);
    } finally {
      setIsStatusChanging(false);
    }
  };

  const updateObservations = async (leadId: string, obs: string) => {
    try {
      const { error } = await supabase
        .from("inscricoes")
        .update({ observacoes: obs })
        .eq("id", leadId);

      if (error) throw error;
      toast.success("Observações salvas");
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, observacoes: obs } : l));
    } catch (err: any) {
      toast.error("Erro ao salvar observações: " + err.message);
    }
  };

  const handleDelete = async (leadId: string) => {
    if (!confirm("Deseja realmente excluir esta inscrição?")) return;
    try {
      const { error } = await supabase
        .from("inscricoes")
        .delete()
        .eq("id", leadId);

      if (error) throw error;
      toast.success("Inscrição excluída");
      setLeads(prev => prev.filter(l => l.id !== leadId));
    } catch (err: any) {
      toast.error("Erro ao excluir: " + err.message);
    }
  };

  const convertToClient = async (lead: Lead) => {
    toast.info("A funcionalidade de conversão direta será implementada em breve. Por enquanto, utilize o fluxo de Novo Laboratório.");
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <PageHeader
        eyebrow="Leads e Vendas"
        title="Inscrições"
        description="Gestão de interessados capturados pela landing page."
        actions={
          <Button variant="outline" size="sm" onClick={() => loadLeads()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        }
      />

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4">
        <form onSubmit={handleSearch} className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome, laboratório ou WhatsApp..."
            className="pl-9 h-10"
          />
        </form>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[200px] h-10">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filtrar por Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Todos">Todos os Status</SelectItem>
            {Object.keys(STATUS_CONFIG).map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <PageSkeleton rows={8} />
      ) : leads.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-card rounded-lg border border-dashed border-border">
          <TrendingUp className="h-10 w-10 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">Nenhuma inscrição encontrada</h3>
          <p className="text-sm text-muted-foreground">Novos leads aparecerão aqui assim que preencherem o formulário.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="w-[180px]">Responsável</TableHead>
                <TableHead>Laboratório</TableHead>
                <TableHead>Localização</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead) => (
                <TableRow key={lead.id} className="cursor-pointer hover:bg-muted/30" onClick={() => { setSelectedLead(lead); setIsDetailOpen(true); }}>
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span>{lead.nome_responsavel}</span>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(lead.created_at).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-primary" />
                        {lead.nome_laboratorio}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{lead.quantidade_unidades}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">{lead.cidade} - {lead.estado}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono">{lead.whatsapp}</span>
                      {lead.whatsapp_confirmado && <CheckCircle2 className="h-3.5 w-3.5 text-secondary" />}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge 
                      tone={STATUS_CONFIG[lead.status].tone} 
                      label={STATUS_CONFIG[lead.status].label} 
                    />
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => { setSelectedLead(lead); setIsDetailOpen(true); }}>
                          <Eye className="h-4 w-4 mr-2" />
                          Ver Detalhes
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-primary"
                          onClick={() => convertToClient(lead)}
                        >
                          <UserCheck className="h-4 w-4 mr-2" />
                          Converter Cliente
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={() => handleDelete(lead.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Modal de Detalhes */}
      {selectedLead && (
        <StandardDialog
          open={isDetailOpen}
          onClose={() => setIsDetailOpen(false)}
          icon={<Sparkles className="h-5 w-5 text-primary" />}
          title="Detalhes da Inscrição"
          subtitle={`Capturado em ${new Date(selectedLead.created_at).toLocaleString('pt-BR')}`}
          maxWidth="3xl"
          footer={
            <>
              <Button variant="ghost" className="h-9 rounded-lg" onClick={() => setIsDetailOpen(false)}>
                Fechar
              </Button>
              <Button
                variant="outline"
                className="h-9 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
                onClick={() => handleDelete(selectedLead.id)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir Lead
              </Button>
            </>
          }
        >
          <div className="overflow-y-auto">
            {/* Hero — identidade do lead */}
            <div className="px-6 pt-6 pb-5 border-b border-border/60">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground text-lg font-semibold shadow-[0_8px_24px_-8px_hsl(var(--primary)/0.5)]">
                  {getInitials(selectedLead.nome_responsavel)}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-semibold text-foreground leading-tight truncate">
                    {selectedLead.nome_responsavel}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5 truncate">
                    <Building2 className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{selectedLead.nome_laboratorio}</span>
                    <span className="text-muted-foreground/60">·</span>
                    <span className="text-xs">{selectedLead.quantidade_unidades}</span>
                  </p>
                </div>
                <StatusBadge
                  tone={STATUS_CONFIG[selectedLead.status].tone}
                  label={STATUS_CONFIG[selectedLead.status].label}
                />
              </div>

              {/* Quick actions */}
              <div className="flex flex-wrap gap-2 mt-5">
                <Button
                  size="sm"
                  className="h-9 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/90 shadow-none"
                  onClick={() =>
                    window.open(
                      `https://wa.me/${selectedLead.whatsapp.replace(/\D/g, '')}`,
                      '_blank'
                    )
                  }
                >
                  <MessageCircle className="h-4 w-4 mr-1.5" />
                  Abrir WhatsApp
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 rounded-lg border-border/60"
                  onClick={() => convertToClient(selectedLead)}
                >
                  <UserCheck className="h-4 w-4 mr-1.5 text-primary" />
                  Iniciar Onboarding
                </Button>
              </div>
            </div>

            {/* Conteúdo em duas colunas */}
            <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-0 lg:divide-x lg:divide-border/60">
              {/* Coluna esquerda — Dados de contato */}
              <div className="px-6 py-5">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Informações de Contato
                </p>
                <div className="space-y-0.5">
                  <DataRow
                    label="WhatsApp"
                    icon={Phone}
                    action={
                      selectedLead.whatsapp_confirmado ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-secondary font-semibold uppercase">
                          <CheckCircle2 className="h-3 w-3" />
                          Validado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] text-warning font-semibold uppercase">
                          <Clock className="h-3 w-3" />
                          Pendente
                        </span>
                      )
                    }
                  >
                    <span className="font-mono">{selectedLead.whatsapp}</span>
                  </DataRow>

                  <DataRow label="Responsável" icon={User}>
                    {selectedLead.nome_responsavel}
                  </DataRow>

                  <DataRow label="Laboratório" icon={Building2}>
                    {selectedLead.nome_laboratorio}
                  </DataRow>

                  <DataRow label="Localização" icon={MapPin}>
                    {selectedLead.cidade} - {selectedLead.estado}
                  </DataRow>

                  <DataRow label="Data da Inscrição" icon={Calendar}>
                    {new Date(selectedLead.created_at).toLocaleString('pt-BR')}
                  </DataRow>
                </div>
              </div>

              {/* Coluna direita — Gestão */}
              <div className="px-6 py-5 space-y-5 bg-muted/20">
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Status do Lead
                  </label>
                  <Select
                    disabled={isStatusChanging}
                    value={selectedLead.status}
                    onValueChange={(v) => updateStatus(selectedLead.id, v as InscricaoStatus)}
                  >
                    <SelectTrigger className="w-full h-10 rounded-lg border-border/60 bg-card focus:ring-primary/30">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(STATUS_CONFIG).map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">
                    A alteração é registrada automaticamente.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Notas Internas
                  </label>
                  <Textarea
                    placeholder="Anote detalhes do contato, próximos passos, objeções..."
                    className="h-32 resize-none text-sm rounded-lg border-border/60 bg-card focus:ring-primary/30"
                    defaultValue={selectedLead.observacoes || ''}
                    onBlur={(e) => updateObservations(selectedLead.id, e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground italic">
                    Salvo automaticamente ao sair do campo.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </StandardDialog>
      )}
    </div>
  );
}
