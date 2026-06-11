// Schema dos blocos do builder visual de páginas do tenant.
// Tudo passa por Zod antes de salvar/render — garante que conteúdo é JSON
// estruturado, nunca HTML arbitrário.
import { z } from "zod";

export const HeroBlock = z.object({
  type: z.literal("hero"),
  props: z.object({
    titulo: z.string().max(200).default(""),
    subtitulo: z.string().max(400).default(""),
    ctaTexto: z.string().max(60).default(""),
    ctaUrl: z.string().max(500).default(""),
    imagemUrl: z.string().max(1000).default(""),
    alinhamento: z.enum(["left", "center"]).default("center"),
  }),
});

export const TextoBlock = z.object({
  type: z.literal("texto"),
  props: z.object({
    nivel: z.enum(["h2", "h3", "p"]).default("p"),
    texto: z.string().max(5000).default(""),
    alinhamento: z.enum(["left", "center", "right"]).default("left"),
  }),
});

export const ServicosBlock = z.object({
  type: z.literal("servicos"),
  props: z.object({
    titulo: z.string().max(200).default("Nossos serviços"),
    itens: z
      .array(
        z.object({
          nome: z.string().max(120).default(""),
          descricao: z.string().max(300).default(""),
        }),
      )
      .max(60)
      .default([]),
  }),
});

export const ImagemBlock = z.object({
  type: z.literal("imagem"),
  props: z.object({
    layout: z.enum(["unica", "galeria"]).default("unica"),
    imagens: z
      .array(
        z.object({
          url: z.string().max(1000).default(""),
          legenda: z.string().max(200).default(""),
        }),
      )
      .max(24)
      .default([]),
  }),
});

export const ExamesListaBlock = z.object({
  type: z.literal("exames_lista"),
  props: z.object({
    titulo: z.string().max(200).default("Nossos exames"),
    descricao: z.string().max(500).default(""),
    mostrarPreco: z.boolean().default(true),
    mostrarBusca: z.boolean().default(true),
    apenasDestaque: z.boolean().default(false),
    limite: z.number().int().min(1).max(120).default(60),
    layout: z.enum(["grid", "lista"]).default("grid"),
  }),
});

export const Block = z.discriminatedUnion("type", [
  HeroBlock,
  TextoBlock,
  ServicosBlock,
  ImagemBlock,
  ExamesListaBlock,
]);

export const PageContent = z.array(Block).max(50);

export type TBlock = z.infer<typeof Block>;
export type TPageContent = z.infer<typeof PageContent>;
export type BlockType = TBlock["type"];

export function defaultBlock(type: BlockType): TBlock {
  switch (type) {
    case "hero":
      return Block.parse({
        type: "hero",
        props: { titulo: "Bem-vindo ao laboratório", subtitulo: "Resultados rápidos e confiáveis", ctaTexto: "Acessar portal", ctaUrl: "app", imagemUrl: "", alinhamento: "center" },
      });
    case "texto":
      return Block.parse({
        type: "texto",
        props: { nivel: "p", texto: "Conte aqui um pouco sobre o seu laboratório.", alinhamento: "left" },
      });
    case "servicos":
      return Block.parse({
        type: "servicos",
        props: { titulo: "Nossos serviços", itens: [{ nome: "Hemograma", descricao: "" }, { nome: "Bioquímica", descricao: "" }] },
      });
    case "imagem":
      return Block.parse({
        type: "imagem",
        props: { layout: "unica", imagens: [{ url: "", legenda: "" }] },
      });
    case "exames_lista":
      return Block.parse({
        type: "exames_lista",
        props: { titulo: "Nossos exames", descricao: "Selecione os exames de interesse e solicite uma reserva.", mostrarPreco: true, mostrarBusca: true, apenasDestaque: false, limite: 60, layout: "grid" },
      });
  }
}

export const BLOCK_LABELS: Record<BlockType, string> = {
  hero: "Destaque (Hero)",
  texto: "Texto",
  servicos: "Lista de serviços",
  imagem: "Imagem / Galeria",
  exames_lista: "Vitrine de exames",
};

/** Sanitização defensiva: parse com Zod descarta campos extras e
 *  garante que não haja HTML embutido em campos string. */
export function sanitizeContent(raw: unknown): TPageContent {
  const result = PageContent.safeParse(raw);
  return result.success ? result.data : [];
}