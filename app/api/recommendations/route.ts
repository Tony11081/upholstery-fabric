import { prisma } from "@/lib/prisma";
import { isAiChatConfigured, openRouterChat } from "@/lib/ai/openrouter";
import { createApiContext, jsonError, jsonOk, logApiError, logApiSuccess, logApiWarning } from "@/lib/utils/api";

type RequestBody = {
  style?: string;
  occasion?: string;
  size?: string;
  budget?: string;
  notes?: string;
};

type Candidate = {
  id: string;
  slug: string;
  titleEn: string;
  descriptionEn?: string | null;
  tags: string[];
  price: number;
  currency: string;
};

function parseBudget(budget?: string | null) {
  if (!budget) return null;
  if (budget.includes("+")) {
    const value = Number(budget.replace("+", ""));
    return { min: Number.isNaN(value) ? 0 : value, max: null };
  }
  const [minRaw, maxRaw] = budget.split("-");
  const min = Number(minRaw);
  const max = Number(maxRaw);
  if (Number.isNaN(min) && Number.isNaN(max)) return null;
  return { min: Number.isNaN(min) ? 0 : min, max: Number.isNaN(max) ? null : max };
}

function scoreCandidate(candidate: Candidate, tokens: string[]) {
  const haystack = [
    candidate.titleEn,
    candidate.descriptionEn ?? "",
    candidate.tags.join(" "),
  ]
    .join(" ")
    .toLowerCase();

  let score = 0;
  for (const token of tokens) {
    if (!token) continue;
    if (haystack.includes(token)) score += 2;
  }
  if (candidate.tags.includes("editorial")) score += 1;
  if (candidate.tags.includes("new")) score += 1;
  return score;
}

export async function POST(request: Request) {
  const ctx = createApiContext(request);
  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    logApiWarning(ctx, 400, { reason: "invalid_json" });
    return jsonError("Invalid request body", 400, ctx, { code: "INVALID_BODY" });
  }

  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      include: {
        images: { orderBy: { sortOrder: "asc" } },
        category: true,
      },
      take: 80,
      orderBy: { updatedAt: "desc" },
    });

    const candidates: Candidate[] = products.map((product) => ({
      id: product.id,
      slug: product.slug,
      titleEn: product.titleEn,
      descriptionEn: product.descriptionEn,
      tags: product.tags ?? [],
      price: Number(product.price),
      currency: product.currency,
    }));

    const budgetRange = parseBudget(body.budget);
    let filtered = candidates.filter((candidate) => {
      if (!budgetRange) return true;
      if (budgetRange.min && candidate.price < budgetRange.min) return false;
      if (budgetRange.max && candidate.price > budgetRange.max) return false;
      return true;
    });

    if (!filtered.length) {
      filtered = candidates;
    }

    let selectedSlugs: string[] | null = null;
    if (isAiChatConfigured()) {
      const prompt = {
        style: body.style ?? "any",
        occasion: body.occasion ?? "any",
        size: body.size ?? "any",
        budget: body.budget ?? "open",
        notes: body.notes ?? "",
      };
      const shortlist = filtered.slice(0, 50).map((candidate) => ({
        slug: candidate.slug,
        title: candidate.titleEn,
        tags: candidate.tags,
        price: candidate.price,
      }));
      const system = "You are a luxury merchandiser. Select up to 6 product slugs from the list.";
      const user = `Preferences: ${JSON.stringify(prompt)}\nProducts: ${JSON.stringify(shortlist)}\nReturn JSON array of slugs.`;

      try {
        const response = await openRouterChat({
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          temperature: 0.2,
          maxTokens: 200,
        });
        const parsed = JSON.parse(response) as string[];
        if (Array.isArray(parsed) && parsed.length) {
          selectedSlugs = parsed.filter((slug) => typeof slug === "string");
        }
      } catch (error) {
        logApiWarning(ctx, 200, { reason: "ai_recommendation_failed" });
      }
    }

    let finalList = filtered;
    if (selectedSlugs?.length) {
      finalList = filtered.filter((candidate) => selectedSlugs?.includes(candidate.slug));
    } else {
      const tokens = [
        body.style,
        body.occasion,
        body.size,
        body.notes,
      ]
        .join(" ")
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);
      finalList = filtered
        .map((candidate) => ({ candidate, score: scoreCandidate(candidate, tokens) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 6)
        .map((entry) => entry.candidate);
    }

    const responseItems = finalList.slice(0, 6).map((item) => {
      const product = products.find((p) => p.id === item.id);
      const cover = product?.images?.[0];
      return {
        id: item.id,
        slug: item.slug,
        titleEn: item.titleEn,
        price: item.price,
        currency: item.currency,
        tags: item.tags,
        image: cover?.url ?? null,
      };
    });

    logApiSuccess(ctx, 200, { count: responseItems.length });
    return jsonOk({ products: responseItems }, ctx);
  } catch (error) {
    logApiError(ctx, 500, error);
    return jsonError("Unable to generate recommendations", 500, ctx, { code: "RECOMMENDATIONS_FAILED" });
  }
}
