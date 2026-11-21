import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { BackOffice } from "@/client/components/BackOffice";
import { PageHeader } from "@/client/components/PageHeader";
import { ProductForm } from "@/client/components/ProductForm";
import { getProduct } from "@/serverFunctions/products";

export const Route = createFileRoute("/products/$productId")({
  loader: async ({ params }) => {
    try {
      return await getProduct({ data: { id: params.productId } });
    } catch {
      throw notFound();
    }
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? [{ title: loaderData.product.name }] : [],
  }),
  component: EditProduct,
});

function EditProduct() {
  const { product } = Route.useLoaderData();
  return (
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
        title={product.name}
      />
      <ProductForm key={product.id} product={product} />
    </BackOffice>
  );
}
