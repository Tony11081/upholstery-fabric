import { openClawBridgeChat } from "@/lib/ai/openclaw-bridge";

export type OpenRouterContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type OpenRouterMessage = {
  role: "system" | "user" | "assistant";
  content: string | OpenRouterContentPart[];
};

type OpenRouterChatOptions = {
  messages: OpenRouterMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
};

type OpenRouterConfig = {
  provider: "openrouter" | "openclaw" | "openclaw_bridge";
  apiKey?: string;
  baseUrl: string;
  model: string;
  appName?: string;
  siteUrl?: string;
  timeoutMs: number;
};

const DEFAULT_MODEL = "anthropic/claude-sonnet-4.5";

function resolveProvider() {
  const raw = (process.env.AI_PROVIDER ?? "").trim().toLowerCase();
  if (raw === "openclaw" || raw === "openrouter" || raw === "openclaw_bridge") {
    return raw;
  }
  if (process.env.OPENCLAW_BASE_URL) {
    return "openclaw" as const;
  }
  return "openrouter" as const;
}

function getConfig(): OpenRouterConfig {
  const provider = resolveProvider();
  const timeoutMs = Number(process.env.OPENROUTER_TIMEOUT_MS ?? 45000);

  if (provider === "openclaw") {
    const baseUrl = process.env.OPENCLAW_BASE_URL ?? "";
    if (!baseUrl) {
      throw new Error("OPENCLAW_BASE_URL is required when AI_PROVIDER=openclaw");
    }
    return {
      provider,
      apiKey: process.env.OPENCLAW_API_KEY ?? "",
      baseUrl,
      model: process.env.OPENCLAW_MODEL ?? process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL,
      timeoutMs,
    };
  }

  if (provider === "openclaw_bridge") {
    const bridgeToken = (process.env.OPENCLAW_BRIDGE_TOKEN ?? "").trim();
    if (!bridgeToken) {
      throw new Error("OPENCLAW_BRIDGE_TOKEN is required when AI_PROVIDER=openclaw_bridge");
    }
    return {
      provider,
      baseUrl: "",
      model: process.env.OPENCLAW_MODEL ?? process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL,
      timeoutMs,
    };
  }

  const apiKey = process.env.OPENROUTER_API_KEY ?? "";
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is required when AI_PROVIDER=openrouter");
  }

  return {
    provider,
    apiKey,
    baseUrl: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
    model: process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL,
    appName: process.env.OPENROUTER_APP_NAME,
    siteUrl: process.env.OPENROUTER_SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL,
    timeoutMs,
  };
}

function buildHeaders(config: OpenRouterConfig) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`;
  }
  if (config.provider === "openrouter" && config.siteUrl) {
    headers["HTTP-Referer"] = config.siteUrl;
  }
  if (config.provider === "openrouter" && config.appName) {
    headers["X-Title"] = config.appName;
  }
  return headers;
}

export function isAiChatConfigured() {
  try {
    getConfig();
    return true;
  } catch {
    return false;
  }
}

export function getAiChatProvider() {
  return resolveProvider();
}

export async function openRouterChat(options: OpenRouterChatOptions): Promise<string> {
  const config = getConfig();
  if (config.provider === "openclaw_bridge") {
    return openClawBridgeChat({
      messages: options.messages,
      model: options.model ?? config.model,
      temperature: options.temperature ?? 0.2,
      maxTokens: options.maxTokens ?? 600,
      timeoutMs: config.timeoutMs,
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: buildHeaders(config),
      body: JSON.stringify({
        model: options.model ?? config.model,
        messages: options.messages,
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens ?? 600,
      }),
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => null)) as
      | { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } }
      | null;

    if (!response.ok) {
      const message = payload?.error?.message ?? "OpenRouter request failed";
      throw new Error(message);
    }

    const content = payload?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("OpenRouter response missing content");
    }
    return content;
  } finally {
    clearTimeout(timeout);
  }
}
