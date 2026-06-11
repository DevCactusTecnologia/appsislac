import { useState, useEffect, useMemo, useRef } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { cn, searchNormalize } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface State {
  id: number;
  name: string;
  uf: string;
}

interface City {
  id: number;
  name: string;
}

interface LocationSelectorProps {
  selectedState: string;
  selectedCity: string;
  onStateChange: (uf: string) => void;
  onCityChange: (city: string) => void;
}

const inputClass =
  "w-full px-3 py-2.5 bg-muted/30 border border-border/60 rounded-xl text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all duration-200 disabled:opacity-50";

export function LocationSelector({
  selectedState,
  selectedCity,
  onStateChange,
  onCityChange,
}: LocationSelectorProps) {
  const [states, setStates] = useState<State[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);

  const [stateQuery, setStateQuery] = useState("");
  const [cityQuery, setCityQuery] = useState("");
  const [stateOpen, setStateOpen] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);

  const stateWrapRef = useRef<HTMLDivElement>(null);
  const cityWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("states").select("id, name, uf").order("name");
      if (data) setStates(data);
    })();
  }, []);

  useEffect(() => {
    if (!selectedState || states.length === 0) {
      setCities([]);
      return;
    }
    const stateId = states.find((s) => s.uf === selectedState)?.id;
    if (!stateId) return;
    (async () => {
      setLoadingCities(true);
      const { data } = await supabase
        .from("cities")
        .select("id, name")
        .eq("uf_id", stateId)
        .order("name");
      if (data) setCities(data);
      setLoadingCities(false);
    })();
  }, [selectedState, states]);

  // Sync display text when external selection changes
  const currentStateName = useMemo(
    () => states.find((s) => s.uf === selectedState)?.name ?? "",
    [states, selectedState],
  );

  useEffect(() => {
    if (!stateOpen) {
      setStateQuery(currentStateName ? `${currentStateName} (${selectedState})` : "");
    }
  }, [currentStateName, selectedState, stateOpen]);

  useEffect(() => {
    if (!cityOpen) setCityQuery(selectedCity || "");
  }, [selectedCity, cityOpen]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (stateWrapRef.current && !stateWrapRef.current.contains(e.target as Node)) {
        setStateOpen(false);
      }
      if (cityWrapRef.current && !cityWrapRef.current.contains(e.target as Node)) {
        setCityOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredStates = useMemo(() => {
    const q = searchNormalize(stateQuery);
    if (!q) return states;
    return states.filter(
      (s) => searchNormalize(s.name).includes(q) || searchNormalize(s.uf).includes(q),
    );
  }, [states, stateQuery]);

  const filteredCities = useMemo(() => {
    const q = searchNormalize(cityQuery);
    if (!q) return cities;
    return cities.filter((c) => searchNormalize(c.name).includes(q));
  }, [cities, cityQuery]);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <label className="text-[11px] font-medium text-muted-foreground block uppercase tracking-wider">
          Estado (UF)
        </label>
        <div className="relative" ref={stateWrapRef}>
          <input
            className={inputClass + " pr-16"}
            value={stateQuery}
            onChange={(e) => {
              setStateQuery(e.target.value);
              setStateOpen(true);
            }}
            onFocus={() => {
              setStateOpen(true);
              setStateQuery("");
            }}
            placeholder="Digite o estado ou UF..."
            autoComplete="off"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {selectedState && (
              <button
                type="button"
                onClick={() => {
                  onStateChange("");
                  onCityChange("");
                  setStateQuery("");
                }}
                className="p-1 rounded-md hover:bg-muted text-muted-foreground"
                aria-label="Limpar estado"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <ChevronDown className="h-4 w-4 opacity-50" />
          </div>
          {stateOpen && (
            <div className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto rounded-xl border border-border bg-popover shadow-lg">
              {filteredStates.length === 0 ? (
                <div className="px-3 py-2.5 text-sm text-muted-foreground">Nenhum estado encontrado.</div>
              ) : (
                filteredStates.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      onStateChange(s.uf);
                      onCityChange("");
                      setStateOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-muted/60"
                  >
                    <Check
                      className={cn(
                        "h-4 w-4",
                        selectedState === s.uf ? "opacity-100 text-primary" : "opacity-0",
                      )}
                    />
                    <span>
                      {s.name} <span className="text-muted-foreground">({s.uf})</span>
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] font-medium text-muted-foreground block uppercase tracking-wider">
          Cidade
        </label>
        <div className="relative" ref={cityWrapRef}>
          <input
            className={inputClass + " pr-16"}
            value={cityQuery}
            onChange={(e) => {
              setCityQuery(e.target.value);
              setCityOpen(true);
            }}
            onFocus={() => {
              if (!selectedState) return;
              setCityOpen(true);
              setCityQuery("");
            }}
            placeholder={selectedState ? "Digite a cidade..." : "Selecione o estado primeiro"}
            autoComplete="off"
            disabled={!selectedState}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {selectedCity && (
              <button
                type="button"
                onClick={() => {
                  onCityChange("");
                  setCityQuery("");
                }}
                className="p-1 rounded-md hover:bg-muted text-muted-foreground"
                aria-label="Limpar cidade"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <ChevronDown className="h-4 w-4 opacity-50" />
          </div>
          {cityOpen && selectedState && (
            <div className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto rounded-xl border border-border bg-popover shadow-lg">
              {loadingCities ? (
                <div className="px-3 py-2.5 text-sm text-muted-foreground">Carregando...</div>
              ) : filteredCities.length === 0 ? (
                <div className="px-3 py-2.5 text-sm text-muted-foreground">Nenhuma cidade encontrada.</div>
              ) : (
                filteredCities.slice(0, 200).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      onCityChange(c.name);
                      setCityOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-muted/60"
                  >
                    <Check
                      className={cn(
                        "h-4 w-4",
                        selectedCity === c.name ? "opacity-100 text-primary" : "opacity-0",
                      )}
                    />
                    <span>{c.name}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
