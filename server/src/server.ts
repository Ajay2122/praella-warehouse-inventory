import { app } from './app';
import { env } from './config/env';
import { startJobs } from './jobs';

app.listen(env.PORT, () => {
  console.log(`[server] listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

startJobs().catch((err) => {
  console.warn('[jobs] failed to start background workers:', (err as Error).message);
});
