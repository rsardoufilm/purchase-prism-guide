import { ALL_PERIODS, PERIOD_LABELS, PRIMARY_PERIODS, type PeriodKey } from "@/lib/period";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown } from "lucide-react";

export function PeriodFilter({
  value,
  onChange,
}: {
  value: PeriodKey;
  onChange: (v: PeriodKey) => void;
}) {
  const isPrimary = PRIMARY_PERIODS.includes(value);
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
      {PRIMARY_PERIODS.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={cn(
            "px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all",
            value === p
              ? "bg-secondary text-secondary-foreground"
              : "bg-card border border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {PERIOD_LABELS[p]}
        </button>
      ))}
      <Popover>
        <PopoverTrigger asChild>
          <button
            className={cn(
              "px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap inline-flex items-center gap-1 transition-all",
              !isPrimary
                ? "bg-secondary text-secondary-foreground"
                : "bg-card border border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {!isPrimary ? PERIOD_LABELS[value] : "Mais"}
            <ChevronDown className="size-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-1" align="end">
          <div className="grid gap-0.5">
            {ALL_PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => onChange(p)}
                className={cn(
                  "text-left px-3 py-2 rounded-md text-sm transition-colors",
                  value === p
                    ? "bg-primary-soft text-primary font-semibold"
                    : "hover:bg-muted text-foreground",
                )}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
