-- Migration visites techniques — attribution admin pour les visites sans assigne_a
-- À exécuter dans Supabase > SQL Editor

-- Attribuer les visites sans assigne_a à l'admin (toi)
UPDATE public.visites_techniques
SET assigne_a = (
  SELECT id FROM public.profiles WHERE role = 'admin' ORDER BY created_at LIMIT 1
)
WHERE assigne_a IS NULL;

-- S'assurer que le champ partage_token existe
ALTER TABLE public.visites_techniques
  ADD COLUMN IF NOT EXISTS partage_token UUID DEFAULT gen_random_uuid();

-- Index pour recherche par token
CREATE INDEX IF NOT EXISTS idx_visites_partage_token ON public.visites_techniques(partage_token);

NOTIFY pgrst, 'reload schema';
