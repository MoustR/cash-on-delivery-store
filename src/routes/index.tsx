import {
  createFileRoute,
  Link,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";
import { useState } from "react";
import { BackOffice } from "@/client/components/BackOffice";
import { EmptyState } from "@/client/components/EmptyState";
import { FormError, messageOf } from "@/client/components/FormError";
import { PageHeader } from "@/client/components/PageHeader";
import { SelectField } from "@/client/components/SelectField";
import { StatusBadge } from "@/client/components/StatusBadge";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
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
import { formatDateTime } from "@/client/lib/dates";
import { formatMoney } from "@/lib/money";
import { STATUS_LABELS, STATUS_ORDER } from "@/lib/pipeline";
import { listOrdersInput, type ListOrdersInput } from "@/lib/search";
import { bulkChangeOrderStatus, getOrders } from "@/serverFunctions/orders";

export const Route = createFileRoute("/")({
  validateSearch: (search) => listOrdersInput.catch({}).parse(search),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getOrders({ data: deps }),
  head: () => ({ meta: [{ title: "Orders" }] }),
  component: Orders,
});

type SortKey = NonNullable<ListOrdersInput["sort"]>;

function Orders() {
  const { rows, total, page, pageCount } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/" });
  const router = useRouter();
  const [q, setQ] = useState(search.q ?? "");
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkTo, setBulkTo] = useState("confirmed");
  const [courier, setCourier] = useState("");
  const [bulkResult, setBulkResult] = useState<{
    updated: number[];
    skipped: { number: number; reason: string }[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const setSearch = (next: Partial<ListOrdersInput>) => {
    setSelected([]);
    void navigate({
      search: (prev) => {
        const merged = { ...prev, page: undefined, ...next };
        return Object.fromEntries(
          Object.entries(merged).filter(([, v]) => v !== undefined && v !== ""),
        );
      },
    });
  };

  const sortBy = (key: SortKey) => {
    const current = search.sort ?? "date";
    const dir =
      current === key && (search.dir ?? "desc") === "desc" ? "asc" : "desc";
    setSearch({ sort: key, dir });
  };

  async function applyBulk() {
    setError(null);
    setBulkResult(null);
    setPending(true);
    try {
      const result = await bulkChangeOrderStatus({
        data: {
          ids: selected,
          to: bulkTo as ListOrdersInput["status"] & string,
          courier: bulkTo === "shipped" ? courier : undefined,
        },
      });
      setBulkResult(result);
      setSelected([]);
      await router.invalidate();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setPending(false);
    }
  }

  const filtered = Boolean(
    search.status || search.q || search.from || search.to,
  );
  const allOnPage =
    rows.length > 0 && rows.every((r) => selected.includes(r.id));

  return (
    <BackOffice>
      <PageHeader
        title="Orders"
        description={`${total} ${total === 1 ? "order" : "orders"}`}
        actions={
          <Button render={<Link to="/orders/new" />} data-testid="new-order">
            <Plus /> New order
          </Button>
        }
      />

      <div className="space-y-4">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            setSearch({ q: q.trim() || undefined });
          }}
        >
          <div className="min-w-48 flex-1 space-y-1.5">
            <Label htmlFor="order-search">Search</Label>
            <Input
              id="order-search"
              data-testid="order-search"
              name="q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Number, name or phone"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <SelectField
              testId="filter-status"
              label="Status"
              className="w-36"
              value={search.status ?? "all"}
              onChange={(v) =>
                setSearch({
                  status:
                    v === "all" ? undefined : (v as ListOrdersInput["status"]),
                })
              }
              options={[
                { value: "all", label: "All statuses" },
                ...STATUS_ORDER.map((s) => ({
                  value: s,
                  label: STATUS_LABELS[s],
                })),
              ]}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="date-from">From</Label>
            <Input
              id="date-from"
              type="date"
              data-testid="date-from"
              defaultValue={search.from}
              onChange={(e) => setSearch({ from: e.target.value || undefined })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="date-to">To</Label>
            <Input
              id="date-to"
              type="date"
              data-testid="date-to"
              defaultValue={search.to}
              onChange={(e) => setSearch({ to: e.target.value || undefined })}
            />
          </div>
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>

        {selected.length > 0 ? (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-muted/50 px-4 py-3">
            <span className="text-sm font-medium">
              {selected.length} selected
            </span>
            <SelectField
              testId="bulk-status"
              label="New status"
              className="w-36"
              value={bulkTo}
              onChange={setBulkTo}
              options={STATUS_ORDER.filter((s) => s !== "pending").map((s) => ({
                value: s,
                label: STATUS_LABELS[s],
              }))}
            />
            {bulkTo === "shipped" ? (
              <Input
                aria-label="Courier"
                data-testid="bulk-courier"
                placeholder="Courier"
                className="w-40"
                value={courier}
                onChange={(e) => setCourier(e.target.value)}
              />
            ) : null}
            <Button
              data-testid="bulk-apply"
              pending={pending}
              onClick={applyBulk}
            >
              Apply
            </Button>
          </div>
        ) : null}
        <FormError message={error} />
        {bulkResult ? (
          <Alert data-testid="bulk-result">
            <AlertDescription>
              {bulkResult.updated.length} updated.
              {bulkResult.skipped.map((s) => (
                <span key={s.number} className="block">
                  #{s.number} skipped: {s.reason}.
                </span>
              ))}
            </AlertDescription>
          </Alert>
        ) : null}

        {rows.length === 0 ? (
          filtered ? (
            <EmptyState kind="filtered" title="No orders match these filters" />
          ) : (
            <EmptyState
              media="rows"
              title="No orders yet"
              description="Orders from the storefront and ones you add appear here."
            />
          )
        ) : (
          <TableCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      aria-label="Select all on this page"
                      checked={allOnPage}
                      onCheckedChange={(checked) =>
                        setSelected(checked ? rows.map((r) => r.id) : [])
                      }
                    />
                  </TableHead>
                  <SortHead
                    label="Order"
                    k="number"
                    search={search}
                    onSort={sortBy}
                  />
                  <SortHead
                    label="Date"
                    k="date"
                    search={search}
                    onSort={sortBy}
                  />
                  <SortHead
                    label="Customer"
                    k="customer"
                    search={search}
                    onSort={sortBy}
                  />
                  <TableHead>City</TableHead>
                  <SortHead
                    label="Total"
                    k="total"
                    search={search}
                    onSort={sortBy}
                  />
                  <TableHead>Status</TableHead>
                  <TableHead>Assigned</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} data-testid="order-row">
                    <TableCell>
                      <Checkbox
                        data-testid="row-select"
                        aria-label={`Select order ${row.number}`}
                        checked={selected.includes(row.id)}
                        onCheckedChange={(checked) =>
                          setSelected((prev) =>
                            checked
                              ? [...prev, row.id]
                              : prev.filter((id) => id !== row.id),
                          )
                        }
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link
                        to="/orders/$orderId"
                        params={{ orderId: row.id }}
                        className="hover:underline"
                      >
                        #{row.number}
                      </Link>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDateTime(row.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div>{row.customerName}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.phone}
                      </div>
                    </TableCell>
                    <TableCell>{row.city}</TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {formatMoney(row.total, row.currency)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={row.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.assigneeEmail ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableCard>
        )}

        {pageCount > 1 ? (
          <div className="flex items-center justify-end gap-2">
            <span
              className="text-sm text-muted-foreground"
              data-testid="page-info"
            >
              Page {page} of {pageCount}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Previous page"
              data-testid="page-prev"
              disabled={page <= 1}
              onClick={() => setSearch({ page: page - 1 })}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Next page"
              data-testid="page-next"
              disabled={page >= pageCount}
              onClick={() => setSearch({ page: page + 1 })}
            >
              <ChevronRight />
            </Button>
          </div>
        ) : null}
      </div>
    </BackOffice>
  );
}

function SortHead({
  label,
  k,
  search,
  onSort,
}: {
  label: string;
  k: SortKey;
  search: ListOrdersInput;
  onSort: (k: SortKey) => void;
}) {
  const active = (search.sort ?? "date") === k;
  const Icon = (search.dir ?? "desc") === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead>
      <button
        type="button"
        data-testid={`sort-${k}`}
        className="inline-flex cursor-pointer items-center gap-1 hover:text-foreground"
        onClick={() => onSort(k)}
      >
        {label}
        {active ? <Icon className="size-3.5" aria-hidden /> : null}
      </button>
    </TableHead>
  );
}
