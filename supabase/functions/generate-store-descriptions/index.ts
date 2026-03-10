import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { batch_size = 10 } = await req.json().catch(() => ({}));

    // Fetch products without descriptions
    const { data: products, error } = await supabase
      .from("products")
      .select("id, name, store_category_id, store_categories!store_category_id(name_uz)")
      .is("store_description", null)
      .gt("tashkent_manual_stock", 0)
      .eq("status", "active")
      .limit(batch_size);

    if (error) throw error;
    if (!products || products.length === 0) {
      return new Response(JSON.stringify({ message: "Barcha mahsulotlarda tavsif mavjud", updated: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let updated = 0;
    const errors: string[] = [];

    for (const product of products) {
      const categoryName = (product as any).store_categories?.name_uz || "Boshqa";
      const prompt = `O'zbek tilida onlayn do'kon uchun qisqa mahsulot tavsifi yoz. 2-3 gap. Mahsulot: "${product.name}", Kategoriya: "${categoryName}". Faqat tavsif yoz, boshqa hech narsa qo'shma.`;

      try {
        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              { role: "system", content: "Sen onlayn do'kon uchun mahsulot tavsiflarini o'zbek tilida yozuvchi yordamchisan. Qisqa, aniq va sotuvga yo'naltirilgan tavsiflar yoz." },
              { role: "user", content: prompt },
            ],
          }),
        });

        if (aiResp.status === 429) {
          errors.push(`Rate limited at product ${product.id}`);
          break;
        }

        if (!aiResp.ok) {
          errors.push(`AI error for ${product.id}: ${aiResp.status}`);
          continue;
        }

        const aiData = await aiResp.json();
        const description = aiData.choices?.[0]?.message?.content?.trim();

        if (description) {
          const { error: updateErr } = await supabase
            .from("products")
            .update({ store_description: description })
            .eq("id", product.id);

          if (updateErr) {
            errors.push(`DB update error for ${product.id}: ${updateErr.message}`);
          } else {
            updated++;
          }
        }

        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 500));
      } catch (e) {
        errors.push(`Error for ${product.id}: ${e.message}`);
      }
    }

    return new Response(JSON.stringify({
      message: `${updated} ta mahsulotga tavsif yozildi`,
      updated,
      total_found: products.length,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
