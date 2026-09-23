import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Without Clerk keys the middleware would throw on every request; the site has
// to keep working (landing, privacy, /app) before the account exists.
const configured = !!(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);

export default configured ? clerkMiddleware() : () => NextResponse.next();

export const config = {
  matcher: ["/((?!_next|app/|.*\\..*).*)", "/api/(.*)"],
};
