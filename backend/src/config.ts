import "dotenv/config";

// Valores padrão do projeto Supabase (públicos: a chave publicável não dá acesso sem login + RLS)
const DEFAULT_URL = "https://razvvvtsvtigogvumgpi.supabase.co";
const DEFAULT_KEY = "sb_publishable_j7Jv38u9mWRWMawV1NrZnQ_qVj6gj0H";

export const config = {
  port: Number(process.env.PORT ?? 3001),
  supabaseUrl: process.env.SUPABASE_URL || DEFAULT_URL,
  supabaseKey: process.env.SUPABASE_PUBLISHABLE_KEY || DEFAULT_KEY,
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
};
