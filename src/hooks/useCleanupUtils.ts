/**
 * MEMORY LEAK PREVENTION
 * 
 * OBJETIVO: Evitar memory leaks em useEffect
 * REGRA: SEMPRE adicione cleanup function
 */

import { useEffect, useRef } from "react";

// ============================================================================
// USEEFFECT COM CLEANUP AUTOMÁTICO
// ============================================================================

/**
 * useEffect que garante cleanup de interval
 * 
 * ❌ ANTES (leak):
 *    useEffect(() => {
 *      const interval = setInterval(() => {}, 5000);
 *    }, []);
 * 
 * ✅ DEPOIS (safe):
 *    useInterval(() => {}, 5000);
 */
export function useInterval(
  callback: () => void,
  delay: number | null
): void {
  useEffect(() => {
    if (delay === null) return;

    const interval = setInterval(callback, delay);

    return () => clearInterval(interval);
  }, [callback, delay]);
}

/**
 * useEffect com cleanup de timeout
 */
export function useTimeout(
  callback: () => void,
  delay: number | null
): void {
  useEffect(() => {
    if (delay === null) return;

    const timeout = setTimeout(callback, delay);

    return () => clearTimeout(timeout);
  }, [callback, delay]);
}

/**
 * useEffect com cleanup automático
 * SMART: Chama cleanup ao desmontar
 */
export function useCleanup(
  effect: () => void | (() => void),
  deps?: React.DependencyList
): void {
  useEffect(() => {
    const result = effect();
    const cleanup = typeof result === "function" ? result : undefined;

    return () => {
      cleanup?.();
    };
  }, deps);
}

// ============================================================================
// SUPABASE SUBSCRIPTIONS
// ============================================================================

/**
 * Hook para subscription Supabase com cleanup automático
 */
export function useSupabaseSubscription(
  subscriptionFn: () => any,
  deps?: React.DependencyList
): void {
  useEffect(() => {
    const subscription = subscriptionFn();

    return () => {
      if (subscription && typeof subscription.unsubscribe === "function") {
        try {
          subscription.unsubscribe();
        } catch (error) {
          console.error("Erro ao limpar subscription", error);
        }
      }
    };
  }, deps);
}

/**
 * Hook para channel Supabase com cleanup
 */
export function useSupabaseChannel(
  channelFn: (channel: any) => any,
  supabase: any,
  deps?: React.DependencyList
): void {
  const channelRef = useRef<any>(null);

  useEffect(() => {
    const setupChannel = async () => {
      channelFn((channel: any) => {
        channelRef.current = channel;
        return channel;
      });
    };

    setupChannel();

    return () => {
      if (channelRef.current) {
        try {
          supabase.removeChannel(channelRef.current);
        } catch (error) {
          console.error("Erro ao limpar channel", error);
        }
      }
    };
  }, deps);
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

/**
 * Hook para event listener com cleanup
 */
export function useEventListener<K extends keyof WindowEventMap>(
  eventName: K,
  handler: (event: WindowEventMap[K]) => void,
  element: Window | Document = window,
  options?: boolean | AddEventListenerOptions
): void {
  useEffect(() => {
    const isSupported = element && element.addEventListener;

    if (!isSupported) return;

    element.addEventListener(eventName, handler as any, options);

    return () => {
      element.removeEventListener(eventName, handler as any, options);
    };
  }, [eventName, handler, element, options]);
}

/**
 * Hook para ResizeObserver com cleanup
 */
export function useResizeObserver(
  ref: React.RefObject<HTMLElement>,
  callback: (entry: ResizeObserverEntry) => void
): void {
  useEffect(() => {
    if (!ref.current) return;

    const observer = new ResizeObserver((entries) => {
      entries.forEach(callback);
    });

    observer.observe(ref.current);

    return () => {
      observer.disconnect();
    };
  }, [ref, callback]);
}

/**
 * Hook para IntersectionObserver com cleanup
 */
export function useIntersectionObserver(
  ref: React.RefObject<HTMLElement>,
  callback: (isVisible: boolean) => void,
  options?: IntersectionObserverInit
): void {
  useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(([entry]) => {
      callback(entry.isIntersecting);
    }, options);

    observer.observe(ref.current);

    return () => {
      observer.disconnect();
    };
  }, [ref, callback, options]);
}

// ============================================================================
// ABORT CONTROLLER (para cancela fetch/requests)
// ============================================================================

/**
 * Hook para AbortController (cancelar requests)
 * 
 * EXEMPLO:
 *    const { signal, abort } = useAbortSignal();
 *    
 *    useEffect(() => {
 *      fetch(url, { signal });
 *    }, [signal]);
 *    
 *    // Cleanup automático: abort() chamado ao desmontar
 */
export function useAbortSignal() {
  const controllerRef = useRef<AbortController | null>(null);

  if (!controllerRef.current) {
    controllerRef.current = new AbortController();
  }

  useEffect(() => {
    return () => {
      if (controllerRef.current) {
        try {
          controllerRef.current.abort();
        } catch {
          // noop
        }
      }
    };
  }, []);

  return {
    signal: controllerRef.current.signal,
    abort: () => controllerRef.current?.abort(),
  };
}

// ============================================================================
// MOUNTED STATE (evitar setState em componente desmontado)
// ============================================================================

/**
 * Hook para saber se componente está montado
 * 
 * ❌ ANTES (memory leak):
 *    useEffect(() => {
 *      asyncOperation().then(data => setState(data));
 *    }, []);
 *    // setState pode ser chamado após desmontar!
 * 
 * ✅ DEPOIS (safe):
 *    const isMounted = useMounted();
 *    useEffect(() => {
 *      asyncOperation().then(data => {
 *        if (isMounted()) setState(data);
 *      });
 *    }, []);
 */
export function useMounted(): () => boolean {
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return () => isMountedRef.current;
}

/**
 * Hook para setState seguro (só atualiza se montado)
 */
export function useSafeState<T>(
  initialValue: T
): [T, (value: T | ((val: T) => T)) => void] {
  const [state, setState] = React.useState<T>(initialValue);
  const isMounted = useMounted();

  const setSafeState = React.useCallback((value: T | ((val: T) => T)) => {
    if (isMounted()) {
      setState(value);
    }
  }, [isMounted]);

  return [state, setSafeState];
}

// ============================================================================
// PREVIOUS VALUE (útil para detectar mudanças)
// ============================================================================

/**
 * Hook para guardar valor anterior
 */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>();

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref.current;
}

// ============================================================================
// DEBOUNCE (evitar múltiplas chamadas)
// ============================================================================

/**
 * Hook para debounce
 * 
 * EXEMPLO:
 *    const debouncedSearch = useDebounce(searchValue, 300);
 *    
 *    useEffect(() => {
 *      search(debouncedSearch);
 *    }, [debouncedSearch]);
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook para debounce de função
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return ((...args: any[]) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }) as T;
}

// ============================================================================
// THROTTLE (limitar taxa de chamadas)
// ============================================================================

/**
 * Hook para throttle
 */
export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const lastCalledRef = useRef<number>(0);

  return ((...args: any[]) => {
    const now = Date.now();
    if (now - lastCalledRef.current >= delay) {
      lastCalledRef.current = now;
      callback(...args);
    }
  }) as T;
}
