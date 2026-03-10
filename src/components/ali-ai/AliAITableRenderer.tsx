import { useState } from 'react';
import { Download, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

interface Column {
  key: string;
  label: string;
  align?: 'left' | 'center' | 'right';
  format?: 'number' | 'currency' | 'percent' | 'date';
}

interface TableData {
  title: string;
  columns: Column[];
  rows: Record<string, any>[];
  summary?: Record<string, any>;
  exportable?: boolean;
}

interface AliAITableRendererProps {
  tableData: TableData;
}

export function AliAITableRenderer({ tableData }: AliAITableRendererProps) {
  const { title, columns, rows, summary, exportable = true } = tableData;
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const formatValue = (value: any, format?: string) => {
    if (value === null || value === undefined) return '-';
    
    switch (format) {
      case 'number':
        return typeof value === 'number' ? value.toLocaleString() : value;
      case 'currency':
        return typeof value === 'number' ? `$${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : value;
      case 'percent':
        return typeof value === 'number' ? `${value.toFixed(1)}%` : value;
      case 'date':
        try {
          return new Date(value).toLocaleDateString('uz-UZ');
        } catch {
          return value;
        }
      default:
        return value;
    }
  };

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortedRows = [...rows].sort((a, b) => {
    if (!sortKey) return 0;
    const aVal = a[sortKey];
    const bVal = b[sortKey];
    
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    }
    
    const aStr = String(aVal || '');
    const bStr = String(bVal || '');
    return sortDir === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
  });

  const exportToCsv = () => {
    try {
      const headers = columns.map(c => c.label).join(',');
      const csvRows = sortedRows.map(row => 
        columns.map(col => {
          const val = row[col.key];
          // Escape quotes and wrap in quotes if contains comma
          const strVal = String(val ?? '');
          return strVal.includes(',') ? `"${strVal.replace(/"/g, '""')}"` : strVal;
        }).join(',')
      );
      
      const csv = [headers, ...csvRows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('CSV formatida yuklab olindi');
    } catch (error) {
      toast.error('Eksport qilishda xatolik');
    }
  };

  return (
    <Card className="my-3 overflow-hidden">
      <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {exportable && rows.length > 0 && (
          <Button variant="ghost" size="sm" onClick={exportToCsv} className="h-7 px-2">
            <Download className="h-3.5 w-3.5 mr-1" />
            <span className="text-xs">CSV</span>
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map(col => (
                  <TableHead 
                    key={col.key}
                    className={`text-xs cursor-pointer hover:bg-muted/50 ${
                      col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''
                    }`}
                    onClick={() => handleSort(col.key)}
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      {sortKey === col.key ? (
                        sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-30" />
                      )}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRows.map((row, idx) => (
                <TableRow key={idx}>
                  {columns.map(col => (
                    <TableCell 
                      key={col.key}
                      className={`text-xs py-2 ${
                        col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''
                      }`}
                    >
                      {formatValue(row[col.key], col.format)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
              
              {/* Summary row */}
              {summary && (
                <TableRow className="bg-muted/50 font-medium">
                  {columns.map((col, idx) => (
                    <TableCell 
                      key={col.key}
                      className={`text-xs py-2 ${
                        col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''
                      }`}
                    >
                      {idx === 0 ? 'Jami' : formatValue(summary[col.key], col.format)}
                    </TableCell>
                  ))}
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        
        {rows.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-4">Ma'lumot topilmadi</p>
        )}
      </CardContent>
    </Card>
  );
}
