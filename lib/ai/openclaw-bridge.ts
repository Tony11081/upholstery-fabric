import { prisma } from "@/lib/prisma";
import type { OpenRouterMessage } from "@/lib/ai/openrouter";

type BridgeChatOptions = {
  messages: OpenRouterMessage[];
  model: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractChatCompletionContent(response: unknown): string | null {
  if (!isRecord(response)) return null;
  const choices = response.choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;

  const firstChoice = choices[0];
  if (!isRecord(firstChoice)) return null;

  const message = firstChoice.message;
  if (isRecord(message) && typeof message.content === "string") {
    return message.content;
  }

  // Some providers may return `choices[0].text` for non-chat completions.
  if (typeof firstChoice.text === "string") return firstChoice.text;
  return null;
}

export async function openClawBridgeChat(options: BridgeChatOptions): Promise<string> {
  const pollMs = Number(process.env.OPENCLAW_BRIDGE_POLL_MS ?? 600);
  const intervalMs = Number.isFinite(pollMs) && pollMs > 50 ? pollMs : 600;

  const job = await prisma.aiBridgeJob.create({
    data: {
      type: "CHAT_COMPLETIONS",
      status: "PENDING",
      request: {
        model: options.model,
        messages: options.messages,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
      },
    },
    select: { id: true },
  });

  const deadline = Date.now() + options.timeoutMs;
  // Simple polling is enough here; workers are expected to run concurrency=1.
  // If we need higher throughput, switch to LISTEN/NOTIFY or a Redis queue.
  while (Date.now() < deadline) {
    const current = await prisma.aiBridgeJob.findUnique({
      where: { id: job.id },
      select: { status: true, response: true, error: true },
    });

    if (!current) {
      throw new Error("OpenClaw bridge job missing");
    }

    if (current.status === "DONE") {
      const content = extractChatCompletionContent(current.response);
      if (typeof content !== "string" || !content.trim()) {
        throw new Error("OpenClaw bridge response missing content");
      }
      return content;
    }

    if (current.status === "FAILED") {
      const message = current.error?.trim() || "OpenClaw bridge job failed";
      throw new Error(message);
    }

    await sleep(intervalMs);
  }

  throw new Error("OpenClaw bridge timeout");
}
