import cors from 'cors';
import express from 'express';
import { env } from './env';
import { materialsRouter } from './routes/materials';
import { reviewRouter } from './routes/review';
import { scribeTokenRouter } from './routes/scribeToken';

const app = express();

app.use(cors());
app.use(express.json({ limit: '25mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api', scribeTokenRouter);
app.use('/api/materials', materialsRouter);
app.use('/api', reviewRouter);

app.listen(env.port, () => {
  console.log(`server listening on http://localhost:${env.port}`);
});
