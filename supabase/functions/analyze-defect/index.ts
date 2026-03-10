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
    const { imageUrl, productName, productCategory } = await req.json();
    
    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: 'Image URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Analyzing defect for image:', imageUrl.substring(0, 100) + '...');

    const systemPrompt = `You are an expert quality control inspector specializing in product defect detection. 
Analyze the provided image and determine:
1. Whether there is a visible defect
2. The type/category of defect if present
3. The severity of the defect (minor, moderate, severe)
4. Confidence level in your assessment

Product context: ${productName || 'Unknown product'}, Category: ${productCategory || 'General'}

Be thorough but concise. Focus on visible damage, scratches, dents, cracks, discoloration, missing parts, or any quality issues.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analyze this product image for defects. Provide your analysis in JSON format with fields: hasDefect (boolean), defectType (string or null), severity (minor/moderate/severe or null), confidence (0-1), description (string).'
              },
              {
                type: 'image_url',
                image_url: { url: imageUrl }
              }
            ]
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'report_defect_analysis',
              description: 'Report the defect analysis results',
              parameters: {
                type: 'object',
                properties: {
                  hasDefect: {
                    type: 'boolean',
                    description: 'Whether a defect was detected in the image'
                  },
                  defectType: {
                    type: 'string',
                    description: 'Category of the defect: scratch, dent, crack, discoloration, broken, missing_part, stain, deformation, or other',
                    enum: ['scratch', 'dent', 'crack', 'discoloration', 'broken', 'missing_part', 'stain', 'deformation', 'other', null]
                  },
                  severity: {
                    type: 'string',
                    description: 'Severity level of the defect',
                    enum: ['minor', 'moderate', 'severe', null]
                  },
                  confidence: {
                    type: 'number',
                    description: 'Confidence level of the analysis (0 to 1)'
                  },
                  description: {
                    type: 'string',
                    description: 'Detailed description of the defect or quality assessment'
                  }
                },
                required: ['hasDefect', 'confidence', 'description']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'report_defect_analysis' } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add credits.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'AI analysis failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('AI response received:', JSON.stringify(data).substring(0, 500));

    // Extract tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const result = JSON.parse(toolCall.function.arguments);
      console.log('Defect analysis result:', result);
      
      return new Response(
        JSON.stringify({
          success: true,
          analysis: result
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fallback: try to parse from content
    const content = data.choices?.[0]?.message?.content;
    if (content) {
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]);
          return new Response(
            JSON.stringify({ success: true, analysis: result }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } catch (e) {
        console.error('Failed to parse content as JSON:', e);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        analysis: {
          hasDefect: false,
          confidence: 0.5,
          description: 'Could not analyze image. Please try again.'
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in analyze-defect function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
