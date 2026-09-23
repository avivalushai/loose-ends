import { NextResponse } from "next/server";
import { approve } from "@/lib/device";
import { currentSignedInUser } from "@/lib/auth";
import { clerkConfigured, store } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Called from /link by a signed-in user. Approving is the whole point of signing in. */
export async function POST(req: Request) {
  if (!clerkConfigured()) return NextResponse.json({ error: "sign-in isn't configured on this deployment yet" }, { status: 503 });

  const user = await currentSignedInUser();
  if (!user) return NextResponse.json({ error: "sign in first" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const code = typeof body?.code === "string" ? body.code : "";
  const decision = body?.decision === "deny" ? "deny" : "approve";
  if (!code) return NextResponse.json({ error: "code is required" }, { status: 400 });

  const s = store();
  await s.upsertUser({ id: user.id, email: user.email, name: user.name, createdAt: new Date().toISOString() });

  const res = await approve(s, code, user.id, decision);
  if (!res.ok) {
    const status = res.reason === "unknown" ? 404 : 410;
    const message = { unknown: "that code doesn't exist", expired: "that code has expired", used: "that code was already used" }[res.reason];
    return NextResponse.json({ error: message }, { status });
  }
  return NextResponse.json({ ok: true, decision });
}
