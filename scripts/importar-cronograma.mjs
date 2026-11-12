// Converte a aba "geral" de "cronograma da burocracia.xlsx" em registros da tabela licencas.
// Uso: node scripts/importar-cronograma.mjs "cronograma da burocracia.xlsx" saida.json saida.sql
//
// Regras:
// - linhas 5..37 = etapas (coluna A = nº de ordem, coluna B = etapa); colunas por obra = início | término
// - "ok" em qualquer coluna da obra -> Concluído (datas mantidas se houver)
// - "não necessário" ou célula cinza -> não se aplica (não importa)
// - duas datas -> início, término e duração; só uma data -> término (para "obra pedreiros", vira início)
// - célula amarela = "pedir" e vermelha = "atrasado, cobrar" (legenda da planilha) -> anotado nas observações
// - textos ("renovar", "já pedi", "precisa do nº"...) -> observações, com andamento ajustado
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const [, , xlsx, outJson, outSql] = process.argv;
if (!xlsx) { console.error("Informe o caminho do .xlsx"); process.exit(1); }

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cronograma-"));
execFileSync("tar", ["-xf", path.resolve(xlsx), "-C", tmp]);
const read = (p) => fs.readFileSync(path.join(tmp, p), "utf8");

// ---------- leitura do xlsx ----------
const unxml = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
// cada <si> é um texto; ignora a transcrição fonética (<rPh>) e trata <t/> vazio
const shared = [...read("xl/sharedStrings.xml").matchAll(/<si\b[^>]*?(?:\/>|>([\s\S]*?)<\/si>)/g)].map((m) =>
  unxml([...(m[1] ?? "").replace(/<rPh\b[\s\S]*?<\/rPh>/g, "").matchAll(/<t\b[^>]*?(?:\/>|>([\s\S]*?)<\/t>)/g)].map((t) => t[1] ?? "").join("")));

