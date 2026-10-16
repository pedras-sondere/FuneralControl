import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        const { q } = await import("@/lib/db.server");
        const { APP_VERSION } = await import("@/lib/app-version");
        const { CURRENT_SCHEMA_VERSION } = await import("@/lib/schema-version");
        const { buildHealthPayload } = await import("@/lib/runtime-health.server");
        await q("SELECT 1");
        return Response.json(
          buildHealthPayload({ version: APP_VERSION, schemaVersion: CURRENT_SCHEMA_VERSION }),
          {
            headers: { "cache-control": "no-store" },
          },
        );
      },
    },
  },
});
