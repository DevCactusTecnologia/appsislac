
-- Fase 3: RPCs de introspecção usadas pelas edges de migração.

-- 1) DDL completo do schema public (idempotente no destino).
CREATE OR REPLACE FUNCTION public.super_admin_dump_ddl()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
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

  -- Extensões (exceto internas do supabase)
  SELECT array_agg('CREATE EXTENSION IF NOT EXISTS "' || extname || '" WITH SCHEMA public')
    INTO extensions
    FROM pg_extension
   WHERE extname NOT IN ('plpgsql','pg_stat_statements','supabase_vault','pg_graphql','pgjwt','pg_net','pgsodium','pg_cron');

  -- Enums
  SELECT jsonb_agg(jsonb_build_object(
    'name', t.typname,
    'ddl', 'CREATE TYPE public.' || quote_ident(t.typname) || ' AS ENUM (' ||
           string_agg(quote_literal(e.enumlabel), ', ' ORDER BY e.enumsortorder) || ')'
  ))
    INTO enums
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    JOIN pg_namespace n ON n.oid = t.typnamespace
   WHERE n.nspname = 'public'
   GROUP BY t.typname, t.oid;

  -- Sequences (exclui as owned by columns — recriadas com serial/identity)
  SELECT jsonb_agg(jsonb_build_object(
    'name', c.relname,
    'ddl', 'CREATE SEQUENCE IF NOT EXISTS public.' || quote_ident(c.relname)
  ))
    INTO sequences
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname='public' AND c.relkind='S'
     AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = c.oid AND d.deptype = 'a');

  -- Tabelas com colunas (sem FKs; FKs vão em passo separado para permitir carga fora de ordem)
  WITH cols AS (
    SELECT c.table_name,
           c.ordinal_position,
           c.column_name,
           c.data_type,
           c.udt_schema,
           c.udt_name,
           c.is_nullable,
           c.column_default,
           c.character_maximum_length,
           c.numeric_precision, c.numeric_scale
      FROM information_schema.columns c
      JOIN information_schema.tables t
        ON t.table_schema=c.table_schema AND t.table_name=c.table_name
     WHERE c.table_schema='public' AND t.table_type='BASE TABLE'
  ),
  col_ddl AS (
    SELECT table_name,
           string_agg(
             quote_ident(column_name) || ' ' ||
             CASE
               WHEN data_type='USER-DEFINED' THEN quote_ident(udt_schema)||'.'||quote_ident(udt_name)
               WHEN data_type='ARRAY' THEN
                 -- udt_name para arrays vem como "_int4" etc — devolvemos o tipo base + []
                 CASE
                   WHEN udt_name LIKE '\_%' ESCAPE '\' THEN substring(udt_name from 2) || '[]'
                   ELSE udt_name || '[]'
                 END
               WHEN data_type='character varying' AND character_maximum_length IS NOT NULL
                 THEN 'varchar('||character_maximum_length||')'
               WHEN data_type='numeric' AND numeric_precision IS NOT NULL
                 THEN 'numeric('||numeric_precision||','||coalesce(numeric_scale,0)||')'
               ELSE data_type
             END ||
             CASE WHEN is_nullable='NO' THEN ' NOT NULL' ELSE '' END ||
             CASE WHEN column_default IS NOT NULL THEN ' DEFAULT '||column_default ELSE '' END,
             ', ' ORDER BY ordinal_position
           ) AS cols
      FROM cols
     GROUP BY table_name
  ),
  pks AS (
    SELECT tc.table_name,
           ', PRIMARY KEY (' || string_agg(quote_ident(kcu.column_name), ',' ORDER BY kcu.ordinal_position) || ')' AS pk
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON kcu.constraint_name=tc.constraint_name AND kcu.table_schema=tc.table_schema
     WHERE tc.table_schema='public' AND tc.constraint_type='PRIMARY KEY'
     GROUP BY tc.table_name
  )
  SELECT jsonb_agg(jsonb_build_object(
    'name', c.table_name,
    'ddl', 'CREATE TABLE IF NOT EXISTS public.'||quote_ident(c.table_name)||' ('||c.cols||coalesce(p.pk,'')||')'
  ))
    INTO tables
    FROM col_ddl c
    LEFT JOIN pks p ON p.table_name=c.table_name;

  -- FKs
  SELECT jsonb_agg(jsonb_build_object(
    'table', conrelid::regclass::text,
    'name', conname,
    'ddl', 'ALTER TABLE '||conrelid::regclass::text||
           ' ADD CONSTRAINT '||quote_ident(conname)||' '||pg_get_constraintdef(oid)
  ))
    INTO fks
    FROM pg_constraint
   WHERE contype='f'
     AND connamespace=(SELECT oid FROM pg_namespace WHERE nspname='public');

  -- Índices (exclui os de PK que já vêm no CREATE TABLE)
  SELECT jsonb_agg(jsonb_build_object(
    'table', tablename,
    'name', indexname,
    'ddl', replace(indexdef,'CREATE INDEX','CREATE INDEX IF NOT EXISTS')
  ))
    INTO indexes
    FROM pg_indexes
   WHERE schemaname='public'
     AND indexname NOT IN (SELECT conname FROM pg_constraint WHERE contype='p');

  -- Funções (pg_get_functiondef já devolve CREATE OR REPLACE)
  SELECT jsonb_agg(jsonb_build_object(
    'name', p.proname,
    'ddl', pg_get_functiondef(p.oid)
  ))
    INTO functions
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname='public'
     AND p.prokind IN ('f','p')
     -- Ignora as próprias funções internas de introspecção
     AND p.proname NOT LIKE 'super_admin_dump_%';

  -- Triggers
  SELECT jsonb_agg(jsonb_build_object(
    'table', c.relname,
    'name', t.tgname,
    'ddl', pg_get_triggerdef(t.oid)
  ))
    INTO triggers
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname='public' AND NOT t.tgisinternal;

  -- Views
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
END $$;

