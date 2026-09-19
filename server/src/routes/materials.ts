import { Router } from 'express';

export const materialsRouter = Router();

// TODO(ux): POST /api/materials/file — one file per request, extract text
// (see docs/design.md "Reading lecture files"), enforce UPLOAD_LIMITS,
// return SourceFile.
materialsRouter.post('/file', (_req, res) => {
  res.status(501).json({ error: 'TODO(ux): file extraction not implemented' });
});

// TODO(ux) + TODO(ai): POST /api/materials/concepts — body { files: SourceFile[] },
// run extractConcepts over the whole set, return { concepts: Concept[] }.
materialsRouter.post('/concepts', (_req, res) => {
  res.status(501).json({ error: 'TODO(ux): concept extraction not implemented' });
});
