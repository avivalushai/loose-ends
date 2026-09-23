import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy — Loose Ends" };

export default function Privacy() {
  return (
    <main>
      <h1>What we store</h1>
      <p className="lede">
        Loose Ends is a local tool with a thin account on top. Your boards, code, notes and file paths stay on your
        machine. This page is the whole list, not a summary of one.
      </p>

      <h2>On your machine only</h2>
      <table className="what">
        <tbody>
          <tr>
            <td>
              <code>.board/board.json</code> in each project
            </td>
            <td>Your cards: titles, notes, steps, files touched, activity. Never uploaded.</td>
          </tr>
          <tr>
            <td>
              <code>~/.loose-ends/projects.json</code>
            </td>
            <td>Which folders have boards. Never uploaded.</td>
          </tr>
          <tr>
            <td>
              <code>~/.loose-ends/auth.json</code>
            </td>
            <td>Your sign-in token, if you signed in.</td>
          </tr>
        </tbody>
      </table>
      <p className="note">
        The web app on this site fetches from <code>http://localhost:4747</code> — a server you start with{" "}
        <code>board ui</code>. Your board is rendered in your browser without passing through our servers.
      </p>

      <h2>On our servers</h2>
      <table className="what">
        <thead>
          <tr>
            <th>What</th>
            <th>Why</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Email, name, sign-up date</td>
            <td>So you have an account and can sign in.</td>
          </tr>
          <tr>
            <td>A device-link record while you run <code>board login</code></td>
            <td>A short code, and a hash of the token it hands your CLI. The token itself is never stored.</td>
          </tr>
          <tr>
            <td>Counts of actions</td>
            <td>
              Event names like <code>feature_added</code> or <code>status_changed</code>, with small values such as{" "}
              <code>by=claude</code> or <code>to=parked</code>, and numbers such as how many projects you have. Analytics
              are hosted in the EU.
            </td>
          </tr>
        </tbody>
      </table>

      <h2>Never</h2>
      <p>
        Card titles. Notes. Step text. File paths. Project names. Repository contents. Anything Claude wrote for you.
        These are filtered out in the CLI before anything is sent, not on our side.
      </p>

      <h2>Turning it off</h2>
      <p>
        <code>board telemetry off</code> stops all events, signed in or not. The tool keeps working; we just stop
        counting. <code>board logout</code> removes the token from your machine.
      </p>
    </main>
  );
}
