"use client";

import { createClient, type Session } from "@supabase/supabase-js";

/**
 * Mr.Seo Cloud (P2): magic-link auth + лицензия + device-bind.
 * До задания env-переменных работает режим DEV (всё разрешено) —
 * приложение не ломается у разработчика без облака.
 */
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const cloudEnabled = Boolean(URL_ && KEY);

export const supabase = cloudEnabled ? createClient(URL_, KEY) : null;

export type LicenseState = {
  mode: "dev" | "anon" | "licensed" | "expired";
  email?: string;
  plan?: string;
  expiresAt?: string;
  error?: string;
};

/** Стабильный id устройства (localStorage; в Tauri заменим на machine-id). */
export function deviceId(): string {
  const k = "mrseo-device-id";
  let v = localStorage.getItem(k);
  if (!v) {
    v = crypto.randomUUID();
    localStorage.setItem(k, v);
  }
  return v;
}

export async function sendMagicLink(email: string): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: "облако не настроено" };
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin + "/account" },
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function currentSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function checkLicense(): Promise<LicenseState> {
  if (!cloudEnabled) return { mode: "dev" };
  const session = await currentSession();
  if (!session) return { mode: "anon" };
  const { data, error } = await supabase!.rpc("register_device", {
    p_device_id: deviceId(),
    p_label: navigator.platform,
  });
  if (error) return { mode: "anon", email: session.user.email ?? "", error: error.message };
  if (data?.ok) {
    return { mode: "licensed", email: session.user.email ?? "", plan: data.plan, expiresAt: data.expires_at };
  }
  return { mode: "expired", email: session.user.email ?? "", error: data?.error };
}

export async function signOut() {
  await supabase?.auth.signOut();
}
