/**
 * CLEANUP UTILITIES - MEMORY LEAK PREVENTION
 * 
 * Hooks que garantem limpeza automática
 * Nunca esqueça de chamar cleanup!
 */

import { useEffect, useRef, useState, useCallback } from "react";

/**
 * useInterval: Executa função a cada N ms COM cleanup automático
 * 
 * ❌ ERRADO:
 * useEffect(() => {
 *   setInterval(() => { ... }, 1000);
 *   // Memory leak! Interval nunca é limpo
 * }, []);
 * 
 * ✅ CORRETO:
 * useInterval(() => { ... }, 1000);
 */
export function useInterval(
  callback: () => void,
  delayMs: number | null = 1000,
  options?: { immediate?: boolean }
) {
  const callbackRef = useRef(callback);

  // Atualizar ref quando callback mudar
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delayMs === null) {
      return;
    }

    if (options?.immediate) {
      callbackRef.current();
    }

    const intervalId = setInterval(() => {
      callbackRef.current();
    }, delayMs);

    // Cleanup: SEMPRE limpar interval
    return () => clearInterval(intervalId);
  }, [delayMs, options?.immediate]);
}

/**
 * useTimeout: Executa função após N ms COM cleanup automático
 * 
 * ✅ CORRETO:
 * useTimeout(() => { ... }, 3000);
 */
export function useTimeout(
  callback: () => void,
  delayMs: number | null = 1000
) {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delayMs === null) {
      return;
    }

    const timeoutId = setTimeout(() => {
      callbackRef.current();
    }, delayMs);

    // Cleanup: SEMPRE limpar timeout
    return () => clearTimeout(timeoutId);
  }, [delayMs]);
}

/**
 * useMounted: Saber se componente está montado
 * 
 * ✅ Previne "Can't perform a React state update on an unmounted component"
 * 
 * useEffect(() => {
 *   const isMounted = useMounted();
 *   fetchData().then(data => {
 *     if (isMounted()) {
 *       setState(data); // Seguro!
 *     }
 *   });
 * }, []);
 */
export function useMounted() {
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return useCallback(() => mountedRef.current, []);
}

/**
 * useSafeState: setState que valida se está montado
 * 
 * const [data, setData] = useSafeState(null);
 * // setData nunca vai gerar warning se desmontado
 */
export function useSafeState<T>(initialValue: T) {
  const [state, setState] = useState<T>(initialValue);
  const isMounted = useMounted();

  const setSafeState = useCallback((value: T | ((prev: T) => T)) => {
    if (isMounted()) {
      setState(value);
    }
  }, [isMounted]);

  return [state, setSafeState] as const;
}

/**
 * useDebounce: Delay valor com cleanup automático
 * 
 * const debouncedValue = useDebounce(searchTerm, 500);
 */
export function useDebounce<T>(value: T, delayMs: number = 500) {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => clearTimeout(timeoutId);
  }, [value, delayMs]);

  return debouncedValue;
}

/**
 * useDebouncedCallback: Callback debounced com cleanup
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delayMs: number = 500
) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delayMs);
    },
    [callback, delayMs]
  );

  return debouncedCallback;
}

/**
 * useThrottledCallback: Callback throttled com cleanup
 * 
 * const handleScroll = useThrottledCallback(() => {
 *   console.log("Scroll!");
 * }, 500);
 * 
 * window.addEventListener("scroll", handleScroll);
 */
export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  delayMs: number = 500
) {
  const lastCallRef = useRef<number>(0);

  const throttledCallback = useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();

      if (now - lastCallRef.current >= delayMs) {
        lastCallRef.current = now;
        callback(...args);
      }
    },
    [callback, delayMs]
  );

  return throttledCallback;
}

/**
 * useSupabaseSubscription: Subscribe com cleanup automático
 */
export function useSupabaseSubscription<T>(
  table: string,
  callback: (data: T) => void,
  filters?: { column: string; value: any }[]
) {
  const isMounted = useMounted();

  useEffect(() => {
    // Nota: Implementação real depende de seu setup do Supabase
    // Este é um padrão genérico

    const unsubscribe = () => {
      // Placeholder para unsubscribe
    };

    // Cleanup automático
    return () => {
      unsubscribe();
    };
  }, [table, callback, filters, isMounted]);
}

/**
 * useEventListener: Add/remove event listener com cleanup
 * 
 * useEventListener("resize", handleResize);
 */
export function useEventListener<K extends keyof WindowEventMap>(
  eventName: K,
  handler: (event: WindowEventMap[K]) => void,
  element: HTMLElement | Window = window,
  options?: boolean | AddEventListenerOptions
) {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    const isSupported = element && element.addEventListener;
    if (!isSupported) return;

    const eventListener = (event: Event) => {
      handlerRef.current(event as WindowEventMap[K]);
    };

    element.addEventListener(eventName, eventListener, options);

    // Cleanup: remover listener
    return () => {
      element.removeEventListener(eventName, eventListener, options);
    };
  }, [eventName, element, options]);
}

/**
 * useResizeObserver: Observar mudanças de tamanho COM cleanup
 */
export function useResizeObserver(
  ref: React.RefObject<HTMLElement>,
  callback: (entry: ResizeObserverEntry) => void
) {
  useEffect(() => {
    if (!ref.current || !window.ResizeObserver) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      entries.forEach(callback);
    });

    observer.observe(ref.current);

    // Cleanup: parar de observar
    return () => {
      observer.disconnect();
    };
  }, [ref, callback]);
}

/**
 * useIntersectionObserver: Detectar quando elemento entra/sai da viewport
 */
export function useIntersectionObserver(
  ref: React.RefObject<HTMLElement>,
  callback: (entry: IntersectionObserverEntry) => void,
  options?: IntersectionObserverInit
) {
  useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(callback);
    }, options);

    observer.observe(ref.current);

    // Cleanup
    return () => {
      observer.disconnect();
    };
  }, [ref, callback, options]);
}

/**
 * useAbortSignal: Para requisições com cleanup automático
 * 
 * const signal = useAbortSignal();
 * fetch(url, { signal }).then(...);
 * // Cleanup automático quando componente desmontar
 */
export function useAbortSignal() {
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    controllerRef.current = new AbortController();

    return () => {
      // Cleanup: abortar requisições
      controllerRef.current?.abort();
    };
  }, []);

  return controllerRef.current?.signal || new AbortController().signal;
}

/**
 * usePrevious: Guardar valor anterior
 */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>();

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref.current;
}
