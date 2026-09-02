# API server (Express) for Sistema Somma

Quick start

1. Install dependencies inside the `server/` folder:

```bash
cd server
npm install
```

2. Set environment variables (see `../.env.example`):

- `DATABASE_URL` — Neon DB connection string
- `NEON_AUTH_JWKS_URI` — JWKS URI for Neon Auth (used to verify JWTs)
- `YOUTUBE_CLIENT_ID` — Google OAuth web client ID
- `YOUTUBE_CLIENT_SECRET` — Google OAuth web client secret
- `YOUTUBE_REDIRECT_URI` — exact backend callback registered in Google Cloud
- `YOUTUBE_SCOPES` — defaults to `https://www.googleapis.com/auth/youtube.readonly`
- `FRONTEND_BASE_URL` — frontend URL used after OAuth completes

3. Run server:

```bash
npm run dev
# or
npm start
```

This server exposes:
- `GET /api/session` — returns session if Authorization header Bearer token present
- `GET /api/pages` — list pages for authenticated user
- `POST /api/pages` — create page (authenticated)
- `DELETE /api/pages/:id` — delete page owned by authenticated user
- `GET /api/integrations/youtube/start` — create a Google authorization URL
- `GET /api/integrations/youtube/callback` — verify and save the creator's YouTube channel
- `GET /api/connected-content?page_id=...` — list posts/videos from the selected connected account
- `GET /api/profile` — get profile for authenticated user
- `GET /api/withdrawals` — list withdrawals for authenticated user
- `POST /api/withdrawals` — request withdrawal
- `POST /api/error-logs` — log client-side errors

Notes
- This is a scaffold: adapt SQL queries and add proper validation and authorization checks before using in production.
- Apply `supabase/migrations/20260902000000_connected_social_content.sql` to the Neon database before deploying this version.
- Existing YouTube pages must be connected once more so Google can issue the refresh token used to load channel videos.
