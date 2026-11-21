import { createFileRoute } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import {
  CustomerFields,
  EMPTY_CUSTOMER,
} from "@/client/components/CustomerFields";
import { EmptyState } from "@/client/components/EmptyState";
import { FormError } from "@/client/components/FormError";
import { Closed, ProductImage, ShopShell } from "@/client/components/ShopShell";
import { Button } from "@/client/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/client/components/ui/card";
import { Input } from "@/client/components/ui/input";
import { useCart } from "@/client/lib/cart";
import { formatMoney } from "@/lib/money";
import { getCatalogue } from "@/serverFunctions/storefront";

export const Route = createFileRoute("/shop/cart")({
  loader: () => getCatalogue(),
  head: ({ loaderData }) => ({
    meta: loaderData ? [{ title: `Cart · ${loaderData.store.name}` }] : [],
  }),
  component: Cart,
});

function Cart() {
  const { store, products } = Route.useLoaderData();
  const cart = useCart();
  const [customer, setCustomer] = useState(EMPTY_CUSTOMER);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [placed, setPlaced] = useState<{
    number: number;
    trackingUrl: string;
  } | null>(null);
  if (!store.isOpen) return <Closed name={store.name} />;

  const money = (n: number) => formatMoney(n, store.currency);
  const byId = new Map(products.map((p) => [p.id, p]));
  const lines = cart.lines.flatMap((l) => {
    const product = byId.get(l.productId);
    return product ? [{ ...l, product }] : [];
  });
  const subtotal = lines.reduce((s, l) => s + l.product.price * l.qty, 0);

  async function placeOrder() {
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/shop/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          customer: { ...customer, note: customer.note || undefined },
          lines: lines.map((l) => ({ productId: l.productId, qty: l.qty })),
        }),
      });
      const body = (await res.json()) as {
        number?: number;
        trackingUrl?: string;
        error?: string;
      };
      if (!res.ok || !body.number || !body.trackingUrl)
        throw new Error(
          body.error ?? "The order didn't go through. Try again.",
        );
      cart.clear();
      setPlaced({ number: body.number, trackingUrl: body.trackingUrl });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The order didn't go through. Try again.",
      );
    } finally {
      setPending(false);
    }
  }

  if (placed) {
    return (
      <ShopShell storeName={store.name}>
        <Card data-testid="order-confirmation">
          <CardHeader>
            <CardTitle>Thank you! Order #{placed.number} is placed.</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              You pay in cash when it's delivered.
            </p>
            <a
              href={placed.trackingUrl}
              data-testid="tracking-link"
              className="text-sm text-primary hover:underline"
            >
              Track your order
            </a>
          </CardContent>
        </Card>
      </ShopShell>
    );
  }

  return (
    <ShopShell storeName={store.name}>
      <h1 className="text-2xl font-semibold tracking-tight">Cart</h1>
      {!cart.ready ? null : lines.length === 0 ? (
        <EmptyState
          title="Your cart is empty"
          action={
            <Button variant="outline" render={<a href="/shop" />}>
              Browse products
            </Button>
          }
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-5">
          <Card className="md:col-span-3">
            <CardContent>
              <ul className="divide-y divide-border">
                {lines.map((l) => (
                  <li
                    key={l.productId}
                    data-testid="cart-line"
                    className="flex items-center gap-3 py-3 text-sm"
                  >
                    <ProductImage
                      imageKey={l.product.imageKey}
                      name={l.product.name}
                      className="size-12 shrink-0 rounded-md"
                    />
                    <span className="min-w-0 flex-1 font-medium">
                      {l.product.name}
                    </span>
                    <Input
                      aria-label={`Quantity of ${l.product.name}`}
                      type="number"
                      min={1}
                      className="w-20"
                      value={l.qty}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (Number.isInteger(n) && n > 0)
                          cart.setQty(l.productId, n);
                      }}
                    />
                    <span className="w-24 text-right tabular-nums">
                      {money(l.product.price * l.qty)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${l.product.name}`}
                      onClick={() => cart.setQty(l.productId, 0)}
                    >
                      <Trash2 />
                    </Button>
                  </li>
                ))}
                <li className="flex justify-between py-2 text-sm text-muted-foreground">
                  <span>Delivery</span>
                  <span className="tabular-nums">
                    {money(store.deliveryFee)}
                  </span>
                </li>
                <li className="flex justify-between py-2 font-medium">
                  <span>Total, paid on delivery</span>
                  <span className="tabular-nums" data-testid="cart-total">
                    {money(subtotal + store.deliveryFee)}
                  </span>
                </li>
              </ul>
            </CardContent>
          </Card>
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Delivery details</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void placeOrder();
                }}
              >
                <CustomerFields
                  value={customer}
                  onChange={setCustomer}
                  prefix="checkout"
                />
                <FormError message={error} />
                <Button
                  type="submit"
                  className="w-full"
                  data-testid="place-order"
                  pending={pending}
                >
                  Place order
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </ShopShell>
  );
}
