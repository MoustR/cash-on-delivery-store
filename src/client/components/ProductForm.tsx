import { useNavigate } from "@tanstack/react-router";
import { ImageIcon } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { FormError, messageOf } from "@/client/components/FormError";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent } from "@/client/components/ui/card";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { Switch } from "@/client/components/ui/switch";
import { Textarea } from "@/client/components/ui/textarea";
import { moneyInput } from "@/lib/money";
import { slugify } from "@/lib/pipeline";
import { deleteProduct, saveProduct } from "@/serverFunctions/products";

export interface ProductValues {
  id?: string;
  name: string;
  slug: string;
  description: string;
  price: number | null;
  compareAtPrice: number | null;
  sku: string;
  stock: number;
  status: "active" | "draft";
  imageKey: string | null;
}

export function ProductForm({ product }: { product?: ProductValues }) {
  const navigate = useNavigate();
  const [name, setName] = useState(product?.name ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [price, setPrice] = useState(moneyInput(product?.price));
  const [compare, setCompare] = useState(moneyInput(product?.compareAtPrice));
  const [sku, setSku] = useState(product?.sku ?? "");
  const [stock, setStock] = useState(String(product?.stock ?? 0));
  const [active, setActive] = useState(
    (product?.status ?? "active") === "active",
  );
  const [imageKey, setImageKey] = useState(product?.imageKey ?? null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function upload(file: File) {
    setError(null);
    setUploading(true);
    try {
      const res = await fetch("/api/images", {
        method: "POST",
        headers: { "content-type": file.type },
        body: file,
      });
      const body = (await res.json()) as { key?: string; error?: string };
      if (!res.ok || !body.key)
        throw new Error(body.error ?? "The upload failed.");
      setImageKey(body.key);
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    setError(null);
    setPending(true);
    try {
      await saveProduct({
        data: {
          id: product?.id,
          name,
          slug,
          description,
          price,
          compareAtPrice: compare,
          sku,
          stock: Number(stock),
          status: active ? "active" : "draft",
          imageKey,
        },
      });
      await navigate({ to: "/products" });
    } catch (cause) {
      setError(messageOf(cause));
      setPending(false);
    }
  }

  async function remove() {
    if (!product?.id) return;
    setPending(true);
    try {
      await deleteProduct({ data: { id: product.id } });
      await navigate({ to: "/products" });
    } catch (cause) {
      setConfirming(false);
      setError(messageOf(cause));
      setPending(false);
    }
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="product-name">Name</Label>
            <Input
              id="product-name"
              data-testid="product-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="product-slug">Slug</Label>
            <Input
              id="product-slug"
              data-testid="product-slug"
              value={slug}
              placeholder={slugify(name)}
              onChange={(e) => setSlug(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="product-description">Description</Label>
            <Textarea
              id="product-description"
              data-testid="product-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="product-price">Price</Label>
            <Input
              id="product-price"
              data-testid="product-price"
              inputMode="decimal"
              required
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="product-compare">Compare-at price (optional)</Label>
            <Input
              id="product-compare"
              data-testid="product-compare"
              inputMode="decimal"
              value={compare}
              onChange={(e) => setCompare(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="product-sku">SKU</Label>
            <Input
              id="product-sku"
              data-testid="product-sku"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="product-stock">In stock</Label>
            <Input
              id="product-stock"
              data-testid="product-stock"
              type="number"
              min={0}
              step={1}
              required
              value={stock}
              onChange={(e) => setStock(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3 sm:col-span-2">
            <Switch
              id="product-active"
              data-testid="product-active"
              checked={active}
              onCheckedChange={setActive}
            />
            <Label htmlFor="product-active">Active on the storefront</Label>
          </div>
          <div className="flex items-center gap-4 sm:col-span-2">
            <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
              {imageKey ? (
                <img
                  src={`/api/img/${imageKey}`}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                <ImageIcon
                  className="size-6 text-muted-foreground"
                  aria-hidden
                />
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="product-image">Photo</Label>
              <Input
                id="product-image"
                data-testid="product-image"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void upload(file);
                }}
              />
            </div>
            {imageKey ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setImageKey(null)}
              >
                Remove
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
      <FormError message={error} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          type="submit"
          data-testid="save-product"
          pending={pending}
          disabled={uploading}
        >
          {product?.id ? "Save" : "Add product"}
        </Button>
        {product?.id ? (
          <Button
            type="button"
            variant="outline"
            data-testid="delete-product"
            onClick={() => setConfirming(true)}
          >
            Delete
          </Button>
        ) : null}
      </div>
      {confirming ? (
        <ConfirmDialog
          title={`Delete ${product?.name}?`}
          confirmLabel="Delete"
          destructive
          pending={pending}
          onConfirm={() => void remove()}
          onClose={() => setConfirming(false)}
        >
          A product that has orders is moved to draft instead.
        </ConfirmDialog>
      ) : null}
    </form>
  );
}
