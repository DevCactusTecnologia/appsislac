interface Img { url: string; legenda: string }
interface Props { layout: "unica" | "galeria"; imagens: Img[] }

export default function ImagemRenderer({ layout, imagens }: Props) {
  const visible = imagens.filter((i) => i.url.trim().length);
  if (!visible.length) return null;
  if (layout === "unica") {
    const img = visible[0];
    return (
      <figure className="w-full">
        <div className="overflow-hidden rounded-2xl border border-border/60 shadow-sm bg-card">
          <img src={img.url} alt={img.legenda} className="w-full h-auto object-cover" loading="lazy" />
        </div>
        {img.legenda ? (
          <figcaption className="text-[11px] text-muted-foreground mt-2 text-center">{img.legenda}</figcaption>
        ) : null}
      </figure>
    );
  }
  return (
    <div className="w-full">
      <div className="grid grid-cols-2 gap-2.5">
        {visible.map((img, idx) => (
          <figure key={idx} className="space-y-1">
            <div className="overflow-hidden rounded-xl border border-border/60 shadow-sm bg-card">
              <img src={img.url} alt={img.legenda} className="w-full h-32 sm:h-36 object-cover" loading="lazy" />
            </div>
            {img.legenda ? (
              <figcaption className="text-[10px] text-muted-foreground text-center">{img.legenda}</figcaption>
            ) : null}
          </figure>
        ))}
      </div>
    </div>
  );
}