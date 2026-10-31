import { createSupabaseServerClient } from "../../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const headers = { "Cache-Control": "no-store" };

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLISHABLE_KEY) {
    return Response.json(
      { ok: false, message: "Supabase environment variables are not configured." },
      { status: 503, headers },
    );
  }

  try {
    const supabase = createSupabaseServerClient();
    // Exercise the real RPC and its anonymous permissions without exposing ideas.
    const { error } = await supabase.rpc("list_ideas").limit(1);
    if (error) {
      return Response.json(
        { ok: false, message: "Supabase connection check failed. Check the project URL, publishable key, schema, and network access." },
        { status: 503, headers },
      );
    }
    return Response.json({ ok: true, message: "Supabase connection verified." }, { headers });
  } catch {
    return Response.json(
      { ok: false, message: "Supabase connection check failed. Check server configuration and network access." },
      { status: 503, headers },
    );
  }
}
