import { NextResponse } from "next/server";
import { poll } from "@/lib/device";
import { store } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The CLI polls with its secret device code and gets the token once. */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const deviceCode = typeof body?.deviceCode === "string" ? body.deviceCode : "";
    if (!deviceCode) return NextResponse.json({ error: "deviceCode is required" }, { status: 400 });
    return NextResponse.json(await poll(store(), deviceCode));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
