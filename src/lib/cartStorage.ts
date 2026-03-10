export interface CartItem {
  productId: string;
  variantId?: string;
  name: string;
  variantName?: string;
  price: number;
  quantity: number;
  image?: string;
  maxStock: number;
}

const CART_KEY = 'alibrand_cart';

export function getCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCart(items: CartItem[]) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}

export function addToCart(item: CartItem): CartItem[] {
  const cart = getCart();
  const key = item.variantId || item.productId;
  const existing = cart.find(i => (i.variantId || i.productId) === key);
  
  if (existing) {
    existing.quantity = Math.min(existing.quantity + item.quantity, item.maxStock);
  } else {
    cart.push(item);
  }
  
  saveCart(cart);
  return cart;
}

export function removeFromCart(productId: string, variantId?: string): CartItem[] {
  const key = variantId || productId;
  const cart = getCart().filter(i => (i.variantId || i.productId) !== key);
  saveCart(cart);
  return cart;
}

export function updateCartQuantity(productId: string, variantId: string | undefined, quantity: number): CartItem[] {
  const cart = getCart();
  const key = variantId || productId;
  const item = cart.find(i => (i.variantId || i.productId) === key);
  if (item) {
    item.quantity = Math.max(1, Math.min(quantity, item.maxStock));
  }
  saveCart(cart);
  return cart;
}

export function clearCart(): CartItem[] {
  saveCart([]);
  return [];
}

export function getCartTotal(cart: CartItem[]): number {
  return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

export function getCartCount(cart: CartItem[]): number {
  return cart.reduce((sum, item) => sum + item.quantity, 0);
}
