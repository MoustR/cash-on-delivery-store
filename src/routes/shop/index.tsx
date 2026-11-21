import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "@/client/components/EmptyState";
import { Closed, ProductImage, ShopShell } from "@/client/components/ShopShell";
import { Badge } from "@/client/components/ui/badge";
import { formatMoney } from "@/lib/money";
import { getCatalogue } from "@/serverFunctions/storefront";

export const Route = createFileRoute("/shop/")({
  loader: () => getCatalogue(),
  head: ({ loaderData }) => ({
    meta: loaderData ? [{ title: loaderData.store.name }] : [],
  }),
  component: Shop,
});

function Shop() {
  const { store, products } = Route.useLoaderData();
  if (!store.isOpen) return <Closed name={store.name} />;
  return (
    <ShopShell storeName={store.name}>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{store.name}</h1>
        {store.description ? (
          <p className="text-sm text-muted-foreground">{store.description}</p>
        ) : null}
      </div>
      {products.length === 0 ? (
        <EmptyState title="No products yet" description="Check back soon." />
      ) : (
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {products.map((p) => (
            <li key={p.id} data-testid="shop-product">
              <a
                href={`/shop/p/${p.slug}`}
                className="group block overflow-hidden rounded-xl border border-border bg-card shadow-xs"
              >
                <ProductImage
                  imageKey={p.imageKey}
                  name={p.name}
                  className="aspect-square"
                />
                <div className="space-y-1 p-3">
                  <p className="font-medium group-hover:underline">{p.name}</p>
                  <p className="flex flex-wrap items-baseline gap-2 text-sm">
                    <span className="tabular-nums">
                      {formatMoney(p.price, store.currency)}
                    </span>
                    {p.compareAtPrice && p.compareAtPrice > p.price ? (
                      <s
                        className="text-muted-foreground tabular-nums"
                        data-testid="compare-price"
                      >
                        {formatMoney(p.compareAtPrice, store.currency)}
                      </s>
                    ) : null}
                  </p>
                  {!p.inStock ? (
                    <Badge variant="outline" data-testid="out-of-stock">
                      Out of stock
                    </Badge>
                  ) : null}
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </ShopShell>
  );
}
