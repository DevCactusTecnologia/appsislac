// Versionamento automático do favicon.
// O Vite processa o asset importado e gera uma URL com hash de conteúdo.

import faviconUrl from "@/assets/favicon.png";

function setLink(rel: string, href: string, type?: string, sizes?: string) {
  const selector = `link[rel="${rel}"]`;
  let link = document.head.querySelector<HTMLLinkElement>(selector);
  if (!link) {
    link = document.createElement("link");
    link.rel = rel;
    document.head.appendChild(link);
  }
  if (type) link.type = type;
  if (sizes) link.setAttribute("sizes", sizes);
  link.href = href;
}

export function installFavicon() {
  if (typeof document === "undefined") return;

  // Remove links antigos de ícones.
  document.head
    .querySelectorAll<HTMLLinkElement>(
      'link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]'
    )
    .forEach((el) => el.remove());

  setLink("icon", faviconUrl, "image/png");
  setLink("shortcut icon", faviconUrl, "image/png");
}
