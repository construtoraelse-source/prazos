import app from "./app.js";
import { config } from "./config.js";

app.listen(config.port, () => {
  console.log(`API rodando em http://localhost:${config.port}`);
  // checagem de conectividade com o Supabase na partida
  fetch(`${config.supabaseUrl}/auth/v1/health`, { headers: { apikey: config.supabaseKey } })
    .then((r) => console.log(`Supabase acessível (HTTP ${r.status})`))
    .catch((e: Error & { cause?: { code?: string; message?: string } }) =>
      console.error(`Supabase INACESSÍVEL a partir da API: ${e.cause?.code ?? ""} ${e.cause?.message ?? e.message}`));
});
