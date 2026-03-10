import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ETARequest {
  shipment_id?: string;
  carrier?: string;
  departure_date?: string;
  weight_kg?: number;
  volume_m3?: number;
}

interface CarrierStats {
  avg_transit_days: number;
  min_transit_days: number;
  max_transit_days: number;
  total_shipments: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: ETARequest = await req.json();
    console.log('Calculating ETA for:', payload);

    const carrier = payload.carrier || 'AbuSaxiy';
    const departureDate = payload.departure_date || new Date().toISOString();

    // Get historical data for this carrier
    const { data: historicalShipments, error: histError } = await supabase
      .from('shipments')
      .select('departure_date, arrival_date, total_weight_kg, total_volume_m3, actual_transit_days')
      .eq('carrier', carrier)
      .eq('status', 'arrived')
      .not('departure_date', 'is', null)
      .not('arrival_date', 'is', null)
      .order('arrival_date', { ascending: false })
      .limit(50);

    if (histError) {
      console.error('Error fetching historical data:', histError);
      throw histError;
    }

    let avgTransitDays = 10; // Default fallback
    let minTransitDays = 7;
    let maxTransitDays = 14;
    let confidence = 0.5;

    if (historicalShipments && historicalShipments.length > 0) {
      // Calculate transit days for each shipment
      const transitDays = historicalShipments.map(s => {
        if (s.actual_transit_days) return s.actual_transit_days;
        const dep = new Date(s.departure_date);
        const arr = new Date(s.arrival_date);
        return Math.ceil((arr.getTime() - dep.getTime()) / (1000 * 60 * 60 * 24));
      }).filter(d => d > 0 && d < 60); // Filter out invalid values

      if (transitDays.length > 0) {
        avgTransitDays = transitDays.reduce((a, b) => a + b, 0) / transitDays.length;
        minTransitDays = Math.min(...transitDays);
        maxTransitDays = Math.max(...transitDays);

        // Calculate confidence based on data points and variance
        const variance = transitDays.reduce((sum, d) => sum + Math.pow(d - avgTransitDays, 2), 0) / transitDays.length;
        const stdDev = Math.sqrt(variance);
        
        // More data points and lower variance = higher confidence
        const dataPointFactor = Math.min(transitDays.length / 20, 1); // Max at 20 shipments
        const varianceFactor = Math.max(1 - (stdDev / avgTransitDays), 0.3);
        confidence = (dataPointFactor * 0.5 + varianceFactor * 0.5);
      }
    }

    // Adjust for weight/volume (heavier shipments may take slightly longer)
    let weightAdjustment = 0;
    if (payload.weight_kg && payload.weight_kg > 1000) {
      weightAdjustment = Math.min((payload.weight_kg - 1000) / 2000, 2); // Max 2 days extra
    }

    // Seasonal adjustment (winter may be slower)
    const depMonth = new Date(departureDate).getMonth();
    const isWinter = depMonth === 11 || depMonth === 0 || depMonth === 1;
    const seasonalAdjustment = isWinter ? 1 : 0;

    const predictedTransitDays = Math.round(avgTransitDays + weightAdjustment + seasonalAdjustment);
    
    // Calculate predicted arrival date
    const predictedArrival = new Date(departureDate);
    predictedArrival.setDate(predictedArrival.getDate() + predictedTransitDays);

    // Update carrier stats
    await supabase.from('carrier_stats').upsert({
      carrier,
      avg_transit_days: Math.round(avgTransitDays * 10) / 10,
      min_transit_days: minTransitDays,
      max_transit_days: maxTransitDays,
      total_shipments: historicalShipments?.length || 0,
      calculated_at: new Date().toISOString()
    }, { onConflict: 'carrier' });

    // Update shipment if ID provided
    if (payload.shipment_id) {
      await supabase
        .from('shipments')
        .update({
          predicted_arrival: predictedArrival.toISOString().split('T')[0],
          prediction_confidence: Math.round(confidence * 100) / 100
        })
        .eq('id', payload.shipment_id);
    }

    const response = {
      predicted_arrival: predictedArrival.toISOString().split('T')[0],
      predicted_transit_days: predictedTransitDays,
      confidence: Math.round(confidence * 100) / 100,
      confidence_level: confidence >= 0.7 ? 'high' : confidence >= 0.4 ? 'medium' : 'low',
      historical_average: Math.round(avgTransitDays * 10) / 10,
      historical_range: {
        min: minTransitDays,
        max: maxTransitDays
      },
      adjustments: {
        weight: weightAdjustment,
        seasonal: seasonalAdjustment
      },
      data_points: historicalShipments?.length || 0
    };

    console.log('ETA calculation result:', response);

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in calculate-eta:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
