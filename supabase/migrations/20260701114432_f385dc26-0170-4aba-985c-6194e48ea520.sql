GRANT EXECUTE ON FUNCTION public.super_admin_dump_ddl() TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_list_migration_tables(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_dump_auth_users(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_dump_table_page(text, uuid, integer, integer) TO authenticated;