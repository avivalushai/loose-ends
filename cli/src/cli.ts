import path from "node:path";
import { parseArgs, type ParseArgsConfig } from "node:util";
import * as cmd from "./commands.js";
import { type Ctx, UserError } from "./context.js";

type OptSpec = NonNullable<ParseArgsConfig["options"]>;

const GLOBAL: OptSpec = {
  json: { type: "boolean" },
  by: { type: "string" },
  dir: { type: "string", short: "C" },
  help: { type: "boolean", short: "h" },
};
const s = { type: "string" } as const;
const many = { type: "string", multiple: true } as const;
const flag = { type: "boolean" } as const;

interface Command {
  usage: string;
  options: OptSpec;
  run: (ctx: Ctx, args: cmd.Args) => void;
}

const COMMANDS: Record<string, Command> = {
  init: { usage: `init [--name "Looper"] [--key LOOP]`, options: { name: s, key: s }, run: cmd.init },
  list: { usage: "list [--status parked[,review]] [--type bug|question] [--all]", options: { status: s, type: s, all: flag }, run: cmd.listCmd },
  show: { usage: "show LOOP-3", options: {}, run: cmd.show },
  add: {
    usage: `add "Title" [--status active] [--type bug] [--next "..."] [--step "..."]... [--done-when "..."]... [--file path]...`,
    options: { status: s, type: s, next: s, note: s, step: many, "done-when": many, file: many },
    run: cmd.add,
  },
  update: {
    usage: "update LOOP-3 [--title ...] [--note ...] [--status ...] [--type ...] [--done-when ...]... [--file path]... [--unfile path]...",
    options: { title: s, note: s, next: s, status: s, type: s, "done-when": many, file: many, unfile: many },
    run: cmd.update,
  },
  step: { usage: `step LOOP-3 "Render buffer"|2 [--done|--undone|--remove]`, options: { done: flag, undone: flag, remove: flag }, run: cmd.step },
  park: { usage: `park LOOP-3 --note "Where we stopped"`, options: { note: s }, run: cmd.park },
  review: { usage: `review LOOP-3 [--note "What to check"]`, options: { note: s }, run: cmd.review },
  done: { usage: "done LOOP-3", options: {}, run: cmd.done },
  merge: { usage: "merge LOOP-15 --into LOOP-3", options: { into: s }, run: cmd.merge },
  ask: {
    usage: `ask "Which auth provider?" [--status active] [--note "..."]`,
    options: { status: s, next: s, note: s, step: many, "done-when": many, file: many },
    run: cmd.ask,
  },
  answer: { usage: `answer LOOP-7 "What you found out" [--done]`, options: { note: s, done: flag }, run: cmd.answer },
  note: {
    usage: `note add brainstorm|plan|reference "Title" [--body ...] [--url ...] [--file ...] [--card LOOP-3]...\n         note list [--kind plan] · note show LOOP-N3 · note update LOOP-N3 ... · note link LOOP-N3 LOOP-4 · note rm LOOP-N3`,
    options: { kind: s, title: s, body: s, url: s, file: s, card: many },
    run: cmd.note,
  },
  delete: { usage: "delete LOOP-3", options: {}, run: cmd.remove },
  touch: { usage: "touch <file>... [--card LOOP-3]", options: { card: s }, run: cmd.touch },
  context: { usage: "context", options: {}, run: cmd.context },
  ui: { usage: "ui [--port 4747] [--no-open]", options: { port: s, "no-open": flag }, run: cmd.ui },
  login: { usage: "login [--no-open]", options: { "no-open": flag }, run: cmd.login },
  logout: { usage: "logout", options: {}, run: cmd.logout },
  telemetry: { usage: "telemetry [off|on|status]", options: {}, run: cmd.telemetry },
};

export function helpText(): string {
  return [
    "board — the Loose Ends feature board",
    "",
    "Usage:",
    ...Object.values(COMMANDS).map((c) => `  board ${c.usage}`),
    "",
    "Global: --json (machine output)  --by claude|user  -C, --dir <path>",
    "Cards can be referred to as LOOP-3 or just 3; notes as LOOP-N3, N3 or 3.",
  ].join("\n");
}

/** Run the CLI in-process. Returns the exit code; never calls process.exit. */
export function run(argv: string[], ctx: Ctx): number {
  const [name, ...rest] = argv;
  if (!name || name === "help" || name === "--help" || name === "-h") {
    ctx.out(helpText());
    return 0;
  }
  if (name === "--version" || name === "-v") {
    ctx.out("0.2.0");
    return 0;
  }
  const command = COMMANDS[name];
  if (!command) {
    ctx.err(`board: unknown command "${name}". Run \`board help\`.`);
    return 1;
  }

  try {
    let parsed;
    try {
      parsed = parseArgs({ args: rest, options: { ...GLOBAL, ...command.options }, allowPositionals: true, strict: true });
    } catch (e) {
      throw new UserError(`${(e as Error).message.split("\n")[0]}\nusage: board ${command.usage}`);
    }
    const opts = parsed.values as cmd.Opts;
    if (opts.help) {
      ctx.out(`usage: board ${command.usage}`);
      return 0;
    }
    const dir = typeof opts.dir === "string" ? path.resolve(ctx.cwd, opts.dir) : ctx.cwd;
    command.run({ ...ctx, cwd: dir }, { pos: parsed.positionals, opts });
    return 0;
  } catch (e) {
    if (e instanceof UserError) ctx.err(`board: ${e.message}`);
    else ctx.err(`board: unexpected error: ${(e as Error).stack ?? e}`);
    return 1;
  }
}
