import {
  startRuntime,
  expect,
} from "/home/user/oss-new/control/runtime/index.mjs";
import {
  open,
  tid,
  saveSettings,
  createProduct,
  productBySlug,
  checkout,
} from "./helpers.mjs";

const runtime = await startRuntime();
try {
  let owner = await open(runtime, "owner");
  await saveSettings(owner, {
    name: "Kasbah Pantry",
    description: "Olive oil and dates.",
    currency: "TND",
    fee: "6",
    open: true,
  });
  await expect(owner.getByText("Settings saved")).toBeVisible();
  await createProduct(owner, {
    name: "Deglet Nour Dates 1kg",
    description: "From Tozeur.",
    price: "22",
    sku: "DT-1",
    stock: 12,
    status: "active",
    image: true,
  });
  const dates = await productBySlug(runtime, "deglet-nour-dates-1kg");
  const order = await checkout(runtime, {
    customer: {
      name: "Mouna Sassi",
      phone: "23 456 789",
      city: "Gabes",
      address: "7 Rue de Palestine",
    },
    lines: [{ productId: dates.id, qty: 3 }],
  });
  expect(order.status).toBe(201);

  await runtime.restart();

  const shop = await (await runtime.fetch("/shop")).text();
  expect(shop).toContain("Kasbah Pantry");
  expect(shop).toContain("Deglet Nour Dates 1kg");
  expect((await runtime.fetch(`/shop/img/${dates.image_key}`)).status).toBe(
    200,
  );
  const track = await (
    await runtime.fetch(`/shop/t/${order.json.token}`)
  ).text();
  expect(track).toContain(`#${order.json.number}`);
  owner = await open(runtime, "owner");
  await owner.goto("/");
  await expect(
    tid(owner, "order-row").filter({ hasText: "Mouna Sassi" }),
  ).toHaveCount(1);
  await owner.goto("/products");
  await expect(
    tid(owner, "product-row").filter({ hasText: "Deglet Nour Dates 1kg" }),
  ).toContainText("9");
  await owner.goto("/customers");
  await expect(
    tid(owner, "customer-row").filter({ hasText: "Mouna Sassi" }),
  ).toHaveCount(1);
} finally {
  await runtime.close();
}
