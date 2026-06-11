interface Item { nome: string; descricao: string }
interface Props { titulo: string; itens: Item[] }

export default function ServicosRenderer({ titulo, itens }: Props) {
  const visible = itens.filter((i) => i.nome.trim().length);
  if (!visible.length) return null;
  return (
    <div className="w-full">
      {titulo ? (
        <h2 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-3 text-center">
          {titulo}
        </h2>
      ) : null}
      <ul className="flex flex-col gap-2.5">
        {visible.map((item, idx) => (
          <li
            key={idx}
            className="group bg-card/70 backdrop-blur-md border border-border/60 rounded-2xl px-5 py-4 shadow-sm hover:shadow-md hover:bg-card hover:-translate-y-0.5 transition-all"
          >
            <p className="text-sm font-semibold text-foreground">{item.nome}</p>
            {item.descricao ? (
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{item.descricao}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}