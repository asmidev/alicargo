import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { 
  Package, 
  ShoppingCart, 
  TrendingUp, 
  TrendingDown,
  Warehouse,
  BarChart3,
  Calendar,
  Loader2,
  ArrowDownToLine,
  BoxIcon
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFinanceCurrency } from '@/contexts/FinanceCurrencyContext';
import { ScrollArea } from '@/components/ui/scroll-area';

// Exchange rates are now sourced from useFinanceCurrency() context

const CATEGORY_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export function TashkentFinanceTab() {
  const { t } = useTranslation();
  const { formatMoney, convertFromUZS, usdToUzs, cnyToUzs } = useFinanceCurrency();
  const [periodFilter, setPeriodFilter] = useState<string>('30');

  // Fetch product variants with stock and cost data
  const { data: productVariants, isLoading: variantsLoading } = useQuery({
    queryKey: ['tashkent-variants-finance'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_variants')
        .select(`
          id,
          sku,
          stock_quantity,
          cost_price,
          selling_price,
          cost_price_currency,
          products (id, name, category)
        `)
        .gt('stock_quantity', 0);
      if (error) throw error;
      return data;
    },
  });

  // Fetch direct sales
  const { data: directSales, isLoading: salesLoading } = useQuery({
    queryKey: ['tashkent-direct-sales', periodFilter],
    queryFn: async () => {
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - parseInt(periodFilter));
      
      const { data, error } = await supabase
        .from('direct_sales')
        .select('*')
        .gte('created_at', daysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(5000);
      if (error) throw error;
      return data;
    },
  });

  // Fetch product items in Tashkent warehouse (arrived items = expenses)
  const { data: arrivedItems, isLoading: itemsLoading } = useQuery({
    queryKey: ['tashkent-arrived-items', periodFilter],
    queryFn: async () => {
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - parseInt(periodFilter));
      
      const { data, error } = await supabase
        .from('product_items')
        .select(`
          id,
          item_uuid,
          status,
          location,
          unit_cost,
          unit_cost_currency,
          unit_cost_usd,
          final_cost_usd,
          created_at,
          products (id, name, category)
        `)
        .eq('location', 'uzbekistan')
        .in('status', ['arrived_pending', 'in_tashkent'])
        .gte('updated_at', daysAgo.toISOString())
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const isLoading = variantsLoading || salesLoading || itemsLoading;

  // Calculate arrived items total (incoming goods = expenses)
  const arrivedItemsMetrics = arrivedItems?.reduce((acc, item) => {
    // Use final_cost_usd as the primary source, convert to UZS
    const costUSD = Number(item.final_cost_usd) || Number(item.unit_cost_usd) || 0;
    const valueUZS = costUSD * usdToUzs;
    
    return {
      totalValue: acc.totalValue + valueUZS,
      totalItems: acc.totalItems + 1,
    };
  }, { totalValue: 0, totalItems: 0 }) || { totalValue: 0, totalItems: 0 };

  // Calculate inventory value from variants (weighted average cost)
  const inventoryFromVariants = (productVariants as any[])?.reduce((acc, variant) => {
    const costPrice = variant.cost_price || 0;
    const quantity = variant.stock_quantity || 0;
    const currency = variant.cost_price_currency || 'UZS';
    
    // Convert to UZS using live rates
    let valueUZS = costPrice * quantity;
    if (currency === 'USD') {
      valueUZS = costPrice * usdToUzs * quantity;
    } else if (currency === 'CNY') {
      valueUZS = costPrice * cnyToUzs * quantity;
    }
    
    return {
      totalValue: acc.totalValue + valueUZS,
      totalItems: acc.totalItems + quantity,
    };
  }, { totalValue: 0, totalItems: 0 }) || { totalValue: 0, totalItems: 0 };

  // Total inventory
  const totalInventoryValue = inventoryFromVariants.totalValue;
  const totalInventoryItems = inventoryFromVariants.totalItems;

  // Calculate sales metrics
  const salesMetrics = directSales?.reduce((acc, sale) => {
    const revenue = sale.total_price || 0;
    const quantity = sale.quantity || 1;
    
    return {
      totalRevenue: acc.totalRevenue + revenue,
      totalQuantity: acc.totalQuantity + quantity,
      salesCount: acc.salesCount + 1,
    };
  }, { totalRevenue: 0, totalQuantity: 0, salesCount: 0 }) || { totalRevenue: 0, totalQuantity: 0, salesCount: 0 };

  // Calculate COGS (Cost of Goods Sold) from sales
  const cogsFromSales = directSales?.reduce((acc, sale) => {
    // Get cost from variant if available
    const variants = productVariants as any[] | undefined;
    const variant = variants?.find(v => v.id === sale.variant_id);
    if (variant && variant.cost_price) {
      let costUZS = variant.cost_price;
      if (variant.cost_price_currency === 'USD') {
        costUZS = variant.cost_price * usdToUzs;
      } else if (variant.cost_price_currency === 'CNY') {
        costUZS = variant.cost_price * cnyToUzs;
      }
      return acc + (costUZS * (sale.quantity || 1));
    }
    return acc;
  }, 0) || 0;

  // Gross profit from Tashkent sales
  const grossProfit = salesMetrics.totalRevenue - cogsFromSales;
  const profitMargin = salesMetrics.totalRevenue > 0 ? (grossProfit / salesMetrics.totalRevenue) * 100 : 0;

  // Sales by day for chart
  const salesByDay = directSales?.reduce((acc, sale) => {
    const date = new Date(sale.created_at).toLocaleDateString('uz-UZ', { day: '2-digit', month: 'short' });
    const existing = acc.find(d => d.date === date);
    if (existing) {
      existing.revenue += sale.total_price || 0;
      existing.quantity += sale.quantity || 1;
    } else {
      acc.push({
        date,
        revenue: sale.total_price || 0,
        quantity: sale.quantity || 1,
      });
    }
    return acc;
  }, [] as { date: string; revenue: number; quantity: number }[])?.reverse() || [];

  // Sales by category for pie chart
  const salesByCategory = directSales?.reduce((acc, sale) => {
    const variants = productVariants as any[] | undefined;
    const variant = variants?.find(v => v.id === sale.variant_id);
    const category = variant?.products?.category || 'Boshqa';
    const existing = acc.find(c => c.name === category);
    if (existing) {
      existing.value += sale.total_price || 0;
    } else {
      acc.push({
        name: category,
        value: sale.total_price || 0,
      });
    }
    return acc;
  }, [] as { name: string; value: number }[]) || [];

  // Arrived items by product for display
  const arrivedByProduct = arrivedItems?.reduce((acc, item) => {
    const productName = (item.products as any)?.name || 'Noma\'lum';
    const costUSD = Number(item.final_cost_usd) || Number(item.unit_cost_usd) || 0;
    const valueUZS = costUSD * usdToUzs;
    
    const existing = acc.find(p => p.name === productName);
    if (existing) {
      existing.count += 1;
      existing.totalCost += valueUZS;
    } else {
      acc.push({
        name: productName,
        count: 1,
        totalCost: valueUZS,
      });
    }
    return acc;
  }, [] as { name: string; count: number; totalCost: number }[])?.sort((a, b) => b.totalCost - a.totalCost) || [];

  return (
    <div className="space-y-6">
      {/* Header with filter */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Warehouse className="h-5 w-5" />
            Toshkent Ombori Moliyasi
          </h3>
          <p className="text-sm text-muted-foreground">To'g'ridan-to'g'ri savdo va inventar tahlili</p>
        </div>
        <Select value={periodFilter} onValueChange={setPeriodFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Davr" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Oxirgi 7 kun</SelectItem>
            <SelectItem value="30">Oxirgi 30 kun</SelectItem>
            <SelectItem value="90">Oxirgi 90 kun</SelectItem>
            <SelectItem value="365">Bir yil</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards - 5 cards now */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="p-4 bg-card border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Inventar qiymati</p>
              <p className="text-lg font-bold">{formatMoney(totalInventoryValue)}</p>
              <p className="text-xs text-muted-foreground">{totalInventoryItems} dona mahsulot</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-card border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
              <ArrowDownToLine className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Kelib tushgan (xarajat)</p>
              <p className="text-lg font-bold text-destructive">{formatMoney(arrivedItemsMetrics.totalValue)}</p>
              <p className="text-xs text-muted-foreground">{arrivedItemsMetrics.totalItems} ta tovar</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-card border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-chart-2/10 flex items-center justify-center">
              <ShoppingCart className="h-5 w-5 text-chart-2" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Sotuv daromadi</p>
              <p className="text-lg font-bold">{formatMoney(salesMetrics.totalRevenue)}</p>
              <p className="text-xs text-muted-foreground">{salesMetrics.salesCount} ta sotuv</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-card border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-chart-3/10 flex items-center justify-center">
              <TrendingDown className="h-5 w-5 text-chart-3" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Sotilgan tannarxi</p>
              <p className="text-lg font-bold">{formatMoney(cogsFromSales)}</p>
              <p className="text-xs text-muted-foreground">{salesMetrics.totalQuantity} dona sotildi</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-card border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-chart-1/10 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-chart-1" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Yalpi foyda</p>
              <p className={`text-lg font-bold ${grossProfit >= 0 ? 'text-chart-1' : 'text-destructive'}`}>
                {formatMoney(grossProfit)}
              </p>
              <p className="text-xs text-muted-foreground">{profitMargin.toFixed(1)}% margin</p>
            </div>
          </div>
        </Card>
      </div>

      {isLoading ? (
        <LoadingSkeleton count={5} />
      ) : (
        <div className="space-y-6">
          {/* Arrived Items (Expenses) Section */}
          <Card className="p-6 bg-card border-border">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <BoxIcon className="h-5 w-5 text-destructive" />
              Kelib tushgan tovarlar (Xarajatlar)
            </h3>
            
            {arrivedByProduct.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <p className="text-sm">Bu davrda kelib tushgan tovar yo'q</p>
              </div>
            ) : (
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {arrivedByProduct.map((product, index) => (
                    <div 
                      key={product.name} 
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-2 h-2 rounded-full" 
                          style={{ backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }}
                        />
                        <div>
                          <p className="text-sm font-medium truncate max-w-[200px]">{product.name}</p>
                          <p className="text-xs text-muted-foreground">{product.count} dona</p>
                        </div>
                      </div>
                      <span className="font-semibold text-destructive">{formatMoney(product.totalCost)}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sales Trend Chart */}
            <Card className="lg:col-span-2 p-6 bg-card border-border">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Sotuv trendi
              </h3>

              {salesByDay.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <p className="text-sm">Bu davrda sotuv yo'q</p>
                </div>
              ) : (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={salesByDay}>
                      <defs>
                        <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="date" 
                        stroke="hsl(var(--muted-foreground))"
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis 
                        stroke="hsl(var(--muted-foreground))"
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => {
                          const converted = convertFromUZS(value);
                          return converted >= 1000000 ? `${(converted / 1000000).toFixed(1)}M` : `${(converted / 1000).toFixed(0)}K`;
                        }}
                      />
                      <Tooltip 
                        formatter={(value: number) => formatMoney(value)}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="revenue" 
                        stroke="hsl(var(--chart-1))" 
                        fillOpacity={1} 
                        fill="url(#colorSales)" 
                        name="Daromad"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            {/* Sales by Category */}
            <Card className="p-6 bg-card border-border">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Kategoriya bo'yicha
              </h3>

              {salesByCategory.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <p className="text-sm">Ma'lumot yo'q</p>
                </div>
              ) : (
                <>
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={salesByCategory}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {salesByCategory.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: number) => formatMoney(value)}
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))' 
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="space-y-2 mt-4">
                    {salesByCategory.slice(0, 5).map((cat, index) => (
                      <div key={cat.name} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }}
                          />
                          <span className="text-muted-foreground truncate max-w-[120px]">{cat.name}</span>
                        </div>
                        <span className="font-medium">{formatMoney(cat.value)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
