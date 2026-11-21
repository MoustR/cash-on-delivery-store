import { createFileRoute } from "@tanstack/react-router";
import { ZodError } from "zod";
import { AppError } from "@/server/actor";
import { newOrderInput, placeOrder } from "@/server/orders";

// Public (everyapp.config.ts): shoppers place cash-on-delivery orders without
// an account. Only product ids and quantities are read from the cart; prices,
// stock and the delivery fee come from the database.
export const Route = createFileRoute("/shop/api/checkout")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json(
            { error: "Send the order as JSON." },
            { status: 400 },
          );
        }
        const parsed = newOrderInput.safeParse(body);
        if (!parsed.success)
          return Response.json(
            { error: parsed.error.issues[0]?.message ?? "Check the form." },
            { status: 400 },
          );
        try {
          const order = await placeOrder(parsed.data, null);
          const trackingUrl = new URL(`/shop/t/${order.token}`, request.url)
            .href;
          return Response.json(
            { number: order.number, token: order.token, trackingUrl },
            { status: 201 },
          );
        } catch (error) {
          if (error instanceof AppError)
            return Response.json(
              { error: error.message },
              { status: error.status },
            );
          if (error instanceof ZodError)
            return Response.json({ error: "Check the form." }, { status: 400 });
          throw error;
        }
      },
    },
  },
});
