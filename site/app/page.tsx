import Link from "next/link";
import { CopyButton } from "./copy-button";
import { INSTALL_STEPS } from "@/lib/site";

export default function Home() {
  return (
    <main>
      <h1>The board Claude keeps while you build.</h1>
      <p className="lede">
        Every project gets a board. Claude writes to it as you work — so you always know what&apos;s in progress, what you
        left halfway, and what&apos;s done. You never have to remember to update it.
      </p>

      <div className="demo" aria-label="What a board looks like">
        <div className="row parked">
          <span className="k">LOOP-3</span>
          <span>
            <span className="t">Save loops to library</span>
            <div className="n">Stopped: IndexedDB schema drafted, Save button not wired yet</div>
          </span>
          <span className="pill parked">Parked</span>
        </div>
        <div className="row">
          <span className="k">LOOP-8</span>
          <span>
            <span className="t">Drum row recording</span>
            <div className="n">Next: quantize hits to the grid when recording stops</div>
          </span>
          <span className="pill active">In progress</span>
        </div>
      </div>

      <h2>Install</h2>
      <ol className="steps">
        {INSTALL_STEPS.map((step, i) => (
          <li className="step" key={step}>
            <span className="n">{i + 1}</span>
            <code>{step}</code>
            <CopyButton text={step} />
          </li>
        ))}
      </ol>
      <p className="note" style={{ marginTop: 10 }}>
        Run the first two in Claude Code, then restart it. The third one is optional — everything works signed out.
      </p>

      <h2>Where your work lives</h2>
      <div className="promise">
        <b>Your code and plans never leave your machine.</b>
        Each board is a file in its own repo (<code>.board/board.json</code>). The web app on this site reads it straight
        from a small server running on your laptop — the data never touches ours.
      </div>
      <p>
        We keep an account (your email and name) and counts of which actions happen. Never titles, notes, file paths or
        project names. <Link href="/privacy">The exact list</Link>.
      </p>

      <h2>What it does for you</h2>
      <table className="what">
        <tbody>
          <tr>
            <td>
              <b>Nothing to maintain</b>
            </td>
            <td>Claude opens, updates and closes cards as it works. You write code; the board follows.</td>
          </tr>
          <tr>
            <td>
              <b>Parked work stays findable</b>
            </td>
            <td>Anything left halfway gets a note saying exactly where you stopped — so picking it up weeks later is cheap.</td>
          </tr>
          <tr>
            <td>
              <b>All your projects at once</b>
            </td>
            <td>One view across every repo with a board, so the thing you forgot isn&apos;t hiding in a folder you haven&apos;t opened.</td>
          </tr>
          <tr>
            <td>
              <b>Never closed on a guess</b>
            </td>
            <td>Claude can move a card to Review. Done needs your word, a merge, or a deploy.</td>
          </tr>
        </tbody>
      </table>

      <div className="row-btns">
        <Link className="btn" href="/app">
          Open my board
        </Link>
        <Link className="btn ghost" href="/privacy">
          Read the privacy promise
        </Link>
      </div>
    </main>
  );
}
