const SUPABASE_URL = "https://qnbxnldkzuoydqgzagvu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFuYnhubGRrenVveWRxZ3phZ3Z1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwODc4NjQsImV4cCI6MjA3OTY2Mzg2NH0.qtQBorH6DKn0ZVnuK7GFPjeHn1xnqU3Ia_BcgxMkpG4";
const headers = { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", "Prefer": "count=exact" };

async function get(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers });
  const text = await res.text();
  if (!res.ok) return { data: [], total: "ERROR: " + res.status };
  const range = res.headers.get("content-range");
  return { data: JSON.parse(text), total: range ? range.split("/")[1] : "?" };
}

async function run() {
  const { total: boxItemsTotal, data: boxItemsData } = await get("box_items?select=*&limit=10");
  console.log(`box_items total: ${boxItemsTotal}`);
  console.log("box_items headers:", boxItemsData);
}

run().catch(e => console.error(e));
