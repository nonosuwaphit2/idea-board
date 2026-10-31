import { isSameOrigin } from "../../../lib/same-origin";
import { cookies } from "next/headers";
import { UUID_PATTERN } from "../../../lib/ideas";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const jar = await cookies();
  if (!UUID_PATTERN.test(jar.get("idea_board_voter")?.value ?? "")) {
    jar.set("idea_board_voter", crypto.randomUUID(), {
      httpOnly: true, sameSite: "lax", secure: new URL(request.url).protocol === "https:",
      path: "/", maxAge: 60 * 60 * 24 * 365,
    });
  }
  try {
    const { data, error } = await createSupabaseServerClient().rpc("list_ideas");
    if (error) throw error;
    return Response.json({ ideas: data ?? [] }, { headers });
  } catch {
    return Response.json({ message: "We couldn’t load ideas. Please try again." }, { status: 503, headers });
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json({ message: "Please submit from this website." }, { status: 403 });
  }
  let body;
  try { body = await request.json(); } catch {
    return Response.json({ message: "Invalid request." }, { status: 400 });
  }
  const fields = ["title", "description", "author_nickname"] as const;
  const limits = [120, 2000, 50];
  const values: string[] = [];
  for (let i = 0; i < fields.length; i++) {
    const value = body?.[fields[i]];
    if (typeof value !== "string" || !value.trim() || [...value.trim()].length > limits[i]) {
      return Response.json({ message: "Enter a title (1–120 characters), description (1–2000), and nickname (1–50)." }, { status: 400 });
    }
    values.push(value.trim());
  }
  try {
    const { data, error } = await createSupabaseServerClient().rpc("submit_idea", {
      p_title: values[0], p_description: values[1], p_author_nickname: values[2],
    });
    if (error) throw error;
    return Response.json({ id: data }, { status: 201, headers });
  } catch {
    return Response.json({ message: "We couldn’t confirm your submission. Refresh the board before trying again to avoid posting twice." }, { status: 503, headers });
  }
}
