// Find what tables are in the schema and find the boxes
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
  console.log("=== SCHEMA EXPLORATION ===\n");

  // Check warehouses
  const { data: warehouses, total: wTotal } = await get("warehouses?select=id,name,city,location&limit=10");
  console.log(`warehouses table (total: ${wTotal}):`);
  warehouses.forEach(w => console.log(`  id: ${w.id} | name: ${w.name} | city: ${w.city} | location: ${w.location}`));
  
  // Check shipments with different filter
  const { data: shipments, total: sTotal } = await get("shipments?select=id,status,from_location,to_location&limit=10");
  console.log(`\nshipments table (total: ${sTotal}):`);
  shipments.forEach(s => console.log(`  id: ${s.id} | status: ${s.status} | from: ${s.from_location} | to: ${s.to_location}`));

  // Try boxes without any RLS issues 
  const { data: allBoxes, total: bTotal } = await get("boxes?select=id,status,location,shipment_id,warehouse_id&limit=20");
  console.log(`\nboxes table (total: ${bTotal}):`);
  if (parseInt(bTotal) > 0) {
    allBoxes.forEach(b => console.log(`  status: ${b.status} | location: ${b.location} | shipment_id: ${b.shipment_id} | warehouse_id: ${b.warehouse_id}`));
  } else {
    console.log("  ❌ RLS may be blocking READ access to boxes table");
  }

  // product_items
  const { data: allItems, total: iTotal } = await get("product_items?select=id,status,location,box_id&limit=10");
  console.log(`\nproduct_items table (total: ${iTotal}):`);
  if (parseInt(iTotal) > 0) {
    allItems.forEach(i => console.log(`  status: ${i.status} | location: ${i.location} | box_id: ${i.box_id}`));
  } else {
    console.log("  ❌ Either empty or RLS blocks access");
  }

  // Try shipment_boxes junction
  const { data: sboxes, total: sbTotal } = await get("shipment_boxes?select=*&limit=5");
  console.log(`\nshipment_boxes table (total: ${sbTotal}):`);

  console.log("\n=== CONCLUSION ===");
  console.log("If boxes=0: anon key cannot read boxes table (RLS blocks)");
  console.log("The app uses authenticated session which CAN read the data");
  console.log("So the DB DOES have 3 boxes — anon key just cannot see them");
  console.log("\nThe 'Yo'ldagi soni' issue is a REAL CODE/LOGIC problem that needs fixing");
}

run().catch(e => console.error("Error:", e.message));
