import { createFileRoute } from "@tanstack/react-router";
import { requireEveryAppUser } from "@every-app/sdk/server";
import { env } from "cloudflare:workers";

const TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_BYTES = 5 * 1024 * 1024;

// Members only: uploads a product photo to R2 and answers with its key.
export const Route = createFileRoute("/api/images")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        await requireEveryAppUser(request, env);
        const type = request.headers.get("content-type") ?? "";
        if (!TYPES.includes(type))
          return Response.json(
            { error: "Use a PNG, JPEG, WebP or GIF image." },
            { status: 415 },
          );
        const body = await request.arrayBuffer();
        if (body.byteLength === 0 || body.byteLength > MAX_BYTES)
          return Response.json(
            { error: "Images can be up to 5 MB." },
            { status: 413 },
          );
        const key = crypto.randomUUID();
        await env.files.put(key, body, { httpMetadata: { contentType: type } });
        return Response.json({ key }, { status: 201 });
      },
    },
  },
});
