#!/usr/bin/env node
import { run } from "./cli.js";

process.exitCode = run(process.argv.slice(2), {
  cwd: process.cwd(),
  env: process.env,
  out: (l) => process.stdout.write(l + "\n"),
  err: (l) => process.stderr.write(l + "\n"),
});
