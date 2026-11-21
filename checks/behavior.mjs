import {
  startRuntime,
  expect,
} from "/home/user/oss-new/control/runtime/index.mjs";
import {
  open,
  tid,
  pick,
  saveSettings,
  createProduct,
  productBySlug,
  orderByNumber,
  checkout,
  openOrder,
  changeStatus,
} from "./helpers.mjs";

const runtime = await startRuntime();
try {
  // F001: a new store starts closed and takes no orders.
  let res = await runtime.fetch("/shop");
  expect(res.status).toBe(200);
  expect(await res.text()).toContain('data-testid="store-closed"');

  const owner = await open(runtime, "owner");
  await owner.goto("/");
  await runtime.assertBackLink(owner);

  // F002: products, with an image, a draft and low stock.
  await createProduct(owner, {
    name: "Handwoven Olive Basket",
    description: "Palm leaf basket woven in Nabeul.",
    price: "45",
    compare: "60",
    sku: "BSK-01",
    stock: 10,
    status: "active",
    image: true,
  });
  await createProduct(owner, {
    name: "Ceramic Harissa Bowl",
    description: "Hand-painted bowl, 12 cm.",
    price: "18.5",
    sku: "BWL-02",
    stock: 3,
    status: "active",
  });
  await createProduct(owner, {
    name: "Linen Table Runner",
    description: "Natural linen, 180 cm.",
    price: "32",
    sku: "RUN-03",
    stock: 8,
    status: "draft",
  });
  await createProduct(owner, {
    name: "Cedar Spice Box",
    description: "Six compartments.",
    price: "27",
    sku: "BOX-04",
    stock: 0,
    status: "active",
  });

  await owner.goto("/products");
  await expect(tid(owner, "product-row")).toHaveCount(4);
  await expect(
    tid(owner, "product-row")
      .filter({ hasText: "Ceramic Harissa Bowl" })
      .getByTestId("low-stock"),
  ).toBeVisible();
  await expect(
    tid(owner, "product-row")
      .filter({ hasText: "Handwoven Olive Basket" })
      .getByTestId("low-stock"),
  ).toHaveCount(0);
  await tid(owner, "product-search").fill("bowl");
  await tid(owner, "product-search").press("Enter");
  await expect(tid(owner, "product-row")).toHaveCount(1);
  await expect(tid(owner, "product-row")).toContainText("Ceramic Harissa Bowl");
  await owner.goto("/products");
  await pick(owner, "product-status-filter", "Draft");
  await expect(tid(owner, "product-row")).toHaveCount(1);
  await expect(tid(owner, "product-row")).toContainText("Linen Table Runner");

  // Slugs are unique.
  await owner.goto("/products/new");
  await tid(owner, "product-name").fill("Another basket");
  await tid(owner, "product-slug").fill("handwoven-olive-basket");
  await tid(owner, "product-price").fill("10");
  await tid(owner, "product-stock").fill("1");
  await tid(owner, "save-product").click();
  await expect(tid(owner, "form-error")).toBeVisible();

  // F001: settings, then the store opens.
  await saveSettings(owner, {
    name: "Medina Home Goods",
    description: "Handmade homeware from Tunisian workshops.",
    currency: "TND",
    fee: "7",
    open: true,
  });
  await expect(owner.getByText("Settings saved")).toBeVisible();
  await owner.reload();
  await expect(tid(owner, "store-name")).toHaveValue("Medina Home Goods");

  res = await runtime.fetch("/shop");
  expect(res.status).toBe(200);
  const shopHtml = await res.text();
  expect(shopHtml).toContain("Medina Home Goods");
  expect(shopHtml).toContain("Handwoven Olive Basket");
  expect(shopHtml).toContain("60.000 TND");
  expect(shopHtml).not.toContain("Linen Table Runner");
  expect(shopHtml).not.toContain("BSK-01");
  expect((await runtime.fetch("/shop/p/handwoven-olive-basket")).status).toBe(
    200,
  );
  expect((await runtime.fetch("/shop/p/linen-table-runner")).status).toBe(404);
  const basket = await productBySlug(runtime, "handwoven-olive-basket");
  const bowl = await productBySlug(runtime, "ceramic-harissa-bowl");
  const runner = await productBySlug(runtime, "linen-table-runner");
  expect(basket.image_key).toBeTruthy();
  const img = await runtime.fetch(`/shop/img/${basket.image_key}`);
  expect(img.status).toBe(200);
  expect(img.headers.get("content-type")).toContain("image/png");

  // F001 + F003: a visitor browses and checks out.
  const visitor = await open(runtime, null);
  await visitor.goto("/shop");
  await expect(tid(visitor, "shop-product")).toHaveCount(3);
  await expect(
    tid(visitor, "shop-product")
      .filter({ hasText: "Cedar Spice Box" })
      .getByTestId("out-of-stock"),
  ).toBeVisible();
  await expect(
    tid(visitor, "shop-product")
      .filter({ hasText: "Handwoven Olive Basket" })
      .getByTestId("compare-price"),
  ).toContainText("60.000");
  await visitor
    .getByRole("link", { name: /Handwoven Olive Basket/ })
    .first()
    .click();
  await expect(visitor).toHaveURL(/\/shop\/p\/handwoven-olive-basket/);
  await expect(tid(visitor, "add-to-cart")).toBeEnabled();
  await tid(visitor, "qty").fill("2");
  await tid(visitor, "add-to-cart").click();
  await expect(tid(visitor, "cart-link")).toContainText("2");
  await tid(visitor, "cart-link").click();
  await expect(tid(visitor, "cart-line")).toHaveCount(1);
  await expect(tid(visitor, "cart-total")).toContainText("97.000 TND");
  await tid(visitor, "checkout-name").fill("Amira Trabelsi");
  await tid(visitor, "checkout-phone").fill("+216 22 345 678");
  await tid(visitor, "checkout-city").fill("Sousse");
  await tid(visitor, "checkout-address").fill("14 Rue Ibn Khaldoun");
  await tid(visitor, "checkout-note").fill("Please call before delivery");
  await tid(visitor, "place-order").click();
  await expect(tid(visitor, "order-confirmation")).toContainText("#1001");
  const trackHref = await tid(visitor, "tracking-link").getAttribute("href");
  expect(new URL(trackHref, `https://${runtime.hostname}`).hostname).toBe(
    runtime.hostname,
  );
  expect((await productBySlug(runtime, "handwoven-olive-basket")).stock).toBe(
    8,
  );

  // F003: the server prices the cart and enforces stock and status.
  const customer = {
    name: "Karim Haddad",
    phone: "98 765 432",
    city: "Tunis",
    address: "3 Avenue Habib Bourguiba",
  };
  let c = await checkout(runtime, {
    customer,
    lines: [{ productId: bowl.id, qty: 1, price: 1 }],
  });
  expect(c.status).toBe(201);
  expect(c.json.number).toBe(1002);
  const o2 = await orderByNumber(runtime, 1002);
  expect(o2.total).toBe(25500);
  expect(o2.status).toBe("pending");
  expect(o2.payment_method).toBe("cod");
  expect(o2.token.length).toBeGreaterThanOrEqual(20);
  expect(new URL(c.json.trackingUrl).hostname).toBe(runtime.hostname);
  c = await checkout(runtime, {
    customer,
    lines: [{ productId: bowl.id, qty: 5 }],
  });
  expect(c.status).toBe(409);
  c = await checkout(runtime, {
    customer,
    lines: [{ productId: runner.id, qty: 1 }],
  });
  expect(c.status).toBe(409);
  expect((await productBySlug(runtime, "ceramic-harissa-bowl")).stock).toBe(2);
  const lines = await (await runtime.database())
    .prepare("select name, unit_price, qty from order_lines where order_id = ?")
    .bind(o2.id)
    .all();
  expect(lines.results).toEqual([
    { name: "Ceramic Harissa Bowl", unit_price: 18500, qty: 1 },
  ]);

  // F003: a manual order from the back office.
  await owner.goto("/orders/new");
  await pick(owner, "line-product", "Ceramic Harissa Bowl");
  await tid(owner, "line-qty").fill("1");
  await tid(owner, "add-line").click();
  await tid(owner, "order-name").fill("Youssef Ben Salah");
  await tid(owner, "order-phone").fill("55 111 222");
  await tid(owner, "order-city").fill("Sfax");
  await tid(owner, "order-address").fill("22 Rue de la Liberte");
  await Promise.all([
    owner.waitForURL(/\/orders\/[^/]+$/),
    tid(owner, "create-order").click(),
  ]);
  await expect(tid(owner, "order-title")).toContainText("#1003");
  expect((await productBySlug(runtime, "ceramic-harissa-bowl")).stock).toBe(1);

  // F004 + F005: the pipeline on #1001.
  await openOrder(owner, runtime, 1001);
  await expect(tid(owner, "order-status")).toHaveText("Pending");
  await changeStatus(owner, "confirmed", { note: "Confirmed by phone" });
  await expect(tid(owner, "order-status")).toHaveText("Confirmed");
  await tid(owner, "action-shipped").click();
  await tid(owner, "status-submit").click();
  await expect(tid(owner, "action-error")).toBeVisible();
  await tid(owner, "courier").fill("Rapid Post");
  await tid(owner, "tracking-number").fill("RP-55821");
  await tid(owner, "status-submit").click();
  await expect(tid(owner, "order-status")).toHaveText("Shipped");
  await expect(tid(owner, "history-entry")).toHaveCount(3);
  await expect(
    tid(owner, "history-entry").filter({ hasText: "Confirmed by phone" }),
  ).toHaveCount(1);
  await expect(tid(owner, "shipment")).toContainText("Rapid Post");

  // F005: the public tracking page.
  const o1 = await orderByNumber(runtime, 1001);
  res = await runtime.fetch(`/shop/t/${o1.token}`);
  expect(res.status).toBe(200);
  const trackHtml = await res.text();
  for (const s of [
    "#1001",
    "Shipped",
    "Rapid Post",
    "RP-55821",
    "Amira",
    "Handwoven Olive Basket",
    "97.000",
  ])
    expect(trackHtml).toContain(s);
  for (const s of [
    "Trabelsi",
    "22 345 678",
    "Ibn Khaldoun",
    "Confirmed by phone",
    "Please call",
    "#1002",
  ])
    expect(trackHtml).not.toContain(s);
  expect((await runtime.fetch("/shop/t/not-a-real-token-at-all")).status).toBe(
    404,
  );
  await visitor.goto(trackHref);
  await expect(tid(visitor, "tracking-status")).toHaveText("Shipped");
  await expect(tid(visitor, "timeline-entry")).toHaveCount(3);

  await openOrder(owner, runtime, 1001);
  await changeStatus(owner, "delivered");
  await expect(tid(owner, "order-status")).toHaveText("Delivered");

  // F004: cancelling restocks; backward moves don't exist.
  await openOrder(owner, runtime, 1002);
  await expect(tid(owner, "action-delivered")).toHaveCount(0);
  await changeStatus(owner, "cancelled", {
    note: "Customer changed their mind",
  });
  await expect(tid(owner, "order-status")).toHaveText("Cancelled");
  await expect(tid(owner, "action-confirmed")).toHaveCount(0);
  expect((await productBySlug(runtime, "ceramic-harissa-bowl")).stock).toBe(2);

  // F004: assignment.
  await openOrder(owner, runtime, 1003);
  await pick(owner, "assignee", "owner@example.test");
  await expect(tid(owner, "assignee")).toContainText("owner@example.test");
  expect((await orderByNumber(runtime, 1003)).assignee_id).toBe("owner");

  // F006: collections.
  await owner.goto("/collections");
  const group = tid(owner, "courier-group").filter({ hasText: "Rapid Post" });
  await expect(group).toContainText("1 order");
  await expect(group).toContainText("97.000 TND");
  await group.getByTestId("collect-group").click();
  await tid(owner, "confirm-collect").click();
  await expect(
    tid(owner, "collection-row").filter({ hasText: "Rapid Post" }),
  ).toContainText("97.000 TND");
  await expect(tid(owner, "courier-group")).toHaveCount(0);
  await expect(
    tid(owner, "paid-total-row").filter({ hasText: "Rapid Post" }),
  ).toContainText("97.000 TND");
  expect((await orderByNumber(runtime, 1001)).status).toBe("paid");

  // F004: bulk change reports skipped orders.
  await owner.goto("/");
  await tid(owner, "order-row")
    .filter({ hasText: "#1003" })
    .getByTestId("row-select")
    .click();
  await tid(owner, "order-row")
    .filter({ hasText: "#1002" })
    .getByTestId("row-select")
    .click();
  await pick(owner, "bulk-status", "Confirmed");
  await tid(owner, "bulk-apply").click();
  await expect(tid(owner, "bulk-result")).toContainText("1 updated");
  await expect(tid(owner, "bulk-result")).toContainText("#1002");
  expect((await orderByNumber(runtime, 1003)).status).toBe("confirmed");

  // F004: filters, search, dates.
  await owner.goto("/");
  await pick(owner, "filter-status", "Paid");
  await expect(tid(owner, "order-row")).toHaveCount(1);
  await expect(tid(owner, "order-row")).toContainText("#1001");
  await owner.goto("/");
  await tid(owner, "order-search").fill("55 111");
  await tid(owner, "order-search").press("Enter");
  await expect(tid(owner, "order-row")).toHaveCount(1);
  await expect(tid(owner, "order-row")).toContainText("Youssef Ben Salah");
  await owner.goto("/");
  await tid(owner, "date-from").fill("2099-01-01");
  await tid(owner, "date-from").press("Enter");
  await expect(tid(owner, "order-row")).toHaveCount(0);

  // F007: customers.
  await owner.goto("/customers");
  const amira = tid(owner, "customer-row").filter({
    hasText: "Amira Trabelsi",
  });
  await expect(amira.getByTestId("customer-orders")).toHaveText("1");
  await expect(amira.getByTestId("customer-spent")).toContainText("97.000");
  await expect(
    tid(owner, "customer-row")
      .filter({ hasText: "Karim Haddad" })
      .getByTestId("customer-spent"),
  ).toContainText("0.000");
  await tid(owner, "customer-search").fill("Sfax");
  await tid(owner, "customer-search").press("Enter");
  await expect(tid(owner, "customer-row")).toHaveCount(1);
  await owner.goto("/customers");
  await amira.getByRole("link").first().click();
  await expect(tid(owner, "customer-order")).toHaveCount(1);
  await tid(owner, "customer-notes").fill("Prefers afternoon delivery");
  await tid(owner, "customer-tags").fill("repeat, sousse");
  await tid(owner, "save-customer").click();
  await expect(owner.getByText("Customer saved")).toBeVisible();
  await owner.reload();
  await expect(tid(owner, "customer-notes")).toHaveValue(
    "Prefers afternoon delivery",
  );
  await expect(tid(owner, "customer-tag")).toHaveCount(2);
  // A repeat order matches the customer by phone.
  c = await checkout(runtime, {
    customer: {
      name: "Amira T.",
      phone: "+21622345678",
      city: "Sousse",
      address: "14 Rue Ibn Khaldoun",
    },
    lines: [{ productId: basket.id, qty: 1 }],
  });
  expect(c.status).toBe(201);
  const count = await (await runtime.database())
    .prepare("select count(*) as n from customers where phone like '%22345678'")
    .first();
  expect(count.n).toBe(1);

  // F002: deleting a product that has orders archives it.
  await owner.goto(`/products/${bowl.id}`);
  await tid(owner, "delete-product").click();
  await tid(owner, "confirm-delete").click();
  await owner.waitForURL(/\/products(\?.*)?$/);
  expect((await productBySlug(runtime, "ceramic-harissa-bowl")).status).toBe(
    "draft",
  );
  const box = await productBySlug(runtime, "cedar-spice-box");
  await owner.goto(`/products/${box.id}`);
  await tid(owner, "delete-product").click();
  await tid(owner, "confirm-delete").click();
  await owner.waitForURL(/\/products(\?.*)?$/);
  expect(await productBySlug(runtime, "cedar-spice-box")).toBeNull();

  // F004: paging through many orders.
  const names = [
    "Salma Gharbi",
    "Mehdi Jaziri",
    "Ines Mabrouk",
    "Walid Chebbi",
    "Rania Ayari",
    "Hatem Ferchichi",
    "Leila Ben Ammar",
    "Sami Khelifi",
    "Nour Hamdi",
    "Omar Dridi",
  ];
  await owner.goto("/products/" + basket.id);
  await tid(owner, "product-stock").fill("60");
  await Promise.all([
    owner.waitForURL(/\/products(\?.*)?$/),
    tid(owner, "save-product").click(),
  ]);
  for (let i = 0; i < 20; i++) {
    const n = names[i % names.length];
    const r = await checkout(runtime, {
      customer: {
        name: n,
        phone: `20 ${String(100000 + i * 7919).slice(0, 6)}`,
        city: ["Tunis", "Sousse", "Bizerte", "Gabes", "Monastir"][i % 5],
        address: `${i + 2} Rue des Jasmins`,
      },
      lines: [{ productId: basket.id, qty: 1 + (i % 2) }],
    });
    expect(r.status).toBe(201);
  }
  await owner.goto("/");
  await expect(tid(owner, "order-row")).toHaveCount(20);
  await expect(tid(owner, "page-info")).toContainText("1 of 2");
  await tid(owner, "page-next").click();
  await expect(tid(owner, "page-info")).toContainText("2 of 2");
  await expect(tid(owner, "order-row")).toHaveCount(4);
  await owner.goto("/?sort=total&dir=desc");
  await expect(tid(owner, "order-row").first()).toContainText("97.000");

  // Phone-sized smoke.
  const phone = await open(runtime, null, {
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await phone.goto("/shop");
  await expect(tid(phone, "shop-product").first()).toBeVisible();
  const memberPhone = await open(runtime, "member", {
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await memberPhone.goto("/");
  await expect(tid(memberPhone, "order-row").first()).toBeVisible();

  // The result: the busy order list.
  await owner.goto("/");
  await expect(tid(owner, "order-row").first()).toBeVisible();
  await runtime.screenshot(owner);
} finally {
  await runtime.close();
}
