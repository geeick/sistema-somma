-- Fixes for type mismatches between our app schema and existing tables
-- Create page_tags with tag_id uuid (tags.id is uuid) and page_id text (pages.id is text)
CREATE TABLE IF NOT EXISTS page_tags (
  id uuid PRIMARY KEY,
  page_id text,
  tag_id uuid
);

-- Create submissions table matching campaigns.id (uuid) and pages.id (text)
CREATE TABLE IF NOT EXISTS submissions (
  id uuid PRIMARY KEY,
  user_id text,
  page_id text,
  campaign_id uuid,
  status text,
  created_at timestamptz DEFAULT now()
);
