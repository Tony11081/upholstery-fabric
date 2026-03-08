import nodemailer from "nodemailer";
import { resolveEmailFromAddress, resolveEmailTransportConfig, type EmailTransportSource } from "@/lib/utils/email-config";

type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

type EmailConfig = {
  host?: string;
  port: number;
  user?: string;
  pass?: string;
  from?: string;
  supportEmail?: string;
  isProduction: boolean;
  secure: boolean;
  source: EmailTransportSource;
};

export type EmailHealthStatus = {
  configured: boolean;
  canSend: boolean;
  verified: boolean;
  missing: string[];
  host?: string;
  port: number;
  secure: boolean;
  from?: string;
  supportEmail?: string;
  isProduction: boolean;
  source: EmailTransportSource;
  verifyDurationMs?: number;
  verifyError?: string;
};

function resolveEmailConfig(): EmailConfig {
  const transport = resolveEmailTransportConfig();
  const isProduction = process.env.NODE_ENV === "production";

  return {
    host: transport.host,
    port: transport.port,
    user: transport.user,
    pass: transport.pass,
    secure: transport.secure,
    source: transport.source,
    from: resolveEmailFromAddress(),
    supportEmail: process.env.SUPPORT_EMAIL,
    isProduction,
  };
}

function getMissingConfig(config: EmailConfig) {
  const missing: string[] = [];
  if (!config.host) missing.push("SMTP_HOST or EMAIL_SERVER");
  if (!config.from) missing.push("SMTP_FROM or EMAIL_FROM");
  if (config.isProduction && !config.user) {
    missing.push("SMTP_USER or EMAIL_SERVER credentials");
  }
  return missing;
}

function createTransport(config: EmailConfig) {
  return nodemailer.createTransport({
    host: config.host ?? "localhost",
    port: config.port,
    secure: config.secure,
    auth: config.user
      ? {
          user: config.user,
          pass: config.pass,
        }
      : undefined,
  });
}

function getTransport(config: EmailConfig) {
  const missing = getMissingConfig(config);
  if (missing.length > 0) {
    throw new Error(`Email configuration is missing: ${missing.join(", ")}`);
  }
  return createTransport(config);
}

export async function getEmailHealthStatus(): Promise<EmailHealthStatus> {
  const config = resolveEmailConfig();
  const missing = getMissingConfig(config);

  if (missing.length > 0) {
    return {
      configured: false,
      canSend: false,
      verified: false,
      missing,
      host: config.host,
      port: config.port,
      secure: config.secure,
      from: config.from,
      supportEmail: config.supportEmail,
      isProduction: config.isProduction,
      source: config.source,
    };
  }

  const transporter = createTransport(config);
  const verifyStartedAt = Date.now();
  const verifyTimeoutMs = 8000;

  try {
    await Promise.race([
      transporter.verify(),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(`SMTP verify timeout (${verifyTimeoutMs}ms)`)),
          verifyTimeoutMs,
        ),
      ),
    ]);
    return {
      configured: true,
      canSend: true,
      verified: true,
      missing: [],
      host: config.host,
      port: config.port,
      secure: config.secure,
      from: config.from,
      supportEmail: config.supportEmail,
      isProduction: config.isProduction,
      source: config.source,
      verifyDurationMs: Date.now() - verifyStartedAt,
    };
  } catch (error) {
    return {
      configured: true,
      canSend: true,
      verified: false,
      missing: [],
      host: config.host,
      port: config.port,
      secure: config.secure,
      from: config.from,
      supportEmail: config.supportEmail,
      isProduction: config.isProduction,
      source: config.source,
      verifyDurationMs: Date.now() - verifyStartedAt,
      verifyError: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function sendEmail({ to, subject, html, text }: SendEmailParams) {
  const config = resolveEmailConfig();
  const missing = getMissingConfig(config);

  // Skip email sending if SMTP is not configured
  if (missing.length > 0) {
    console.log("[email:skip]", {
      to,
      subject,
      reason: missing.join(","),
    });
    return;
  }

  const transporter = getTransport(config);
  const mailOptions = {
    from: config.from,
    to,
    subject,
    html,
    text,
    replyTo: config.supportEmail || undefined,
  };

  await transporter.sendMail(mailOptions);
}
