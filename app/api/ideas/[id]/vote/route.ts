import { isSameOrigin } from "../../../../../lib/same-origin";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "../../../../../lib/supabase/server";
import { UUID_PATTERN } from "../../../../../lib/ideas";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) {
    return Response.json({ message: "Please vote from this website." }, { status: 403 });
  }
  const { id } = await context.params;
  if (!UUID_PATTERN.test(id)) {
    return Response.json({ message: "Invalid idea." }, { status: 400 });
  }
  const jar = await cookies();
  const existing = jar.get("idea_board_voter")?.value;
  const voterId = existing && UUID_PATTERN.test(existing) ? existing : crypto.randomUUID();
  // Set even on a transient database error, so retries keep the same identity.
  jar.set("idea_board_voter", voterId, {
    httpOnly: true, sameSite: "lax", secure: new URL(request.url).protocol === "https:",
    path: "/", maxAge: 60 * 60 * 24 * 365,
  });
  try {
    const { data, error } = await createSupabaseServerClient().rpc("cast_vote", {
      p_idea_id: id, p_voter_id: voterId,
    });
    if (error?.code === "23503") {
      return Response.json({ message: "This idea no longer exists. Refresh the board." }, { status: 404 });
    }
    if (error || typeof data !== "boolean") throw error ?? new Error("Invalid vote result");
    return Response.json({ voted: true, duplicate: !data }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ message: "We couldn’t confirm your vote. Please try again; duplicate votes won’t be counted." }, { status: 503 });
  }
}
