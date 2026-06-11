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
}

export default function ProducaoChartsLazy({ daily, pie, colors, pieTitle }: Props) {
  return (
    <>
      <div className="rounded-2xl border border-border/60 p-5">
        <h4 className="text-sm font-semibold text-foreground mb-4">Produção Diária</h4>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis dataKey="dia" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip />
              <Bar dataKey="exames" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="rounded-2xl border border-border/60 p-5">
        <h4 className="text-sm font-semibold text-foreground mb-4">Participação por {pieTitle}</h4>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pie}
                dataKey="valor"
                nameKey="nome"
                cx="50%"
                cy="50%"
                outerRadius="75%"
                innerRadius="40%"
                paddingAngle={2}
                label={({ nome, percent }) => `${nome} (${(percent * 100).toFixed(0)}%)`}
              >
                {pie.map((entry, index) => (
                  <Cell key={index} fill={colors[index % colors.length]} opacity={entry.isSelected ? 1 : 0.7} />
                ))}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}