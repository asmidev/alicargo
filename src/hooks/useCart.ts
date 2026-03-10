import { useState, useCallback, useEffect } from 'react';
import {
  CartItem, getCart, addToCart as addToCartStorage,
  removeFromCart as removeFromCartStorage,
  updateCartQuantity as updateQuantityStorage,
  clearCart as clearCartStorage,
  getCartTotal, getCartCount
} from '@/lib/cartStorage';

export function useCart() {
  const [items, setItems] = useState<CartItem[]>(getCart);

  // Sync across tabs
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === 'alibrand_cart') setItems(getCart());
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const addItem = useCallback((item: CartItem) => {
    setItems(addToCartStorage(item));
  }, []);

  const removeItem = useCallback((productId: string, variantId?: string) => {
    setItems(removeFromCartStorage(productId, variantId));
  }, []);

  const updateQuantity = useCallback((productId: string, variantId: string | undefined, qty: number) => {
    setItems(updateQuantityStorage(productId, variantId, qty));
  }, []);

  const clear = useCallback(() => {
    setItems(clearCartStorage());
  }, []);

  return {
    items,
    addItem,
    removeItem,
    updateQuantity,
    clear,
    total: getCartTotal(items),
    count: getCartCount(items),
    isEmpty: items.length === 0,
  };
}
