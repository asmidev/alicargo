import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Repeat } from 'lucide-react';

export interface RecurringPattern {
  frequency: 'daily' | 'weekly' | 'monthly';
  interval: number;
  daysOfWeek?: number[];
  dayOfMonth?: number;
  endDate?: string;
  maxOccurrences?: number;
}

interface RecurringTaskConfigProps {
  isRecurring: boolean;
  onRecurringChange: (isRecurring: boolean) => void;
  pattern: RecurringPattern | null;
  onPatternChange: (pattern: RecurringPattern) => void;
}

export function RecurringTaskConfig({
  isRecurring,
  onRecurringChange,
  pattern,
  onPatternChange,
}: RecurringTaskConfigProps) {
  const { t } = useTranslation();

  const defaultPattern: RecurringPattern = {
    frequency: 'daily',
    interval: 1,
  };

  const currentPattern = pattern || defaultPattern;

  const handleFrequencyChange = (frequency: RecurringPattern['frequency']) => {
    onPatternChange({ ...currentPattern, frequency });
  };

  const handleIntervalChange = (interval: string) => {
    const num = parseInt(interval) || 1;
    onPatternChange({ ...currentPattern, interval: Math.max(1, num) });
  };

  const weekDays = [
    { value: 0, label: t('sunday') },
    { value: 1, label: t('monday') },
    { value: 2, label: t('tuesday') },
    { value: 3, label: t('wednesday') },
    { value: 4, label: t('thursday') },
    { value: 5, label: t('friday') },
    { value: 6, label: t('saturday') },
  ];

  const toggleDayOfWeek = (day: number) => {
    const days = currentPattern.daysOfWeek || [];
    const newDays = days.includes(day)
      ? days.filter(d => d !== day)
      : [...days, day].sort();
    onPatternChange({ ...currentPattern, daysOfWeek: newDays });
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Repeat className="h-4 w-4 text-muted-foreground" />
          <Label className="font-medium">{t('recurring_task')}</Label>
        </div>
        <Switch checked={isRecurring} onCheckedChange={onRecurringChange} />
      </div>

      {isRecurring && (
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('frequency')}</Label>
              <Select value={currentPattern.frequency} onValueChange={handleFrequencyChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">{t('daily')}</SelectItem>
                  <SelectItem value="weekly">{t('weekly')}</SelectItem>
                  <SelectItem value="monthly">{t('monthly')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('every')}</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  value={currentPattern.interval}
                  onChange={(e) => handleIntervalChange(e.target.value)}
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">
                  {currentPattern.frequency === 'daily' && t('days')}
                  {currentPattern.frequency === 'weekly' && t('weeks')}
                  {currentPattern.frequency === 'monthly' && t('months')}
                </span>
              </div>
            </div>
          </div>

          {currentPattern.frequency === 'weekly' && (
            <div className="space-y-2">
              <Label>{t('repeat_on')}</Label>
              <div className="flex flex-wrap gap-1">
                {weekDays.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleDayOfWeek(day.value)}
                    className={`px-2 py-1 text-xs rounded-md border transition-colors ${
                      (currentPattern.daysOfWeek || []).includes(day.value)
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-background hover:bg-muted'
                    }`}
                  >
                    {day.label.slice(0, 2)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {currentPattern.frequency === 'monthly' && (
            <div className="space-y-2">
              <Label>{t('day_of_month')}</Label>
              <Input
                type="number"
                min={1}
                max={31}
                value={currentPattern.dayOfMonth || 1}
                onChange={(e) =>
                  onPatternChange({ ...currentPattern, dayOfMonth: parseInt(e.target.value) || 1 })
                }
                className="w-24"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
