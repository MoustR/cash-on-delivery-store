import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { isPublicImage } from "@/server/storefront";

// Public: photos of products the storefront shows, and no others.
export const Route = createFileRoute("/shop/img/$key")({
  server: {
    handlers: {
      GET: async ({ params }: { params: { key: string } }) => {
        if (!(await isPublicImage(params.key)))
          return new Response("Not found", { status: 404 });
        const object = await env.files.get(params.key);
        if (!object) return new Response("Not found", { status: 404 });
        return new Response(object.body, {
          headers: {
            "content-type":
              object.httpMetadata?.contentType ?? "application/octet-stream",
            "cache-control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
