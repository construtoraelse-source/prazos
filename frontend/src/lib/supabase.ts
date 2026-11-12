import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
if (!url || !key) throw new Error("Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY em frontend/.env.local");

// Usado só para login/sessão. Os dados passam pelo backend (/api).
export const supabase = createClient(url, key);
