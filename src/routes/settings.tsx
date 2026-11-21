import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { BackOffice } from "@/client/components/BackOffice";
import { FormError, messageOf } from "@/client/components/FormError";
import { PageHeader } from "@/client/components/PageHeader";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent } from "@/client/components/ui/card";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { Switch } from "@/client/components/ui/switch";
import { Textarea } from "@/client/components/ui/textarea";
import { moneyInput } from "@/lib/money";
import {
  getStoreSettings,
  saveStoreSettings,
} from "@/serverFunctions/settings";

export const Route = createFileRoute("/settings")({
  loader: () => getStoreSettings(),
  head: () => ({ meta: [{ title: "Settings" }] }),
  component: Settings,
});

function Settings() {
  const { settings, isAdmin } = Route.useLoaderData();
  const router = useRouter();
  const [name, setName] = useState(settings.name);
  const [description, setDescription] = useState(settings.description);
  const [currency, setCurrency] = useState(settings.currency);
  const [fee, setFee] = useState(moneyInput(settings.deliveryFee));
  const [isOpen, setIsOpen] = useState(settings.isOpen);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function save() {
    setError(null);
    setPending(true);
    try {
      await saveStoreSettings({
        data: { name, description, currency, deliveryFee: fee, isOpen },
      });
      await router.invalidate();
      toast.success("Settings saved");
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setPending(false);
    }
  }

  return (
    <BackOffice>
      <PageHeader
        title="Settings"
        description={isAdmin ? undefined : "Only admins can change these."}
      />
      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <Card>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="store-name">Store name</Label>
              <Input
                id="store-name"
                data-testid="store-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="store-description">Description</Label>
              <Textarea
                id="store-description"
                data-testid="store-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="store-currency">Currency code</Label>
              <Input
                id="store-currency"
                data-testid="store-currency"
                maxLength={3}
                required
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="store-fee">Delivery fee</Label>
              <Input
                id="store-fee"
                data-testid="store-fee"
                inputMode="decimal"
                required
                value={fee}
                onChange={(e) => setFee(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-3 sm:col-span-2">
              <Switch
                id="store-open"
                data-testid="store-open"
                checked={isOpen}
                onCheckedChange={setIsOpen}
              />
              <Label htmlFor="store-open">Open for orders</Label>
            </div>
          </CardContent>
        </Card>
        <FormError message={error} />
        <Button type="submit" data-testid="save-settings" pending={pending}>
          Save
        </Button>
      </form>
    </BackOffice>
  );
}
