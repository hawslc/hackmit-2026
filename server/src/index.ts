// TA Coach server. Thin HTTP layer: extract materials, extract concepts, run the
// review — all the LLM work lives in the ai-review workspace. Holds no state.

import { loadEnv, port } from "./env.ts";
loadEnv();

import express from "express";
import { errorHandler } from "./httpError.ts";
import { materialsRouter } from "./routes/materials.ts";
import { reviewRouter } from "./routes/review.ts";
import { scribeTokenRouter } from "./routes/scribeToken.ts";

const app = express();
app.use(express.json({ limit: "5mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api", scribeTokenRouter);
app.use("/api/materials", materialsRouter);
app.use("/api/review", reviewRouter);

// Central error handler: every failure becomes JSON { error } (client reads data.error).
app.use(errorHandler);

const p = port();
app.listen(p, () => {
  console.log(`[server] listening on http://localhost:${p}`);
});
