import { createFileRoute, notFound } from "@tanstack/react-router";
import { ShopShell } from "@/client/components/ShopShell";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/client/components/ui/card";
import { formatDateTime } from "@/client/lib/dates";
import { formatMoney } from "@/lib/money";
import { STATUS_LABELS } from "@/lib/pipeline";
import { getTracking } from "@/serverFunctions/storefront";

export const Route = createFileRoute("/shop/t/$token")({
  loader: async ({ params }) => {
    const result = await getTracking({ data: { token: params.token } });
    if (!result) throw notFound();
    return result;
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `Order #${loaderData.order.number}` },
          { name: "robots", content: "noindex" },
        ]
      : [],
  }),
  component: Tracking,
});

function Tracking() {
  const { storeName, order, lines, events } = Route.useLoaderData();
  const money = (n: number) => formatMoney(n, order.currency);
  return (
    <ShopShell storeName={storeName}>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Order #{order.number}
        </h1>
        <p className="text-sm text-muted-foreground">
          Hi {order.firstName}. Status:{" "}
          <span
            className="font-medium text-foreground"
            data-testid="tracking-status"
          >
            {STATUS_LABELS[order.status]}
          </span>
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="space-y-3">
              {events.map((e, i) => (
                <li
                  key={i}
                  data-testid="timeline-entry"
                  className="flex gap-3 text-sm"
                >
                  <span
                    className="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
                    aria-hidden
                  />
                  <span className="font-medium">{STATUS_LABELS[e.status]}</span>
                  <span className="text-muted-foreground">
                    {formatDateTime(e.createdAt)}
                  </span>
                </li>
              ))}
            </ol>
            {order.courier ? (
              <div className="rounded-lg border border-border p-3 text-sm">
                <p>
                  Courier:{" "}
                  <span className="font-medium" data-testid="tracking-courier">
                    {order.courier}
                  </span>
                </p>
                {order.trackingNumber ? (
                  <p>
                    Tracking number:{" "}
                    <span className="font-medium" data-testid="tracking-number">
                      {order.trackingNumber}
                    </span>
                  </p>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Items</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border text-sm">
              {lines.map((l, i) => (
                <li key={i} className="flex justify-between gap-3 py-2">
                  <span>
                    {l.qty} × {l.name}
                  </span>
                  <span className="tabular-nums">
                    {money(l.unitPrice * l.qty)}
                  </span>
                </li>
              ))}
              <li className="flex justify-between py-2 text-muted-foreground">
                <span>Delivery</span>
                <span className="tabular-nums">{money(order.deliveryFee)}</span>
              </li>
              <li className="flex justify-between py-2 font-medium">
                <span>Total, cash on delivery</span>
                <span className="tabular-nums">{money(order.total)}</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </ShopShell>
  );
}
