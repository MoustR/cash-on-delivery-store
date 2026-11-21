import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { BackOffice } from "@/client/components/BackOffice";
import {
  CustomerFields,
  EMPTY_CUSTOMER,
} from "@/client/components/CustomerFields";
import { FormError, messageOf } from "@/client/components/FormError";
import { PageHeader } from "@/client/components/PageHeader";
import { SelectField } from "@/client/components/SelectField";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/client/components/ui/card";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { formatMoney } from "@/lib/money";
import { createManualOrder } from "@/serverFunctions/orders";
import { getOrderableProducts } from "@/serverFunctions/products";

export const Route = createFileRoute("/orders/new")({
  loader: () => getOrderableProducts(),
  head: () => ({ meta: [{ title: "New order" }] }),
  component: NewOrder,
});

function NewOrder() {
  const { products, settings } = Route.useLoaderData();
  const navigate = useNavigate();
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [qty, setQty] = useState("1");
  const [lines, setLines] = useState<{ productId: string; qty: number }[]>([]);
  const [customer, setCustomer] = useState(EMPTY_CUSTOMER);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const byId = new Map(products.map((p) => [p.id, p]));
  const money = (n: number) => formatMoney(n, settings.currency);
  const subtotal = lines.reduce(
    (s, l) => s + (byId.get(l.productId)?.price ?? 0) * l.qty,
    0,
  );

  function addLine() {
    const n = Number(qty);
    if (!productId || !Number.isInteger(n) || n < 1) return;
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === productId);
      if (existing)
        return prev.map((l) =>
          l.productId === productId ? { ...l, qty: l.qty + n } : l,
        );
      return [...prev, { productId, qty: n }];
    });
    setQty("1");
  }

  async function submit() {
    setError(null);
    setPending(true);
    try {
      const order = await createManualOrder({
        data: {
          customer: { ...customer, note: customer.note || undefined },
          lines,
        },
      });
      await navigate({ to: "/orders/$orderId", params: { orderId: order.id } });
    } catch (cause) {
      setError(messageOf(cause));
      setPending(false);
    }
  }

  return (
    <BackOffice>
      <PageHeader
        backLink={
          <Link
            to="/"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ‹ Orders
          </Link>
        }
        title="New order"
      />
      {!settings.isOpen ? (
        <Alert>
          <AlertDescription>
            The store is closed, so orders can't be placed. Open it in Settings.
          </AlertDescription>
        </Alert>
      ) : null}
      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {products.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No active products.{" "}
                <Link
                  to="/products/new"
                  className="text-primary hover:underline"
                >
                  Add one
                </Link>{" "}
                first.
              </p>
            ) : (
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-56 flex-1 space-y-1.5">
                  <Label>Product</Label>
                  <SelectField
                    testId="line-product"
                    label="Product"
                    className="w-full"
                    value={productId}
                    onChange={setProductId}
                    options={products.map((p) => ({
                      value: p.id,
                      label: p.name,
                    }))}
                  />
                </div>
                <div className="w-24 space-y-1.5">
                  <Label htmlFor="line-qty">Qty</Label>
                  <Input
                    id="line-qty"
                    data-testid="line-qty"
                    type="number"
                    min={1}
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  data-testid="add-line"
                  onClick={addLine}
                >
                  Add
                </Button>
              </div>
            )}
            {lines.length > 0 ? (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {lines.map((line) => {
                  const p = byId.get(line.productId)!;
                  return (
                    <li
                      key={line.productId}
                      className="flex items-center gap-3 px-4 py-2 text-sm"
                      data-testid="order-line"
                    >
                      <span className="flex-1">{p.name}</span>
                      <span className="text-muted-foreground">
                        {line.qty} × {money(p.price)}
                      </span>
                      <span className="w-28 text-right tabular-nums">
                        {money(p.price * line.qty)}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove ${p.name}`}
                        onClick={() =>
                          setLines((prev) =>
                            prev.filter((l) => l.productId !== line.productId),
                          )
                        }
                      >
                        <Trash2 />
                      </Button>
                    </li>
                  );
                })}
                <li className="flex justify-between px-4 py-2 text-sm text-muted-foreground">
                  <span>Delivery</span>
                  <span className="tabular-nums">
                    {money(settings.deliveryFee)}
                  </span>
                </li>
                <li className="flex justify-between px-4 py-2 text-sm font-medium">
                  <span>Total</span>
                  <span className="tabular-nums">
                    {money(subtotal + settings.deliveryFee)}
                  </span>
                </li>
              </ul>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Customer</CardTitle>
          </CardHeader>
          <CardContent>
            <CustomerFields
              value={customer}
              onChange={setCustomer}
              prefix="order"
            />
          </CardContent>
        </Card>
        <FormError message={error} />
        <Button
          type="submit"
          data-testid="create-order"
          pending={pending}
          disabled={lines.length === 0}
        >
          Create order
        </Button>
      </form>
    </BackOffice>
  );
}
