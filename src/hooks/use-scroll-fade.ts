import { useEffect, useRef, useState } from "react";

/**
 * Detecta se um container scrollável tem conteúdo oculto acima/abaixo,
 * para exibir gradient fades sutis indicando "há mais conteúdo".
 */
export function useScrollFade<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [showTop, setShowTop] = useState(false);
  const [showBottom, setShowBottom] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      setShowTop(scrollTop > 4);
      setShowBottom(scrollTop + clientHeight < scrollHeight - 4);
    };

    update();
    el.addEventListener("scroll", update, { passive: true });

    const ro = new ResizeObserver(update);
    ro.observe(el);
    // Observa também mudanças no conteúdo interno
    Array.from(el.children).forEach((child) => ro.observe(child));

    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  });

  return { ref, showTop, showBottom };
}
