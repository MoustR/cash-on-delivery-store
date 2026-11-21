import tanstackEntry from "@tanstack/react-start/server-entry";
import { everyApp } from "@every-app/sdk/server";

// everyApp() verifies the identity the Gateway sent before any request reaches
// the app (a request from anywhere else is a 401). On the storefront's public
// routes an anonymous shopper gets through with no identity.
export default everyApp<Env>(async (request) => tanstackEntry.fetch(request));
