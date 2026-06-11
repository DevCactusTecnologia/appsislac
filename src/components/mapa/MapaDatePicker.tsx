import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value?: Date;
  onChange: (d?: Date) => void;
}

const MapaDatePicker = ({ label, value, onChange }: Props) => {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">{label}</label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn(
            "w-full justify-start text-left font-normal h-10 text-sm rounded-2xl border-0 bg-muted/50 hover:bg-muted/70 transition-all",
            !value && "text-muted-foreground"
          )}>
            <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
            {value ? format(value, "dd/MM/yyyy", { locale: ptBR }) : "Selecione a data"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value}
            onSelect={(d) => { onChange(d); setOpen(false); }}
            locale={ptBR}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default MapaDatePicker;
