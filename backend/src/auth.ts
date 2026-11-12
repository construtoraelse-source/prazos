import type { NextFunction, Request, Response } from "express";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { config } from "./config.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
      sb?: SupabaseClient;
    }
  }
}

/**
 * Exige "Authorization: Bearer <access_token do Supabase>".
 * Cria um cliente Supabase agindo como o próprio usuário, para que as policies (RLS)
 * do banco decidam o que ele pode ler e gravar.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Faça login para continuar." });

  const sb = createClient(config.supabaseUrl, config.supabaseKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await sb.auth.getUser(token);
  if (error) console.error("[auth] getUser falhou:", error.status, error.name, error.message, (error as { cause?: unknown }).cause ?? "");
  if (error || !data.user) return res.status(401).json({ error: "Sessão inválida ou expirada. Entre de novo." });

  req.user = data.user;
  req.sb = sb;
  next();
}
