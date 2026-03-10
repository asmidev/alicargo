import { useTranslation } from 'react-i18next';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface FinancePeriodFilterProps {
  selectedMonth: number;
  selectedYear: number;
  onMonthChange: (month: number) => void;
  onYearChange: (year: number) => void;
}

export function FinancePeriodFilter({ selectedMonth, selectedYear, onMonthChange, onYearChange }: FinancePeriodFilterProps) {
  const { t } = useTranslation();

  const months = Array.from({ length: 12 }, (_, i) => t(`month_${i}`));

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Select value={selectedMonth.toString()} onValueChange={(v) => onMonthChange(Number(v))}>
        <SelectTrigger className="w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {months.map((m, i) => (
            <SelectItem key={i} value={i.toString()}>{m}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={selectedYear.toString()} onValueChange={(v) => onYearChange(Number(v))}>
        <SelectTrigger className="w-[100px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Array.from({ length: 3 }, (_, i) => new Date().getFullYear() - 1 + i).map(y => (
            <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
