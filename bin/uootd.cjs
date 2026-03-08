#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const projectRoot = path.resolve(__dirname, "..");
const tsxCliPath = path.join(projectRoot, "node_modules", "tsx", "dist", "cli.mjs");
const cliEntry = path.join(projectRoot, "cli", "index.ts");

if (!fs.existsSync(tsxCliPath)) {
  console.error("Missing tsx runtime. Run `npm install` in the project root first.");
  process.exit(1);
}

if (!fs.existsSync(cliEntry)) {
  console.error("Missing CLI entrypoint: cli/index.ts");
  process.exit(1);
}

const result = spawnSync(process.execPath, [tsxCliPath, cliEntry, ...process.argv.slice(2)], {
  stdio: "inherit",
  cwd: projectRoot,
  env: process.env,
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
