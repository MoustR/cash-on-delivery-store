# Cash on Delivery Store

An online store that takes cash-on-delivery orders, with a back office for stock, the order pipeline, courier cash collection and customers.

Inspired by https://dash.tiktak.space

Built with [oss.new](https://oss.new) for [EveryApp](https://github.com/every-app/every-app).

## Features

- Set the store's name, description, currency, delivery fee and open/closed state, and share a public catalogue at `/shop`.
- Add, edit, search and filter products with photos, compare-at prices, SKUs and stock that never goes negative.
- Let shoppers order with cash on delivery from a cart, or enter an order by hand, with server-side pricing and stock checks.
- Move orders through pending, confirmed, shipped, delivered and paid, cancel or return them, assign them, and change many at once.
- Ship with a courier and tracking number and give the customer a private tracking page.
- See the cash each courier owes for delivered orders, mark it received, and review collections and paid totals by date.
- Keep customers by phone with notes, tags, order history and total spent.

Left out: accounts and sign-in, which your Gateway handles; mobile apps; custom domains and multiple stores; the theme builder; marketing tools; carrier integrations; card payments; phone and messaging integrations; warehouses, POS and invoicing; analytics and returns workflows.

## Setup

```sh
pnpm install
pnpm dev                                  # local, behind the dev Gateway
pnpm test                                 # unit tests
pnpm run deploy                           # to your Cloudflare account
```

There are no secrets or settings to fill in. The app uses one D1 database and one R2 bucket for product photos; R2 must be enabled on the Cloudflare account once. After deploying, an admin opens Settings, names the store and switches it open.

The browser checks in `checks/` run against a packaged release in oss.new's local runtime; a real Cloudflare deploy isn't part of them.

## Limitations

- Prices are stored to three decimals and shown with the currency's usual decimals.
- The storefront has one fixed layout and no theming.
- Couriers and tracking numbers are typed by hand; nothing is sent to a courier or to customers.
- Members can change only unassigned orders or their own; admins can change any order.
