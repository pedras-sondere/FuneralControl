import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/contracts/$id")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const { getSessionUser } = await import("@/lib/auth.server");
        const user = await getSessionUser();
        if (!user) return new Response("Não autorizado", { status: 401 });
        const { q } = await import("@/lib/db.server");
        const rows = await q("SELECT file_name, stored_name, mime_type FROM contracts WHERE id = $1", [
          Number(params.id),
        ]);
        const c = rows[0];
        if (!c) return new Response("Não encontrado", { status: 404 });
        const { readStoredFile } = await import("@/lib/storage.server");
        const buf = await readStoredFile(c.stored_name);
        const download = new URL(request.url).searchParams.has("download");
        return new Response(new Uint8Array(buf), {
          headers: {
            "content-type": c.mime_type,
            "cache-control": "private, no-store",
            "content-disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(c.file_name)}`,
          },
        });
      },
    },
  },
});
