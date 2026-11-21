import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";
import {
  themePreferenceInitScript,
  useThemePreference,
} from "@/client/lib/theme";
import appCss from "@/client/styles/app.css?url";
import { getGatewayUrl } from "@/serverFunctions/gateway";

export const Route = createRootRoute({
  // Where the Gateway is: the way back to it (AppShell), and the theme pick
  // the app shares with the launcher and every other app.
  loader: () => getGatewayUrl(),
  staleTime: Infinity,
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/icon.svg", type: "image/svg+xml" },
    ],
  }),
  shellComponent: RootDocument,
  notFoundComponent: NotFound,
});

function NotFound() {
  return (
    <main className="mx-auto max-w-md space-y-2 px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Not found</h1>
      <p className="text-sm text-muted-foreground">
        This page doesn't exist or is no longer available.
      </p>
    </main>
  );
}

/** Toasts ("Copied") in the app's theme. */
function ThemedToaster() {
  const { themePreference } = useThemePreference();
  return <Toaster theme={themePreference} position="bottom-right" />;
}

function RootDocument({ children }: { children: ReactNode }) {
  // Marks the page interactive, for the app's browser checks.
  useEffect(() => {
    document.body.dataset.hydrated = "true";
  }, []);
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Sets the theme before the first paint: dark never flashes light. */}
        <script
          dangerouslySetInnerHTML={{ __html: themePreferenceInitScript }}
        />
        <HeadContent />
      </head>
      <body>
        {children}
        <ThemedToaster />
        <Scripts />
      </body>
    </html>
  );
}
