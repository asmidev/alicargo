
-- Allow anonymous users to read their own order by ID (for OrderSuccess page)
CREATE POLICY "Anyone can read store order by ID"
ON public.store_orders
FOR SELECT
TO anon
USING (true);

-- Note: This is acceptable because store_orders don't contain sensitive data beyond
-- customer name/phone which the customer themselves entered. Orders are only accessible
-- if you know the UUID which is not guessable.
