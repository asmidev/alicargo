import { useTranslation } from 'react-i18next';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RotateCcw, Package, AlertTriangle } from 'lucide-react';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { format } from 'date-fns';
import { FBOReturn } from '@/hooks/useFBOData';
import { useIsMobile } from '@/hooks/use-mobile';

interface FBOReturnsTableProps {
  returns: FBOReturn[];
  isLoading?: boolean;
}

export function FBOReturnsTable({ returns, isLoading }: FBOReturnsTableProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DEFECTED':
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            {t('mp_defected')}
          </Badge>
        );
      case 'RETURNED':
        return <Badge variant="secondary">{t('mp_returned')}</Badge>;
      case 'PROCESSING':
        return <Badge variant="outline">{t('mp_processing')}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            {t('mp_fbo_returns')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <LoadingSkeleton count={3} compact />
        </CardContent>
      </Card>
    );
  }

  if (!returns.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            {t('mp_fbo_returns')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Package className="h-12 w-12 mb-2 opacity-50" />
            <p>{t('mp_returns_not_found')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <RotateCcw className="h-5 w-5" />
          {t('mp_fbo_returns')}
          <Badge variant="secondary" className="ml-2">{returns.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className={isMobile ? "p-2 pt-0" : "p-0"}>
        {isMobile ? (
          <div className="space-y-2">
            {returns.map((ret) => (
              <div key={ret.returnId} className="border rounded-lg p-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-sm line-clamp-2 flex-1">{ret.productTitle || t('mp_unnamed')}</p>
                  {getStatusBadge(ret.status)}
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{ret.quantity} {t('mp_pcs')}</span>
                  <span>{ret.returnReason || '-'}</span>
                  <span>{ret.createdAt ? format(new Date(ret.createdAt), 'dd.MM.yyyy') : '-'}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('mp_fbo_product')}</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-center">{t('mp_fbo_qty')}</TableHead>
                <TableHead>{t('mp_reason')}</TableHead>
                <TableHead>{t('mp_item_status')}</TableHead>
                <TableHead>{t('mp_fbo_date')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {returns.map((ret) => (
                <TableRow key={ret.returnId}>
                  <TableCell className="font-medium max-w-[200px] truncate">{ret.productTitle || t('mp_unnamed')}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">{ret.skuTitle || '-'}</TableCell>
                  <TableCell className="text-center font-medium">{ret.quantity}</TableCell>
                  <TableCell className="text-sm">{ret.returnReason || '-'}</TableCell>
                  <TableCell>{getStatusBadge(ret.status)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {ret.createdAt ? format(new Date(ret.createdAt), 'dd.MM.yyyy') : '-'}
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