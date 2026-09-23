import { NextResponse } from "next/server";
import { start } from "@/lib/device";
import { SITE_URL, store } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The CLI asks for a code. No auth: a pending code is worth nothing on its own. */
export async function POST() {
  try {
    return NextResponse.json(await start(store(), SITE_URL));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
