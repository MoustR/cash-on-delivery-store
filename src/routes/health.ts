import { createFileRoute } from "@tanstack/react-router";

// For uptime checks with a personal access token. Private like every route
// not listed under `public`.
export const Route = createFileRoute("/health")({
  server: {
    handlers: {
      GET: () => Response.json({ ok: true }),
    },
  },
});
