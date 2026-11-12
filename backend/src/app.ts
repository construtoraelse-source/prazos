import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { requireAuth } from "./auth.js";
import { licencasRouter } from "./licencas.js";

// App Express sem listen(): usado pelo servidor local (index.ts) e pela função da Vercel (api/index.ts)
const app = express();
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api", requireAuth, licencasRouter);

export default app;
