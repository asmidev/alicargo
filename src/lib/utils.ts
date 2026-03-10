import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatUZS(amount: number): string {
  return `${amount.toLocaleString('uz-UZ')} so'm`;
}
