-- Persist OAuth credentials server-side so creators can select content from
-- the exact Instagram, TikTok, or YouTube account they connected.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS instagram_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  page_id text NOT NULL,
  instagram_user_id text NOT NULL,
  instagram_username text,
  encrypted_access_token text NOT NULL,
  token_expires_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, instagram_user_id)
);

ALTER TABLE instagram_connections
  ADD COLUMN IF NOT EXISTS page_id text,
  ADD COLUMN IF NOT EXISTS token_expires_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_instagram_connections_user_page
  ON instagram_connections(user_id, page_id);

CREATE TABLE IF NOT EXISTS youtube_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  page_id text NOT NULL,
  channel_id text NOT NULL,
  channel_title text,
  uploads_playlist_id text,
  encrypted_access_token text NOT NULL,
  encrypted_refresh_token text,
  access_token_expires_at timestamp with time zone,
  scopes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, channel_id)
);

ALTER TABLE youtube_connections
  ADD COLUMN IF NOT EXISTS page_id text,
  ADD COLUMN IF NOT EXISTS channel_title text,
  ADD COLUMN IF NOT EXISTS uploads_playlist_id text,
  ADD COLUMN IF NOT EXISTS encrypted_access_token text,
  ADD COLUMN IF NOT EXISTS encrypted_refresh_token text,
  ADD COLUMN IF NOT EXISTS access_token_expires_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS scopes text;

CREATE INDEX IF NOT EXISTS idx_youtube_connections_user_page
  ON youtube_connections(user_id, page_id);

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

CREATE INDEX IF NOT EXISTS idx_tiktok_connections_user_page
  ON tiktok_connections(user_id, page_id);
