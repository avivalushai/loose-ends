// Clerk, but only when it's configured. Without keys the site still runs —
// sign-in simply refuses, and never falls back to letting someone through.

import { clerkConfigured } from "./site.js";

export interface SignedInUser {
  id: string;
  email?: string;
  name?: string;
}

export async function currentSignedInUser(): Promise<SignedInUser | null> {
  if (!clerkConfigured()) return null;
  const { currentUser } = await import("@clerk/nextjs/server");
  const u = await currentUser();
  if (!u) return null;
  return {
    id: u.id,
    email: u.primaryEmailAddress?.emailAddress ?? u.emailAddresses[0]?.emailAddress,
    name: [u.firstName, u.lastName].filter(Boolean).join(" ") || undefined,
  };
}
