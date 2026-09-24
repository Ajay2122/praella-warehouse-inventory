import dotenv from 'dotenv';
import path from 'path';

// Runs before any test file (or the app/env modules it imports) is
// required. dotenv never overwrites an already-set process.env key by
// default, so env.ts's own `import 'dotenv/config'` (which loads plain
// .env) becomes a no-op for anything already set here - the test DB URL
// and secrets win.
dotenv.config({ path: path.resolve(__dirname, '../.env.test'), override: true });
