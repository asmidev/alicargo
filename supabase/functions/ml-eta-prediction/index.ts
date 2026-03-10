import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { shipmentId, carrier, departureDate, weightKg, volumeM3 } = await req.json();

    if (!shipmentId || !departureDate) {
      return new Response(
        JSON.stringify({ error: 'Shipment ID and departure date are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Calculating ML-based ETA for shipment:', shipmentId);

    // Get historical data for the carrier
    const { data: historicalShipments, error: histError } = await supabase
      .from('shipments')
      .select('departure_date, arrival_date, actual_transit_days, carrier, total_weight_kg, total_volume_m3')
      .eq('carrier', carrier || 'AbuSaxiy')
      .not('arrival_date', 'is', null)
      .not('departure_date', 'is', null)
      .order('arrival_date', { ascending: false })
      .limit(100);

    if (histError) {
      console.error('Error fetching historical data:', histError);
    }

    // Calculate statistics from historical data
    let avgTransitDays = 12; // Default
    let minTransitDays = 8;
    let maxTransitDays = 18;
    let confidenceBase = 0.5;
    let sampleSize = 0;

    if (historicalShipments && historicalShipments.length > 0) {
      const transitDays = historicalShipments
        .map(s => {
          if (s.actual_transit_days) return s.actual_transit_days;
          const dep = new Date(s.departure_date);
          const arr = new Date(s.arrival_date);
          return Math.round((arr.getTime() - dep.getTime()) / (1000 * 60 * 60 * 24));
        })
        .filter(d => d > 0 && d < 60); // Filter outliers

      if (transitDays.length > 0) {
        sampleSize = transitDays.length;
        avgTransitDays = transitDays.reduce((a, b) => a + b, 0) / transitDays.length;
        minTransitDays = Math.min(...transitDays);
        maxTransitDays = Math.max(...transitDays);
        
        // Calculate confidence based on sample size and variance
        const variance = transitDays.reduce((sum, d) => sum + Math.pow(d - avgTransitDays, 2), 0) / transitDays.length;
        const stdDev = Math.sqrt(variance);
        
        // Higher sample size and lower variance = higher confidence
        confidenceBase = Math.min(0.95, 0.4 + (sampleSize / 100) * 0.3 + (1 / (1 + stdDev / 5)) * 0.25);
      }
    }

    // Use AI to enhance prediction with contextual factors
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    let aiAdjustment = 0;
    let aiInsights = '';

    if (LOVABLE_API_KEY) {
      try {
        const currentMonth = new Date(departureDate).getMonth();
        const isHolidaySeason = currentMonth === 11 || currentMonth === 0 || currentMonth === 1; // Dec, Jan, Feb
        const isSummer = currentMonth >= 5 && currentMonth <= 7; // Jun, Jul, Aug

        const prompt = `Based on logistics data analysis:
- Average transit time: ${avgTransitDays.toFixed(1)} days
- Range: ${minTransitDays}-${maxTransitDays} days
- Carrier: ${carrier || 'AbuSaxiy'}
- Shipment weight: ${weightKg || 'unknown'} kg
- Volume: ${volumeM3 || 'unknown'} m³
- Departure: ${departureDate}
- Season: ${isHolidaySeason ? 'Holiday season (Dec-Feb)' : isSummer ? 'Summer' : 'Regular'}

Provide a brief adjustment recommendation for transit time (in days, positive = longer, negative = shorter) and one-line insight.`;

        const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash-lite',
            messages: [
              {
                role: 'system',
                content: 'You are a logistics ETA prediction assistant. Be concise and practical.'
              },
              { role: 'user', content: prompt }
            ],
            tools: [
              {
                type: 'function',
                function: {
                  name: 'provide_eta_adjustment',
                  description: 'Provide ETA adjustment recommendation',
                  parameters: {
                    type: 'object',
                    properties: {
                      adjustment_days: {
                        type: 'number',
                        description: 'Days to add (positive) or subtract (negative) from average'
                      },
                      insight: {
                        type: 'string',
                        description: 'One-line insight about the prediction'
                      }
                    },
                    required: ['adjustment_days', 'insight']
                  }
                }
              }
            ],
            tool_choice: { type: 'function', function: { name: 'provide_eta_adjustment' } }
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall?.function?.arguments) {
            const result = JSON.parse(toolCall.function.arguments);
            aiAdjustment = Math.max(-3, Math.min(5, result.adjustment_days || 0));
            aiInsights = result.insight || '';
            console.log('AI adjustment:', aiAdjustment, 'Insight:', aiInsights);
          }
        }
      } catch (aiError) {
        console.error('AI enhancement failed, using base prediction:', aiError);
      }
    }

    // Calculate final predicted arrival
    const departureDateTime = new Date(departureDate);
    const predictedTransitDays = Math.round(avgTransitDays + aiAdjustment);
    const predictedArrival = new Date(departureDateTime);
    predictedArrival.setDate(predictedArrival.getDate() + predictedTransitDays);

    // Adjust confidence based on AI availability
    const finalConfidence = LOVABLE_API_KEY ? Math.min(0.95, confidenceBase + 0.05) : confidenceBase;

    // Update shipment with prediction
    const { error: updateError } = await supabase
      .from('shipments')
      .update({
        predicted_arrival: predictedArrival.toISOString().split('T')[0],
        prediction_confidence: finalConfidence,
        updated_at: new Date().toISOString()
      })
      .eq('id', shipmentId);

    if (updateError) {
      console.error('Error updating shipment:', updateError);
    }

    // Update or insert carrier stats
    const { error: statsError } = await supabase
      .from('carrier_stats')
      .upsert({
        carrier: carrier || 'AbuSaxiy',
        avg_transit_days: avgTransitDays,
        min_transit_days: minTransitDays,
        max_transit_days: maxTransitDays,
        total_shipments: sampleSize,
        calculated_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'carrier' });

    if (statsError) {
      console.error('Error updating carrier stats:', statsError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        prediction: {
          predictedArrival: predictedArrival.toISOString().split('T')[0],
          confidence: finalConfidence,
          transitDays: predictedTransitDays,
          avgTransitDays: Math.round(avgTransitDays),
          range: { min: minTransitDays, max: maxTransitDays },
          sampleSize,
          aiEnhanced: !!LOVABLE_API_KEY,
          insight: aiInsights
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in ml-eta-prediction:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
