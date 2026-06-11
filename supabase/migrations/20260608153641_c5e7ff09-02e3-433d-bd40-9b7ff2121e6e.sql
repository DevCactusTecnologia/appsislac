
-- Helper: extract uuid from segment N of a colon-separated realtime topic
CREATE OR REPLACE FUNCTION public.realtime_topic_uuid(topic text, seg int)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, extensions
AS $$
DECLARE
  part text;
  out_uuid uuid;
BEGIN
  IF topic IS NULL THEN RETURN NULL; END IF;
  part := split_part(topic, ':', seg);
  IF part IS NULL OR part = '' THEN RETURN NULL; END IF;
  BEGIN
    out_uuid := part::uuid;
  EXCEPTION WHEN others THEN
    RETURN NULL;
  END;
  RETURN out_uuid;
END;
$$;

REVOKE ALL ON FUNCTION public.realtime_topic_uuid(text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.realtime_topic_uuid(text, int) TO authenticated, anon, service_role;

-- Ensure RLS is enabled on realtime.messages (Supabase default already true; idempotent)
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

-- Drop legacy/empty policies if any exist with these names (idempotent)
DROP POLICY IF EXISTS "sislac_tenant_topic_read" ON realtime.messages;
DROP POLICY IF EXISTS "sislac_tenant_topic_write" ON realtime.messages;

-- Allow authenticated users to RECEIVE (SELECT) realtime messages only when
-- the channel topic encodes their own tenant_id (or is their own profile topic).
-- Allowed topic shapes:
--   atendimentos-store:<tenant_uuid>
--   solicpub-unread:<tenant_uuid>[:...]
--   solicpub-list:<tenant_uuid>[:...]
--   lab-apoio:<tenant_uuid>
--   profile-self:<user_uuid>
CREATE POLICY "sislac_tenant_topic_read"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  (
    (
      realtime.topic() LIKE 'atendimentos-store:%'
      OR realtime.topic() LIKE 'solicpub-unread:%'
      OR realtime.topic() LIKE 'solicpub-list:%'
      OR realtime.topic() LIKE 'lab-apoio:%'
    )
    AND public.realtime_topic_uuid(realtime.topic(), 2) IS NOT NULL
    AND (
      public.realtime_topic_uuid(realtime.topic(), 2) = public.current_tenant_id()
      OR public.is_super_admin()
    )
  )
  OR (
    realtime.topic() LIKE 'profile-self:%'
    AND public.realtime_topic_uuid(realtime.topic(), 2) = auth.uid()
  )
);

-- Mirror policy for INSERT (broadcast/presence writes), same constraints.
CREATE POLICY "sislac_tenant_topic_write"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  (
    (
      realtime.topic() LIKE 'atendimentos-store:%'
      OR realtime.topic() LIKE 'solicpub-unread:%'
      OR realtime.topic() LIKE 'solicpub-list:%'
      OR realtime.topic() LIKE 'lab-apoio:%'
    )
    AND public.realtime_topic_uuid(realtime.topic(), 2) IS NOT NULL
    AND (
      public.realtime_topic_uuid(realtime.topic(), 2) = public.current_tenant_id()
      OR public.is_super_admin()
    )
  )
  OR (
    realtime.topic() LIKE 'profile-self:%'
    AND public.realtime_topic_uuid(realtime.topic(), 2) = auth.uid()
  )
);
