import { useEffect, useState } from "react";
import { ALL_PERIODS, PRIMARY_PERIODS, periodLabel, type PeriodKey } from "@/lib/period";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function PeriodFilter({
  value,
  onChange,
}: {
  value: PeriodKey;
  onChange: (v: PeriodKey) => void;
}) {
  const [months, setMonths] = useState<string[]>([]); // "YYYY-MM" desc

  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from("expenses")
        .select("expense_date")
        .order("expense_date", { ascending: false });
      if (cancel) return;
      const set = new Set<string>();
      for (const r of data ?? []) {
        const d = r.expense_date as string | null;
        if (d && d.length >= 7) set.add(d.slice(0, 7));
      }
      setMonths([...set]); // já ordenado pela query
    })();
    return () => {
      cancel = true;
    };
  }, []);

  const isPrimary = (PRIMARY_PERIODS as readonly string[]).includes(value);
  const isMonth = typeof value === "string" && value.startsWith("month:");
  const monthKeys: PeriodKey[] = months.map((ym) => `month:${ym}` as PeriodKey);

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
          {periodLabel(p)}
        </button>
      ))}

      {monthKeys.map((mk) => (
        <button
          key={mk}
          onClick={() => onChange(mk)}
          className={cn(
            "px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all",
            value === mk
              ? "bg-secondary text-secondary-foreground"
              : "bg-card border border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {periodLabel(mk)}
        </button>
      ))}

      <Popover>
        <PopoverTrigger asChild>
          <button
            className={cn(
              "px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap inline-flex items-center gap-1 transition-all",
              !isPrimary && !isMonth
                ? "bg-secondary text-secondary-foreground"
                : "bg-card border border-border text-muted-foreground hover:text-foreground",
            )}
            aria-label="Mais opções de período"
          >
            {!isPrimary && !isMonth ? periodLabel(value) : "Mais"}
            <ChevronDown className="size-3" aria-hidden />
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
                {periodLabel(p)}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
