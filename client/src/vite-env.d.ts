/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Full URL of the backend API, e.g. https://api-production.up.railway.app.
  // Only needed when frontend and backend are hosted on different origins
  // (Vercel + Railway) - unset for local dev and the Docker build, where a
  // same-origin proxy already handles /api.
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
