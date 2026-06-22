import { useState, useEffect, useCallback } from "react";

const SHARED_KEY = "aura:shared-category";
const EVENT_NAME = "aura:category-changed";

/**
 * Shared category filter value.
 * Sentinels:
 *  - "all"       → no filter
 *  - "__uncat__" → uncategorized
 *  - any other   → exact category name
 */
export type SharedCategory = string;

function readCategory(): SharedCategory {
  if (typeof window === "undefined") return "all";
  try {
    const raw = window.localStorage.getItem(SHARED_KEY);
    if (raw) return raw;
  } catch {
    /* noop */
  }
  return "all";
}

export function useSharedCategory(): [SharedCategory, (c: SharedCategory) => void] {
  const [category, setCategoryState] = useState<SharedCategory>(readCategory);

  const setCategory = useCallback((c: SharedCategory) => {
    setCategoryState(c);
    try {
      window.localStorage.setItem(SHARED_KEY, c);
    } catch {
      /* noop */
    }
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: c }));
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === SHARED_KEY && e.newValue) {
        setCategoryState(e.newValue);
      }
    };
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent).detail as SharedCategory;
      if (detail) setCategoryState(detail);
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(EVENT_NAME, onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(EVENT_NAME, onCustom);
    };
  }, []);

  return [category, setCategory];
}
