CREATE OR REPLACE FUNCTION public.super_admin_dump_ddl()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  result jsonb := '{}'::jsonb;
  extensions text[];
  enums jsonb;
  sequences jsonb;
  tables jsonb;
  fks jsonb;
  indexes jsonb;
  functions jsonb;
  triggers jsonb;
  views jsonb;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT array_agg('CREATE EXTENSION IF NOT EXISTS "' || extname || '" WITH SCHEMA public')
    INTO extensions
    FROM pg_extension
   WHERE extname NOT IN ('plpgsql','pg_stat_statements','supabase_vault','pg_graphql','pgjwt','pg_net','pgsodium','pg_cron');

  WITH e AS (
    SELECT t.typname,
           string_agg(quote_literal(en.enumlabel), ', ' ORDER BY en.enumsortorder) AS labels
      FROM pg_type t
      JOIN pg_enum en ON en.enumtypid = t.oid
      JOIN pg_namespace n ON n.oid = t.typnamespace
     WHERE n.nspname = 'public'
     GROUP BY t.typname, t.oid
  )
  SELECT jsonb_agg(jsonb_build_object(
    'name', typname,
    'ddl', 'CREATE TYPE public.' || quote_ident(typname) || ' AS ENUM (' || labels || ')'
  )) INTO enums FROM e;

  -- Inclui TODAS as sequences do schema public (incluindo owned/serial),
  -- necessárias para DEFAULT nextval(...) das tabelas.
  SELECT jsonb_agg(jsonb_build_object(
    'name', c.relname,
    'ddl', 'CREATE SEQUENCE IF NOT EXISTS public.' || quote_ident(c.relname)
  ))
    INTO sequences
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname='public' AND c.relkind='S';

  WITH cols AS (
    SELECT c.table_name, c.ordinal_position, c.column_name, c.data_type,
           c.udt_schema, c.udt_name, c.is_nullable, c.column_default,
           c.character_maximum_length, c.numeric_precision, c.numeric_scale
      FROM information_schema.columns c
      JOIN information_schema.tables t
        ON t.table_schema=c.table_schema AND t.table_name=c.table_name
     WHERE c.table_schema='public' AND t.table_type='BASE TABLE'
  ),
  coldefs AS (
    SELECT table_name,
           string_agg(
             quote_ident(column_name) || ' ' ||
             CASE
               WHEN data_type = 'ARRAY' THEN
                 (SELECT quote_ident(udt_schema)||'.'||quote_ident(regexp_replace(udt_name,'^_',''))||'[]')
               WHEN data_type IN ('USER-DEFINED') THEN quote_ident(udt_schema)||'.'||quote_ident(udt_name)
               WHEN data_type = 'character varying' AND character_maximum_length IS NOT NULL
                 THEN 'varchar('||character_maximum_length||')'
               WHEN data_type = 'numeric' AND numeric_precision IS NOT NULL
                 THEN 'numeric('||numeric_precision||','||coalesce(numeric_scale,0)||')'
               ELSE data_type
             END ||
             CASE WHEN column_default IS NOT NULL THEN ' DEFAULT '||column_default ELSE '' END ||
             CASE WHEN is_nullable='NO' THEN ' NOT NULL' ELSE '' END,
             ', ' ORDER BY ordinal_position
           ) AS colspec
      FROM cols
     GROUP BY table_name
  ),
  pks AS (
    SELECT tc.table_name,
           ', PRIMARY KEY ('||string_agg(quote_ident(kc.column_name), ', ' ORDER BY kc.ordinal_position)||')' AS pkspec
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kc
        ON kc.constraint_name=tc.constraint_name AND kc.table_schema=tc.table_schema
     WHERE tc.table_schema='public' AND tc.constraint_type='PRIMARY KEY'
     GROUP BY tc.table_name
  )
  SELECT jsonb_agg(jsonb_build_object(
    'name', d.table_name,
    'ddl', 'CREATE TABLE IF NOT EXISTS public.'||quote_ident(d.table_name)||' ('||d.colspec||coalesce(p.pkspec,'')||')'
  ) ORDER BY d.table_name)
    INTO tables
    FROM coldefs d
    LEFT JOIN pks p ON p.table_name = d.table_name;

  SELECT jsonb_agg(jsonb_build_object(
    'name', conname,
    'ddl', 'ALTER TABLE public.'||quote_ident(conrelid::regclass::text)||' ADD CONSTRAINT '||quote_ident(conname)||' '||pg_get_constraintdef(oid)
  ))
    INTO fks
    FROM pg_constraint
   WHERE connamespace = 'public'::regnamespace AND contype IN ('f','u','c');

  SELECT jsonb_agg(jsonb_build_object('name', indexname, 'ddl', indexdef))
    INTO indexes
    FROM pg_indexes
   WHERE schemaname='public' AND indexname NOT LIKE '%_pkey';

  SELECT jsonb_agg(jsonb_build_object('name', p.proname, 'ddl', pg_get_functiondef(p.oid)))
    INTO functions
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname='public' AND p.prokind IN ('f','p');

  SELECT jsonb_agg(jsonb_build_object(
    'name', tgname,
    'ddl', pg_get_triggerdef(oid, true)
  ))
    INTO triggers
    FROM pg_trigger
   WHERE NOT tgisinternal AND tgrelid::regclass::text LIKE 'public.%';

  SELECT jsonb_agg(jsonb_build_object(
    'name', table_name,
    'ddl', 'CREATE OR REPLACE VIEW public.'||quote_ident(table_name)||' AS '||view_definition
  ))
    INTO views
    FROM information_schema.views
   WHERE table_schema='public';

  result := jsonb_build_object(
    'extensions', to_jsonb(coalesce(extensions, ARRAY[]::text[])),
    'enums',      coalesce(enums,'[]'::jsonb),
    'sequences',  coalesce(sequences,'[]'::jsonb),
    'tables',     coalesce(tables,'[]'::jsonb),
    'fks',        coalesce(fks,'[]'::jsonb),
    'indexes',    coalesce(indexes,'[]'::jsonb),
    'functions',  coalesce(functions,'[]'::jsonb),
    'triggers',   coalesce(triggers,'[]'::jsonb),
    'views',      coalesce(views,'[]'::jsonb),
    'generated_at', now()
  );

  RETURN result;
END $function$;

GRANT EXECUTE ON FUNCTION public.super_admin_dump_ddl() TO authenticated;