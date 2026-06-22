import { useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2, ArrowDown } from "lucide-react";

const THRESHOLD = 70;
const MAX = 110;

export function PullToRefresh({ children }: { children: ReactNode }) {
  const startY = useRef<number | null>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY > 0 || refreshing) return;
      startY.current = e.touches[0].clientY;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (startY.current == null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) {
        setPull(0);
        return;
      }
      const next = Math.min(MAX, dy * 0.5);
      setPull((prev) => {
        if (prev < THRESHOLD && next >= THRESHOLD) {
          try {
            (navigator as Navigator & { vibrate?: (p: number | number[]) => boolean }).vibrate?.(8);
          } catch { /* no-op */ }
        }
        return next;
      });
    };
    const onTouchEnd = async () => {
      if (startY.current == null) return;
      const p = pull;
      startY.current = null;
      if (p >= THRESHOLD && !refreshing) {
        setRefreshing(true);
        setPull(THRESHOLD);
        try {
          (navigator as Navigator & { vibrate?: (p: number | number[]) => boolean }).vibrate?.(15);
        } catch { /* no-op */ }
        window.dispatchEvent(new CustomEvent("aura:data-changed"));
        await new Promise((r) => setTimeout(r, 600));
        setRefreshing(false);
      }
      setPull(0);
    };
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [pull, refreshing]);

  const show = pull > 4 || refreshing;
  const ready = pull >= THRESHOLD;

  return (
    <>
      <div
        aria-hidden={!show}
        className="pointer-events-none fixed top-0 left-0 right-0 z-[60] flex justify-center md:hidden transition-opacity"
        style={{ opacity: show ? 1 : 0, transform: `translateY(${Math.max(0, pull - 20)}px)` }}
      >
        <div className="mt-2 grid size-10 place-items-center rounded-full bg-card border border-border shadow-[var(--shadow-elevated)]">
          {refreshing ? (
            <Loader2 className="size-4 animate-spin text-primary" />
          ) : (
            <ArrowDown
              className={`size-4 transition-transform ${ready ? "rotate-180 text-primary" : "text-muted-foreground"}`}
            />
          )}
        </div>
      </div>
      <div style={{ transform: pull ? `translateY(${pull}px)` : undefined, transition: pull ? "none" : "transform 200ms" }}>
        {children}
      </div>
    </>
  );
}
