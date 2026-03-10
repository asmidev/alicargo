import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ShoppingCart, TrendingUp, Calendar, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface DirectSalesStatsProps {
  className?: string;
}

export function DirectSalesStats({ className }: DirectSalesStatsProps) {
  const { t } = useTranslation();
  const { data: stats, isLoading } = useQuery({
    queryKey: ["direct-sales-stats"],
    queryFn: async () => {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const monthAgo = new Date(today);
      monthAgo.setMonth(monthAgo.getMonth() - 1);

      const [todayResult, weekResult, monthResult] = await Promise.all([
        // Today's sales
        supabase
          .from("direct_sales")
          .select("id, quantity, price_usd")
          .gte("created_at", today.toISOString())
          .eq("payment_status", "paid"),
        // This week's sales
        supabase
          .from("direct_sales")
          .select("id, quantity, price_usd")
          .gte("created_at", weekAgo.toISOString())
          .eq("payment_status", "paid"),
        // This month's sales
        supabase
          .from("direct_sales")
          .select("id, quantity, price_usd")
          .gte("created_at", monthAgo.toISOString())
          .eq("payment_status", "paid"),
      ]);

      const todaySales = todayResult.data || [];
      const weekSales = weekResult.data || [];
      const monthSales = monthResult.data || [];

      return {
        todayCount: todaySales.reduce((sum, s) => sum + s.quantity, 0),
        todayRevenue: todaySales.reduce((sum, s) => sum + (s.price_usd || 0), 0),
        weekCount: weekSales.reduce((sum, s) => sum + s.quantity, 0),
        weekRevenue: weekSales.reduce((sum, s) => sum + (s.price_usd || 0), 0),
        monthCount: monthSales.reduce((sum, s) => sum + s.quantity, 0),
        monthRevenue: monthSales.reduce((sum, s) => sum + (s.price_usd || 0), 0),
      };
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className={cn("grid grid-cols-2 lg:grid-cols-4 gap-4", className)}>
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  const statCards = [
    {
      title: t('ss_today_sold'),
      value: stats?.todayCount || 0,
      suffix: t('pcs'),
      icon: ShoppingCart,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      title: t('ss_today_revenue'),
      value: formatCurrency(stats?.todayRevenue || 0),
      icon: DollarSign,
      color: "text-green-500",
      bg: "bg-green-500/10",
    },
    {
      title: t('ss_weekly_sales'),
      value: stats?.weekCount || 0,
      suffix: t('pcs'),
      icon: Calendar,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      title: t('ss_monthly_revenue'),
      value: formatCurrency(stats?.monthRevenue || 0),
      icon: TrendingUp,
      color: "text-purple-500",
      bg: "bg-purple-500/10",
    },
  ];

  return (
    <div className={cn("grid grid-cols-2 lg:grid-cols-4 gap-4", className)}>
      {statCards.map((stat, i) => (
        <Card key={i} className="p-4">
          <div className="flex items-center gap-3">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", stat.bg)}>
              <stat.icon className={cn("h-5 w-5", stat.color)} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{stat.title}</p>
              <p className="text-lg font-bold">
                {stat.value}
                {stat.suffix && <span className="text-sm font-normal ml-1">{stat.suffix}</span>}
              </p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
