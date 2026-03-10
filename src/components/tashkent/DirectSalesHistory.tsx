import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  History, 
  Search, 
  Receipt, 
  Banknote, 
  CreditCard, 
  ArrowRightLeft,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DirectSalesHistoryProps {
  className?: string;
  limit?: number;
}

const PAGE_SIZE = 20;

export function DirectSalesHistory({ className, limit }: DirectSalesHistoryProps) {
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [page, setPage] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ["direct-sales-history", page, limit],
    queryFn: async () => {
      let query = supabase
        .from("direct_sales")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });

      if (limit) {
        query = query.limit(limit);
      } else {
        query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { sales: data || [], total: count || 0 };
    },
  });

  const sales = data?.sales || [];
  const totalPages = Math.ceil((data?.total || 0) / PAGE_SIZE);

  // Filter sales
  const filteredSales = sales.filter((sale) => {
    const matchesSearch =
      sale.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sale.receipt_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sale.customer_name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesPayment =
      paymentFilter === "all" || sale.payment_method === paymentFilter;

    return matchesSearch && matchesPayment;
  });

  const formatPrice = (price: number | null, currency: string = "UZS") => {
    if (!price) return "-";
    if (currency === "USD") {
      return "$" + price.toFixed(2);
    }
    return new Intl.NumberFormat("uz-UZ").format(price) + " so'm";
  };

  const getPaymentIcon = (method: string) => {
    switch (method) {
      case "cash":
        return Banknote;
      case "card":
        return CreditCard;
      case "transfer":
        return ArrowRightLeft;
      default:
        return Banknote;
    }
  };

  const getPaymentLabel = (method: string) => {
    switch (method) {
      case "cash":
        return "Naqd";
      case "card":
        return "Karta";
      case "transfer":
        return "O'tkazma";
      default:
        return method;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-green-100 text-green-800">To'langan</Badge>;
      case "pending":
        return <Badge variant="secondary">Kutilmoqda</Badge>;
      case "partial":
        return <Badge className="bg-yellow-100 text-yellow-800">Qisman</Badge>;
      case "refunded":
        return <Badge variant="destructive">Qaytarilgan</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          {limit ? "So'nggi sotuvlar" : "Sotuvlar tarixi"}
        </CardTitle>
        {!limit && (
          <div className="flex items-center gap-3">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Qidirish..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="To'lov usuli" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Barchasi</SelectItem>
                <SelectItem value="cash">Naqd</SelectItem>
                <SelectItem value="card">Karta</SelectItem>
                <SelectItem value="transfer">O'tkazma</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {filteredSales.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Receipt className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Sotuvlar tarixi bo'sh</p>
          </div>
        ) : (
          <>
            {isMobile ? (
              <div className="space-y-2">
                {filteredSales.map((sale) => {
                  const PaymentIcon = getPaymentIcon(sale.payment_method);
                  return (
                    <div key={sale.id} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm truncate flex-1">{sale.product_name}</span>
                        {getStatusBadge(sale.payment_status)}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">{sale.quantity} dona</span>
                        <span className="font-medium text-sm">{formatPrice(sale.total_price, sale.currency)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <Badge variant="outline" className="gap-1 text-xs">
                          <PaymentIcon className="h-3 w-3" />
                          {getPaymentLabel(sale.payment_method)}
                        </Badge>
                        <span>{format(new Date(sale.created_at), "dd.MM.yyyy HH:mm")}</span>
                      </div>
                      {sale.receipt_number && (
                        <div className="text-xs text-muted-foreground font-mono">#{sale.receipt_number}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kvitansiya</TableHead>
                      <TableHead>Mahsulot</TableHead>
                      <TableHead className="text-center">Miqdor</TableHead>
                      <TableHead className="text-right">Summa</TableHead>
                      <TableHead className="text-center">To'lov</TableHead>
                      <TableHead className="text-center">Holat</TableHead>
                      <TableHead>Xaridor</TableHead>
                      <TableHead>Sana</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSales.map((sale) => {
                      const PaymentIcon = getPaymentIcon(sale.payment_method);
                      return (
                        <TableRow key={sale.id}>
                          <TableCell className="font-mono text-sm">{sale.receipt_number}</TableCell>
                          <TableCell className="font-medium max-w-[200px] truncate">{sale.product_name}</TableCell>
                          <TableCell className="text-center">{sale.quantity} dona</TableCell>
                          <TableCell className="text-right">
                            <div>
                              <p className="font-medium">{formatPrice(sale.total_price, sale.currency)}</p>
                              {sale.currency === "UZS" && sale.price_usd && (
                                <p className="text-xs text-muted-foreground">≈ ${sale.price_usd.toFixed(2)}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="gap-1">
                              <PaymentIcon className="h-3 w-3" />
                              {getPaymentLabel(sale.payment_method)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">{getStatusBadge(sale.payment_status)}</TableCell>
                          <TableCell className="text-muted-foreground">{sale.customer_name || "-"}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{format(new Date(sale.created_at), "dd.MM.yyyy HH:mm")}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Pagination */}
            {!limit && totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  {page * PAGE_SIZE + 1} - {Math.min((page + 1) * PAGE_SIZE, data?.total || 0)} / {data?.total || 0}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
