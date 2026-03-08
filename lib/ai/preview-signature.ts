import { createHash, createHmac, timingSafeEqual } from "crypto";

type PreviewTokenPayload = {
  hash: string;
  exp: number;
  rows: number;
};

function getPreviewSecret() {
  const secret = process.env.AI_PREVIEW_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";
  if (!secret) {
    throw new Error("AI_PREVIEW_SECRET (or NEXTAUTH_SECRET) is required");
  }
  return secret;
}

function base64UrlEncode(input: string) {
  return Buffer.from(input).toString("base64url");
}

function base64UrlDecode(input: string) {
  return Buffer.from(input, "base64url").toString("utf8");
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, val]) => val !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashPreviewRows(previewRows: unknown) {
  const normalized = JSON.parse(JSON.stringify(previewRows)) as unknown;
  const payload = stableStringify(normalized);
  return createHash("sha256").update(payload).digest("hex");
}

export function signPreviewRows(previewRows: unknown, ttlSeconds = 3600) {
  const secret = getPreviewSecret();
  const payload: PreviewTokenPayload = {
    hash: hashPreviewRows(previewRows),
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    rows: Array.isArray(previewRows) ? previewRows.length : 0,
  };
  const encoded = base64UrlEncode(JSON.stringify(payload));
  const signature = createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifyPreviewToken(previewRows: unknown, token: string) {
  const secret = getPreviewSecret();
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) {
    return { ok: false, reason: "Invalid token format" };
  }
  const expected = createHmac("sha256", secret).update(encoded).digest("base64url");
  const safeEqual =
    expected.length === signature.length &&
    timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  if (!safeEqual) {
    return { ok: false, reason: "Invalid token signature" };
  }
  const payload = JSON.parse(base64UrlDecode(encoded)) as PreviewTokenPayload;
  if (!payload?.exp || payload.exp < Math.floor(Date.now() / 1000)) {
    return { ok: false, reason: "Token expired" };
  }
  const hash = hashPreviewRows(previewRows);
  if (hash !== payload.hash) {
    return { ok: false, reason: "Preview data mismatch" };
  }
  return { ok: true, payload };
}
