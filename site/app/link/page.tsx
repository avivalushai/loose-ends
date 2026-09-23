import type { Metadata } from "next";
import { currentSignedInUser } from "@/lib/auth";
import { clerkConfigured } from "@/lib/site";
import { ApproveForm } from "./approve-form";

export const metadata: Metadata = { title: "Link your terminal — Loose Ends" };
export const dynamic = "force-dynamic";

export default async function LinkPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code = "" } = await searchParams;
  const user = await currentSignedInUser();
  const configured = clerkConfigured();

  return (
    <main>
      <h1>Link your terminal</h1>
      {code ? (
        <>
          <p className="lede">Check this matches the code your terminal is showing, then approve it.</p>
          <p className="code-big">{code.toUpperCase()}</p>
        </>
      ) : (
        <p className="lede">
          Run <code>board login</code> in your terminal — it opens this page with your code filled in.
        </p>
      )}

      {!configured ? (
        <p className="bad">Sign-in isn&apos;t configured on this deployment yet.</p>
      ) : !user ? (
        <p>
          <a className="btn" href={`/sign-in?redirect_url=${encodeURIComponent(`/link?code=${code}`)}`}>
            Sign in to approve
          </a>
        </p>
      ) : (
        <>
          <p className="note">Signed in as {user.email ?? user.id}.</p>
          <ApproveForm code={code} canApprove={!!code} />
        </>
      )}

      <p className="note" style={{ marginTop: 24 }}>
        Approving links this computer to your account so usage counts can be attributed to you. It gives us no access to
        your boards — those never leave your machine.
      </p>
    </main>
  );
}
