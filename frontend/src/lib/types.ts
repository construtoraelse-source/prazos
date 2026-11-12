export const STATUS = [
  ["em_preparo", "Em preparo"],
  ["protocolado", "Protocolado"],
  ["em_analise", "Em análise"],
  ["em_execucao", "Em execução"],
  ["exigencia", "Com exigência"],
  ["aprovado", "Aprovado / vigente"],
  ["concluido", "Concluído"],
  ["indeferido", "Indeferido"],
  ["encerrado", "Encerrado / arquivado"],
] as const;

export type Status = (typeof STATUS)[number][0];
export const STATUS_LABEL = Object.fromEntries(STATUS) as Record<Status, string>;
export const CLOSED = new Set<Status>(["indeferido", "encerrado", "concluido"]);
export const FASES = ["Licenciamento", "Execução", "Vendas"] as const;
export type Fase = (typeof FASES)[number];

export interface Licenca {
  id: string;
  obra: string;
  tipo: string;
  ordem: number | null;
  fase: Fase;
  orgao: string | null;
  protocolo: string | null;
  status: Status;
  dataProtocolo: string | null; // AAAA-MM-DD
  duracao: number | null;
  vencimento: string | null; // AAAA-MM-DD
  responsavel: string | null;
  notas: string | null;
  exemplo: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export type LicencaInput = Omit<Licenca, "id" | "criadoEm" | "atualizadoEm" | "exemplo"> & { exemplo?: boolean };

export interface Me {
  id: string;
  email: string | null;
  papel: "leitor" | "editor" | null;
  nome: string | null;
}

export const TIPOS = ["Consulta prévia / Certidão de uso do solo", "Aprovação de projeto arquitetônico", "Alvará de Construção", "Alvará de Demolição", "Licença de Terraplenagem", "Licença Ambiental Prévia (LP)", "Licença de Instalação (LI)", "Licença de Operação (LO)", "Autorização de supressão vegetal", "Outorga de uso da água", "Estudo de Impacto de Vizinhança (EIV)", "Projeto de prevenção contra incêndio (PPCI)", "AVCB / Certificado do Corpo de Bombeiros", "ART / RRT", "Aprovação concessionária (água/esgoto)", "Aprovação concessionária (energia)", "Habite-se / Certificado de Conclusão", "CND de obra (INSS)", "Matrícula CNO"];
export const ORGAOS = ["Prefeitura Municipal", "Secretaria de Urbanismo", "Secretaria de Meio Ambiente", "Órgão ambiental estadual", "Corpo de Bombeiros", "CREA", "CAU", "Concessionária de água", "Concessionária de energia", "Receita Federal", "Cartório de Registro de Imóveis"];

// sequência da coluna A do "cronograma da burocracia"
export const ORDEM: Record<string, number> = { "Escritura": 1, "Desmembramento": 2, "Certidão de uso e ocupação do solo": 3, "Projeto arquitetônico": 4, "ART": 5, "Alvará de Construção": 6, "Dispensa de licença ambiental": 7, "Viabilidade CAERN": 8, "Pedido de ligação de água": 9, "Pedido de energia da obra": 10, "Projetos de engenharia": 11, "Aprovação do Corpo de Bombeiros": 12, "Aprovação do projeto pela COSERN": 13, "Extensão da iluminação pública": 14, "Extensão da rede da CAERN": 15, "Obra (pedreiros)": 16, "SCPO": 17, "Gesso": 18, "Cerâmica": 19, "Bancadas": 20, "Pintura": 21, "Tomadas e interruptores": 22, "Habite-se": 23, "Vistoria dos Bombeiros (AVCB)": 24, "Inspeção e ligação do quadro de energia do condomínio": 25, "Viabilidade CAERN definitiva": 26, "Averbação": 27, "Instituição de condomínio e matrículas": 28, "Cadastro das casas novas na tributação": 29, "Iniciar as vendas": 30, "Laudos": 31, "Assinatura na Caixa": 32 };
