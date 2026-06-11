-- Garante REPLICA IDENTITY FULL para que DELETE traga payload completo
ALTER TABLE public.atendimentos REPLICA IDENTITY FULL;
ALTER TABLE public.atendimento_exames REPLICA IDENTITY FULL;
ALTER TABLE public.atendimento_pagamentos REPLICA IDENTITY FULL;

-- Adiciona à publicação realtime (idempotente via DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'atendimentos'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.atendimentos';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'atendimento_exames'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.atendimento_exames';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'atendimento_pagamentos'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.atendimento_pagamentos';
  END IF;
END$$;