import { GroupedProductList } from "./GroupedProductList";

interface SaleableProductListProps {
  onSellProduct: (product: {
    id: string;
    name: string;
    image?: string;
    warehousePrice: number | null;
    availableStock: number;
  }) => void;
  onDeleteProduct?: (productId: string, productName: string) => void;
  canDelete?: boolean;
  className?: string;
}

// This component now delegates to GroupedProductList for automatic product grouping
export function SaleableProductList({ 
  onSellProduct, 
  onDeleteProduct,
  canDelete,
  className 
}: SaleableProductListProps) {
  return (
    <GroupedProductList
      onSellProduct={onSellProduct}
      onDeleteProduct={onDeleteProduct}
      canDelete={canDelete}
      className={className}
    />
  );
}
