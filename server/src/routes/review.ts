import type { ReviewRequest } from '@hackmit/shared';
import { Router } from 'express';

export const reviewRouter = Router();

// TODO(ai): POST /api/review — body ReviewRequest, run the three reviewers
// (delivery tips / content gaps / teaching skills) in parallel with 30s
// timeouts, then synthesize. LLM_PROVIDER=mock returns canned output.
// See docs/design.md "AI review pipeline" and docs/rubric.md.
reviewRouter.post('/review', (req, res) => {
  const _body = req.body as ReviewRequest;
  res.status(501).json({ error: 'TODO(ai): review pipeline not implemented' });
});
