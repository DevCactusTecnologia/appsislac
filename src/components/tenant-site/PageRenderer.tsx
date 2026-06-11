import { memo } from "react";
import type { TBlock, TPageContent } from "@/lib/tenantSite/blocks";
import HeroRenderer from "./blocks/HeroRenderer";
import TextoRenderer from "./blocks/TextoRenderer";
import ServicosRenderer from "./blocks/ServicosRenderer";
import ImagemRenderer from "./blocks/ImagemRenderer";
import ExamesListaRenderer from "./blocks/ExamesListaRenderer";

export interface PageRendererProps {
  content: TPageContent;
  /** Prefixo para resolver links relativos do CTA (ex.: "app" → "/site/:slug/app"). */
  ctaBaseHref?: string;
  /** Tenant resolvido pelo container; usado por blocos que precisam consultar dados públicos. */
  tenantId?: string;
  /** Logo do tenant — usado como fallback no Hero quando o bloco não define imagemUrl. */
  tenantLogoUrl?: string | null;
}

function renderBlock(block: TBlock, ctaBase?: string, tenantId?: string, tenantLogoUrl?: string | null) {
  switch (block.type) {
    case "hero": {
      const props = { ...block.props };
      if (!props.imagemUrl && tenantLogoUrl) props.imagemUrl = tenantLogoUrl;
      return <HeroRenderer {...props} ctaBase={ctaBase} />;
    }
    case "texto":
      return <TextoRenderer {...block.props} />;
    case "servicos":
      return <ServicosRenderer {...block.props} />;
    case "imagem":
      return <ImagemRenderer {...block.props} />;
    case "exames_lista":
      return <ExamesListaRenderer {...block.props} tenantId={tenantId} />;
    default:
      return null;
  }
}

function PageRendererImpl({ content, ctaBaseHref, tenantId, tenantLogoUrl }: PageRendererProps) {
  if (!content?.length) {
    return (
      <div className="max-w-xl mx-auto px-4 py-24 text-center">
        <div className="bg-card/60 backdrop-blur-md border border-border/60 rounded-3xl p-8">
          <p className="text-sm text-muted-foreground">Esta página ainda não tem conteúdo publicado.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="w-full max-w-xl mx-auto px-4 flex flex-col gap-4">
      {content.map((block, idx) => (
        <section key={idx} className="w-full">{renderBlock(block, ctaBaseHref, tenantId, tenantLogoUrl)}</section>
      ))}
    </div>
  );
}

export const PageRenderer = memo(PageRendererImpl);
export default PageRenderer;