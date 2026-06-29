// Bloco isolado para isolar o `recharts` (~300 KB) em um chunk separado.
// Só é baixado quando o usuário abre o diálogo "Gráfica" em /relatorios/producao.
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

export interface DailyDatum { dia: string; exames: number }
export interface PieDatum { nome: string; valor: number; isSelected: boolean }

interface Props {
  daily: DailyDatum[];
  pie: PieDatum[];
  colors: string[];
  pieTitle: string;
  /** When set, render only one of the two charts. Default: render both (legacy). */
  variant?: "both" | "daily" | "pie";
}

export default function ProducaoChartsLazy({ daily, pie, colors, pieTitle, variant = "both" }: Props) {
  const showDaily = variant === "both" || variant === "daily";
  const showPie = variant === "both" || variant === "pie";
  return (
    <>
      {showDaily && (
        <div className={variant === "both" ? "rounded-2xl border border-border/60 p-5" : ""}>
          <h4 className="text-sm font-semibold text-foreground mb-4">Produção diária</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis dataKey="dia" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip cursor={{ fill: "hsl(var(--muted) / 0.4)" }} contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                <Bar dataKey="exames" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      {showPie && (
        <div className={variant === "both" ? "rounded-2xl border border-border/60 p-5" : ""}>
          {variant === "both" && <h4 className="text-sm font-semibold text-foreground mb-4">Participação por {pieTitle}</h4>}
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pie}
                  dataKey="valor"
                  nameKey="nome"
                  cx="50%"
                  cy="50%"
                  outerRadius="78%"
                  innerRadius="48%"
                  paddingAngle={2}
                  stroke="hsl(var(--card))"
                  strokeWidth={2}
                >
                  {pie.map((entry, index) => (
                    <Cell key={index} fill={colors[index % colors.length]} opacity={entry.isSelected ? 1 : 0.55} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: "11px" }} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </>
  );
}
