#!/usr/bin/env node
// One UI, two homes: `board ui` serves ui/index.html, the site serves a copy at /app.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const from = path.join(repo, "ui/index.html");
const to = path.join(repo, "site/public/app/index.html");
fs.mkdirSync(path.dirname(to), { recursive: true });
fs.copyFileSync(from, to);
console.log(`ui/index.html → site/public/app/index.html (${fs.statSync(to).size} bytes)`);
