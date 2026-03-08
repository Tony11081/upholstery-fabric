import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const RUNTIME_TABLE = "runtime_kv";

type RuntimeKvRow = {
  key: string;
  value: string;
  metadata: Prisma.JsonValue | null;
  updated_at: Date;
};

type RuntimeStoreState = {
  ensured: boolean;
  ensurePromise: Promise<void> | null;
};

function getStoreState() {
  const globalScope = globalThis as typeof globalThis & {
    __runtimeKvStoreGeneric?: RuntimeStoreState;
  };
  if (!globalScope.__runtimeKvStoreGeneric) {
    globalScope.__runtimeKvStoreGeneric = {
      ensured: false,
      ensurePromise: null,
    };
  }
  return globalScope.__runtimeKvStoreGeneric;
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

export async function readRuntimeJson<T>(key: string): Promise<T | null> {
  await ensureRuntimeTable();
  const rows = await prisma.$queryRawUnsafe<RuntimeKvRow[]>(
    `SELECT key, value, metadata, updated_at FROM ${RUNTIME_TABLE} WHERE key = $1 LIMIT 1`,
    key,
  );
  const row = rows[0];
  if (!row?.value) return null;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return null;
  }
}

export async function saveRuntimeJson(
  key: string,
  value: unknown,
  metadata: Record<string, unknown> = {},
) {
  await ensureRuntimeTable();
  await prisma.$executeRawUnsafe(
    `
      INSERT INTO ${RUNTIME_TABLE} (key, value, metadata, updated_at)
      VALUES ($1, $2, $3::jsonb, NOW())
      ON CONFLICT (key)
      DO UPDATE SET value = EXCLUDED.value, metadata = EXCLUDED.metadata, updated_at = NOW()
    `,
    key,
    JSON.stringify(value),
    JSON.stringify(metadata),
  );
}

export async function deleteRuntimeKey(key: string) {
  await ensureRuntimeTable();
  await prisma.$executeRawUnsafe(`DELETE FROM ${RUNTIME_TABLE} WHERE key = $1`, key);
}

export async function readRuntimeValue(key: string) {
  await ensureRuntimeTable();
  const rows = await prisma.$queryRawUnsafe<RuntimeKvRow[]>(
    `SELECT key, value, metadata, updated_at FROM ${RUNTIME_TABLE} WHERE key = $1 LIMIT 1`,
    key,
  );
  const row = rows[0];
  if (!row) return null;
  return {
    value: row.value,
    metadata: normalizeMetadata(row.metadata),
    updatedAt: row.updated_at.toISOString(),
  };
}
