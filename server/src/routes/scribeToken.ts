import type { ScribeTokenResponse } from '@hackmit/shared';
import { Router } from 'express';
import { env } from '../env';

export const scribeTokenRouter = Router();

const TOKEN_URL = 'https://api.elevenlabs.io/v1/single-use-token/realtime_scribe';

/**
 * GET /api/scribe-token -> { token }
 * Mints a single-use Scribe v2 Realtime token (expires 15 min). The browser
 * opens the ElevenLabs WebSocket directly with it; the API key never leaves
 * the server.
 */
scribeTokenRouter.get('/scribe-token', async (_req, res) => {
  if (!env.elevenLabsApiKey) {
    res.status(500).json({ error: 'ELEVENLABS_API_KEY is not set on the server' });
    return;
  }

  try {
    const upstream = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'xi-api-key': env.elevenLabsApiKey },
    });
    if (!upstream.ok) {
      const detail = (await upstream.text()).slice(0, 300);
      res.status(502).json({ error: `ElevenLabs returned ${upstream.status}`, detail });
      return;
    }
    const { token } = (await upstream.json()) as ScribeTokenResponse;
    res.json({ token } satisfies ScribeTokenResponse);
  } catch (err) {
    res.status(502).json({ error: `token request failed: ${(err as Error).message}` });
  }
});
