import { clerkConfigured } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function SignUpPage() {
  if (!clerkConfigured()) return <main><h1>Sign-up isn&apos;t configured yet</h1></main>;
  const { SignUp } = await import("@clerk/nextjs");
  return (
    <main>
      <h1>Create your account</h1>
      <p className="lede">With Google or GitHub. No passwords, and no access to your boards.</p>
      <SignUp routing="hash" signInUrl="/sign-in" />
    </main>
  );
}
