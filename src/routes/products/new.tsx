import { createFileRoute, Link } from "@tanstack/react-router";
import { BackOffice } from "@/client/components/BackOffice";
import { PageHeader } from "@/client/components/PageHeader";
import { ProductForm } from "@/client/components/ProductForm";

export const Route = createFileRoute("/products/new")({
  head: () => ({ meta: [{ title: "New product" }] }),
  component: () => (
    <BackOffice>
      <PageHeader
        backLink={
          <Link
            to="/products"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ‹ Products
          </Link>
        }
        title="New product"
      />
      <ProductForm />
    </BackOffice>
  ),
});
