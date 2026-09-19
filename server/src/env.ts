import 'dotenv/config';

export const env = {
  port: Number(process.env.PORT ?? 3001),
  elevenLabsApiKey: process.env.ELEVENLABS_API_KEY ?? null,
  llmProvider: process.env.LLM_PROVIDER ?? 'mock',
};