const styles = read("xl/styles.xml");
const fills = [...(/<fills[^>]*>([\s\S]*?)<\/fills>/.exec(styles)[1]).matchAll(/<fill>([\s\S]*?)<\/fill>|<fill\/>/g)].map((m) => {
  const fg = /<fgColor ([^/]*)\/>/.exec(m[1] || "");
  if (!fg) return null;
  if (/FFFFFF00/.test(fg[1])) return "amarelo";
  if (/FFFF0000/.test(fg[1])) return "vermelho";
  if (/theme="0" tint="-0\.2/.test(fg[1])) return "cinza";
  return "outra";
});
const xfFill = [...(/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(styles)[1]).matchAll(/<xf ([^>]*?)\/?>/g)].map((m) => fills[+(/fillId="(\d+)"/.exec(m[1])?.[1] ?? 0)]);

const sheet = read("xl/worksheets/sheet1.xml");
const cells = {}; // "F10" -> { v, cor, f }
// percorre cada <c ...> ou <c .../>; o conteúdo vai até o próximo </c>
const cellRe = /<c\b([^>]*)>/g;
let cm;
while ((cm = cellRe.exec(sheet))) {
  const attrs = cm[1];
  const ref = /\br="([A-Z]+\d+)"/.exec(attrs)?.[1];
  if (!ref) continue;
  let inner = "";
  if (!attrs.endsWith("/")) {
    const end = sheet.indexOf("</c>", cellRe.lastIndex);
    inner = sheet.slice(cellRe.lastIndex, end);
    cellRe.lastIndex = end + 4;
  }
  const s = /s="(\d+)"/.exec(attrs)?.[1];
  const t = /t="(\w+)"/.exec(attrs)?.[1];
  let v = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
  const f = /<f[^>]*>([\s\S]*?)<\/f>/.exec(inner)?.[1];
  if (t === "s" && v != null) v = shared[+v];
  else if (t === "str" && v != null) v = unxml(v);
  cells[ref] = { v: v ?? "", cor: xfFill[+(s ?? 0)] ?? null, f: f ?? "" };
}
const comments = {};
try {
  for (const m of read("xl/comments1.xml").matchAll(/<comment ref="([A-Z]+\d+)"[\s\S]*?<\/comment>/g))
    comments[m[1]] = unxml([...m[0].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join("")).replace(/\s+/g, " ").trim();
} catch { /* sem comentários */ }

const get = (ref) => cells[ref] ?? { v: "", cor: null, f: "" };
const serialToIso = (n) => new Date(Date.UTC(1899, 11, 30) + Math.round(+n) * 86400000).toISOString().slice(0, 10);
const isDate = (v) => /^\d{5}(\.\d+)?$/.test(String(v)) && +v > 40000 && +v < 60000;
const br = (iso) => iso.split("-").reverse().join("/");

// ---------- obras (blocos de colunas) ----------
const NOMES = { "GÊNOVA": "Gênova", "ROUXINÓIS": "Rouxinóis", "BEIJA-FLOR": "Beija-Flor", "RIVIERA": "Riviera", "san giminiano": "San Gimignano", "florença": "Florença", "amarilis": "Amarílis", "alamanda": "Alamanda", "mediterrâneo": "Mediterrâneo", "canada": "Canadá", "flórida": "Flórida", "califórnia": "Califórnia", "atenas": "Atenas", "míkonos": "Míkonos", "santorini": "Santorini" };
// cada obra = 3 colunas (início | término | concluído?), identificadas pelo cabeçalho "início" da linha 4
const colNum = (s) => [...s].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
const colName = (n) => { let s = ""; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
const BLOCOS = Object.keys(cells)
  .map((ref) => /^([A-Z]+)4$/.exec(ref)?.[1])
  .filter((c) => c && colNum(c) >= colNum("F") && String(get(c + "4").v).trim().toLowerCase() === "início" && String(get(c + "3").v).trim())
  .sort((a, b) => colNum(a) - colNum(b))
  .map((c) => [c, colName(colNum(c) + 1), colName(colNum(c) + 2)]);
const obras = BLOCOS.map(([ini, fim, concl]) => {
  const nome = NOMES[String(get(ini + "1").v).trim()] ?? null;
  const q = String(get(ini + "2").v).trim();
  let l = String(get(ini + "3").v).trim();
  const local = /^[A-Z]$/.test(l) ? `${q} Casa ${l}` : `${q} ${/^\d+$/.test(l) ? "L" + l : l}`;
  return { ini, fim, concl, obra: nome ? `${nome} — ${local}` : local };
});
if (process.env.DEBUG) console.log(obras);

// ---------- etapas ----------
const ETAPAS = {
  "escritura": ["Escritura", "Licenciamento", "Cartório"],
  "desmembramento": ["Desmembramento", "Licenciamento", "Prefeitura Municipal"],
  "certidão de uso ocupação": ["Certidão de uso e ocupação do solo", "Licenciamento", "Prefeitura Municipal"],
  "projeto arquitetônico": ["Projeto arquitetônico", "Licenciamento", "Prefeitura Municipal"],
  "art": ["ART", "Licenciamento", "CREA"],
  "alvará de construção": ["Alvará de Construção", "Licenciamento", "Prefeitura Municipal"],
  "dispença de licença ambiental": ["Dispensa de licença ambiental", "Licenciamento", "Órgão ambiental municipal"],
  "viabilidade caern": ["Viabilidade CAERN", "Licenciamento", "CAERN"],
  "pedir água": ["Pedido de ligação de água", "Licenciamento", "CAERN"],
  "pedir energia da obra": ["Pedido de energia da obra", "Licenciamento", "COSERN"],
  "projetos de engenharia": ["Projetos de engenharia", "Licenciamento", null],
  "aprovação dos bombeiros": ["Aprovação do Corpo de Bombeiros", "Licenciamento", "Corpo de Bombeiros"],
  "aprovação do projeto pela cosern": ["Aprovação do projeto pela COSERN", "Licenciamento", "COSERN"],
  "extensão da iluminação pública": ["Extensão da iluminação pública", "Licenciamento", "Prefeitura Municipal"],
  "extensão da rede da caern": ["Extensão da rede da CAERN", "Licenciamento", "CAERN"],
  "obra pedreiros": ["Obra (pedreiros)", "Execução", null],
  "scpo": ["SCPO", "Licenciamento", "Ministério do Trabalho"],
  "gesso": ["Gesso", "Execução", null],
  "cerâmica": ["Cerâmica", "Execução", null],
  "bancadas": ["Bancadas", "Execução", null],
  "pintura": ["Pintura", "Execução", null],
  "tomadas e interruptores": ["Tomadas e interruptores", "Execução", null],
  "habite-se": ["Habite-se", "Licenciamento", "Prefeitura Municipal"],
  "vistoria dos bombeiros avcb": ["Vistoria dos Bombeiros (AVCB)", "Licenciamento", "Corpo de Bombeiros"],
  "inspeção e ligação do quadro de energia do condomínio": ["Inspeção e ligação do quadro de energia do condomínio", "Licenciamento", "COSERN"],
  "viabilidade caern definitiva": ["Viabilidade CAERN definitiva", "Licenciamento", "CAERN"],
  "averbação": ["Averbação", "Licenciamento", "Cartório de Registro de Imóveis"],
  "instituição de condomínio e matrículas": ["Instituição de condomínio e matrículas", "Licenciamento", "Cartório de Registro de Imóveis"],
  "cadastrar casas novas na tributação": ["Cadastro das casas novas na tributação", "Licenciamento", "Prefeitura (tributação)"],
  "iniciar as vendas": ["Iniciar as vendas", "Vendas", null],
  "laudos": ["Laudos", "Licenciamento", null],
  "assinatura na caixa": ["Assinatura na Caixa", "Licenciamento", "Caixa Econômica Federal"],
  "cnd cno receita federal": ["CND / CNO (Receita Federal)", "Licenciamento", "Receita Federal"],
};

const hoje = new Date().toISOString().slice(0, 10);
const regs = [];
const avisos = [];

for (let row = 5; row <= 37; row++) {
  const etapaRaw = String(get("B" + row).v).trim().toLowerCase();
  if (!etapaRaw) continue;
  const def = ETAPAS[etapaRaw];
  if (!def) { avisos.push(`Etapa não reconhecida na linha ${row}: "${etapaRaw}"`); continue; }
  const [tipo, fase, orgao] = def;
  const ordem = +get("A" + row).v || null;

  for (const o of obras) {
    const ci = get(o.ini + row), cf = get(o.fim + row), cc = o.concl ? get(o.concl + row) : { v: "", cor: null };
    const vals = [ci.v, cf.v, cc.v].map((v) => String(v).trim());
    const temAlgo = vals.some(Boolean);
    if (!temAlgo) continue;
    const lower = vals.map((v) => v.toLowerCase());
    if (lower.includes("não necessário")) continue;
    if (ci.cor === "cinza" && cf.cor === "cinza" && !vals.some((v) => isDate(v))) continue;

    const notas = [];
    const ok = lower.includes("ok");
    const di = isDate(ci.v) ? serialToIso(ci.v) : null;
    const df = isDate(cf.v) ? serialToIso(cf.v) : null;
    const textos = [ci.v, cf.v, cc.v].map((v) => String(v).trim()).filter((v) => v && !isDate(v) && v.toLowerCase() !== "ok");

    let dataProtocolo = null, vencimento = null;
    if (di && df) { dataProtocolo = di; vencimento = df; }
    else if (di && tipo === "Obra (pedreiros)") { dataProtocolo = di; if (!ok) notas.push(`Início da obra ${br(di)}; sem previsão de término na planilha.`); }
    else if (di && String(cf.v).trim()) { dataProtocolo = di; } // início preenchido e término com texto (ex.: "???")
    else if (di || df) { vencimento = di ?? df; }
    if (vencimento && dataProtocolo && vencimento < dataProtocolo) { notas.push(`Na planilha o término (${br(vencimento)}) é antes do início (${br(dataProtocolo)}); término ignorado.`); vencimento = null; }
    const duracao = dataProtocolo && vencimento ? Math.round((Date.parse(vencimento) - Date.parse(dataProtocolo)) / 86400000) : null;

    if (/TODAY\(\)/i.test(cf.f) || /TODAY\(\)/i.test(ci.f)) notas.push("Na planilha esta data é a fórmula HOJE(); importada com a data salva no arquivo.");
    for (const t of textos) notas.push(`Na planilha: ${t}`);
    for (const ref of [o.ini + row, o.fim + row]) if (comments[ref]) notas.push(`Comentário na planilha: ${comments[ref]}`);
    const cores = new Set([ci.cor, cf.cor]);
    if (!ok && cores.has("amarelo")) notas.push("Marcado em amarelo na planilha (pedir).");
    if (!ok && cores.has("vermelho")) notas.push("Marcado em vermelho na planilha (atrasado, cobrar).");

    let status;
    const tl = textos.join(" ").toLowerCase();
    if (ok) status = "concluido";
    else if (/já pedi|solicitei/.test(tl) || comments[o.ini + row]?.toLowerCase().includes("solicitei")) status = "protocolado";
    else if (!dataProtocolo && !vencimento) status = "em_preparo";
    else {
      // sem início: etapas de obra/vendas com término futuro ainda não começaram
      const comecou = dataProtocolo ? dataProtocolo <= hoje : fase === "Licenciamento" || vencimento <= hoje;
      status = !comecou ? "em_preparo" : fase === "Licenciamento" ? "em_analise" : "em_execucao";
    }

    regs.push({ obra: o.obra, tipo, ordem, fase, orgao, protocolo: null, status, dataProtocolo, duracao, vencimento, responsavel: null, notas: notas.length ? notas.join(" ") : null });
  }
}

fs.rmSync(tmp, { recursive: true, force: true });

const q = (v) => (v == null ? "null" : typeof v === "number" ? String(v) : "'" + String(v).replace(/'/g, "''") + "'");
const sql = "insert into public.licencas (obra, tipo, ordem, fase, orgao, protocolo, status, data_protocolo, duracao, vencimento, responsavel, notas) values\n" +
  regs.map((r) => `(${[r.obra, r.tipo, r.ordem, r.fase, r.orgao, r.protocolo, r.status, r.dataProtocolo, r.duracao, r.vencimento, r.responsavel, r.notas].map(q).join(", ")})`).join(",\n") + ";\n";

if (outJson) fs.writeFileSync(outJson, JSON.stringify(regs, null, 2));
if (outSql) fs.writeFileSync(outSql, sql);

const by = (k) => regs.reduce((a, r) => ((a[r[k]] = (a[r[k]] ?? 0) + 1), a), {});
console.log(JSON.stringify({ total: regs.length, porStatus: by("status"), porObra: by("obra"), avisos }, null, 2));
