import { useState } from 'react';
import { Pencil, Check, X, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useFinanceCurrency } from '@/contexts/FinanceCurrencyContext';

interface ExchangeRateBannerProps {
  showEdit?: boolean;
  compact?: boolean;
  className?: string;
}

export function ExchangeRateBanner({ showEdit = true, compact = false, className }: ExchangeRateBannerProps) {
  const { usdToUzs, cnyToUzs, isManualRate, rateSource, saveManualRate, resetToAutoRate } = useFinanceCurrency();
  const [editing, setEditing] = useState(false);
  const [draftUsd, setDraftUsd] = useState('');
  const [draftCny, setDraftCny] = useState('');
  const [saving, setSaving] = useState(false);

  const handleEditStart = () => {
    setDraftUsd(usdToUzs.toString());
    setDraftCny(cnyToUzs.toString());
    setEditing(true);
  };

  const handleApply = async () => {
    const usd = parseFloat(draftUsd);
    const cny = parseFloat(draftCny);
    if (usd > 0 && cny > 0) {
      setSaving(true);
      await saveManualRate(usd, cny);
      setSaving(false);
    }
    setEditing(false);
  };

  const handleCancel = () => {
    setEditing(false);
  };

  const handleReset = async () => {
    setSaving(true);
    await resetToAutoRate();
    setSaving(false);
    setEditing(false);
  };

  const sourceLabel = isManualRate
    ? '✏️ Qo\'lda'
    : rateSource === 'ipak_yoli'
    ? '🏦 Ipak Yo\'li'
    : rateSource === 'cbu'
    ? '🏛️ Markaziy Bank'
    : rateSource === 'loading'
    ? '...'
    : rateSource || '🏦 Bank';

  if (editing) {
    return (
      <div className={cn('rounded-lg border border-warning/30 bg-warning/5 p-2.5', className)}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-warning-foreground whitespace-nowrap">✏️ Kurs:</span>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground whitespace-nowrap">1 USD =</span>
            <Input
              type="number"
              value={draftUsd}
              onChange={(e) => setDraftUsd(e.target.value)}
              className="h-7 w-28 text-xs px-2"
              mobileOptimized={false}
              autoFocus
            />
            <span className="text-xs text-muted-foreground">so'm</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground whitespace-nowrap">1 CNY =</span>
            <Input
              type="number"
              value={draftCny}
              onChange={(e) => setDraftCny(e.target.value)}
              className="h-7 w-24 text-xs px-2"
              mobileOptimized={false}
            />
            <span className="text-xs text-muted-foreground">so'm</span>
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" className="h-7 px-2" onClick={handleApply} disabled={saving}>
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={handleCancel} disabled={saving}>
              <X className="h-3.5 w-3.5" />
            </Button>
            {isManualRate && (
              <Button size="sm" variant="ghost" className="h-7 px-2 text-muted-foreground" onClick={handleReset} disabled={saving} title="Bank kursiga qaytarish">
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">* Ushbu kurs bazaga saqlanadi va barcha bo'limlarda qo'llaniladi.</p>
      </div>
    );
  }

  return (
    <div className={cn(
      'flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-3 py-2 text-xs',
      isManualRate ? 'border border-primary/20 bg-primary/5' : 'bg-muted/60',
      className
    )}>
      <span className={cn(
        'font-medium whitespace-nowrap',
        isManualRate ? 'text-primary' : 'text-muted-foreground'
      )}>
        {sourceLabel}
      </span>
      <span className="text-foreground font-mono whitespace-nowrap">
        1 USD = <strong>{usdToUzs.toLocaleString('uz-UZ')}</strong> so'm
      </span>
      {!compact && (
        <>
          <span className="text-muted-foreground/40">·</span>
          <span className="text-foreground font-mono whitespace-nowrap">
            1 CNY = <strong>{cnyToUzs.toLocaleString('uz-UZ')}</strong> so'm
          </span>
        </>
      )}
      {showEdit && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 text-[11px] ml-auto gap-1 text-muted-foreground hover:text-foreground"
          onClick={handleEditStart}
        >
          <Pencil className="h-3 w-3" />
          Tahrirlash
        </Button>
      )}
      {isManualRate && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 text-[11px] gap-1 text-primary/70 hover:text-primary"
          onClick={handleReset}
          disabled={saving}
        >
          <RotateCcw className="h-3 w-3" />
          Bank kursiga qaytarish
        </Button>
      )}
    </div>
  );
}
