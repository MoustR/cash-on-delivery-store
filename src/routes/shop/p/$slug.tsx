import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Closed, ProductImage, ShopShell } from "@/client/components/ShopShell";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { useCart } from "@/client/lib/cart";
import { formatMoney } from "@/lib/money";
import { getPublicProduct } from "@/serverFunctions/storefront";

export const Route = createFileRoute("/shop/p/$slug")({
  loader: async ({ params }) => {
    const result = await getPublicProduct({ data: { slug: params.slug } });
    if (result.store.isOpen && !result.product) throw notFound();
    return result;
  },
  head: ({ loaderData }) => ({
    meta: loaderData?.product
      ? [{ title: `${loaderData.product.name} · ${loaderData.store.name}` }]
      : [],
  }),
  component: ProductPage,
});

function ProductPage() {
  const { store, product } = Route.useLoaderData();
  const { add, ready } = useCart();
  const [qty, setQty] = useState("1");
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  if (!store.isOpen || !product) return <Closed name={store.name} />;

  return (
    <ShopShell storeName={store.name}>
      <div className="grid gap-8 md:grid-cols-2">
        <ProductImage
          imageKey={product.imageKey}
          name={product.name}
          className="aspect-square rounded-xl border border-border"
        />
        <div className="space-y-4">
          <h1 className="text-2xl font-semibold tracking-tight">
            {product.name}
          </h1>
          <p className="flex flex-wrap items-baseline gap-2 text-lg">
            <span className="tabular-nums">
              {formatMoney(product.price, store.currency)}
            </span>
            {product.compareAtPrice &&
            product.compareAtPrice > product.price ? (
              <s className="text-base text-muted-foreground tabular-nums">
                {formatMoney(product.compareAtPrice, store.currency)}
              </s>
            ) : null}
          </p>
          {product.description ? (
            <p className="text-sm whitespace-pre-line text-muted-foreground">
              {product.description}
            </p>
          ) : null}
          {product.inStock ? (
            <form
              className="flex items-end gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                const n = Number(qty);
                if (!Number.isInteger(n) || n < 1) return;
                add(product.id, n);
                toast.success("Added to cart");
              }}
            >
              <div className="w-20 space-y-1.5">
                <Label htmlFor="qty">Qty</Label>
                <Input
                  id="qty"
                  data-testid="qty"
                  type="number"
                  min={1}
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                />
              </div>
              <Button
                type="submit"
                data-testid="add-to-cart"
                disabled={!hydrated || !ready}
              >
                Add to cart
              </Button>
            </form>
          ) : (
            <Badge variant="outline" data-testid="out-of-stock">
              Out of stock
            </Badge>
          )}
          <p className="text-sm text-muted-foreground">
            Pay in cash when it arrives.
          </p>
        </div>
      </div>
    </ShopShell>
  );
}
