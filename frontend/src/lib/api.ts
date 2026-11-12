import { supabase } from "./supabase";
import type { Licenca, LicencaInput, Me } from "./types";

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(BASE + "/api" + path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Erro ${res.status}`);
  return body as T;
}

export const api = {
  me: () => call<Me>("/me"),
  list: () => call<Licenca[]>("/licencas"),
  create: (v: LicencaInput) => call<Licenca>("/licencas", { method: "POST", body: JSON.stringify(v) }),
  update: (id: string, v: LicencaInput) => call<Licenca>(`/licencas/${id}`, { method: "PUT", body: JSON.stringify(v) }),
  remove: (id: string) => call<void>(`/licencas/${id}`, { method: "DELETE" }),
};
