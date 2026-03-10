import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Calendar, Clock, TrendingUp, RefreshCw, AlertCircle, CheckCircle2, Sparkles, Brain } from 'lucide-react';
import { format, differenceInDays, addDays } from 'date-fns';
import { uz } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

interface ETAPredictionProps {
  shipmentId: string;
  carrier?: string;
  departureDate?: string;
  currentPredictedArrival?: string;
  currentConfidence?: number;
  actualArrival?: string;
  weightKg?: number;
  volumeM3?: number;
}

interface MLPredictionResult {
  predictedArrival: string;
  confidence: number;
  transitDays: number;
  avgTransitDays: number;
  range: { min: number; max: number };
  sampleSize: number;
  aiEnhanced: boolean;
  insight?: string;
}

export function ETAPrediction({
  shipmentId,
  carrier = 'AbuSaxiy',
  departureDate,
  currentPredictedArrival,
  currentConfidence,
  actualArrival,
  weightKg,
  volumeM3
}: ETAPredictionProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [mlResult, setMlResult] = useState<MLPredictionResult | null>(null);

  // Fetch carrier stats
  const { data: carrierStats } = useQuery({
    queryKey: ['carrier-stats', carrier],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('carrier_stats')
        .select('*')
        .eq('carrier', carrier)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    }
  });

  const calculateETA = async () => {
    setIsRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('ml-eta-prediction', {
        body: {
          shipmentId,
          carrier,
          departureDate,
          weightKg,
          volumeM3
        }
      });

      if (error) throw error;

      if (data?.success && data?.prediction) {
        setMlResult(data.prediction);
        toast({
          title: t('eta_updated'),
          description: data.prediction.aiEnhanced 
            ? t('eta_ai_enhanced')
            : t('eta_historical'),
        });
        
        // Refresh the page to show updated data
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch (error: any) {
      console.error('Error calculating ETA:', error);
      toast({
        title: t('error'),
        description: t('eta_error'),
        variant: 'destructive',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.7) return 'text-green-500';
    if (confidence >= 0.4) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.7) return t('eta_high');
    if (confidence >= 0.4) return t('eta_medium');
    return t('eta_low');
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.7) return 'default';
    if (confidence >= 0.4) return 'secondary';
    return 'destructive';
  };

  // If already arrived, show actual vs predicted comparison
  if (actualArrival) {
    const actualDate = new Date(actualArrival);
    const predictedDate = currentPredictedArrival ? new Date(currentPredictedArrival) : null;
    const difference = predictedDate ? differenceInDays(actualDate, predictedDate) : null;

    return (
      <Card className="border-green-500/30 bg-green-500/5">
        <CardContent className="pt-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 text-green-600 mb-2">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">{t('eta_arrived')}</span>
              </div>
              <p className="text-lg font-semibold">
                {format(actualDate, 'd MMMM yyyy', { locale: uz })}
              </p>
              {difference !== null && (
                <p className={cn(
                  'text-sm mt-1',
                  difference === 0 ? 'text-green-600' :
                  difference > 0 ? 'text-orange-600' : 'text-blue-600'
                )}>
                  {difference === 0 ? t('eta_on_time') :
                   difference > 0 ? t('eta_late', { days: difference }) : t('eta_early', { days: Math.abs(difference) })}
                </p>
              )}
            </div>
            <Calendar className="h-8 w-8 text-green-500 opacity-50" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show prediction
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{t('eta_estimated')}</span>
            </div>
            
            {currentPredictedArrival ? (
              <>
                <p className="text-xl font-semibold">
                  {format(new Date(currentPredictedArrival), 'd MMMM yyyy', { locale: uz })}
                </p>
                
                <div className="flex items-center gap-2 flex-wrap">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant={getConfidenceBadge(currentConfidence || 0)}>
                          <TrendingUp className="h-3 w-3 mr-1" />
                          {getConfidenceLabel(currentConfidence || 0)} {t('eta_confidence')}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{t('eta_accuracy', { percent: Math.round((currentConfidence || 0) * 100) })}</p>
                        {carrierStats && (
                          <p className="text-xs mt-1">
                            {t('eta_based_on', { count: carrierStats.total_shipments })}
                          </p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  
                  {mlResult?.aiEnhanced && (
                    <Badge variant="outline" className="gap-1 border-primary/30 text-primary">
                      <Sparkles className="h-3 w-3" />
                      AI
                    </Badge>
                  )}
                </div>

                {mlResult?.insight && (
                  <div className="flex items-start gap-2 p-2 rounded-md bg-muted/50 text-xs">
                    <Brain className="h-3 w-3 mt-0.5 text-primary shrink-0" />
                    <span className="text-muted-foreground">{mlResult.insight}</span>
                  </div>
                )}

                {carrierStats && (
                  <p className="text-xs text-muted-foreground">
                    {t('eta_usual_range', { min: carrierStats.min_transit_days, max: carrierStats.max_transit_days })}
                  </p>
                )}
              </>
            ) : departureDate ? (
              <div className="space-y-2">
                <p className="text-muted-foreground flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  {t('eta_ml_calculate')}
                </p>
                <Button 
                  size="sm" 
                  onClick={calculateETA}
                  disabled={isRefreshing}
                  className="gap-2"
                >
                  {isRefreshing ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Brain className="h-4 w-4" />
                  )}
                  {t('eta_calculate')}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t('eta_no_departure')}
              </p>
            )}
          </div>

          {currentPredictedArrival && (
            <Button
              variant="ghost"
              size="icon"
              onClick={calculateETA}
              disabled={isRefreshing}
            >
              <RefreshCw className={cn(
                'h-4 w-4',
                isRefreshing && 'animate-spin'
              )} />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
