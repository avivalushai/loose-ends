import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const html = fs.readFileSync(path.join(repo, "ui/index.html"), "utf8");
const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? "";

describe("the bundled UI", () => {
  it("is one self-contained page with valid script", () => {
    expect(html).toContain("<title>Loose Ends");
    expect(script.length).toBeGreaterThan(10_000);
    expect(() => new vm.Script(script)).not.toThrow();
    // no build step, no CDN: the server serves this file as-is
    expect(html).not.toMatch(/<script[^>]+src=/);
    expect(html).not.toMatch(/https?:\/\/(cdn|unpkg|jsdelivr)/);
  });

  it("keeps board data in the API and only view prefs in the browser", () => {
    expect(script).toContain("/api/projects");
    expect(script).toContain("/api/events");
    for (const write of script.match(/localStorage\.\w+\([^)]*\)/g) ?? []) expect(write).toContain("prefs");
    expect(script).not.toContain("function sample(");
  });

  it("writes every change through the API, never straight to state", () => {
    for (const call of ["method:'POST'", "method:'PATCH'", "method:'DELETE'"]) expect(script).toContain(call);
    expect(script).toContain("EventSource");
  });

  it("explains itself when the local server isn't running", () => {
    expect(script).toContain("No local server");
    expect(script).toContain("board ui");
  });

  it("keeps ideas out of the progress figure and collapsed by default", () => {
    // A brainstorm should never make the project look like it went backwards.
    expect(script).toContain("const committed=fs=>fs.filter(f=>f.status!=='idea')");
    expect(script).toContain("collapsed:['idea']");
    expect(script).toContain("data-grp=");
  });

  it("opens a card on a row click, without stealing clicks meant for editing", () => {
    expect(script).toContain("addEventListener('click'");
    expect(script).toContain("if(e.target.closest('input,select,button,textarea,label,a')) return;");
    expect(script).not.toContain("addEventListener('dblclick'");
  });

  it("shows the note as text, with a pencil to edit it", () => {
    expect(script).toContain('data-editnote=');
    expect(script).toContain("editingNote===f.id");
    // a re-render leaves the field unfocused, so a click outside has to close it too
    expect(script).toContain("addEventListener('mousedown'");
    expect(script).toContain("if(editingNote){");
  });

  it("tells the user how to add a project instead of faking one", () => {
    expect(script).toContain("board init");
    expect(script).not.toContain("S.projects.push(");
  });
});
