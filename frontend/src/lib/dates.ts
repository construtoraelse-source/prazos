import { CLOSED, type Licenca } from "./types";

export const parse = (s?: string | null): Date | null => {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
export const fmt = (s?: string | null) => {
  const d = parse(s);
  return d ? d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
};
export const iso = (d: Date) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
export const addDays = (s: string, n: number) => { const d = parse(s); if (!d) return ""; d.setDate(d.getDate() + n); return iso(d); };
export const diffDays = (a?: string | null, b?: string | null) => { const x = parse(a), y = parse(b); return x && y ? Math.round((y.getTime() - x.getTime()) / 86400000) : null; };
export const daysLeft = (s?: string | null) => { const d = parse(s); return d ? Math.round((d.getTime() - today().getTime()) / 86400000) : null; };

export type Urgency = "late" | "soon" | "warn" | "ok" | "none";
export const BUCKETS: [Urgency, string][] = [["late", "Vencidos"], ["soon", "Até 15 dias"], ["warn", "16 a 45 dias"], ["ok", "Em dia"], ["none", "Sem prazo / encerrados"]];

export function urgency(r: Licenca): Urgency {
  if (CLOSED.has(r.status)) return "none";
  const n = daysLeft(r.vencimento);
  if (n === null) return "none";
  if (n < 0) return "late";
  if (n <= 15) return "soon";
  if (n <= 45) return "warn";
  return "ok";
}

const order: Record<Urgency, number> = { late: 0, soon: 1, warn: 2, ok: 3, none: 4 };
export function sortRows(a: Licenca, b: Licenca) {
  const ua = order[urgency(a)], ub = order[urgency(b)];
  if (ua !== ub) return ua - ub;
  const da = daysLeft(a.vencimento), db = daysLeft(b.vencimento);
  if (da !== null && db !== null && da !== db) return da - db;
  return (a.obra || "").localeCompare(b.obra || "", "pt-BR");
}
