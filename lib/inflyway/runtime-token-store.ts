import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const RUNTIME_TABLE = "runtime_kv";
const INFLYWAY_TOKEN_KEY = "inflyway.current_token";

type RuntimeKvRow = {
  key: string;
  value: string;
  metadata: Prisma.JsonValue | null;
  updated_at: Date;
};

export type StoredInflywayToken = {
  token: string;
  source: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
};

type RuntimeStoreState = {
  ensured: boolean;
  ensurePromise: Promise<void> | null;
};

function getStoreState() {
  const globalScope = globalThis as typeof globalThis & {
    __runtimeKvStore?: RuntimeStoreState;
  };
  if (!globalScope.__runtimeKvStore) {
    globalScope.__runtimeKvStore = {
      ensured: false,
      ensurePromise: null,
    };
  }
  return globalScope.__runtimeKvStore;
}

function stripWrappingQuotes(value: string) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

async function ensureRuntimeTable() {
  const state = getStoreState();
  if (state.ensured) return;
  if (!state.ensurePromise) {
    state.ensurePromise = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS ${RUNTIME_TABLE} (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          metadata JSONB,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS runtime_kv_updated_at_idx
        ON ${RUNTIME_TABLE}(updated_at DESC)
      `);
      state.ensured = true;
      state.ensurePromise = null;
    })().catch((error) => {
      state.ensured = false;
      state.ensurePromise = null;
      throw error;
    });
  }
  await state.ensurePromise;
}

function normalizeMetadata(raw: Prisma.JsonValue | null): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  return raw as Record<string, unknown>;
}

export async function readStoredInflywayToken(): Promise<StoredInflywayToken | null> {
  try {
    await ensureRuntimeTable();
    const rows = await prisma.$queryRawUnsafe<RuntimeKvRow[]>(
      `SELECT key, value, metadata, updated_at FROM ${RUNTIME_TABLE} WHERE key = $1 LIMIT 1`,
      INFLYWAY_TOKEN_KEY,
    );
    const row = rows[0];
    if (!row?.value) return null;
    const token = stripWrappingQuotes(row.value);
    if (!token) return null;
    const metadata = normalizeMetadata(row.metadata);
    return {
      token,
      source: String(metadata.source ?? "runtime"),
      updatedAt: row.updated_at.toISOString(),
      metadata,
    };
  } catch (error) {
    console.warn("[inflyway][token-store] read failed", error);
    return null;
  }
}

export async function saveInflywayToken(
  token: string,
  metadata: Record<string, unknown> = {},
) {
  const normalizedToken = stripWrappingQuotes(token);
  if (!normalizedToken) {
    throw new Error("Cannot store empty Inflyway token");
  }
  const mergedMetadata = {
    source: "runtime",
    refreshedAt: new Date().toISOString(),
    ...metadata,
  };
  await ensureRuntimeTable();
  await prisma.$executeRawUnsafe(
    `
      INSERT INTO ${RUNTIME_TABLE} (key, value, metadata, updated_at)
      VALUES ($1, $2, $3::jsonb, NOW())
      ON CONFLICT (key)
      DO UPDATE SET value = EXCLUDED.value, metadata = EXCLUDED.metadata, updated_at = NOW()
    `,
    INFLYWAY_TOKEN_KEY,
    normalizedToken,
    JSON.stringify(mergedMetadata),
  );
}

export async function resolveInflywayToken() {
  const stored = await readStoredInflywayToken();
  if (stored?.token) {
    return {
      token: stored.token,
      source: stored.source || "runtime",
      updatedAt: stored.updatedAt,
      metadata: stored.metadata,
    };
  }
  const envToken = stripWrappingQuotes(process.env.INFLYWAY_TOKEN ?? "");
  if (envToken) {
    return {
      token: envToken,
      source: "env",
      updatedAt: null as string | null,
      metadata: {} as Record<string, unknown>,
    };
  }
  return {
    token: null,
    source: "none",
    updatedAt: null as string | null,
    metadata: {} as Record<string, unknown>,
  };
}

export function maskToken(token?: string | null) {
  if (!token) return "";
  const cleaned = stripWrappingQuotes(token);
  if (cleaned.length <= 8) return "****";
  return `${cleaned.slice(0, 4)}...${cleaned.slice(-4)}`;
}
