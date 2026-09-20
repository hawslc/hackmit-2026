// GET /api/scribe-token -> { token } (ScribeTokenResponse).
// Mints a single-use ElevenLabs Scribe v2 Realtime token (expires ~15 min). The
// browser opens the ElevenLabs WebSocket directly with it, so the API key never
// leaves the server. Errors flow through the central errorHandler as { error }.

import type { ScribeTokenResponse } from "@ta-coach/shared";
import { Router } from "express";
import { HttpError } from "../httpError.ts";

const TOKEN_URL = "https://api.elevenlabs.io/v1/single-use-token/realtime_scribe";

export const scribeTokenRouter = Router();

scribeTokenRouter.get("/scribe-token", async (_req, res) => {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new HttpError(500, "ELEVENLABS_API_KEY is not set on the server.");
  }

  const upstream = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "xi-api-key": apiKey },
  });
  if (!upstream.ok) {
    const detail = (await upstream.text()).slice(0, 300);
    throw new HttpError(502, `ElevenLabs returned ${upstream.status}: ${detail}`);
  }

  const { token } = (await upstream.json()) as ScribeTokenResponse;
  res.json({ token } satisfies ScribeTokenResponse);
});
