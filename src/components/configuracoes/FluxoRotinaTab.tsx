import { useEffect, useState } from "react";
import { FlaskConical, Droplet, Microscope, ClipboardCheck, ShieldAlert, Building2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  getLabConfig,
  saveLabConfig,
  subscribeLabConfig,
} from "@/data/labConfigStore";

/**
 * Aba "Fluxo da Rotina" — permite ao admin do laboratório desativar as etapas
 * de "Registrar coleta" e "Analisar amostras". Quando desligado, o menu
 * Rotina passa a ter apenas "Resultados" e o sistema registra na auditoria
 * que não houve registro de coleta nem registro de análise.
 *
 * A flag é persistida em `tenant_lab_config.rotina_coleta_analise_enabled`
 * e aplicada imediatamente em toda a UI (sidebar, rotas) e no banco
 * (trigger `atendimento_exames_short_circuit_rotina`).
 */
const FluxoRotinaTab = () => {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState<boolean>(
    () => getLabConfig().rotinaColetaAnaliseEnabled !== false,
  );
  const [autoTerc, setAutoTerc] = useState<boolean>(
    () => getLabConfig().terceirizadoRecebimentoAutomatico === true,
  );
  const [saving, setSaving] = useState(false);
  const [savingTerc, setSavingTerc] = useState(false);

  useEffect(() => {
    const unsub = subscribeLabConfig(() => {
      const cfg = getLabConfig();
      setEnabled(cfg.rotinaColetaAnaliseEnabled !== false);
      setAutoTerc(cfg.terceirizadoRecebimentoAutomatico === true);
    });
    return unsub;
  }, []);

  const handleToggle = async (next: boolean) => {
    setSaving(true);
    const previous = enabled;
    setEnabled(next); // otimista
    try {
      const current = getLabConfig();
      await saveLabConfig({ ...current, rotinaColetaAnaliseEnabled: next });
      toast({
        title: next ? "Rotina completa ativada" : "Rotina simplificada ativada",
        description: next
          ? "As etapas de coleta e análise estão disponíveis no menu Rotina."
          : "Novos exames serão liberados direto para Resultado. A auditoria registrará a ausência de coleta e análise.",
      });
    } catch (err) {
      setEnabled(previous);
      toast({
        title: "Não foi possível salvar",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAutoTerc = async (next: boolean) => {
    setSavingTerc(true);
    const previous = autoTerc;
    setAutoTerc(next);
    try {
      const current = getLabConfig();
      await saveLabConfig({ ...current, terceirizadoRecebimentoAutomatico: next });
      toast({
        title: next ? "Recebimento automático ativado" : "Recebimento manual ativado",
        description: next
          ? "Exames terceirizados serão marcados como finalizados automaticamente ao abrir Inserir Resultado."
          : "O usuário precisará clicar em 'Marcar como recebido' para cada exame terceirizado.",
      });
    } catch (err) {
      setAutoTerc(previous);
      toast({
        title: "Não foi possível salvar",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSavingTerc(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-primary/10 shrink-0">
            <FlaskConical className="h-5 w-5 text-primary" strokeWidth={1.75} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-foreground">
                  Registrar coleta e analisar amostras
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Quando ativado, o menu <strong>Rotina</strong> exibe as três
                  etapas: Coletas, Análise e Resultados. Quando desativado,
                  apenas <strong>Resultados</strong> aparece — exames vão direto
                  do atendimento para a liberação do laudo.
                </p>
              </div>
              <Switch
                checked={enabled}
                disabled={saving}
                onCheckedChange={handleToggle}
                aria-label="Ativar etapas de coleta e análise"
              />
            </div>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <FluxoItem
                icon={Droplet}
                label="Coletas"
                active={enabled}
                hint="/registrar-coleta"
              />
              <FluxoItem
                icon={Microscope}
                label="Análise"
                active={enabled}
                hint="/analisar-amostra"
              />
              <FluxoItem
                icon={ClipboardCheck}
                label="Resultados"
                active
                hint="/resultados"
              />
            </div>

            {!enabled && (
              <div className="mt-5 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-4">
                <ShieldAlert
                  className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
                  strokeWidth={2}
                />
                <div className="text-xs text-amber-900 dark:text-amber-200 space-y-1">
                  <p className="font-bold">Modo simplificado ativo</p>
                  <p>
                    Novos exames são criados com data de coleta e análise iguais
                    ao momento do atendimento. A auditoria de cada exame
                    registrará automaticamente <em>“Não houve registro de
                    coleta”</em> e <em>“Não houve registro da análise”</em>.
                  </p>
                  <p>
                    Atendimentos existentes que ainda estão pendentes nas etapas
                    antigas precisam ser finalizados manualmente antes — esta
                    mudança não retroage no histórico.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

const FluxoItem = ({
  icon: Icon,
  label,
  active,
  hint,
}: {
  icon: typeof Droplet;
  label: string;
  active: boolean;
  hint: string;
}) => (
  <div
    className={`flex items-center gap-3 rounded-lg border p-3 transition-all ${
      active
        ? "border-primary/30 bg-primary/5"
        : "border-dashed border-border bg-muted/30 opacity-60"
    }`}
  >
    <Icon
      className={`h-4 w-4 ${active ? "text-primary" : "text-muted-foreground"}`}
      strokeWidth={1.75}
    />
    <div className="min-w-0">
      <p className={`text-sm font-medium ${active ? "text-foreground" : "text-muted-foreground line-through"}`}>
        {label}
      </p>
      <p className="text-[10px] text-muted-foreground truncate">{hint}</p>
    </div>
  </div>
);

export default FluxoRotinaTab;
