import { isAiChatConfigured, openRouterChat } from "@/lib/ai/openrouter";
import {
  normalizeColorValues,
  normalizeSizeValues,
} from "@/lib/utils/product-options";

export type ProductOptionInferenceInput = {
  imageUrl?: string;
  title?: string;
  description?: string;
  candidateColors?: string[];
  candidateSizes?: string[];
};

export type ProductOptionInferenceResult = {
  colors: string[];
  sizes: string[];
};

function pickModel() {
  return process.env.AI_IMAGE_MODEL ?? process.env.OPENCLAW_MODEL ?? process.env.OPENROUTER_MODEL;
}

function parseJsonObject(text: string) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function toDataUrl(imageUrl: string) {
  try {
    const response = await fetch(imageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "image/jpeg";
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    return `data:${contentType};base64,${base64}`;
  } catch {
    return null;
  }
}

export async function inferProductOptionsWithAI(
  input: ProductOptionInferenceInput,
): Promise<ProductOptionInferenceResult> {
  if (!isAiChatConfigured()) {
    return { colors: [], sizes: [] };
  }

  const title = (input.title ?? "").trim();
  const description = (input.description ?? "").trim();
  const fallbackColors = normalizeColorValues(input.candidateColors ?? []);
  const fallbackSizes = normalizeSizeValues(input.candidateSizes ?? []);
  const dataUrl = input.imageUrl ? await toDataUrl(input.imageUrl) : null;

  const userPrompt = [
    "You are extracting product options for an e-commerce listing.",
    "Return JSON only with this exact shape:",
    '{"colors":["..."],"sizes":["..."]}',
    "Rules:",
    "- Output must be in English only.",
    "- Colors should be generic labels like Black, Brown, Beige, Multicolor.",
    "- Sizes should be shopper-facing labels like XS,S,M,L,XL,XXL,XXXL,One Size,Mini,Small,Medium,Large,EU 38,US 8,UK 6,IT 40.",
    "- Do not include uncertain guesses.",
    `Current title: ${title || "N/A"}`,
    `Current description: ${description || "N/A"}`,
    `Current candidate colors: ${fallbackColors.join(", ") || "none"}`,
    `Current candidate sizes: ${fallbackSizes.join(", ") || "none"}`,
  ].join("\n");

  try {
    const content = await openRouterChat({
      model: pickModel(),
      maxTokens: 260,
      temperature: 0.1,
      messages: [
        {
          role: "user",
          content: dataUrl
            ? [
                { type: "image_url", image_url: { url: dataUrl } },
                { type: "text", text: userPrompt },
              ]
            : userPrompt,
        },
      ],
    });

    const parsed = parseJsonObject(content);
    const colors = normalizeColorValues(
      parsed?.colors ?? parsed?.colorOptions ?? parsed?.colourOptions ?? [],
    );
    const sizes = normalizeSizeValues(parsed?.sizes ?? parsed?.sizeOptions ?? []);

    return { colors, sizes };
  } catch {
    return { colors: [], sizes: [] };
  }
}
