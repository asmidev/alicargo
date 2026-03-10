import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, AlertTriangle, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface VerificationProgressProps {
  total: number;
  verified: number;
  okCount: number;
  defectiveCount: number;
  missingCount: number;
}

export function VerificationProgress({
  total,
  verified,
  okCount,
  defectiveCount,
  missingCount,
}: VerificationProgressProps) {
  const { t } = useTranslation();
  const percentage = total > 0 ? Math.round((verified / total) * 100) : 0;
  const pendingCount = total - verified;
  const isComplete = verified === total && total > 0;

  return (
    <div className="space-y-3 p-4 bg-muted/50 rounded-lg border border-border">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">
          {t('vr_process')}
        </span>
        <span className="text-sm text-muted-foreground">
          {verified} / {total}
        </span>
      </div>
      
      <Progress 
        value={percentage} 
        className={`h-2 transition-all duration-500 ${
          isComplete ? '[&>div]:bg-green-500' : ''
        }`}
      />
      
      <div className="flex flex-wrap gap-2">
        {pendingCount > 0 && (
          <Badge 
            variant="outline" 
            className="border-muted-foreground/30 text-muted-foreground gap-1"
          >
            <Clock className="h-3 w-3" />
            {t('vr_waiting')}: {pendingCount}
          </Badge>
        )}
        
        <Badge 
          variant="outline" 
          className="border-green-500 text-green-500 gap-1"
        >
          <CheckCircle2 className="h-3 w-3" />
          OK: {okCount}
        </Badge>
        
        <Badge 
          variant="outline" 
          className="border-red-500 text-red-500 gap-1"
        >
          <XCircle className="h-3 w-3" />
          {t('vr_defective')}: {defectiveCount}
        </Badge>
        
        <Badge 
          variant="outline" 
          className="border-yellow-500 text-yellow-500 gap-1"
        >
          <AlertTriangle className="h-3 w-3" />
          {t('vr_missing')}: {missingCount}
        </Badge>
      </div>

      {isComplete && (
        <div className="flex items-center gap-2 text-green-500 text-sm font-medium animate-fade-in">
          <CheckCircle2 className="h-4 w-4" />
          <span>{t('vr_complete')}</span>
        </div>
      )}
    </div>
  );
}
