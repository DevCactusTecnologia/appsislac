CREATE OR REPLACE FUNCTION public.super_admin_list_migration_tables(_tenant_id uuid)
RETURNS TABLE(table_name text, level integer, has_tenant_id boolean, rowcount bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  r record;
  cnt bigint;
  v_has_tenant boolean;
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
    PERFORM 1 FROM information_schema.columns cols
      WHERE cols.table_schema='public'
        AND cols.table_name = r.name
        AND cols.column_name='tenant_id';
    v_has_tenant := FOUND;

    table_name := r.name;
    level := r.level;
    has_tenant_id := v_has_tenant;

    IF v_has_tenant THEN
      EXECUTE format('SELECT count(*) FROM public.%I WHERE tenant_id = $1', r.name)
        USING _tenant_id INTO cnt;
    ELSE
      cnt := 0;
    END IF;
    rowcount := cnt;
    RETURN NEXT;
  END LOOP;
END $function$;