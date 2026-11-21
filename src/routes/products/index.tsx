import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ImageIcon, Plus } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { BackOffice } from "@/client/components/BackOffice";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { SelectField } from "@/client/components/SelectField";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
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
import { formatMoney } from "@/lib/money";
import { getProducts } from "@/serverFunctions/products";

const searchSchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(["active", "draft"]).optional(),
});

export const Route = createFileRoute("/products/")({
  validateSearch: (search) => searchSchema.catch({}).parse(search),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getProducts({ data: deps }),
  head: () => ({ meta: [{ title: "Products" }] }),
  component: Products,
});

function Products() {
  const { products, currency, lowStock } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/products/" });
  const [q, setQ] = useState(search.q ?? "");
  const filtered = Boolean(search.q || search.status);

  return (
    <BackOffice>
      <PageHeader
        title="Products"
        actions={
          <Button
            render={<Link to="/products/new" />}
            data-testid="new-product"
          >
            <Plus /> New product
          </Button>
        }
      />
      <div className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <form
            className="contents"
            onSubmit={(event) => {
              event.preventDefault();
              void navigate({
                search: (prev) => ({ ...prev, q: q.trim() || undefined }),
              });
            }}
          >
            <Input
              aria-label="Search products"
              data-testid="product-search"
              name="q"
              placeholder="Name or SKU"
              className="max-w-xs"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </form>
          <SelectField
            testId="product-status-filter"
            label="Status"
            className="w-36"
            value={search.status ?? "all"}
            onChange={(v) =>
              void navigate({
                search: (prev) => ({
                  ...prev,
                  status: v === "all" ? undefined : (v as "active" | "draft"),
                }),
              })
            }
            options={[
              { value: "all", label: "All" },
              { value: "active", label: "Active" },
              { value: "draft", label: "Draft" },
            ]}
          />
        </div>

        {products.length === 0 ? (
          filtered ? (
            <EmptyState kind="filtered" title="No products match" />
          ) : (
            <EmptyState
              media="rows"
              title="No products yet"
              description="Add one and it will appear here."
            />
          )
        ) : (
          <TableCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => (
                  <TableRow key={p.id} data-testid="product-row">
                    <TableCell className="pl-4">
                      <Link
                        to="/products/$productId"
                        params={{ productId: p.id }}
                        className="flex items-center gap-3 font-medium hover:underline"
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
                          {p.imageKey ? (
                            <img
                              src={`/api/img/${p.imageKey}`}
                              alt=""
                              className="size-full object-cover"
                            />
                          ) : (
                            <ImageIcon
                              className="size-4 text-muted-foreground"
                              aria-hidden
                            />
                          )}
                        </span>
                        {p.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.sku || "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {formatMoney(p.price, currency)}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-2 tabular-nums">
                        {p.stock}
                        {p.stock <= lowStock ? (
                          <Badge
                            variant={p.stock === 0 ? "destructive" : "warning"}
                            data-testid="low-stock"
                          >
                            {p.stock === 0 ? "Out of stock" : "Low stock"}
                          </Badge>
                        ) : null}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={p.status === "active" ? "success" : "outline"}
                      >
                        {p.status === "active" ? "Active" : "Draft"}
                      </Badge>
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
