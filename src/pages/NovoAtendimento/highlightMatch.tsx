// Extraído de NovoAtendimento.tsx (Sprint 1 — slicing estrutural).
import React from "react";

/** Realça as ocorrências de `query` em `text` com contraste acessível. */
export function highlightMatch(text: string, query: string): React.ReactNode {
  const q = (query || "").trim();
  if (!q) return text;
  try {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(${escaped})`, "ig");
    const parts = text.split(re);
    return parts.map((part, i) =>
      re.test(part) && part.toLowerCase() === q.toLowerCase() ? (
        <mark
          key={i}
          className="bg-primary/20 text-primary font-semibold rounded px-0.5"
        >
          {part}
        </mark>
      ) : (
        <span key={i}>{part}</span>
      ),
    );
  } catch {
    return text;
  }
}
