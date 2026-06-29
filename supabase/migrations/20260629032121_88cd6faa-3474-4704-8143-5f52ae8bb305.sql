-- Recupera o profile do usuário criado sem profile (trigger ausente)
INSERT INTO public.profiles (user_id, email, nome, perfil, status, tenant_id, unidade_ids, unidade_ativa)
SELECT
  '8a091e54-37f0-483c-a7b7-60c6ceca2a9b'::uuid,
  'josafa@gmail.com',
  'Josafá',
  'recepcionista',
  'Ativo',
  '00000000-0000-0000-0000-000000000001'::uuid,
  ARRAY[(SELECT id FROM public.unidades WHERE tenant_id = '00000000-0000-0000-0000-000000000001'::uuid AND ativo = true ORDER BY created_at LIMIT 1)],
  (SELECT id FROM public.unidades WHERE tenant_id = '00000000-0000-0000-0000-000000000001'::uuid AND ativo = true ORDER BY created_at LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = '8a091e54-37f0-483c-a7b7-60c6ceca2a9b'::uuid);