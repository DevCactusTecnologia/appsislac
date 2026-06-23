/**
 * useHidScanner — captura global de leitores HID (USB/Bluetooth) que
 * emulam teclado.
 *
 * Fonte única de verdade — substitui as duplicações em Soroteca.tsx e
 * SorotecaTriagem.tsx.
 *
 * Comportamento:
 *  - Ignora eventos quando o foco está em input/textarea/select/contentEditable
 *    (deixa o campo lidar).
 *  - Acumula caracteres com intervalo curto (<= 50 ms) — digitação humana
 *    naturalmente excede esse limite e é descartada.
 *  - Dispara `onScan(code)` quando recebe Enter e o buffer tem comprimento
 *    mínimo (default 4).
 *  - Pode ser pausado via `disabled` (ex.: diálogo aberto).
 */

import { useEffect, useRef } from "react";

export interface UseHidScannerOptions {
  onScan: (code: string) => void;
  disabled?: boolean;
  /** Intervalo máximo (ms) entre teclas para considerar leitura HID. */
  maxIntervalMs?: number;
  /** Comprimento mínimo do código aceito. */
  minLength?: number;
}

export function useHidScanner({
  onScan,
  disabled = false,
  maxIntervalMs = 50,
  minLength = 4,
}: UseHidScannerOptions) {
  const bufRef = useRef<{ value: string; lastAt: number }>({ value: "", lastAt: 0 });
  // Mantemos a referência mais recente do callback para evitar reassinar listener.
  const cbRef = useRef(onScan);
  cbRef.current = onScan;

  useEffect(() => {
    if (disabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || t?.isContentEditable) {
        return;
      }
      const now = Date.now();
      const buf = bufRef.current;
      if (now - buf.lastAt > maxIntervalMs) buf.value = "";
      buf.lastAt = now;

      if (e.key === "Enter") {
        const code = buf.value;
        buf.value = "";
        if (code.length >= minLength) {
          e.preventDefault();
          cbRef.current(code);
        }
        return;
      }
      if (e.key.length === 1) buf.value += e.key;
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [disabled, maxIntervalMs, minLength]);
}

export default useHidScanner;
