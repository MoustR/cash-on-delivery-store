import { defineEveryApp } from "@every-app/sdk";

export default defineEveryApp({
  id: "cash-on-delivery-store",
  name: "Cash on Delivery Store",
  description:
    "An online store that takes cash-on-delivery orders, with stock, shipping, courier cash collection and customers in one back office.",
  icon: "/icon.svg",
  resources: {
    d1: ["DB"],
    // Product photos.
    r2: ["files"],
  },
  // The storefront: shoppers browse, order and track a parcel without an
  // account. Everything else is for members only.
  public: [
    { path: "/shop", methods: ["GET"] },
    { path: "/shop/**", methods: ["GET"] },
    { path: "/shop/api/checkout", methods: ["POST"] },
  ],
  // The built scripts and styles the storefront loads.
  publicAssets: ["/assets/**", "/icon.svg"],
});
