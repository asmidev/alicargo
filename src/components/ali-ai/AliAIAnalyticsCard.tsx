import { TrendingUp, TrendingDown, Minus, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface MetricData {
  label: string;
  value: string | number;
  previousValue?: string | number;
  change?: number;
  unit?: string;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'default' | 'success' | 'warning' | 'danger';
}

interface AliAIAnalyticsCardProps {
  title: string;
  metrics: MetricData[];
  period?: string;
  insight?: string;
}

export function AliAIAnalyticsCard({ title, metrics, period, insight }: AliAIAnalyticsCardProps) {
  const getTrendIcon = (trend?: string, change?: number) => {
    const effectiveTrend = trend || (change !== undefined ? (change > 0 ? 'up' : change < 0 ? 'down' : 'neutral') : undefined);
    
    switch (effectiveTrend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      case 'neutral':
        return <Minus className="h-4 w-4 text-muted-foreground" />;
      default:
        return null;
    }
  };

  const getColorClass = (color?: string, change?: number) => {
    if (color) {
      switch (color) {
        case 'success': return 'text-green-600 dark:text-green-400';
        case 'warning': return 'text-amber-600 dark:text-amber-400';
        case 'danger': return 'text-red-600 dark:text-red-400';
        default: return '';
      }
    }
    
    if (change !== undefined) {
      if (change > 0) return 'text-green-600 dark:text-green-400';
      if (change < 0) return 'text-red-600 dark:text-red-400';
    }
    
    return '';
  };

  return (
    <Card className="my-3">
      <CardContent className="pt-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium">{title}</h4>
          {period && <span className="text-xs text-muted-foreground">{period}</span>}
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          {metrics.map((metric, idx) => (
            <div 
              key={idx} 
              className={cn(
                "p-3 rounded-lg bg-muted/50",
                metrics.length === 1 && "col-span-2"
              )}
            >
              <p className="text-xs text-muted-foreground mb-1">{metric.label}</p>
              <div className="flex items-center gap-2">
                <span className={cn("text-xl font-bold", getColorClass(metric.color, metric.change))}>
                  {metric.value}{metric.unit}
                </span>
                {getTrendIcon(metric.trend, metric.change)}
              </div>
              
              {(metric.previousValue !== undefined || metric.change !== undefined) && (
                <div className="flex items-center gap-2 mt-1">
                  {metric.previousValue !== undefined && (
                    <span className="text-xs text-muted-foreground">
                      Oldingi: {metric.previousValue}{metric.unit}
                    </span>
                  )}
                  {metric.change !== undefined && (
                    <span className={cn(
                      "text-xs font-medium",
                      metric.change >= 0 ? 'text-green-500' : 'text-red-500'
                    )}>
                      {metric.change >= 0 ? '+' : ''}{metric.change}%
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        
        {insight && (
          <div className="mt-3 p-2 rounded-lg bg-primary/5 border border-primary/10">
            <div className="flex items-start gap-2">
              <ArrowRight className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <p className="text-xs text-foreground/80">{insight}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
