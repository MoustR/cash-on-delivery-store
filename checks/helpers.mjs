// Shared steps for the suites. Selectors are the app's test IDs.
import { expect } from "/home/user/oss-new/control/runtime/index.mjs";

export const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

export const tid = (page, id) => page.getByTestId(id);

/** A page whose goto and reload wait until the app is interactive. */
export async function open(runtime, role, options) {
  const page = await (await runtime.context(role, options)).newPage();
  const hydrated = () =>
    page.waitForSelector("body[data-hydrated]", { state: "attached" });
  const goto = page.goto.bind(page);
  const reload = page.reload.bind(page);
  page.goto = async (...args) => {
    const r = await goto(...args);
    await hydrated();
    return r;
  };
  page.reload = async (...args) => {
    const r = await reload(...args);
    await hydrated();
    return r;
  };
  return page;
}

/** Picks an option in one of the app's Select menus. */
export async function pick(page, testId, optionName) {
  await tid(page, testId).click();
  await page.getByRole("option", { name: optionName, exact: true }).click();
}

export async function saveSettings(
  page,
  { name, description, currency, fee, open },
) {
  await page.goto("/settings");
  await tid(page, "store-name").fill(name);
  await tid(page, "store-description").fill(description);
  await tid(page, "store-currency").fill(currency);
  await tid(page, "store-fee").fill(fee);
  const sw = tid(page, "store-open");
  const checked = (await sw.getAttribute("aria-checked")) === "true";
  if (checked !== open) await sw.click();
  await tid(page, "save-settings").click();
}

export async function createProduct(page, p) {
  await page.goto("/products/new");
  await tid(page, "product-name").fill(p.name);
  if (p.slug) await tid(page, "product-slug").fill(p.slug);
  await tid(page, "product-description").fill(p.description ?? "");
  await tid(page, "product-price").fill(p.price);
  if (p.compare) await tid(page, "product-compare").fill(p.compare);
  await tid(page, "product-sku").fill(p.sku ?? "");
  await tid(page, "product-stock").fill(String(p.stock));
  const sw = tid(page, "product-active");
  const active = (await sw.getAttribute("aria-checked")) === "true";
  if (active !== (p.status === "active")) await sw.click();
  if (p.image) {
    await tid(page, "product-image").setInputFiles({
      name: "photo.png",
      mimeType: "image/png",
      buffer: PNG,
    });
  }
  await Promise.all([
    page.waitForURL(/\/products(\?.*)?$/),
    tid(page, "save-product").click(),
  ]);
  await tid(page, "new-product").waitFor();
}

export async function productBySlug(runtime, slug) {
  return (await runtime.database())
    .prepare("select * from products where slug = ?")
    .bind(slug)
    .first();
}

export async function orderByNumber(runtime, number) {
  return (await runtime.database())
    .prepare("select * from orders where number = ?")
    .bind(number)
    .first();
}

export async function checkout(runtime, body) {
  const res = await runtime.fetch("/shop/api/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {}
  return { status: res.status, json };
}

export async function openOrder(page, runtime, number) {
  const order = await orderByNumber(runtime, number);
  expect(order, `order #${number} exists`).toBeTruthy();
  await page.goto(`/orders/${order.id}`);
  await expect(tid(page, "order-title")).toContainText(`#${number}`);
  return order;
}

/** Runs a status action from the order page; courier fields for shipping. */
export async function changeStatus(page, to, { courier, tracking, note } = {}) {
  await tid(page, `action-${to}`).click();
  if (courier !== undefined) await tid(page, "courier").fill(courier);
  if (tracking) await tid(page, "tracking-number").fill(tracking);
  if (note) await tid(page, "status-note").fill(note);
  await tid(page, "status-submit").click();
}
