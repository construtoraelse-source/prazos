import { daysLeft, fmt, urgency } from "../lib/dates";
import { CLOSED, STATUS_LABEL, type Licenca } from "../lib/types";

export function LicencaRow({ r, showObra, onOpen }: { r: Licenca; showObra: boolean; onOpen: (r: Licenca) => void }) {
  const u = urgency(r);
  const n = daysLeft(r.vencimento);

  let d: string, unit: string;
  if (r.status === "concluido") { d = "✓"; unit = "concluído"; }
  else if (CLOSED.has(r.status)) { d = "—"; unit = "encerrado"; }
  else if (n === null) { d = "—"; unit = "sem prazo"; }
  else if (n === 0) { d = "HOJE"; unit = "vence"; }
  else if (n < 0) { d = String(-n); unit = -n === 1 ? "dia atraso" : "dias atraso"; }
  else { d = String(n); unit = n === 1 ? "dia" : "dias"; }

  return (
    <button type="button" className={`row u-${u}`} onClick={() => onOpen(r)} aria-label={`${r.tipo} — ${r.obra}. Abrir para editar`}>
      <span className="stripe" />
      <span className="days"><span className="d">{d}</span><span className="u">{unit}</span></span>
      <span className="main">
        <span className="t">
          {r.ordem != null && <span className="ord" title="Nº de ordem da etapa">{String(r.ordem).padStart(2, "0")}</span>}
          <span>{r.tipo || "Sem tipo"}</span>
          {r.exemplo && <span className="tag-ex">exemplo</span>}
        </span>
        <span className="sub">
          {showObra && <span>{r.obra}</span>}
          {r.fase !== "Licenciamento" && <span>{r.fase}</span>}
          {r.orgao && <span>{r.orgao}</span>}
          {r.protocolo && <span className="mono">Proc. {r.protocolo}</span>}
          {r.dataProtocolo && (
            <span className="mono">
              Início {fmt(r.dataProtocolo)}
              {r.duracao != null ? ` · ${r.duracao} ${r.duracao === 1 ? "dia" : "dias"}` : ""}
            </span>
          )}
          {r.responsavel && <span>Resp.: {r.responsavel}</span>}
        </span>
      </span>
      <span className="side">
        <span className={`pill st-${r.status}`}>{STATUS_LABEL[r.status] ?? "Em preparo"}</span>
        <span className="date">{r.vencimento ? "Término " + fmt(r.vencimento) : ""}</span>
      </span>
    </button>
  );
}
