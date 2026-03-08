/* eslint-disable no-console */
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

function resolveLocalBrowserRoot() {
  const configuredPath = (process.env.PLAYWRIGHT_BROWSERS_PATH || "").trim();
  if (!configuredPath || configuredPath === "0") {
    return path.join(process.cwd(), "node_modules", "playwright-core", ".local-browsers");
  }
  if (path.isAbsolute(configuredPath)) return configuredPath;
  return path.join(process.cwd(), configuredPath);
}

function parseNumericSuffix(value, prefix) {
  const match = value.match(new RegExp(`^${prefix}(\\d+)$`));
  if (!match || !match[1]) return null;
  const numeric = Number(match[1]);
  return Number.isFinite(numeric) ? numeric : null;
}

function findLocalChromiumExecutable() {
  const root = resolveLocalBrowserRoot();
  if (!fs.existsSync(root)) return "";

  const entries = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  const candidates = entries
    .map((name) => ({ name, version: parseNumericSuffix(name, "chromium-") }))
    .filter((item) => item.version != null)
    .sort((a, b) => b.version - a.version);

  const subpaths = [
    path.join("chrome-linux64", "chrome"),
    path.join("chrome-linux", "chrome"),
  ];

  for (const candidate of candidates) {
    for (const subpath of subpaths) {
      const executablePath = path.join(root, candidate.name, subpath);
      if (fs.existsSync(executablePath)) return executablePath;
    }
  }

  return "";
}

function findLocalHeadlessShellExecutable() {
  const root = resolveLocalBrowserRoot();
  if (!fs.existsSync(root)) return "";

  const entries = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  const candidates = entries
    .map((name) => ({ name, version: parseNumericSuffix(name, "chromium_headless_shell-") }))
    .filter((item) => item.version != null)
    .sort((a, b) => b.version - a.version);

  const subpaths = [
    path.join("chrome-headless-shell-linux64", "chrome-headless-shell"),
    path.join("chrome-headless-shell-linux", "chrome-headless-shell"),
  ];

  for (const candidate of candidates) {
    for (const subpath of subpaths) {
      const executablePath = path.join(root, candidate.name, subpath);
      if (fs.existsSync(executablePath)) return executablePath;
    }
  }

  return "";
}

function resolveConfiguredExecutable() {
  const configuredPath = (process.env.INFLYWAY_PLAYWRIGHT_EXECUTABLE_PATH || "").trim();
  if (!configuredPath) return "";
  if (fs.existsSync(configuredPath)) return configuredPath;
  console.warn(
    `[playwright][bootstrap] INFLYWAY_PLAYWRIGHT_EXECUTABLE_PATH not found, ignoring: ${configuredPath}`
  );
  return "";
}

function resolvePlaywrightExecutable() {
  try {
    const playwright = require("playwright");
    const executablePath = playwright?.chromium?.executablePath?.();
    if (typeof executablePath === "string" && executablePath && fs.existsSync(executablePath)) {
      return executablePath;
    }
    return "";
  } catch {
    return "";
  }
}

function detectExecutable() {
  return (
    resolveConfiguredExecutable() ||
    findLocalChromiumExecutable() ||
    findLocalHeadlessShellExecutable() ||
    resolvePlaywrightExecutable()
  );
}

function runInstallAttempt(command, args, env, shell) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env,
    shell,
  });
  return result.status === 0;
}

function ensureChromiumInstalled() {
  const env = { ...process.env, PLAYWRIGHT_BROWSERS_PATH: "0" };
  delete env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD;
  const playwrightCli = path.join(process.cwd(), "node_modules", "playwright", "cli.js");
  const hasPlaywrightCli = fs.existsSync(playwrightCli);

  const installAttempts = [
    ...(hasPlaywrightCli
      ? [{ command: "node", args: [playwrightCli, "install", "chromium", "--force"], shell: false }]
      : []),
    {
      command: "npx",
      args: ["playwright", "install", "chromium", "--force"],
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
    {
      command: "npx",
      args: ["playwright", "install", "chromium-headless-shell", "--force"],
      shell: true,
    },
  ];

  for (const attempt of installAttempts) {
    const ok = runInstallAttempt(attempt.command, attempt.args, env, attempt.shell);
    if (!ok) continue;
    const executable = detectExecutable();
    if (executable) return executable;
  }

  return "";
}

function run() {
  if (process.platform !== "linux") {
    console.log(`[playwright][bootstrap] skip (platform=${process.platform})`);
    return;
  }

  if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
    process.env.PLAYWRIGHT_BROWSERS_PATH = "0";
  }
  delete process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD;

  const executable = detectExecutable();
  if (executable) {
    console.log(`[playwright][bootstrap] ready: ${executable}`);
    return;
  }

  console.warn("[playwright][bootstrap] Chromium missing, attempting auto-repair...");
  const installedExecutable = ensureChromiumInstalled();
  if (installedExecutable) {
    console.log(`[playwright][bootstrap] repaired: ${installedExecutable}`);
    return;
  }

  console.warn(
    "[playwright][bootstrap] repair failed. Token auto-refresh may be degraded; run `PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install chromium --force` inside container."
  );
}

run();
