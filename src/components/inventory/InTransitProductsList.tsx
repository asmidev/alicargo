import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Package, Truck, AlertTriangle, Box } from "lucide-react";
import { format } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";

interface InTransitProduct {
  id: string;
  product_id: string;
  product_name: string;
  main_image_url: string | null;
  box_id: string | null;
  box_number: string | null;
  store_number: string | null;
  status: string;
  estimated_arrival: string | null;
}

interface InTransitBox {
  id: string;
  box_number: string;
  store_number: string | null;
  status: string;
  estimated_arrival: string | null;
  item_count: number;
  products: InTransitProduct[];
}

export function InTransitProductsList() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  const { data: inTransitData, isLoading } = useQuery({
    queryKey: ['in-transit-products-detailed'],
    queryFn: async () => {
      // 1. Fetch transit boxes (status = in_transit OR location = transit OR status = arrived but box not confirmed yet)
      const transitBoxes = await fetchAllRows(
        supabase
          .from('boxes')
          .select('id, box_number, store_number, status, location, estimated_arrival')
          .or('status.eq.in_transit,location.eq.transit,status.eq.arrived')
      );
      
      const transitBoxIds = transitBoxes?.map(b => b.id) || [];

      // 2. Fetch ALL potentially relevant product items (in_transit, packed, or arrived_pending)
      // We use fetchAllRows to bypass the 1000 row limit
      const allProductItems = await fetchAllRows(
        supabase
          .from('product_items')
          .select(`
            id,
            product_id,
            box_id,
            status,
            products!inner (
              id,
              name,
              main_image_url
            )
          `)
          .in('status', ['in_transit', 'packed', 'arrived_pending', 'arrived', 'in_stock', 'received'])
      );

      // 3. Filter and Deduplicate products
      // We only want products that are either:
      // a) Explicitly in_transit
      // b) In one of our identified transit boxes
      // c) In arrived_pending status (arrived but not yet confirmed)
      const filteredProducts = allProductItems.filter(item => {
        const isExplicitlyTransit = item.status === 'in_transit' || item.status === 'arrived_pending';
        const isInTransitBox = item.box_id && transitBoxIds.includes(item.box_id);
        return isExplicitlyTransit || isInTransitBox;
      });

      // Group by box
      const boxMap = new Map<string, InTransitBox>();
      
      transitBoxes?.forEach(box => {
        boxMap.set(box.id, {
          id: box.id,
          box_number: box.box_number,
          store_number: box.store_number,
          status: box.status || 'in_transit',
          estimated_arrival: box.estimated_arrival,
          item_count: 0,
          products: [],
        });
      });

      // Add products to boxes
      filteredProducts.forEach(item => {
        const boxId = item.box_id;
        const product: InTransitProduct = {
          id: item.id,
          product_id: item.product_id,
          product_name: (item.products as any)?.name || 'Noma\'lum',
          main_image_url: (item.products as any)?.main_image_url,
          box_id: boxId,
          box_number: boxId ? boxMap.get(boxId)?.box_number || null : null,
          store_number: boxId ? boxMap.get(boxId)?.store_number || null : null,
          status: item.status,
          estimated_arrival: boxId ? boxMap.get(boxId)?.estimated_arrival || null : null,
        };
        
        if (boxId && boxMap.has(boxId)) {
          const box = boxMap.get(boxId)!;
          box.products.push(product);
          box.item_count++;
        }
      });

      // Convert to array and filter out empty boxes if needed
      const boxes = Array.from(boxMap.values())
        .sort((a, b) => {
          if (!a.estimated_arrival) return 1;
          if (!b.estimated_arrival) return -1;
          return new Date(a.estimated_arrival).getTime() - new Date(b.estimated_arrival).getTime();
        });
      const totalProducts = filteredProducts.length;
      const emptyBoxes = boxes.filter(b => b.item_count === 0);

      return {
        boxes,
        totalProducts,
        emptyBoxes,
        hasEmptyBoxes: emptyBoxes.length > 0,
      };
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const { boxes = [], totalProducts = 0, emptyBoxes = [], hasEmptyBoxes = false } = inTransitData || {};

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle className="flex items-center gap-2">
          <Truck className="h-5 w-5 text-amber-500" />
          {t('inv_transit_title')}
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-amber-100 text-amber-800">
            {t('inv_transit_boxes', { count: boxes.length })}
          </Badge>
          <Badge variant="default">
            {t('inv_transit_products', { count: totalProducts })}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {hasEmptyBoxes && (
          <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  {t('inv_transit_empty_boxes', { count: emptyBoxes.length })}
                </p>
                <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                  {t('inv_transit_empty_boxes_desc')}
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {emptyBoxes.map(box => (
                    <Badge key={box.id} variant="outline" className="text-amber-700">
                      {box.box_number} ({box.store_number || t('inv_transit_no_track')})
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {boxes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>{t('inv_transit_no_products')}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {boxes.map((box) => (
              <div key={box.id} className="border rounded-lg overflow-hidden">
                <div className="bg-muted/50 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Box className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <span className="font-medium">{box.box_number}</span>
                      {box.store_number && (
                        <span className="text-sm text-muted-foreground ml-2">
                          Trek: {box.store_number}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {box.estimated_arrival && (
                      <Badge variant="outline">
                        ETA: {format(new Date(box.estimated_arrival), 'dd.MM.yyyy')}
                      </Badge>
                    )}
                    <Badge 
                      variant={box.item_count > 0 ? "default" : "destructive"}
                    >
                      {t('inv_transit_products', { count: box.item_count })}
                    </Badge>
                  </div>
                </div>
                
                {box.item_count > 0 && (isMobile ? (
                  <div className="p-2 space-y-1.5">
                    {box.products.map((product) => (
                      <div key={product.id} className="flex items-center gap-2 p-2 rounded bg-muted/30">
                        <div className="w-8 h-8 rounded bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                          {product.main_image_url ? (
                            <img src={product.main_image_url} alt={product.product_name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          ) : (
                            <Package className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <span className="text-sm font-medium flex-1 truncate">{product.product_name}</span>
                        <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 text-xs">
                          {product.status === 'in_transit' ? t('inv_transit_in_transit') : product.status === 'packed' ? t('inv_transit_packed') : product.status === 'arrived_pending' ? t('inv_arrived_pending', 'Kutilmoqda') : product.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[60px]">{t('inv_transit_image')}</TableHead>
                        <TableHead>{t('inv_transit_product')}</TableHead>
                        <TableHead className="text-center">{t('inv_transit_status')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {box.products.map((product) => (
                        <TableRow key={product.id}>
                          <TableCell>
                            <div className="w-10 h-10 rounded bg-muted flex items-center justify-center overflow-hidden">
                              {product.main_image_url ? (
                                <img src={product.main_image_url} alt={product.product_name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                              ) : (
                                <Package className="h-5 w-5 text-muted-foreground" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{product.product_name}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                              {product.status === 'in_transit' ? t('inv_transit_in_transit') : product.status === 'packed' ? t('inv_transit_packed') : product.status === 'arrived_pending' ? t('inv_arrived_pending', 'Kutilmoqda') : product.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ))}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
