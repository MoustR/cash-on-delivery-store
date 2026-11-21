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
  // X001: the back office is member-only; anonymous visitors and other organizations are refused.
  await runtime.assertPrivateAccess([
    "/",
    "/products",
    "/products/new",
    "/customers",
    "/collections",
    "/settings",
    "/orders/new",
  ]);
  for (const path of ["/", "/settings", "/api/img/anything"]) {
    for (const role of [undefined, "outsider"]) {
      const res = await runtime.fetch(path, { role });
      expect([401, 403, 302, 303]).toContain(res.status);
    }
  }
  // No sign-in of the app's own.
  for (const path of ["/login", "/signin", "/register", "/reset-password"]) {
    const res = await runtime.fetch(path, { role: "member" });
    expect(res.status).not.toBe(200);
  }
  const memberPage = await open(runtime, "member");
  await memberPage.goto("/");
  await expect(memberPage.locator('input[type="password"]')).toHaveCount(0);

  // Owner sets the store up.
  const owner = await open(runtime, "owner");
  await createProduct(owner, {
    name: "Brass Lantern",
    description: "Hand-punched brass.",
    price: "80",
    sku: "LAN-SECRET-77",
    stock: 7,
    status: "active",
  });
  await createProduct(owner, {
    name: "Prototype Rug",
    description: "Not ready.",
    price: "300",
    sku: "RUG-01",
    stock: 2,
    status: "draft",
  });
  await saveSettings(owner, {
    name: "Atlas Crafts",
    description: "Lanterns and rugs.",
    currency: "TND",
    fee: "8",
    open: true,
  });
  await expect(owner.getByText("Settings saved")).toBeVisible();

  // F001: the public catalogue hides drafts and internal fields.
  const shop = await (await runtime.fetch("/shop")).text();
  expect(shop).toContain("Brass Lantern");
  expect(shop).not.toContain("Prototype Rug");
  expect(shop).not.toContain("LAN-SECRET-77");
  const productPage = await (
    await runtime.fetch("/shop/p/brass-lantern")
  ).text();
  expect(productPage).not.toContain("LAN-SECRET-77");
  expect(productPage).not.toMatch(/>\s*7\s*(in stock|left)/i);
  expect((await runtime.fetch("/shop/p/prototype-rug")).status).toBe(404);
  const rug = await productBySlug(runtime, "prototype-rug");
  expect(
    (
      await checkout(runtime, {
        customer: {
          name: "A B",
          phone: "11 222 333",
          city: "Tunis",
          address: "1 Rue",
        },
        lines: [{ productId: rug.id, qty: 1 }],
      })
    ).status,
  ).toBe(409);

  // F005: tracking shows only its own order, without contact details.
  const lantern = await productBySlug(runtime, "brass-lantern");
  const a = await checkout(runtime, {
    customer: {
      name: "Hana Bouzid",
      phone: "21 444 555",
      city: "Nabeul",
      address: "9 Rue des Oliviers",
      note: "gate code 4411",
    },
    lines: [{ productId: lantern.id, qty: 1 }],
  });
  const b = await checkout(runtime, {
    customer: {
      name: "Fares Mejri",
      phone: "29 888 777",
      city: "Kairouan",
      address: "5 Rue Okba",
    },
    lines: [{ productId: lantern.id, qty: 1 }],
  });
  expect(a.status).toBe(201);
  expect(b.status).toBe(201);
  const track = await (await runtime.fetch(`/shop/t/${a.json.token}`)).text();
  expect(track).toContain("Hana");
  for (const s of [
    "Bouzid",
    "21 444 555",
    "Oliviers",
    "gate code",
    "Fares",
    `#${b.json.number}`,
    "LAN-SECRET-77",
  ])
    expect(track).not.toContain(s);
  expect(
    (await runtime.fetch(`/shop/t/${a.json.token.slice(0, -2)}xx`)).status,
  ).toBe(404);
  // Public JSON leaks nothing internal.
  expect(JSON.stringify(a.json)).not.toContain("21 444 555");

  // F001: a closed store takes no orders.
  await saveSettings(owner, {
    name: "Atlas Crafts",
    description: "Lanterns and rugs.",
    currency: "TND",
    fee: "8",
    open: false,
  });
  await expect(owner.getByText("Settings saved")).toBeVisible();
  expect(await (await runtime.fetch("/shop")).text()).toContain(
    'data-testid="store-closed"',
  );
  expect(
    (
      await checkout(runtime, {
        customer: {
          name: "A B",
          phone: "11 222 333",
          city: "Tunis",
          address: "1 Rue",
        },
        lines: [{ productId: lantern.id, qty: 1 }],
      })
    ).status,
  ).toBe(409);

  // F004: an order assigned to the owner can't be changed by another member.
  await openOrder(owner, runtime, a.json.number);
  await pick(owner, "assignee", "owner@example.test");
  await expect(tid(owner, "assignee")).toContainText("owner@example.test");
  await openOrder(memberPage, runtime, a.json.number);
  await changeStatus(memberPage, "confirmed");
  await expect(tid(memberPage, "action-error")).toBeVisible();
  expect((await orderByNumber(runtime, a.json.number)).status).toBe("pending");
  // ... nor in bulk, where it is reported as skipped.
  await memberPage.goto("/");
  await tid(memberPage, "order-row")
    .filter({ hasText: `#${a.json.number}` })
    .getByTestId("row-select")
    .click();
  await tid(memberPage, "order-row")
    .filter({ hasText: `#${b.json.number}` })
    .getByTestId("row-select")
    .click();
  await pick(memberPage, "bulk-status", "Confirmed");
  await tid(memberPage, "bulk-apply").click();
  await expect(tid(memberPage, "bulk-result")).toContainText(
    `#${a.json.number}`,
  );
  expect((await orderByNumber(runtime, a.json.number)).status).toBe("pending");
  expect((await orderByNumber(runtime, b.json.number)).status).toBe(
    "confirmed",
  );
  // The owner, an admin, can change it.
  await openOrder(owner, runtime, a.json.number);
  await changeStatus(owner, "confirmed");
  await expect(tid(owner, "order-status")).toHaveText("Confirmed");

  // Admin-only actions refuse members.
  await memberPage.goto("/settings");
  await tid(memberPage, "store-name").fill("Hijacked");
  await tid(memberPage, "save-settings").click();
  await expect(tid(memberPage, "form-error")).toBeVisible();
  expect(
    (
      await (await runtime.database())
        .prepare("select name from store_settings")
        .first()
    ).name,
  ).toBe("Atlas Crafts");

  await createProduct(owner, {
    name: "Spare Hook",
    description: "",
    price: "2",
    sku: "HK",
    stock: 4,
    status: "active",
  });
  const hook = await productBySlug(runtime, "spare-hook");
  await memberPage.goto(`/products/${hook.id}`);
  await tid(memberPage, "delete-product").click();
  await tid(memberPage, "confirm-delete").click();
  await expect(tid(memberPage, "form-error")).toBeVisible();
  expect(await productBySlug(runtime, "spare-hook")).toBeTruthy();

  // Customers: members edit, only admins delete, and only without orders.
  const db = await runtime.database();
  await db
    .prepare(
      "insert into customers (id, phone, name, city, address, notes, tags, created_at) values ('c-lead', '70111222', 'Lead Without Orders', 'Tunis', '', '', '[]', '2026-01-01T00:00:00Z')",
    )
    .run();
  await memberPage.goto("/customers/c-lead");
  await tid(memberPage, "delete-customer").click();
  await tid(memberPage, "confirm-delete").click();
  await expect(tid(memberPage, "form-error")).toBeVisible();
  expect(
    await db.prepare("select id from customers where id = 'c-lead'").first(),
  ).toBeTruthy();
  const hana = await db
    .prepare("select id from customers where name = 'Hana Bouzid'")
    .first();
  await owner.goto(`/customers/${hana.id}`);
  await tid(owner, "delete-customer").click();
  await tid(owner, "confirm-delete").click();
  await expect(tid(owner, "form-error")).toBeVisible();
  expect(
    await db
      .prepare("select id from customers where id = ?")
      .bind(hana.id)
      .first(),
  ).toBeTruthy();
  await owner.goto("/customers/c-lead");
  await tid(owner, "delete-customer").click();
  await tid(owner, "confirm-delete").click();
  await owner.waitForURL(/\/customers$/);
  expect(
    await db.prepare("select id from customers where id = 'c-lead'").first(),
  ).toBeNull();
} finally {
  await runtime.close();
}
