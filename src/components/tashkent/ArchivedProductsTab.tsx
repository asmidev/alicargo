import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import { RotateCcw, Trash2, Search, Archive, Package } from "lucide-react";
import { format } from "date-fns";
import { LazyImage } from "@/components/ui/lazy-image";

export function ArchivedProductsTab() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { isChiefManager } = useUserRole();
  const [search, setSearch] = useState("");
  const [productToDelete, setProductToDelete] = useState<{ id: string; name: string } | null>(null);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["archived-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, status, main_image_url, tashkent_manual_stock, updated_at")
        .eq("status", "archived")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (productId: string) => {
      const { error } = await supabase
        .from("products")
        .update({ status: "active" })
        .eq("id", productId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Mahsulot qayta aktivlashtirildi");
      queryClient.invalidateQueries({ queryKey: ["archived-products"] });
      queryClient.invalidateQueries({ queryKey: ["tashkent-grouped-products"] });
      queryClient.invalidateQueries({ queryKey: ["tashkent-saleable-products"] });
    },
    onError: (err: Error) => toast.error("Xatolik: " + err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (productId: string) => {
      await Promise.all([
        supabase.from("direct_sales").delete().eq("product_id", productId),
        supabase.from("marketplace_listings").delete().eq("product_id", productId),
        supabase.from("stock_alerts").delete().eq("product_id", productId),
        supabase.from("inventory_movements").delete().eq("product_id", productId),
      ]);
      await supabase.from("product_items").delete().eq("product_id", productId);
      await supabase.from("product_variants").delete().eq("product_id", productId);
      const { error } = await supabase.from("products").delete().eq("id", productId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Mahsulot butunlay o'chirildi");
      queryClient.invalidateQueries({ queryKey: ["archived-products"] });
    },
    onError: (err: Error) => toast.error("Xatolik: " + err.message),
  });

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const archivedCount = products.length;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="flex flex-wrap gap-3 items-center">
        <Badge variant="secondary" className="text-sm px-3 py-1">
          <Archive className="h-3.5 w-3.5 mr-1" />
          Jami: {products.length}
        </Badge>
        <Badge variant="outline" className="text-sm px-3 py-1">
          Arxivlangan: {archivedCount}
        </Badge>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Mahsulot qidirish..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Product List */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Yuklanmoqda...</div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center">
          <Archive className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <p className="text-muted-foreground">Arxivda mahsulot topilmadi</p>
        </Card>
      ) : (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((product) => (
            <Card key={product.id} className="p-4 flex gap-3">
              {/* Image */}
              <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                {product.main_image_url ? (
                  <LazyImage
                    src={product.main_image_url}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 space-y-1">
                <p className="font-medium text-sm truncate">{product.name}</p>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="destructive"
                    className="text-[10px] px-1.5 py-0"
                  >
                    Arxiv
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Zaxira: {product.tashkent_manual_stock || 0}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {product.updated_at ? format(new Date(product.updated_at), "dd.MM.yyyy HH:mm") : "—"}
                </p>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-1.5 flex-shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-2 text-xs gap-1"
                  onClick={() => restoreMutation.mutate(product.id)}
                  disabled={restoreMutation.isPending}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Qaytarish
                </Button>
                {isChiefManager && (
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-8 px-2 text-xs gap-1"
                    onClick={() => setProductToDelete({ id: product.id, name: product.name })}
                    title="Bazadan butunlay o'chirish"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Bazanadan o'chirish
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!productToDelete}
        onOpenChange={(open) => !open && setProductToDelete(null)}
        title="DIQQAT! Mahsulotni bazadan butunlay o'chirish"
        description={`"${productToDelete?.name}" mahsuloti va unga bog'liq BARCHA ma'lumotlar (miqdorlar, variantlar, savdo tarixi) bazadan butunlay o'chib ketadi. Bu amalni qaytarib bo'lmaydi! Davom etasizmi?`}
        confirmText="O'chirish"
        cancelText="Bekor qilish"
        variant="destructive"
        onConfirm={() => {
          if (productToDelete) {
            deleteMutation.mutate(productToDelete.id);
            setProductToDelete(null);
          }
        }}
        isLoading={deleteMutation.isPending}
      />
    </div >
  );
}
