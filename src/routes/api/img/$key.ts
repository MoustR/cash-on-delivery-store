import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";

// Members only: any product photo, drafts included.
export const Route = createFileRoute("/api/img/$key")({
  server: {
    handlers: {
      GET: async ({ params }: { params: { key: string } }) => {
        const object = await env.files.get(params.key);
        if (!object) return new Response("Not found", { status: 404 });
        return new Response(object.body, {
          headers: {
            "content-type":
              object.httpMetadata?.contentType ?? "application/octet-stream",
            "cache-control": "private, max-age=3600",
          },
        });
      },
    },
  },
});
