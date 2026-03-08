export type EmailTransportSource = "SMTP" | "EMAIL_SERVER" | "none";

export type EmailTransportConfig = {
  host?: string;
  port: number;
  user?: string;
  pass?: string;
  secure: boolean;
  source: EmailTransportSource;
};

export type AuthEmailProviderConfig = {
  enabled: boolean;
  server?: string;
  from: string;
  source: EmailTransportSource;
};

const DEFAULT_FROM = "ATELIER FABRICS <no-reply@upholsteryfabric.net>";

function readEnv(name: string) {
  const raw = process.env[name];
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parsePort(raw?: string, fallback = 587) {
  const parsed = raw ? Number(raw) : fallback;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function decodeUrlComponent(value: string) {
  if (!value) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseEmailServerUrl(server?: string) {
  if (!server) return null;
  try {
    const parsed = new URL(server);
    const protocol = parsed.protocol.replace(":", "").toLowerCase();
    if (protocol !== "smtp" && protocol !== "smtps") {
      return null;
    }
    const secure = protocol === "smtps";
    const port = parsePort(parsed.port, secure ? 465 : 587);
    return {
      host: parsed.hostname || undefined,
      port,
      user: decodeUrlComponent(parsed.username),
      pass: decodeUrlComponent(parsed.password),
      secure,
    };
  } catch {
    return null;
  }
}

function buildEmailServerUrl(config: EmailTransportConfig) {
  if (!config.host) return undefined;
  const protocol = config.secure ? "smtps" : "smtp";
  if (config.user) {
    const user = encodeURIComponent(config.user);
    const pass = encodeURIComponent(config.pass ?? "");
    return `${protocol}://${user}:${pass}@${config.host}:${config.port}`;
  }
  return `${protocol}://${config.host}:${config.port}`;
}

export function resolveEmailTransportConfig(): EmailTransportConfig {
  const smtpHost = readEnv("SMTP_HOST");
  const smtpPort = parsePort(readEnv("SMTP_PORT"), 587);
  const smtpUser = readEnv("SMTP_USER");
  const smtpPass = readEnv("SMTP_PASS");

  if (smtpHost) {
    return {
      host: smtpHost,
      port: smtpPort,
      user: smtpUser,
      pass: smtpPass,
      secure: smtpPort === 465,
      source: "SMTP",
    };
  }

  const fromEmailServer = parseEmailServerUrl(readEnv("EMAIL_SERVER"));
  if (fromEmailServer?.host) {
    return {
      host: fromEmailServer.host,
      port: fromEmailServer.port,
      user: fromEmailServer.user,
      pass: fromEmailServer.pass,
      secure: fromEmailServer.secure,
      source: "EMAIL_SERVER",
    };
  }

  return {
    port: 587,
    secure: false,
    source: "none",
  };
}

export function resolveEmailFromAddress() {
  return readEnv("SMTP_FROM") ?? readEnv("EMAIL_FROM") ?? DEFAULT_FROM;
}

export function resolveAuthEmailProviderConfig(): AuthEmailProviderConfig {
  const configuredServer = readEnv("EMAIL_SERVER");
  const transport = resolveEmailTransportConfig();
  const derivedServer = buildEmailServerUrl(transport);
  const server = configuredServer ?? derivedServer;
  const from = resolveEmailFromAddress();

  return {
    enabled: Boolean(server),
    server,
    from,
    source: configuredServer
      ? "EMAIL_SERVER"
      : transport.source === "none"
        ? "none"
        : transport.source,
  };
}
