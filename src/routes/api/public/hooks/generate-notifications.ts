import { createFileRoute } from "@tanstack/react-router";
import { runGenerateForUser } from "@/lib/notifications.functions";

export const Route = createFileRoute("/api/public/hooks/generate-notifications")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Valida apikey simples (anon key) para evitar abuso público
        const apiKey = request.headers.get("apikey") ?? "";
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY ?? "";
        if (!apiKey || apiKey !== expected) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Lista todos os usuários ativos (com perfil)
        const { data: profiles, error: profErr } = await supabaseAdmin
          .from("profiles")
          .select("id");

        if (profErr) {
          return new Response(JSON.stringify({ error: profErr.message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }

        let totalCreated = 0;
        let usersProcessed = 0;
        const errors: Array<{ userId: string; error: string }> = [];

        for (const p of profiles ?? []) {
          try {
            const res = await runGenerateForUser(supabaseAdmin, p.id as string, { respectSchedule: true });
            totalCreated += res.created;
            usersProcessed += 1;
          } catch (e) {
            errors.push({
              userId: p.id as string,
              error: e instanceof Error ? e.message : String(e),
            });
          }
        }

        return new Response(
          JSON.stringify({
            ok: true,
            usersProcessed,
            totalCreated,
            errors: errors.slice(0, 10),
          }),
          { headers: { "content-type": "application/json" } },
        );
      },
    },
  },
});
