import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import { ConfigurationError, gatewayUrl } from "@every-app/sdk/server";

/**
 * The Gateway's origin: the way back to the other apps, and the host the
 * light/dark cookie is set on. No identity needed, so storefront pages,
 * which shoppers open without one, can load it too. Null without GATEWAY_URL.
 */
export const getGatewayUrl = createServerFn().handler(() => {
  try {
    return { gatewayUrl: new URL(gatewayUrl(env)).origin };
  } catch (error) {
    if (!(error instanceof ConfigurationError)) throw error;
    return { gatewayUrl: null };
  }
});
