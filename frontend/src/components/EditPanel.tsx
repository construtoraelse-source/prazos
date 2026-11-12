import { useEffect, useRef, useState } from "react";
import { addDays, diffDays } from "../lib/dates";
import { FASES, ORDEM, ORGAOS, STATUS, TIPOS, type Fase, type Licenca, type LicencaInput, type Status } from "../lib/types";

interface Props {
  licenca: Licenca | null; // null = novo
  canWrite: boolean;
  defaultObra: string;
  suggestions: { obras: string[]; tipos: string[]; orgaos: string[]; responsaveis: string[] };
  onClose: () => void;
  onSave: (v: LicencaInput) => Promise<void>;
  onDelete: () => Promise<void>;
}

type Form = Record<"obra" | "tipo" | "ordem" | "orgao" | "protocolo" | "dataProtocolo" | "duracao" | "vencimento" | "responsavel" | "notas", string> & { fase: Fase; status: Status };

const toForm = (r: Licenca | null, obra: string): Form => ({
  obra: r?.obra ?? obra,
  tipo: r?.tipo ?? "",
  ordem: r?.ordem != null ? String(r.ordem) : "",
  fase: r?.fase ?? "Licenciamento",
  orgao: r?.orgao ?? "",
  protocolo: r?.protocolo ?? "",
  status: r?.status ?? "em_preparo",
  dataProtocolo: r?.dataProtocolo ?? "",
  duracao: r?.duracao != null ? String(r.duracao) : "",
  vencimento: r?.vencimento ?? "",
  responsavel: r?.responsavel ?? "",
  notas: r?.notas ?? "",
});

