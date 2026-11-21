import { useCallback, useEffect, useState } from "react";

export interface CartLine {
  productId: string;
  qty: number;
}

const KEY = "storefront-cart";
const EVENT = "storefront-cart-change";

function read(): CartLine[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(value)
      ? value.filter(
          (l): l is CartLine =>
            typeof l?.productId === "string" &&
            Number.isInteger(l?.qty) &&
            l.qty > 0,
        )
      : [];
  } catch {
    return [];
  }
}

function write(lines: CartLine[]) {
  localStorage.setItem(KEY, JSON.stringify(lines));
  window.dispatchEvent(new Event(EVENT));
}

/** The shopper's cart, kept in this browser. `ready` is false until it's read. */
export function useCart() {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const sync = () => setLines(read());
    sync();
    setReady(true);
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const add = useCallback((productId: string, qty: number) => {
    const current = read();
    const existing = current.find((l) => l.productId === productId);
    write(
      existing
        ? current.map((l) =>
            l.productId === productId ? { ...l, qty: l.qty + qty } : l,
          )
        : [...current, { productId, qty }],
    );
  }, []);
  const setQty = useCallback((productId: string, qty: number) => {
    write(
      read()
        .map((l) => (l.productId === productId ? { ...l, qty } : l))
        .filter((l) => l.qty > 0),
    );
  }, []);
  const clear = useCallback(() => write([]), []);
  const count = lines.reduce((s, l) => s + l.qty, 0);
  return { lines, ready, count, add, setQty, clear };
}
