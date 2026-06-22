import { useMemo } from "react";
import { Filter, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CategoryMultiFilterProps {
  value: string[];
  onChange: (value: string[]) => void;
  categories: string[];
  uncategorizedCount?: number;
  className?: string;
}

export function CategoryMultiFilter({
  value,
  onChange,
  categories,
  uncategorizedCount = 0,
  className,
}: CategoryMultiFilterProps) {
  const selected = useMemo(() => new Set(value), [value]);
  const isAll = value.length === 1 && value[0] === "all";

  const toggle = (item: string) => {
    if (item === "all") {
      onChange(["all"]);
      return;
    }
    const withoutAll = value.filter((v) => v !== "all");
    const next = selected.has(item)
      ? withoutAll.filter((v) => v !== item)
      : [...withoutAll, item];
    onChange(next.length === 0 ? ["all"] : next);
  };

  const clearAll = () => onChange(["all"]);

  const label = useMemo(() => {
    if (isAll) return "Todas as categorias";
    const names = value.filter((v) => v !== "__uncat__");
    const hasUncat = selected.has("__uncat__");
    const display = [...names, ...(hasUncat ? ["Sem categoria"] : [])];
    if (display.length === 1) return display[0];
    return `${display.length} selecionadas`;
  }, [value, selected, isAll]);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Filter className="size-4 text-muted-foreground shrink-0" />
      <Popover>
        <div className="flex flex-1 items-center gap-1">
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="h-9 flex-1 justify-between rounded-xl text-xs px-3 font-normal"
            >
              <span className="truncate">{label}</span>
            </Button>
          </PopoverTrigger>
          {!isAll && (
            <button
              type="button"
              onClick={clearAll}
              aria-label="Limpar filtro de categorias"
              className="size-8 grid place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <PopoverContent className="w-72 p-2" align="start">
          <div className="space-y-1">
            <CategoryItem
              value="all"
              label="Todas as categorias"
              selected={selected.has("all")}
              onToggle={() => toggle("all")}
            />
            <CategoryItem
              value="__uncat__"
              label={`Sem categoria${uncategorizedCount ? ` (${uncategorizedCount})` : ""}`}
              selected={selected.has("__uncat__")}
              onToggle={() => toggle("__uncat__")}
            />
            {categories.length > 0 && <div className="h-px bg-border my-1" />}
            {categories.map((c) => (
              <CategoryItem
                key={c}
                value={c}
                label={c}
                selected={selected.has(c)}
                onToggle={() => toggle(c)}
              />
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

interface CategoryItemProps {
  value: string;
  label: string;
  selected: boolean;
  onToggle: () => void;
}

function CategoryItem({ value, label, selected, onToggle }: CategoryItemProps) {
  return (
    <div
      onClick={onToggle}
      className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-muted transition-colors cursor-pointer"
    >
      <Checkbox
        id={`cat-${value}`}
        checked={selected}
        onCheckedChange={onToggle}
        aria-label={label}
        className="pointer-events-none"
      />
      <label htmlFor={`cat-${value}`} className="flex-1 text-left truncate cursor-pointer">
        {label}
      </label>
    </div>
  );
}
