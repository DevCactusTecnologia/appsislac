interface Props {
  nivel: "h2" | "h3" | "p";
  texto: string;
  alinhamento: "left" | "center" | "right";
}

export default function TextoRenderer({ nivel, texto, alinhamento }: Props) {
  if (!texto) return null;
  const align =
    alinhamento === "center" ? "text-center" : alinhamento === "right" ? "text-right" : "text-left";
  const card = `w-full bg-card/70 backdrop-blur-md border border-border/60 rounded-2xl px-5 py-4 shadow-sm ${align}`;
  if (nivel === "h2") return <h2 className={`${card} text-lg sm:text-xl font-bold text-foreground`}>{texto}</h2>;
  if (nivel === "h3") return <h3 className={`${card} text-base sm:text-lg font-semibold text-foreground`}>{texto}</h3>;
  return <p className={`${card} text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed`}>{texto}</p>;
}