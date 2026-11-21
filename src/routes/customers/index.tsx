import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { BackOffice } from "@/client/components/BackOffice";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { Badge } from "@/client/components/ui/badge";
import { Input } from "@/client/components/ui/input";
import {
  Table,
  TableBody,
  TableCard,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import { formatDate } from "@/client/lib/dates";
import { formatMoney } from "@/lib/money";
import { getCustomers } from "@/serverFunctions/customers";

const searchSchema = z.object({ q: z.string().trim().max(100).optional() });

export const Route = createFileRoute("/customers/")({
  validateSearch: (search) => searchSchema.catch({}).parse(search),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getCustomers({ data: deps }),
  head: () => ({ meta: [{ title: "Customers" }] }),
  component: Customers,
});

function Customers() {
  const { customers, currency } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/customers/" });
  const [q, setQ] = useState(search.q ?? "");

  return (
    <BackOffice>
      <PageHeader title="Customers" />
      <div className="space-y-4">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void navigate({ search: { q: q.trim() || undefined } });
          }}
        >
          <Input
            aria-label="Search customers"
            data-testid="customer-search"
            name="q"
            placeholder="Name, phone, city or tag"
            className="max-w-xs"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </form>
        {customers.length === 0 ? (
          search.q ? (
            <EmptyState kind="filtered" title="No customers match" />
          ) : (
            <EmptyState
              media="rows"
              title="No customers yet"
              description="Each new phone number on an order adds a customer here."
            />
          )
        ) : (
          <TableCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Customer</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Orders</TableHead>
                  <TableHead>Spent</TableHead>
                  <TableHead>Last order</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((c) => (
                  <TableRow key={c.id} data-testid="customer-row">
                    <TableCell className="pl-4">
                      <Link
                        to="/customers/$customerId"
                        params={{ customerId: c.id }}
                        className="font-medium hover:underline"
                      >
                        {c.name}
                      </Link>
                      <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                        {c.phone}
                        {c.tags.map((t) => (
                          <Badge key={t} variant="secondary" size="sm">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{c.city}</TableCell>
                    <TableCell
                      className="tabular-nums"
                      data-testid="customer-orders"
                    >
                      {c.orderCount}
                    </TableCell>
                    <TableCell
                      className="whitespace-nowrap tabular-nums"
                      data-testid="customer-spent"
                    >
                      {formatMoney(c.spent, currency)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.lastOrderAt ? formatDate(c.lastOrderAt) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableCard>
        )}
      </div>
    </BackOffice>
  );
}
