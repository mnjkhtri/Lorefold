import { useCallback, useEffect, useState } from "react";

import type { GeneratedCatalog, GeneratedThreadDocument } from "../models/static-data";

const DATA_URL = `${import.meta.env.BASE_URL}data/`;
const CATALOG_URL = `${DATA_URL}catalog.json`;

export async function fetchCatalog(): Promise<GeneratedCatalog> {
  const response = await fetch(CATALOG_URL, { cache: "no-store" });
  if (!response.ok) throw new Error(`catalog unavailable (${response.status})`);
  return response.json() as Promise<GeneratedCatalog>;
}

export async function fetchThreadDocument(dataPath: string): Promise<GeneratedThreadDocument> {
  if (!/^threads\/[a-f0-9]{24}\.json$/u.test(dataPath)) throw new Error("invalid thread data path");
  const response = await fetch(`${DATA_URL}${dataPath}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`thread unavailable (${response.status})`);
  return response.json() as Promise<GeneratedThreadDocument>;
}

export function useCatalog() {
  const [catalog, setCatalog] = useState<GeneratedCatalog>();
  const [error, setError] = useState<string>();
  const [newCatalog, setNewCatalog] = useState<GeneratedCatalog>();
  const [refreshing, setRefreshing] = useState(true);

  const refresh = useCallback(async (initial = false) => {
    setRefreshing(true);
    try {
      const next = await fetchCatalog();
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
