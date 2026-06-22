import { useState, useEffect, useCallback } from "react";
import type { PeriodKey } from "@/lib/period";

const SHARED_KEY = "aura:shared-period";
const EVENT_NAME = "aura:period-changed";

function readPeriod(): PeriodKey {
  if (typeof window === "undefined") return "este_mes";
  try {
    const raw = window.localStorage.getItem(SHARED_KEY);
    if (raw) return raw as PeriodKey;
  } catch { /* noop */ }
  return "este_mes";
}

export function useSharedPeriod(): [PeriodKey, (p: PeriodKey) => void] {
  const [period, setPeriodState] = useState<PeriodKey>(readPeriod);

  const setPeriod = useCallback((p: PeriodKey) => {
    setPeriodState(p);
    try {
      window.localStorage.setItem(SHARED_KEY, p);
    } catch { /* noop */ }
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: p }));
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === SHARED_KEY && e.newValue) {
        setPeriodState(e.newValue as PeriodKey);
      }
    };
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent).detail as PeriodKey;
      if (detail) setPeriodState(detail);
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(EVENT_NAME, onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(EVENT_NAME, onCustom);
    };
  }, []);

  return [period, setPeriod];
}
