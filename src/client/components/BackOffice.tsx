import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { AppShell } from "@/client/components/AppShell";

const LINKS = [
  { to: "/", label: "Orders" },
  { to: "/products", label: "Products" },
  { to: "/customers", label: "Customers" },
  { to: "/collections", label: "Collections" },
  { to: "/settings", label: "Settings" },
] as const;

const LINK =
  "shrink-0 text-sm text-muted-foreground transition-colors hover:text-foreground data-[status=active]:font-medium data-[status=active]:text-foreground";

/** AppShell with the back office's sections in its bar. */
export function BackOffice({ children }: { children: ReactNode }) {
  return (
    <AppShell
      nav={
        <nav className="flex items-center gap-4">
          {LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={LINK}
              activeOptions={{ exact: link.to === "/" }}
            >
              {link.label}
            </Link>
          ))}
          <a href="/shop" className={LINK}>
            Storefront
          </a>
        </nav>
      }
    >
      {children}
    </AppShell>
  );
}
