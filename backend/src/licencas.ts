import { Router } from "express";
import { z } from "zod";

export const STATUS = [
  "em_preparo", "protocolado", "em_analise", "em_execucao", "exigencia",
  "aprovado", "concluido", "indeferido", "encerrado",
] as const;
export const FASES = ["Licenciamento", "Execução", "Vendas"] as const;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data no formato AAAA-MM-DD");
const optText = z.string().trim().max(2000).optional().nullable().transform((v) => (v ? v : null));

/** Corpo aceito em POST/PUT (camelCase, como no gestor original). */
export const LicencaInput = z
  .object({
    obra: z.string().trim().min(1, "Informe a obra."),
    tipo: z.string().trim().min(1, "Informe a licença ou documento."),
    ordem: z.number().int().positive().optional().nullable(),
    fase: z.enum(FASES).default("Licenciamento"),
    orgao: optText,
    protocolo: optText,
    status: z.enum(STATUS).default("em_preparo"),
    dataProtocolo: isoDate.optional().nullable(),
    duracao: z.number().int().min(0).optional().nullable(),
    vencimento: isoDate.optional().nullable(),
    responsavel: optText,
    notas: optText,
    exemplo: z.boolean().optional(),
  })
  .transform((v) => {
    // término = início + duração (dias corridos)
    if (v.dataProtocolo && v.duracao != null) v.vencimento = addDays(v.dataProtocolo, v.duracao);
    return v;
  })
  .refine((v) => !(v.dataProtocolo && v.vencimento && v.vencimento < v.dataProtocolo), {
    message: "O término não pode ser antes do início.",
    path: ["vencimento"],
  });
export type LicencaInput = z.infer<typeof LicencaInput>;

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

type Row = Record<string, unknown>;

/** API (camelCase) -> colunas do banco (snake_case) */
function toDb(v: LicencaInput): Row {
  return {
    obra: v.obra,
    tipo: v.tipo,
    ordem: v.ordem ?? null,
    fase: v.fase,
    orgao: v.orgao,
    protocolo: v.protocolo,
    status: v.status,
    data_protocolo: v.dataProtocolo ?? null,
    duracao: v.duracao ?? null,
    vencimento: v.vencimento ?? null,
    responsavel: v.responsavel,
    notas: v.notas,
    ...(v.exemplo !== undefined ? { exemplo: v.exemplo } : {}),
  };
}

/** colunas do banco -> API */
function fromDb(r: Row) {
  return {
    id: r.id,
    obra: r.obra,
    tipo: r.tipo,
    ordem: r.ordem,
    fase: r.fase,
    orgao: r.orgao,
    protocolo: r.protocolo,
    status: r.status,
    dataProtocolo: r.data_protocolo,
    duracao: r.duracao,
    vencimento: r.vencimento,
    responsavel: r.responsavel,
    notas: r.notas,
    exemplo: r.exemplo,
    criadoEm: r.criado_em,
    atualizadoEm: r.atualizado_em,
  };
}

export const licencasRouter = Router();

// Papel do usuário logado: null (sem acesso), "leitor" ou "editor"
licencasRouter.get("/me", async (req, res) => {
  const { data, error } = await req.sb!.from("membros").select("papel, nome").eq("user_id", req.user!.id).maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ id: req.user!.id, email: req.user!.email, papel: data?.papel ?? null, nome: data?.nome ?? null });
});

licencasRouter.get("/licencas", async (req, res) => {
  const { data, error } = await req.sb!.from("licencas").select("*").order("vencimento", { ascending: true, nullsFirst: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data.map(fromDb));
});

licencasRouter.post("/licencas", async (req, res) => {
  const parsed = LicencaInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." });
  const { data, error } = await req.sb!.from("licencas").insert(toDb(parsed.data)).select().single();
  if (error) return res.status(statusFor(error.code)).json({ error: messageFor(error.code, error.message) });
  res.status(201).json(fromDb(data));
});

licencasRouter.put("/licencas/:id", async (req, res) => {
  const parsed = LicencaInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." });
  const { data, error } = await req.sb!.from("licencas").update(toDb(parsed.data)).eq("id", req.params.id).select().maybeSingle();
  if (error) return res.status(statusFor(error.code)).json({ error: messageFor(error.code, error.message) });
  if (!data) return res.status(404).json({ error: "Processo não encontrado ou sem permissão para editar." });
  res.json(fromDb(data));
});

licencasRouter.delete("/licencas/:id", async (req, res) => {
  const { data, error } = await req.sb!.from("licencas").delete().eq("id", req.params.id).select("id");
  if (error) return res.status(statusFor(error.code)).json({ error: messageFor(error.code, error.message) });
  if (!data?.length) return res.status(404).json({ error: "Processo não encontrado ou sem permissão para excluir." });
  res.status(204).end();
});

// 42501 = violação de RLS (usuário sem papel de editor)
const statusFor = (code?: string) => (code === "42501" ? 403 : code?.startsWith("23") ? 400 : 500);
const messageFor = (code: string | undefined, msg: string) =>
  code === "42501" ? "Você tem acesso só de leitura a este gestor." : code?.startsWith("23") ? "Dados inválidos: " + msg : msg;
