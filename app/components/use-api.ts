"use client";

import { useEffect, useState } from "react";

interface State<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/** Минимальный fetch-хук с перезапросом при смене url. */
export function useApi<T>(url: string): State<T> {
  const [state, setState] = useState<State<T>>({ data: null, loading: true, error: null });

  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: T) => {
        if (alive) setState({ data, loading: false, error: null });
      })
      .catch((e) => {
        if (alive) setState({ data: null, loading: false, error: String(e) });
      });
    return () => {
      alive = false;
    };
  }, [url]);

  return state;
}
