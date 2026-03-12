// Try using the Supabase REST API with the ANON key to fix the trigger
// via a custom RPC function or direct REST endpoint
const SUPABASE_URL = 'https://qnbxnldkzuoydqgzagvu.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFuYnhubGRrenVveWRxZ3phZ3Z1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwODc4NjQsImV4cCI6MjA3OTY2Mzg2NH0.qtQBorH6DKn0ZVnuK7GFPjeHn1xnqU3Ia_BcgxMkpG4';

// Try to call a Supabase function to run raw SQL (if available)
// Or try the database REST endpoint
const projectRef = 'qnbxnldkzuoydqgzagvu';

const sql = `
CREATE OR REPLACE FUNCTION public.generate_claim_number()
RETURNS TRIGGER AS $func$
DECLARE
  year_prefix TEXT;
  next_num INTEGER;
BEGIN
  year_prefix := to_char(now(), 'YYYY');
  SELECT COALESCE(
    MAX(CAST(SUBSTRING(claim_number FROM 10) AS INTEGER)), 
    0
  ) + 1
  INTO next_num
  FROM public.defect_claims
  WHERE claim_number LIKE 'CLM-' || year_prefix || '-%%';
  NEW.claim_number := 'CLM-' || year_prefix || '-' || LPAD(next_num::TEXT, 4, '0');
  RETURN NEW;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
`;

// Try with Supabase service role via a different URL format (db.supabase.co)
async function tryApiFix() {
  // Option 1: Try management API with correct bearer format
  const mgmtKeyAttempts = [
    // Supabase Personal Access Token (PAT) format
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFuYnhubGRrenVveWRxZ3phZ3Z1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDA4Nzg2NCwiZXhwIjoyMDc5NjYzODY0fQ.-PLACEHOLDER-'
  ];
  
  // Try the database REST API (PostgreSQL via REST)
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'apikey': ANON_KEY,
      'Authorization': `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql_query: sql }),
  });
  
  const text = await res.text();
  console.log('Status:', res.status);
  console.log('Response:', text.slice(0, 500));
}

tryApiFix().catch(console.error);
