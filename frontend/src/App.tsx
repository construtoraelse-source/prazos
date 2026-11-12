import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import { api } from "./lib/api";
import { BUCKETS, urgency, type Urgency } from "./lib/dates";
import { CLOSED, STATUS, type Licenca, type LicencaInput, type Me } from "./lib/types";
import { Login } from "./components/Login";
import { LicencaList } from "./components/LicencaList";
import { EditPanel } from "./components/EditPanel";

type View = "prazo" | "obra";
const readView = (): View => { try { return localStorage.getItem("pl-view") === "obra" ? "obra" : "prazo"; } catch { return "prazo"; } };
const uniq = (a: (string | null)[]) => [...new Set(a.filter((x): x is string => !!x))].sort((x, y) => x.localeCompare(y, "pt-BR"));

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (session === undefined) return null;
  if (!session) return <Login />;
  return <Gestor />;
}

function Gestor() {
  const [me, setMe] = useState<Me | null>(null);
  const [rows, setRows] = useState<Licenca[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [banner, setBanner] = useState("");
  const [bucket, setBucket] = useState<Urgency | "">("");
  const [obra, setObra] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [view, setViewState] = useState<View>(readView);
  const [editing, setEditing] = useState<Licenca | null | "novo">(null);
  const [toast, setToast] = useState("");

  const canWrite = me?.papel === "editor";

  const load = useCallback(async () => {
    try {
      const [m, list] = await Promise.all([api.me(), api.list()]);
      setMe(m); setRows(list); setBanner(m.papel ? "" : "Seu usuário ainda não foi liberado no gestor. Peça a um administrador para incluí-lo.");
    } catch (e) {
      setBanner(e instanceof Error ? e.message : "Não foi possível carregar os processos.");
    } finally { setLoaded(true); }
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 2600); return () => clearTimeout(t); }, [toast]);

  const setView = (v: View) => { setViewState(v); try { localStorage.setItem("pl-view", v); } catch { /* ignora */ } };

  const counts = useMemo(() => { const c: Record<Urgency, number> = { late: 0, soon: 0, warn: 0, ok: 0, none: 0 }; rows.forEach((r) => c[urgency(r)]++); return c; }, [rows]);
  const obras = useMemo(() => uniq(rows.map((r) => r.obra)), [rows]);
  const suggestions = useMemo(() => ({ obras, tipos: uniq(rows.map((r) => r.tipo)), orgaos: uniq(rows.map((r) => r.orgao)), responsaveis: uniq(rows.map((r) => r.responsavel)) }), [rows, obras]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (bucket && urgency(r) !== bucket) return false;
      if (obra && r.obra !== obra) return false;
      if (status === "ativos" && (CLOSED.has(r.status) || r.status === "aprovado")) return false;
      if (status && status !== "ativos" && r.status !== status) return false;
      if (s && ![r.obra, r.tipo, r.orgao, r.protocolo, r.responsavel, r.notas].join(" ").toLowerCase().includes(s)) return false;
      return true;
    });
  }, [rows, bucket, obra, status, q]);

  async function save(v: LicencaInput) {
    if (editing && editing !== "novo") {
      const upd = await api.update(editing.id, v);
      setRows((p) => p.map((r) => (r.id === upd.id ? upd : r))); setToast("Processo atualizado");
    } else {
      const created = await api.create(v);
      setRows((p) => [...p, created]); setToast("Processo cadastrado");
    }
    setEditing(null);
  }
  async function remove() {
    if (!editing || editing === "novo") return;
    await api.remove(editing.id);
    setRows((p) => p.filter((r) => r.id !== editing.id)); setEditing(null); setToast("Processo excluído");
  }

  const hasFilter = !!(bucket || obra || status || q);
  const hoje = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="wrap">
      <header className="top">
        <div>
          <div className="eyebrow">{hoje}</div>
          <h1>Prazos de Licenciamento</h1>
        </div>
        <div className="top-actions">
          <span className="who">{me?.nome || me?.email}{me?.papel === "leitor" ? " · só leitura" : ""}</span>
          <button className="btn" type="button" onClick={() => supabase.auth.signOut()}>Sair</button>
          {canWrite && <button className="btn primary" type="button" onClick={() => setEditing("novo")}>+ Novo processo</button>}
        </div>
      </header>

      {banner && <div className="banner">{banner}</div>}

      <section className="summary" aria-label="Resumo por situação do prazo">
        {BUCKETS.map(([k, label]) => (
          <button key={k} type="button" className={`sum u-${k}`} aria-pressed={bucket === k} onClick={() => setBucket(bucket === k ? "" : k)}>
            <span className="n">{loaded ? counts[k] : "–"}</span><span className="l">{label}</span>
          </button>
        ))}
      </section>

      <div className="filters">
        <input type="search" placeholder="Buscar obra, licença, órgão, protocolo…" aria-label="Buscar" value={q} onChange={(e) => setQ(e.target.value)} />
        <select aria-label="Filtrar por obra" value={obra} onChange={(e) => setObra(e.target.value)}>
          <option value="">Todas as obras</option>
          {obras.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <select aria-label="Filtrar por andamento" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todo andamento</option>
          <option value="ativos">Só em aberto</option>
          {STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <div className="seg" role="group" aria-label="Agrupar">
          <button type="button" aria-pressed={view === "prazo"} onClick={() => setView("prazo")}>Por prazo</button>
          <button type="button" aria-pressed={view === "obra"} onClick={() => setView("obra")}>Por obra</button>
        </div>
        {hasFilter && <button type="button" className="chipclear" onClick={() => { setBucket(""); setObra(""); setStatus(""); setQ(""); }}>Limpar filtros</button>}
      </div>

      {!loaded ? (
        <div className="state"><strong>Carregando processos…</strong></div>
      ) : !rows.length ? (
        <div className="state">
          <strong>Nenhum processo cadastrado</strong>
          <span>Cadastre cada licença de cada obra com o prazo dela. A lista se ordena sozinha pelo que vence primeiro.</span>
          {canWrite && <button className="btn primary" type="button" onClick={() => setEditing("novo")}>+ Cadastrar o primeiro processo</button>}
        </div>
      ) : !filtered.length ? (
        <div className="state"><strong>Nada com esses filtros</strong><span>Ajuste a busca ou clique em Limpar filtros.</span></div>
      ) : (
        <LicencaList rows={filtered} view={view} onOpen={setEditing} />
      )}

      <div className="legend">
        <span className="u-late">Vencido</span>
        <span className="u-soon">Vence em até 15 dias</span>
        <span className="u-warn">16 a 45 dias</span>
        <span className="u-ok">Mais de 45 dias</span>
        <span className="u-none">Sem prazo, concluído ou encerrado</span>
      </div>

      {editing && (
        <EditPanel
          licenca={editing === "novo" ? null : editing}
          canWrite={canWrite}
          defaultObra={obra}
          suggestions={suggestions}
          onClose={() => setEditing(null)}
          onSave={save}
          onDelete={remove}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
