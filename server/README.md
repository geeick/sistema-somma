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
- `GET /api/profile` — get profile for authenticated user
- `GET /api/withdrawals` — list withdrawals for authenticated user
- `POST /api/withdrawals` — request withdrawal
- `POST /api/error-logs` — log client-side errors

Notes
- This is a scaffold: adapt SQL queries and add proper validation and authorization checks before using in production.