export function EditPanel({ licenca, canWrite, defaultObra, suggestions, onClose, onSave, onDelete }: Props) {
  const [f, setF] = useState<Form>(() => toForm(licenca, defaultObra));
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [armed, setArmed] = useState(false);
  const first = useRef<HTMLInputElement>(null);

  useEffect(() => { first.current?.focus(); }, []);
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); document.addEventListener("keydown", k); return () => document.removeEventListener("keydown", k); }, [onClose]);
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(false), 4000); return () => clearTimeout(t); }, [armed]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));

  // término = início + duração; mudar o término com início preenchido recalcula a duração
  const onInicio = (v: string) => setF((p) => { const n = parseInt(p.duracao, 10); return { ...p, dataProtocolo: v, vencimento: v && n >= 0 ? addDays(v, n) : p.vencimento }; });
  const onDuracao = (v: string) => setF((p) => { const n = parseInt(v, 10); return { ...p, duracao: v, vencimento: p.dataProtocolo && n >= 0 ? addDays(p.dataProtocolo, n) : p.vencimento }; });
  const onTermino = (v: string) => setF((p) => { const d = diffDays(p.dataProtocolo, v); return { ...p, vencimento: v, duracao: d !== null && d >= 0 ? String(d) : p.duracao }; });
  const onTipo = (v: string) => setF((p) => ({ ...p, tipo: v, ordem: p.ordem || (ORDEM[v.trim()] ? String(ORDEM[v.trim()]) : "") }));

  async function save() {
    if (saving) return;
    const obra = f.obra.trim(), tipo = f.tipo.trim();
    if (!obra) return setErr("Informe a obra.");
    if (!tipo) return setErr("Informe a licença ou documento.");
    let duracao: number | null = null, ordem: number | null = null;
    if (f.duracao.trim() !== "") { duracao = parseInt(f.duracao, 10); if (!(duracao >= 0)) return setErr("A duração deve ser um número inteiro de dias (0 ou mais)."); }
    if (f.ordem.trim() !== "") { ordem = parseInt(f.ordem, 10); if (!(ordem > 0)) return setErr("O nº de ordem deve ser um número inteiro maior que zero."); }
    const dataProtocolo = f.dataProtocolo || null;
    const vencimento = dataProtocolo && duracao != null ? addDays(dataProtocolo, duracao) : f.vencimento || null;
    if (dataProtocolo && vencimento && (diffDays(dataProtocolo, vencimento) ?? 0) < 0) return setErr("O término não pode ser antes do início.");
    const t = (s: string) => s.trim() || null;
    setSaving(true); setErr("");
    try {
      await onSave({ obra, tipo, ordem, fase: f.fase, orgao: t(f.orgao), protocolo: t(f.protocolo), status: f.status, dataProtocolo, duracao, vencimento, responsavel: t(f.responsavel), notas: t(f.notas), ...(licenca?.exemplo ? { exemplo: true } : {}) });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Não foi possível salvar agora.");
    } finally { setSaving(false); }
  }

  async function del() {
    if (!armed) return setArmed(true);
    try { await onDelete(); } catch (e) { setErr(e instanceof Error ? e.message : "Não foi possível excluir agora."); }
  }

  const ro = !canWrite;
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="panel" role="dialog" aria-modal="true" aria-labelledby="panelTitle">
        <div className="panel-h">
          <h3 id="panelTitle">{licenca ? (canWrite ? "Editar processo" : "Detalhes do processo") : "Novo processo"}</h3>
          <button className="x" type="button" onClick={onClose} aria-label="Fechar">×</button>
        </div>
        <form className="f" noValidate onSubmit={(e) => { e.preventDefault(); save(); }}>
          <div className="fld">
            <label htmlFor="obra">Obra *</label>
            <input id="obra" ref={first} list="dlObras" disabled={ro} value={f.obra} onChange={(e) => set("obra", e.target.value)} placeholder="Ex.: Residencial Vila Nova — Torre B" />
            <datalist id="dlObras">{suggestions.obras.map((o) => <option key={o} value={o} />)}</datalist>
          </div>
          <div className="fld">
            <label htmlFor="tipo">Licença / documento *</label>
            <input id="tipo" list="dlTipos" disabled={ro} value={f.tipo} onChange={(e) => onTipo(e.target.value)} placeholder="Ex.: Alvará de Construção" />
            <datalist id="dlTipos">{[...new Set([...TIPOS, ...suggestions.tipos])].map((o) => <option key={o} value={o} />)}</datalist>
          </div>
          <div className="two">
            <div className="fld">
              <label htmlFor="ordem">Nº de ordem</label>
              <input id="ordem" type="number" min={1} step={1} inputMode="numeric" disabled={ro} value={f.ordem} onChange={(e) => set("ordem", e.target.value)} placeholder="Ex.: 6" />
            </div>
            <div className="fld">
              <label htmlFor="fase">Fase</label>
              <select id="fase" disabled={ro} value={f.fase} onChange={(e) => set("fase", e.target.value as Fase)}>
                {FASES.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </div>
          </div>
          <div className="two">
            <div className="fld">
              <label htmlFor="orgao">Órgão</label>
              <input id="orgao" list="dlOrgaos" disabled={ro} value={f.orgao} onChange={(e) => set("orgao", e.target.value)} placeholder="Ex.: Prefeitura / SMU" />
              <datalist id="dlOrgaos">{[...new Set([...ORGAOS, ...suggestions.orgaos])].map((o) => <option key={o} value={o} />)}</datalist>
            </div>
            <div className="fld">
              <label htmlFor="protocolo">Nº do processo / protocolo</label>
              <input id="protocolo" disabled={ro} value={f.protocolo} onChange={(e) => set("protocolo", e.target.value)} placeholder="Ex.: 2026/014.553" />
            </div>
          </div>
          <div className="fld">
            <label htmlFor="status">Andamento</label>
            <select id="status" disabled={ro} value={f.status} onChange={(e) => set("status", e.target.value as Status)}>
              {STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="three">
            <div className="fld">
              <label htmlFor="dataProtocolo">Início</label>
              <input id="dataProtocolo" type="date" disabled={ro} value={f.dataProtocolo} onChange={(e) => onInicio(e.target.value)} />
            </div>
            <div className="fld">
              <label htmlFor="duracao">Duração (dias)</label>
              <input id="duracao" type="number" min={0} step={1} inputMode="numeric" disabled={ro} value={f.duracao} onChange={(e) => onDuracao(e.target.value)} placeholder="Ex.: 30" />
            </div>
            <div className="fld">
              <label htmlFor="vencimento">Término</label>
              <input id="vencimento" type="date" disabled={ro} value={f.vencimento} onChange={(e) => onTermino(e.target.value)} />
            </div>
          </div>
          <div className="hint">Término = início + duração, em dias corridos, calculado automaticamente. Se mudar o término, a duração se ajusta. Sem data de início, informe direto o término.</div>
          <div className="fld">
            <label htmlFor="responsavel">Responsável</label>
            <input id="responsavel" list="dlResp" disabled={ro} value={f.responsavel} onChange={(e) => set("responsavel", e.target.value)} placeholder="Quem acompanha este processo" />
            <datalist id="dlResp">{suggestions.responsaveis.map((o) => <option key={o} value={o} />)}</datalist>
          </div>
          <div className="fld">
            <label htmlFor="notas">Observações</label>
            <textarea id="notas" disabled={ro} value={f.notas} onChange={(e) => set("notas", e.target.value)} placeholder="Exigências, contatos no órgão, documentos pendentes…" />
          </div>
          {err && <div className="err">{err}</div>}
        </form>
        <div className="panel-f">
          {licenca && canWrite ? (
            <button className={`btn danger${armed ? " armed" : ""}`} type="button" onClick={del}>{armed ? "Confirmar exclusão" : "Excluir"}</button>
          ) : <span />}
          <div className="r">
            <button className="btn" type="button" onClick={onClose}>{canWrite ? "Cancelar" : "Fechar"}</button>
            {canWrite && <button className="btn primary" type="button" onClick={save} disabled={saving}>Salvar</button>}
          </div>
        </div>
      </aside>
    </>
  );
}
