import {
  createFileRoute,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { BackOffice } from "@/client/components/BackOffice";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { EmptyState } from "@/client/components/EmptyState";
import { FormError, messageOf } from "@/client/components/FormError";
import { PageHeader } from "@/client/components/PageHeader";
import { Button } from "@/client/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/client/components/ui/card";
import { Checkbox } from "@/client/components/ui/checkbox";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import {
  Table,
  TableBody,
  TableCard,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import { formatDateTime, isoDay } from "@/client/lib/dates";
import { formatMoney } from "@/lib/money";
import { collectCash, getCollections } from "@/serverFunctions/collections";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const searchSchema = z.object({ from: day.optional(), to: day.optional() });

export const Route = createFileRoute("/collections")({
  validateSearch: (search) => searchSchema.catch({}).parse(search),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) =>
    getCollections({
      data: { from: deps.from ?? isoDay(-30), to: deps.to ?? isoDay(0) },
    }),
  head: () => ({ meta: [{ title: "Collections" }] }),
  component: Collections,
});

function Collections() {
  const { groups, history, totals, currency } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/collections" });
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<{
    ids: string[];
    amount: number;
    label: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const money = (n: number) => formatMoney(n, currency);
  const allOrders = groups.flatMap((g) => g.orders);
  const selectedAmount = allOrders
    .filter((o) => selected.includes(o.id))
    .reduce((s, o) => s + o.total, 0);

  async function collect() {
    if (!confirm) return;
    setError(null);
    setPending(true);
    try {
      const result = await collectCash({ data: { ids: confirm.ids } });
      toast.success(
        result.skipped
          ? `${result.collected} marked paid, ${result.skipped} skipped`
          : `${result.collected} marked paid`,
      );
      setSelected([]);
      setConfirm(null);
      await router.invalidate();
    } catch (cause) {
      setConfirm(null);
      setError(messageOf(cause));
    } finally {
      setPending(false);
    }
  }

  return (
    <BackOffice>
      <PageHeader
        title="Collections"
        description="Cash couriers hold for delivered orders."
        actions={
          selected.length > 0 ? (
            <Button
              data-testid="collect-selected"
              onClick={() =>
                setConfirm({
                  ids: selected,
                  amount: selectedAmount,
                  label: `${selected.length} selected orders`,
                })
              }
            >
              Mark {money(selectedAmount)} received
            </Button>
          ) : null
        }
      />
      <FormError message={error} />

      <section className="space-y-3">
        {groups.length === 0 ? (
          <EmptyState
            title="Nothing to collect"
            description="Delivered orders that aren't paid yet appear here by courier."
          />
        ) : (
          groups.map((group) => (
            <Card key={group.courier} data-testid="courier-group">
              <CardHeader>
                <CardTitle>{group.courier}</CardTitle>
                <CardDescription>
                  {group.count} {group.count === 1 ? "order" : "orders"} ·{" "}
                  {money(group.amount)} to collect
                </CardDescription>
                <CardAction>
                  <Button
                    variant="outline"
                    data-testid="collect-group"
                    onClick={() =>
                      setConfirm({
                        ids: group.orders.map((o) => o.id),
                        amount: group.amount,
                        label: group.courier,
                      })
                    }
                  >
                    Mark all received
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent>
                <ul className="divide-y divide-border">
                  {group.orders.map((o) => (
                    <li
                      key={o.id}
                      className="flex items-center gap-3 py-2 text-sm"
                    >
                      <Checkbox
                        data-testid="collect-select"
                        aria-label={`Select order ${o.number}`}
                        checked={selected.includes(o.id)}
                        onCheckedChange={(checked) =>
                          setSelected((prev) =>
                            checked
                              ? [...prev, o.id]
                              : prev.filter((id) => id !== o.id),
                          )
                        }
                      />
                      <span className="font-medium">#{o.number}</span>
                      <span className="text-muted-foreground">
                        {o.customerName}, {o.city}
                      </span>
                      <span className="ml-auto tabular-nums">
                        {money(o.total)}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-base font-semibold tracking-tight">
            Paid by courier
          </h2>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="paid-from">From</Label>
              <Input
                id="paid-from"
                type="date"
                data-testid="paid-from"
                defaultValue={search.from ?? isoDay(-30)}
                onChange={(e) =>
                  e.target.value &&
                  void navigate({
                    search: (p) => ({ ...p, from: e.target.value }),
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="paid-to">To</Label>
              <Input
                id="paid-to"
                type="date"
                data-testid="paid-to"
                defaultValue={search.to ?? isoDay(0)}
                onChange={(e) =>
                  e.target.value &&
                  void navigate({
                    search: (p) => ({ ...p, to: e.target.value }),
                  })
                }
              />
            </div>
          </div>
        </div>
        {totals.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No cash collected in these dates.
          </p>
        ) : (
          <TableCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Courier</TableHead>
                  <TableHead>Orders</TableHead>
                  <TableHead className="pr-4 text-right">Paid</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {totals.map((t) => (
                  <TableRow key={t.courier} data-testid="paid-total-row">
                    <TableCell className="pl-4">{t.courier}</TableCell>
                    <TableCell className="tabular-nums">
                      {t.orderCount}
                    </TableCell>
                    <TableCell className="pr-4 text-right tabular-nums">
                      {money(t.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableCard>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold tracking-tight">History</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">No collections yet.</p>
        ) : (
          <TableCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">When</TableHead>
                  <TableHead>Courier</TableHead>
                  <TableHead>Orders</TableHead>
                  <TableHead>Recorded by</TableHead>
                  <TableHead className="pr-4 text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((h) => (
                  <TableRow key={h.id} data-testid="collection-row">
                    <TableCell className="pl-4 whitespace-nowrap text-muted-foreground">
                      {formatDateTime(h.createdAt)}
                    </TableCell>
                    <TableCell>{h.courier}</TableCell>
                    <TableCell className="tabular-nums">
                      {h.orderCount}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {h.memberEmail ?? "—"}
                    </TableCell>
                    <TableCell className="pr-4 text-right tabular-nums">
                      {money(h.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableCard>
        )}
      </section>

      {confirm ? (
        <ConfirmDialog
          title={`Mark ${money(confirm.amount)} received?`}
          confirmLabel="Mark received"
          testId="confirm-collect"
          pending={pending}
          onConfirm={() => void collect()}
          onClose={() => setConfirm(null)}
        >
          {confirm.ids.length === 1
            ? "1 order moves"
            : `${confirm.ids.length} orders move`}{" "}
          to paid.
        </ConfirmDialog>
      ) : null}
    </BackOffice>
  );
}
