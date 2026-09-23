"use client";

import { useState } from "react";

type State = { kind: "idle" } | { kind: "working" } | { kind: "done"; decision: string } | { kind: "error"; message: string };

export function ApproveForm({ code, canApprove }: { code: string; canApprove: boolean }) {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function send(decision: "approve" | "deny") {
    setState({ kind: "working" });
    try {
      const res = await fetch("/api/device/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, decision }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return setState({ kind: "error", message: body.error ?? `${res.status} ${res.statusText}` });
      setState({ kind: "done", decision });
    } catch (e) {
      setState({ kind: "error", message: (e as Error).message });
    }
  }

  if (state.kind === "done")
    return state.decision === "approve" ? (
      <p className="ok">Approved — your terminal should be signed in. You can close this tab.</p>
    ) : (
      <p className="bad">Refused. Nothing was linked.</p>
    );

  return (
    <>
      <div className="row-btns">
        <button className="btn" disabled={!canApprove || state.kind === "working"} onClick={() => send("approve")}>
          {state.kind === "working" ? "Linking…" : "Approve this device"}
        </button>
        <button className="btn ghost" disabled={!canApprove || state.kind === "working"} onClick={() => send("deny")}>
          It wasn&apos;t me
        </button>
      </div>
      {state.kind === "error" && <p className="bad">{state.message}</p>}
    </>
  );
}
