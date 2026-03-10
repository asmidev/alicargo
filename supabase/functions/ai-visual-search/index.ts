import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, action } = await req.json();

    if (action !== 'analyze') {
      return new Response(
        JSON.stringify({ error: 'Invalid action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: 'Image is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Use Gemini Vision to analyze the image
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are a product image analyzer for an e-commerce platform. Analyze the uploaded image and extract:
1. Product category (e.g., "electronics", "clothing", "furniture", "accessories")
2. Key features/attributes (e.g., "wireless", "leather", "wooden")
3. Colors present in the product
4. Style/aesthetic (e.g., "modern", "vintage", "minimalist")

Respond ONLY with a valid JSON object in this exact format:
{
  "category": "string",
  "features": ["string", "string"],
  "colors": ["string", "string"],
  "style": "string"
}

Be concise with features - max 5 keywords that would help find similar products.
Use simple, common terms that would match product names/descriptions.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analyze this product image and extract searchable features:'
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageBase64
                }
              }
            ]
          }
        ],
        max_tokens: 500,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', errorText);
      throw new Error(`AI analysis failed: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || '';

    // Parse the JSON response
    let analysisResult;
    try {
      // Extract JSON from the response (in case there's extra text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      // Provide fallback result
      analysisResult = {
        category: 'general',
        features: ['product'],
        colors: [],
        style: 'standard'
      };
    }

    return new Response(
      JSON.stringify({
        category: analysisResult.category,
        features: analysisResult.features || [],
        colors: analysisResult.colors || [],
        style: analysisResult.style
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Visual search error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Visual search failed';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        category: 'general',
        features: [],
        colors: [],
        style: 'standard'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
