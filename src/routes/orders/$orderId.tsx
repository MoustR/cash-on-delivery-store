import {
  createFileRoute,
  Link,
  notFound,
  useRouter,
} from "@tanstack/react-router";
import { useState } from "react";
import { BackOffice } from "@/client/components/BackOffice";
import { FormError, messageOf } from "@/client/components/FormError";
import { PageHeader } from "@/client/components/PageHeader";
import { SelectField } from "@/client/components/SelectField";
import { StatusBadge } from "@/client/components/StatusBadge";
import { Button } from "@/client/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/client/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/client/components/ui/dialog";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import { Textarea } from "@/client/components/ui/textarea";
import { formatDateTime } from "@/client/lib/dates";
import { formatMoney } from "@/lib/money";
import { nextStatuses, STATUS_LABELS } from "@/lib/pipeline";
import type { OrderStatus } from "@/lib/statuses";
import {
  assignOrder,
  changeOrderStatus,
  getOrder,
} from "@/serverFunctions/orders";

export const Route = createFileRoute("/orders/$orderId")({
  loader: async ({ params }) => {
    try {
      return await getOrder({ data: { id: params.orderId } });
    } catch {
      throw notFound();
    }
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? [{ title: `Order #${loaderData.order.number}` }] : [],
  }),
  component: OrderPage,
});

const ACTION_LABELS: Partial<Record<OrderStatus, string>> = {
  confirmed: "Confirm",
  shipped: "Ship",
  delivered: "Mark delivered",
  paid: "Mark paid",
  cancelled: "Cancel order",
  returned: "Mark returned",
};

function OrderPage() {
  const { order, members } = Route.useLoaderData();
  const router = useRouter();
  const [action, setAction] = useState<OrderStatus | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const money = (n: number) => formatMoney(n, order.currency);

  async function assign(value: string) {
    setAssignError(null);
    try {
      await assignOrder({
        data: { id: order.id, assigneeId: value === "none" ? null : value },
      });
      await router.invalidate();
    } catch (cause) {
      setAssignError(messageOf(cause));
    }
  }

  const actions = nextStatuses(order.status);

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
        title={<span data-testid="order-title">Order #{order.number}</span>}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <StatusBadge status={order.status} testId="order-status" />
            {formatDateTime(order.createdAt)} ·{" "}
            {order.source === "storefront" ? "Storefront" : "Added by a member"}
          </span>
        }
        actions={actions.map((to) => (
          <Button
            key={to}
            data-testid={`action-${to}`}
            variant={
              to === "cancelled" || to === "returned" ? "outline" : "default"
            }
            onClick={() => setAction(to)}
          >
            {ACTION_LABELS[to]}
          </Button>
        ))}
      />

      <div className="grid gap-6 md:grid-cols-3">
        <div className="space-y-6 md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Items</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Product</TableHead>
                    <TableHead>Unit price</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead className="pr-4 text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell className="pl-4">{line.name}</TableCell>
                      <TableCell className="tabular-nums">
                        {money(line.unitPrice)}
                      </TableCell>
                      <TableCell className="tabular-nums">{line.qty}</TableCell>
                      <TableCell className="pr-4 text-right tabular-nums">
                        {money(line.unitPrice * line.qty)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell
                      className="pl-4 text-muted-foreground"
                      colSpan={3}
                    >
                      Delivery
                    </TableCell>
                    <TableCell className="pr-4 text-right tabular-nums">
                      {money(order.deliveryFee)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="pl-4 font-medium" colSpan={3}>
                      Total
                    </TableCell>
                    <TableCell
                      className="pr-4 text-right font-medium tabular-nums"
                      data-testid="order-total"
                    >
                      {money(order.total)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>History</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                {order.events.map((event) => (
                  <li
                    key={event.id}
                    data-testid="history-entry"
                    className="flex gap-3 text-sm"
                  >
                    <span
                      className="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <div>
                        <span className="font-medium">
                          {STATUS_LABELS[event.status]}
                        </span>
                        <span className="text-muted-foreground">
                          {" "}
                          · {event.actorEmail ?? "Customer"} ·{" "}
                          {formatDateTime(event.createdAt)}
                        </span>
                      </div>
                      {event.note ? (
                        <p className="text-muted-foreground">{event.note}</p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Assigned to</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <SelectField
                testId="assignee"
                label="Assigned to"
                className="w-full"
                value={order.assigneeId ?? "none"}
                onChange={assign}
                options={[
                  { value: "none", label: "Unassigned" },
                  ...members.map((m) => ({ value: m.id, label: m.email })),
                ]}
              />
              <FormError message={assignError} testId="assign-error" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <Link
                to="/customers/$customerId"
                params={{ customerId: order.customerId }}
                className="font-medium hover:underline"
              >
                {order.customerName}
              </Link>
              <p>{order.phone}</p>
              <p className="text-muted-foreground">
                {order.address}, {order.city}
              </p>
              {order.note ? (
                <p className="pt-2 text-muted-foreground">“{order.note}”</p>
              ) : null}
            </CardContent>
          </Card>

          <Card data-testid="shipment">
            <CardHeader>
              <CardTitle>Shipment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {order.courier ? (
                <>
                  <p className="font-medium">{order.courier}</p>
                  <p className="text-muted-foreground">
                    {order.trackingNumber
                      ? `Tracking ${order.trackingNumber}`
                      : "No tracking number"}
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground">Not shipped yet.</p>
              )}
              <a
                href={`/shop/t/${order.token}`}
                className="inline-block pt-2 text-primary hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                Customer's tracking page
              </a>
            </CardContent>
          </Card>
        </div>
      </div>

      {action ? (
        <StatusDialog
          orderId={order.id}
          to={action}
          onClose={() => setAction(null)}
          onDone={async () => {
            setAction(null);
            await router.invalidate();
          }}
        />
      ) : null}
    </BackOffice>
  );
}

function StatusDialog({
  orderId,
  to,
  onClose,
  onDone,
}: {
  orderId: string;
  to: OrderStatus;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [note, setNote] = useState("");
  const [courier, setCourier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const shipping = to === "shipped";

  async function submit() {
    setError(null);
    if (shipping && !courier.trim()) {
      setError("Enter the courier.");
      return;
    }
    setPending(true);
    try {
      await changeOrderStatus({
        data: {
          id: orderId,
          to,
          note: note.trim() || undefined,
          courier: shipping ? courier.trim() : undefined,
          trackingNumber: shipping
            ? trackingNumber.trim() || undefined
            : undefined,
        },
      });
      await onDone();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{ACTION_LABELS[to]}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          {shipping ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="courier">Courier</Label>
                <Input
                  id="courier"
                  data-testid="courier"
                  value={courier}
                  onChange={(e) => setCourier(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tracking-number">
                  Tracking number (optional)
                </Label>
                <Input
                  id="tracking-number"
                  data-testid="tracking-number"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                />
              </div>
            </>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="status-note">Internal note (optional)</Label>
            <Textarea
              id="status-note"
              data-testid="status-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          {to === "cancelled" || to === "returned" ? (
            <p className="text-sm text-muted-foreground">
              The items go back into stock.
            </p>
          ) : null}
          <FormError message={error} testId="action-error" />
          <DialogFooter>
            <Button type="submit" data-testid="status-submit" pending={pending}>
              {ACTION_LABELS[to]}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
