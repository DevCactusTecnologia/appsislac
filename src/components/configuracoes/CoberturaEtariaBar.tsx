import { useMemo } from "react";
import { FaixaEtaria, MAX_DIAS, analisarCobertura, labelFaixa } from "@/lib/idadeFaixas";

interface Props {
  /** Rótulo (ex.: "Masculino"). */
  sexo: string;
  /** Faixas (em dias) cobertas por VRs cadastrados para o sexo. */
  faixas: FaixaEtaria[];
}

/**
 * Barra horizontal em escala "log-like" de 0d → 150a, mostrando:
 *  - verde   = coberto
 *  - cinza   = gap
 *  - vermelho hachurado = sobreposição
 */
const CoberturaEtariaBar = ({ sexo, faixas }: Props) => {
  const { gaps, overlaps, cobre0a150 } = useMemo(() => analisarCobertura(faixas), [faixas]);

  // Escala log para dar destaque ao período pediátrico (0–5a) sem perder o adulto.
  const toPct = (dias: number): number => {
    const x = Math.max(1, dias + 1);
    const max = Math.log(MAX_DIAS + 1);
    return (Math.log(x) / max) * 100;
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-medium text-foreground">{sexo}</span>
        <span className={cobre0a150 ? "text-status-success" : "text-status-warning"}>
          {cobre0a150
            ? "Cobertura completa 0d–150a"
            : `${gaps.length} gap${gaps.length === 1 ? "" : "s"}, ${overlaps.length} sobreposição${overlaps.length === 1 ? "" : "ões"}`}
        </span>
      </div>
      <div className="relative h-3 rounded-full bg-muted overflow-hidden border border-border/40">
        {/* Faixas cobertas (verde) */}
        {faixas.map((f) => (
          <div
            key={`f-${f.id}`}
            className="absolute top-0 bottom-0 bg-status-success/55"
            style={{ left: `${toPct(f.deDias)}%`, width: `${Math.max(0.5, toPct(f.ateDias) - toPct(f.deDias))}%` }}
            title={`Coberto: ${labelFaixa(f.deDias, f.ateDias)}`}
          />
        ))}
        {/* Sobreposições (vermelho hachurado) */}
        {overlaps.map((o, i) => (
          <div
            key={`o-${i}`}
            className="absolute top-0 bottom-0 bg-status-danger/70"
            style={{
              left: `${toPct(o.de)}%`,
              width: `${Math.max(0.5, toPct(o.ate) - toPct(o.de))}%`,
              backgroundImage:
                "repeating-linear-gradient(45deg, transparent 0 3px, hsl(var(--background)/0.45) 3px 6px)",
            }}
            title={`Sobreposição: ${labelFaixa(o.de, o.ate)}`}
          />
        ))}
        {/* Gaps (cinza pontilhado) */}
        {gaps.map((g, i) => (
          <div
            key={`g-${i}`}
            className="absolute top-0 bottom-0 bg-foreground/15"
            style={{
              left: `${toPct(g.de)}%`,
              width: `${Math.max(0.5, toPct(g.ate) - toPct(g.de))}%`,
              backgroundImage:
                "repeating-linear-gradient(90deg, transparent 0 2px, hsl(var(--foreground)/0.25) 2px 4px)",
            }}
            title={`Sem cobertura: ${labelFaixa(g.de, g.ate)}`}
          />
        ))}
      </div>
      <div className="flex justify-between text-[9px] text-muted-foreground">
        <span>0d</span><span>1m</span><span>1a</span><span>5a</span><span>20a</span><span>150a</span>
      </div>
    </div>
  );
};

export default CoberturaEtariaBar;
