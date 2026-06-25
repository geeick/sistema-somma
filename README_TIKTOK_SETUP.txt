Somma TikTok OAuth patch

Files in this zip:
- index.js -> replace server/src/index.js
- Pages.tsx -> replace src/pages/Pages.tsx
- README_TIKTOK_SETUP.txt -> setup checklist and SQL

What this adds:
- GET /api/integrations/tiktok/auth-url
- GET /api/integrations/tiktok/callback
- GET /api/tiktok/videos
- TikTok token storage in tiktok_connections
- TikTok metric sync branch in /api/admin/submissions/:id/sync-metrics
- Connect TikTok button in Pages.tsx
- Small public /, /terms, and /privacy pages on the backend for TikTok app setup

Required .env.local values:
TIKTOK_CLIENT_KEY="your_real_tiktok_client_key"
TIKTOK_CLIENT_SECRET="your_real_tiktok_client_secret"
TIKTOK_REDIRECT_URI="https://YOUR-NGROK-URL.ngrok-free.app/api/integrations/tiktok/callback"
FRONTEND_BASE_URL="http://localhost:8080"

Also keep these existing values:
DATABASE_URL="..."
NEON_AUTH_JWKS_URI="..."
TOKEN_ENCRYPTION_KEY="..."
OAUTH_STATE_SECRET="..."

Run this SQL in Neon before testing:

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE pages
ADD COLUMN IF NOT EXISTS external_account_id text,
ADD COLUMN IF NOT EXISTS verified boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS verified_at timestamp with time zone;

ALTER TABLE submissions
ADD COLUMN IF NOT EXISTS tiktok_video_id text,
ADD COLUMN IF NOT EXISTS username text,
ADD COLUMN IF NOT EXISTS likes_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS views_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS comments_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS shares_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS metrics_synced_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS metrics_source text;

CREATE TABLE IF NOT EXISTS tiktok_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  page_id text,
  tiktok_open_id text NOT NULL,
  display_name text,
  avatar_url text,
  profile_deep_link text,
  encrypted_access_token text NOT NULL,
  encrypted_refresh_token text NOT NULL,
  access_token_expires_at timestamp with time zone,
  refresh_token_expires_at timestamp with time zone,
  scopes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, tiktok_open_id)
);

Restart all 3 terminals:
1. ngrok http 4000
2. npm run start:api
3. npm run dev

Test:
1. Visit http://localhost:4000/api/integrations/tiktok/auth-url directly.
   Expected: 401 Missing Authorization header. That means the route exists.
2. Go to http://localhost:8080/pages
3. Add Page -> TikTok -> select at least one tag -> Connect TikTok
4. Authorize TikTok.
5. You should return to /pages?tiktok=connected.
6. Check Neon:
   SELECT * FROM tiktok_connections ORDER BY created_at DESC;
   SELECT id, user_id, platform, handle, external_account_id, verified FROM pages WHERE platform = 'tiktok' ORDER BY created_at DESC;
