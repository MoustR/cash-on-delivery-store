import {
  createFileRoute,
  Link,
  notFound,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { BackOffice } from "@/client/components/BackOffice";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { FormError, messageOf } from "@/client/components/FormError";
import { PageHeader } from "@/client/components/PageHeader";
import { StatusBadge } from "@/client/components/StatusBadge";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/client/components/ui/card";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { Textarea } from "@/client/components/ui/textarea";
import { formatDateTime } from "@/client/lib/dates";
import { formatMoney } from "@/lib/money";
import {
  deleteCustomer,
  getCustomer,
  saveCustomer,
} from "@/serverFunctions/customers";

export const Route = createFileRoute("/customers/$customerId")({
  loader: async ({ params }) => {
    try {
      return await getCustomer({ data: { id: params.customerId } });
    } catch {
      throw notFound();
    }
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? [{ title: loaderData.customer.name }] : [],
  }),
  component: CustomerPage,
});

function CustomerPage() {
  const { customer } = Route.useLoaderData();
  const router = useRouter();
  const navigate = useNavigate();
  const [notes, setNotes] = useState(customer.notes);
  const [tags, setTags] = useState(customer.tags.join(", "));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function save() {
    setError(null);
    setPending(true);
    try {
      await saveCustomer({
        data: {
          id: customer.id,
          notes,
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        },
      });
      await router.invalidate();
      toast.success("Customer saved");
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    setPending(true);
    try {
      await deleteCustomer({ data: { id: customer.id } });
      await navigate({ to: "/customers" });
    } catch (cause) {
      setConfirming(false);
      setError(messageOf(cause));
      setPending(false);
    }
  }

  return (
    <BackOffice>
      <PageHeader
        backLink={
          <Link
            to="/customers"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ‹ Customers
          </Link>
        }
        title={customer.name}
        description={`${customer.phone} · ${[customer.address, customer.city].filter(Boolean).join(", ")}`}
        actions={
          <Button
            variant="outline"
            data-testid="delete-customer"
            onClick={() => setConfirming(true)}
          >
            Delete
          </Button>
        }
      />
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Orders</CardTitle>
          </CardHeader>
          <CardContent>
            {customer.orders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No orders yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {customer.orders.map((o) => (
                  <li
                    key={o.id}
                    data-testid="customer-order"
                    className="flex flex-wrap items-center gap-3 py-2 text-sm"
                  >
                    <Link
                      to="/orders/$orderId"
                      params={{ orderId: o.id }}
                      className="font-medium hover:underline"
                    >
                      #{o.number}
                    </Link>
                    <span className="text-muted-foreground">
                      {formatDateTime(o.createdAt)}
                    </span>
                    <StatusBadge status={o.status} />
                    <span className="ml-auto tabular-nums">
                      {formatMoney(o.total, o.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Notes and tags</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void save();
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="customer-notes">Notes</Label>
                <Textarea
                  id="customer-notes"
                  data-testid="customer-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="customer-tags">Tags, separated by commas</Label>
                <Input
                  id="customer-tags"
                  data-testid="customer-tags"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                />
                <div className="flex flex-wrap gap-1">
                  {customer.tags.map((t) => (
                    <Badge
                      key={t}
                      variant="secondary"
                      data-testid="customer-tag"
                    >
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
              <FormError message={error} />
              <Button
                type="submit"
                data-testid="save-customer"
                pending={pending}
              >
                Save
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
      {confirming ? (
        <ConfirmDialog
          title={`Delete ${customer.name}?`}
          confirmLabel="Delete"
          destructive
          pending={pending}
          onConfirm={() => void remove()}
          onClose={() => setConfirming(false)}
        />
      ) : null}
    </BackOffice>
  );
}
