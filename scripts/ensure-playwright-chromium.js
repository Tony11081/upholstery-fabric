/* eslint-disable no-console */
/**
 * Dokploy/Nixpacks builds sometimes skip Playwright browser downloads.
 * Inflyway token auto-refresh relies on Playwright, so ensure Chromium exists.
 *
 * This runs on Linux only to avoid surprising local macOS dev installs.
 * If install fails, we log a warning but do NOT fail the build.
 */
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("child_process");

function parseNumericSuffix(value, prefix) {
  const match = value.match(new RegExp(`^${prefix}(\\d+)$`));
  if (!match || !match[1]) return null;
  const numeric = Number(match[1]);
  return Number.isFinite(numeric) ? numeric : null;
}

function resolveLocalBrowserRoot() {
  const configuredPath = (process.env.PLAYWRIGHT_BROWSERS_PATH || "").trim();
  if (!configuredPath || configuredPath === "0") {
    return path.join(process.cwd(), "node_modules", "playwright-core", ".local-browsers");
  }
  if (path.isAbsolute(configuredPath)) return configuredPath;
  return path.join(process.cwd(), configuredPath);
}

function findExecutable(prefix, subpaths) {
  const root = resolveLocalBrowserRoot();
  if (!fs.existsSync(root)) return "";

  const entries = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  const candidates = entries
    .map((name) => ({ name, version: parseNumericSuffix(name, prefix) }))
    .filter((item) => item.version != null)
    .sort((a, b) => b.version - a.version);

  for (const candidate of candidates) {
    for (const subpath of subpaths) {
      const executablePath = path.join(root, candidate.name, subpath);
      if (fs.existsSync(executablePath)) return executablePath;
    }
  }

  return "";
}

function detectExecutable() {
  return (
    findExecutable("chromium-", [path.join("chrome-linux64", "chrome"), path.join("chrome-linux", "chrome")]) ||
    findExecutable("chromium_headless_shell-", [
      path.join("chrome-headless-shell-linux64", "chrome-headless-shell"),
      path.join("chrome-headless-shell-linux", "chrome-headless-shell"),
    ])
  );
}

function run() {
  if (process.platform !== "linux") {
    console.log(`[playwright] skip browser install (platform=${process.platform})`);
    return;
  }

  const env = { ...process.env };
  // Make the browser location independent of the runtime user. This avoids
  // situations where build-time installs land under a different $HOME.
  env.PLAYWRIGHT_BROWSERS_PATH = "0";
  delete env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD;

  const existingExecutable = detectExecutable();
  if (existingExecutable) {
    console.log(`[playwright] browser already available: ${existingExecutable}`);
    return;
  }

  console.log("[playwright] ensuring Playwright Chromium is installed...");
  const playwrightCli = path.join(process.cwd(), "node_modules", "playwright", "cli.js");
  const hasPlaywrightCli = fs.existsSync(playwrightCli);
  const candidates = [
    ...(hasPlaywrightCli
      ? [
          {
            command: "node",
            args: [playwrightCli, "install", "--with-deps", "chromium", "--force"],
            shell: false,
          },
        ]
      : []),
    {
      command: "npx",
      args: ["playwright", "install", "--with-deps", "chromium", "--force"],
      shell: true,
    },
    ...(hasPlaywrightCli
      ? [
          {
            command: "node",
            args: [playwrightCli, "install", "chromium", "--force"],
            shell: false,
          },
        ]
      : []),
    {
      args: ["playwright", "install", "chromium", "--force"],
      command: "npx",
      shell: true,
    },
    ...(hasPlaywrightCli
      ? [
          {
            command: "node",
            args: [playwrightCli, "install", "chromium-headless-shell", "--force"],
            shell: false,
          },
        ]
      : []),
    { command: "npx", args: ["playwright", "install", "chromium-headless-shell", "--force"], shell: true },
    ...(hasPlaywrightCli
      ? [
          {
            command: "node",
            args: [playwrightCli, "install", "chromium", "--force"],
            shell: false,
          },
        ]
      : []),
  ];

  for (const candidate of candidates) {
    const result = spawnSync(candidate.command, candidate.args, {
      stdio: "inherit",
      env,
      shell: candidate.shell,
    });
    if (result.status === 0) {
      const installedExecutable = detectExecutable();
      if (installedExecutable) {
        console.log(`[playwright] browser install verified: ${installedExecutable}`);
        return;
      }
    }
  }

  {
    console.warn(
      "[playwright] Chromium/deps install failed. Token auto-refresh may be degraded. Try: PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install --with-deps chromium --force (or install missing shared libs like libglib2.0-0)."
    );
  }
}

run();
