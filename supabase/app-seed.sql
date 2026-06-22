-- Seed a test user, profile and a sample page so the UI shows data
INSERT INTO profiles (id, total_earnings, pix_key, created_at)
VALUES ('user-1', 100.00, 'test@pix', now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO pages (id, user_id, platform, handle, url, follower_count, tags, created_at)
VALUES ('page-1', 'user-1', 'instagram', '@test', 'https://instagram.com/test', 1234, ARRAY['Funk'], now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO tags (id, name, slug, synonyms, active)
VALUES ('tag-1','Funk','funk', ARRAY['funk','funky'], true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO page_tags (id, page_id, tag_id)
VALUES ('pagetag-1','page-1','tag-1')
ON CONFLICT (id) DO NOTHING;
