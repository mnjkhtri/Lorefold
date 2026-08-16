import { useCallback, useEffect, useState } from "react";

import type { GeneratedCatalog } from "../models/static-data";

const CATALOG_URL = `${import.meta.env.BASE_URL}data/lkml.json`;
const CATALOG_CACHE_KEY = "lorefold.catalog";

function cachedCatalog(): GeneratedCatalog | undefined {
  try {
    const value = localStorage.getItem(CATALOG_CACHE_KEY);
    return value === null ? undefined : JSON.parse(value) as GeneratedCatalog;
  } catch {
    return undefined;
  }
}

export async function fetchCatalog(): Promise<GeneratedCatalog> {
  const response = await fetch(CATALOG_URL, { cache: "no-store" });
  if (!response.ok) throw new Error(`catalog unavailable (${response.status})`);
  return response.json() as Promise<GeneratedCatalog>;
}

export function useCatalog() {
  const [catalog, setCatalog] = useState<GeneratedCatalog | undefined>(cachedCatalog);
  const [error, setError] = useState<string>();
  const [newCatalog, setNewCatalog] = useState<GeneratedCatalog>();
  const [refreshing, setRefreshing] = useState(true);

  const refresh = useCallback(async (initial = false) => {
    setRefreshing(true);
    try {
      const next = await fetchCatalog();
      localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(next));
      setError(undefined);
      if (initial) setCatalog(next);
      else if (catalog?.generatedAt !== next.generatedAt) setNewCatalog(next);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "catalog unavailable");
    } finally {
      setRefreshing(false);
    }
  }, [catalog?.generatedAt]);

  useEffect(() => {
    void refresh(true);
    const timer = window.setInterval(() => void refresh(false), 60_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const applyNewCatalog = () => {
    if (newCatalog !== undefined) {
      setCatalog(newCatalog);
      setNewCatalog(undefined);
    }
  };

  return { catalog, error, newCatalog, refreshing, applyNewCatalog, refresh: () => refresh(false) };
}
