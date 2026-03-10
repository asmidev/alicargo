import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { DirectSaleDialog } from "./DirectSaleDialog";
import { DirectSalesStats } from "./DirectSalesStats";
import { SaleableProductList } from "./SaleableProductList";
import { DirectSalesHistory } from "./DirectSalesHistory";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useUserRole } from "@/hooks/useUserRole";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface TashkentSalesTabProps {
  className?: string;
}

export function TashkentSalesTab({ className }: TashkentSalesTabProps) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { isChiefManager } = useUserRole();
  const [isSaleDialogOpen, setIsSaleDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<{
    id: string;
    name: string;
    image?: string;
    warehousePrice: number | null;
    availableStock: number;
  } | undefined>();
  const [productToDelete, setProductToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Delete mutation with cascading cleanup
  const deleteMutation = useMutation({
    mutationFn: async (productId: string) => {
      const { error } = await supabase
        .from('products')
        .update({ status: 'archived' })
        .eq('id', productId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Arxivga ko'chirildi");
      queryClient.invalidateQueries({ queryKey: ["tashkent-grouped-products"] });
      queryClient.invalidateQueries({ queryKey: ["tashkent-saleable-products"] });
      queryClient.invalidateQueries({ queryKey: ["archived-products"] });
    },
    onError: (err: Error) => {
      toast.error(t('tst_delete_error') + ": " + err.message);
    },
  });

  const handleSellProduct = (product: typeof selectedProduct) => {
    setSelectedProduct(product);
    setIsSaleDialogOpen(true);
  };

  const handleDeleteProduct = (id: string, name: string) => {
    setProductToDelete({ id, name });
  };

  const confirmDelete = () => {
    if (productToDelete) {
      deleteMutation.mutate(productToDelete.id);
      setProductToDelete(null);
    }
  };

  const handleDialogClose = () => {
    setIsSaleDialogOpen(false);
    setSelectedProduct(undefined);
  };

  const handleSaleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["direct-sales-stats"] });
    queryClient.invalidateQueries({ queryKey: ["direct-sales-history"] });
    queryClient.invalidateQueries({ queryKey: ["tashkent-saleable-products"] });
  };

  return (
    <div className={className}>
      <div className="space-y-6">
        {/* Header with Add Sale Button */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t('tst_direct_sales')}</h2>
          <Button onClick={() => setIsSaleDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            {t('tst_new_sale')}
          </Button>
        </div>

        {/* Stats Cards */}
        <DirectSalesStats />

        {/* Products for Sale */}
        <SaleableProductList 
          onSellProduct={handleSellProduct}
          onDeleteProduct={handleDeleteProduct}
          canDelete={isChiefManager}
        />

        {/* Recent Sales - limit to 10 */}
        <DirectSalesHistory limit={10} />
      </div>

      {/* Sale Dialog */}
      <DirectSaleDialog
        open={isSaleDialogOpen}
        onOpenChange={handleDialogClose}
        onSuccess={handleSaleSuccess}
        preSelectedProduct={selectedProduct}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={!!productToDelete}
        onOpenChange={(open) => !open && setProductToDelete(null)}
        title={t('tst_delete_product')}
        description={t('tst_delete_confirm', { name: productToDelete?.name })}
        confirmText={t('delete')}
        cancelText={t('cancel')}
        variant="destructive"
        onConfirm={confirmDelete}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
