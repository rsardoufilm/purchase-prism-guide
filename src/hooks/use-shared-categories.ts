import { useState, useEffect, useCallback } from "react";

const SHARED_KEY = "aura:shared-categories";
const EVENT_NAME = "aura:categories-changed";

export type SharedCategories = string[];

function readCategories(): SharedCategories {
  if (typeof window === "undefined") return ["all"];
  try {
    const raw = window.localStorage.getItem(SHARED_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    /* noop */
  }
  return ["all"];
}

export function useSharedCategories(): [SharedCategories, (c: SharedCategories) => void] {
  const [categories, setCategoriesState] = useState<SharedCategories>(readCategories);

  const setCategories = useCallback((next: SharedCategories) => {
    const normalized = next.length === 0 ? ["all"] : next;
    setCategoriesState(normalized);
    try {
      window.localStorage.setItem(SHARED_KEY, JSON.stringify(normalized));
    } catch {
      /* noop */
    }
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: normalized }));
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === SHARED_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) setCategoriesState(parsed.length ? parsed : ["all"]);
        } catch {
          /* noop */
        }
      }
    };
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent).detail as SharedCategories;
      if (Array.isArray(detail)) setCategoriesState(detail.length ? detail : ["all"]);
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(EVENT_NAME, onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(EVENT_NAME, onCustom);
    };
  }, []);

  return [categories, setCategories];
}
