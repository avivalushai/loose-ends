import { clerkConfigured } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function SignInPage() {
  if (!clerkConfigured()) return <main><h1>Sign-in isn&apos;t configured yet</h1></main>;
  const { SignIn } = await import("@clerk/nextjs");
  return (
    <main>
      <h1>Sign in</h1>
      <p className="lede">With Google or GitHub. No passwords.</p>
      <SignIn routing="hash" signUpUrl="/sign-up" />
    </main>
  );
}
