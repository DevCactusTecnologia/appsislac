-- Allow public access to read states and cities
CREATE POLICY "states_anon_read" ON public.states FOR SELECT TO anon USING (true);
CREATE POLICY "cities_anon_read" ON public.cities FOR SELECT TO anon USING (true);

-- Ensure authenticated can still read (existing policies might already cover this but let's be safe)
-- Actually existing policies: cities_public_read and states_public_read are already there for authenticated.