REVOKE ALL ON FUNCTION public.super_admin_dump_ddl() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_dump_ddl() TO service_role;

-- 2) Lista tabelas do tenant na ordem topológica (FKs) com contagem.
CREATE OR REPLACE FUNCTION public.super_admin_list_migration_tables(_tenant_id uuid)
RETURNS TABLE(table_name text, level int, has_tenant_id boolean, rowcount bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  r record;
  cnt bigint;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  FOR r IN
    WITH edges AS (
      SELECT conrelid AS child, confrelid AS parent
        FROM pg_constraint
       WHERE contype='f'
         AND connamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')
         AND conrelid <> confrelid
    ),
    RECURSIVE_levels AS MATERIALIZED (
      SELECT c.oid, c.relname AS tname, 0 AS lvl
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname='public' AND c.relkind='r'
         AND NOT EXISTS (SELECT 1 FROM edges e WHERE e.child = c.oid)
    )
    SELECT tname AS name, lvl AS level
      FROM RECURSIVE_levels
    UNION ALL
    SELECT c.relname, 99
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relkind='r'
       AND c.relname NOT IN (SELECT tname FROM RECURSIVE_levels)
    ORDER BY 2, 1
  LOOP
    -- has_tenant_id?
    PERFORM 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=r.name AND column_name='tenant_id';
    has_tenant_id := FOUND;
    table_name := r.name;
    level := r.level;

    IF has_tenant_id THEN
      EXECUTE format('SELECT count(*) FROM public.%I WHERE tenant_id = $1', r.name)
        USING _tenant_id INTO cnt;
    ELSE
      cnt := 0;  -- tabelas globais não são migradas por padrão
    END IF;
    rowcount := cnt;
    RETURN NEXT;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.super_admin_list_migration_tables(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_list_migration_tables(uuid) TO service_role;

-- 3) Dump de auth.users (limitado aos users do tenant).
CREATE OR REPLACE FUNCTION public.super_admin_dump_auth_users(_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  users_out jsonb;
  roles_out jsonb;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'id', u.id,
    'email', u.email,
    'encrypted_password', u.encrypted_password,
    'email_confirmed_at', u.email_confirmed_at,
    'raw_user_meta_data', u.raw_user_meta_data,
    'raw_app_meta_data', u.raw_app_meta_data,
    'created_at', u.created_at,
    'updated_at', u.updated_at
  ))
    INTO users_out
    FROM auth.users u
   WHERE u.id IN (SELECT id FROM public.profiles WHERE tenant_id = _tenant_id);

  SELECT jsonb_agg(jsonb_build_object(
    'user_id', ur.user_id,
    'role', ur.role,
    'tenant_id', ur.tenant_id
  ))
    INTO roles_out
    FROM public.user_roles ur
   WHERE ur.tenant_id = _tenant_id;

  RETURN jsonb_build_object(
    'users', coalesce(users_out,'[]'::jsonb),
    'roles', coalesce(roles_out,'[]'::jsonb)
  );
END $$;

REVOKE ALL ON FUNCTION public.super_admin_dump_auth_users(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_dump_auth_users(uuid) TO service_role;

-- 4) Dump paginado de dados de uma tabela filtrada por tenant_id.
CREATE OR REPLACE FUNCTION public.super_admin_dump_table_page(
  _table text,
  _tenant_id uuid,
  _limit int DEFAULT 500,
  _offset int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  has_tid boolean;
  rows_out jsonb;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _table !~ '^[a-z_][a-z0-9_]*$' THEN
    RAISE EXCEPTION 'invalid table name';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=_table) THEN
    RAISE EXCEPTION 'table not found';
  END IF;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name=_table AND column_name='tenant_id')
    INTO has_tid;
  IF NOT has_tid THEN
    RETURN jsonb_build_object('rows','[]'::jsonb,'note','no_tenant_id');
  END IF;
  EXECUTE format(
    'SELECT coalesce(jsonb_agg(row_to_json(t)),''[]''::jsonb) FROM (SELECT * FROM public.%I WHERE tenant_id = $1 ORDER BY 1 LIMIT $2 OFFSET $3) t',
    _table
  ) USING _tenant_id, _limit, _offset INTO rows_out;
  RETURN jsonb_build_object('rows', rows_out);
END $$;

REVOKE ALL ON FUNCTION public.super_admin_dump_table_page(text,uuid,int,int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_dump_table_page(text,uuid,int,int) TO service_role;
