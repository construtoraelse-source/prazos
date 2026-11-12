import "dotenv/config";

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Variável de ambiente ausente: ${name} (veja backend/.env.example)`);
  return v;
}

export const config = {
  port: Number(process.env.PORT ?? 3001),
  supabaseUrl: req("SUPABASE_URL"),
  supabaseKey: req("SUPABASE_PUBLISHABLE_KEY"),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
};
