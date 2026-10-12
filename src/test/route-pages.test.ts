import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "../routeTree.gen";

function lastRouteId(path: string) {
  const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
  return router.matchRoutes(path).at(-1)?.routeId;
}

describe("rotas de operação", () => {
  it("possui páginas de planos e faturas", () => {
    expect(lastRouteId("/plans")).not.toBe(rootRouteId);
    expect(lastRouteId("/invoices")).not.toBe(rootRouteId);
  });
});
