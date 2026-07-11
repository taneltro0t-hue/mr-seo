"use client";

import { useSyncExternalStore } from "react";
import { checkLicense, cloudEnabled, type LicenseState } from "@/lib/cloud";

/**
 * Единый источник статуса облака для всего приложения. Рэйл (индикатор +
 * badge-точка) и экран /account читают ОДНО и то же состояние через внешний
 * store — лицензия проверяется один раз, без дублей RPC. Паттерн — как у
 * orb-ticker: module-level store + подписки + useSyncExternalStore.
 */

export interface CloudStore {
  state: LicenseState | null;
  loading: boolean;
}

let store: CloudStore = { state: null, loading: cloudEnabled };
const listeners = new Set<() => void>();
let started = false;

function emit() {
  for (const l of listeners) l();
}

/** Перепроверить лицензию и разослать обновление подписчикам. */
export async function refreshCloud(): Promise<LicenseState> {
  store = { state: store.state, loading: true };
  emit();
  const s = await checkLicense();
  store = { state: s, loading: false };
  emit();
  return s;
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  if (!started) {
    started = true;
    void refreshCloud();
  }
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): CloudStore {
  return store;
}

// Стабильная ссылка для SSR/первого рендера — без обращения к localStorage.
const serverSnapshot: CloudStore = cloudEnabled
  ? { state: null, loading: true }
  : { state: { mode: "dev" }, loading: false };

function getServerSnapshot(): CloudStore {
  return serverSnapshot;
}

export function useCloudStatus(): CloudStore {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
