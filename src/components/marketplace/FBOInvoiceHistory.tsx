import { useTranslation } from 'react-i18next';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Package, CheckCircle, Clock, XCircle } from 'lucide-react';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { format } from 'date-fns';
import { FBOInvoice } from '@/hooks/useFBOData';
import { useIsMobile } from '@/hooks/use-mobile';

interface FBOInvoiceHistoryProps {
  invoices: FBOInvoice[];
  isLoading?: boolean;
}

export function FBOInvoiceHistory({ invoices, isLoading }: FBOInvoiceHistoryProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  const getStatusBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case 'ACCEPTED':
      case 'DELIVERED':
        return (
          <Badge variant="default" className="bg-emerald-600 dark:bg-emerald-700 gap-1">
            <CheckCircle className="h-3 w-3" />
            {t('mp_accepted')}
          </Badge>
        );
      case 'PENDING':
      case 'IN_TRANSIT':
        return (
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3" />
            {t('mp_waiting')}
          </Badge>
        );
      case 'REJECTED':
      case 'CANCELLED':
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            {t('mp_cancelled')}
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t('mp_invoice_history')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <LoadingSkeleton count={3} compact />
        </CardContent>
      </Card>
    );
  }

  if (!invoices.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t('mp_invoice_history')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Package className="h-12 w-12 mb-2 opacity-50" />
            <p>{t('mp_invoices_not_found')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="h-5 w-5" />
          {t('mp_invoice_history')}
          <Badge variant="secondary" className="ml-2">{invoices.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className={isMobile ? "p-2 pt-0" : "p-0"}>
        {isMobile ? (
          <div className="space-y-2">
            {invoices.map((invoice) => (
              <div key={invoice.id} className="border rounded-lg p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-medium">{invoice.invoiceNumber || invoice.id.slice(0, 8)}</span>
                  {getStatusBadge(invoice.status)}
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{t('mp_n_products', { count: invoice.productCount })}</span>
                  <span>{invoice.totalQuantity} {t('mp_pcs')}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{invoice.createdAt ? format(new Date(invoice.createdAt), 'dd.MM.yyyy') : '-'}</span>
                  <span>{invoice.acceptedAt ? `✓ ${format(new Date(invoice.acceptedAt), 'dd.MM.yyyy')}` : t('mp_waiting')}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('mp_invoice_no')}</TableHead>
                <TableHead className="text-center">{t('mp_products_count')}</TableHead>
                <TableHead className="text-center">{t('mp_total_qty')}</TableHead>
                <TableHead>{t('mp_item_status')}</TableHead>
                <TableHead>{t('mp_created')}</TableHead>
                <TableHead>{t('mp_accepted')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-mono font-medium">{invoice.invoiceNumber || invoice.id}</TableCell>
                  <TableCell className="text-center">{invoice.productCount}</TableCell>
                  <TableCell className="text-center font-medium">{invoice.totalQuantity}</TableCell>
                  <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {invoice.createdAt ? format(new Date(invoice.createdAt), 'dd.MM.yyyy HH:mm') : '-'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {invoice.acceptedAt ? format(new Date(invoice.acceptedAt), 'dd.MM.yyyy HH:mm') : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}