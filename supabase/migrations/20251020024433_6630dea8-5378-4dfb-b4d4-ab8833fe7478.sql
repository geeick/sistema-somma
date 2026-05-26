-- Insert default tags if they don't exist
INSERT INTO public.tags (name, slug, synonyms, active)
VALUES 
  ('Funk', 'funk', ARRAY['funk brasileiro', 'funkeiro'], true),
  ('Rap/Trap', 'rap-trap', ARRAY['rap', 'trap', 'hip-hop'], true),
  ('Pop', 'pop', ARRAY['pop music', 'popular'], true),
  ('Sertanejo', 'sertanejo', ARRAY['sertanejo universitário', 'modão'], true),
  ('Forró', 'forro', ARRAY['forró tradicional', 'forró eletrônico'], true),
  ('Piseiro', 'piseiro', ARRAY['pisadinha'], true),
  ('Arrocha', 'arrocha', ARRAY['arrocha romântico'], true),
  ('Gospel', 'gospel', ARRAY['música gospel', 'louvor'], true),
  ('Internacional', 'internacional', ARRAY['música internacional', 'gringo'], true),
  ('Fofoca', 'fofoca', ARRAY['entretenimento', 'celebridades'], true),
  ('Influencer', 'influencer', ARRAY['influenciador', 'criador de conteúdo'], true),
  ('Edição', 'edicao', ARRAY['edição de vídeo', 'editor'], true),
  ('Letras', 'letras', ARRAY['lyrics', 'letra de música'], true)
ON CONFLICT (slug) DO NOTHING;