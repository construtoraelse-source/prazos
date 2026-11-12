import { sortRows, urgency } from "../lib/dates";
import type { Licenca } from "../lib/types";
import { LicencaRow } from "./LicencaRow";

export function LicencaList({ rows, view, onOpen }: { rows: Licenca[]; view: "prazo" | "obra"; onOpen: (r: Licenca) => void }) {
  const sorted = [...rows].sort(sortRows);

  if (view === "prazo") {
    return <div className="list">{sorted.map((r) => <LicencaRow key={r.id} r={r} showObra onOpen={onOpen} />)}</div>;
  }

  const groups = new Map<string, Licenca[]>();
  sorted.forEach((r) => { const k = r.obra || "Sem obra"; if (!groups.has(k)) groups.set(k, []); groups.get(k)!.push(r); });

  // obras com pendência mais urgente primeiro; dentro de cada obra, pela sequência das etapas
  return (
    <>
      {[...groups.entries()].sort((a, b) => sortRows(a[1][0], b[1][0])).map(([obra, list]) => {
        const late = list.filter((r) => urgency(r) === "late").length;
        const soon = list.filter((r) => urgency(r) === "soon").length;
        let meta = list.length + (list.length === 1 ? " processo" : " processos");
        if (late) meta += ` · ${late} vencido${late > 1 ? "s" : ""}`;
        if (soon) meta += ` · ${soon} em até 15 dias`;
        const seq = [...list].sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999) || sortRows(a, b));
        return (
          <section key={obra}>
            <div className="group-h"><h2>{obra}</h2><span className="meta">{meta}</span></div>
            <div className="list">{seq.map((r) => <LicencaRow key={r.id} r={r} showObra={false} onOpen={onOpen} />)}</div>
          </section>
        );
      })}
    </>
  );
}
