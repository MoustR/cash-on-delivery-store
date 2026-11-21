import { ShoppingBag } from "lucide-react";
import type { ReactNode } from "react";
import { EmptyState } from "@/client/components/EmptyState";
import { useCart } from "@/client/lib/cart";

const COLUMN = "mx-auto w-full max-w-5xl px-4 md:px-10";

/**
 * The storefront's frame: the store's name and the cart. Links are plain
 * anchors, so each page is rendered on the server for shoppers.
 */
export function ShopShell({
  storeName,
  showCart = true,
  children,
}: {
  storeName: string;
  showCart?: boolean;
  children: ReactNode;
}) {
  const { count } = useCart();
  return (
    <div className="flex h-dvh flex-col">
      <header className="shrink-0 border-b border-border">
        <div
          className={`${COLUMN} flex h-14 items-center justify-between gap-3`}
        >
          <a
            href="/shop"
            className="truncate text-base font-semibold tracking-tight"
          >
            {storeName}
          </a>
          {showCart ? (
            <a
              href="/shop/cart"
              data-testid="cart-link"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ShoppingBag className="size-4" aria-hidden />
              Cart ({count})
            </a>
          ) : null}
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <main className={`${COLUMN} space-y-8 pt-8 pb-24`}>{children}</main>
      </div>
    </div>
  );
}

export function ProductImage({
  imageKey,
  name,
  className,
}: {
  imageKey: string | null;
  name: string;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center justify-center overflow-hidden bg-muted ${className ?? ""}`}
    >
      {imageKey ? (
        <img
          src={`/shop/img/${imageKey}`}
          alt={name}
          className="size-full object-cover"
        />
      ) : (
        <ShoppingBag className="size-8 text-muted-foreground/50" aria-hidden />
      )}
    </div>
  );
}

export function Closed({ name }: { name: string }) {
  return (
    <ShopShell storeName={name} showCart={false}>
      <div data-testid="store-closed">
        <EmptyState title="This store is closed" />
      </div>
    </ShopShell>
  );
}
