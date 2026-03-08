import { PrismaClient } from "@prisma/client";
import Anthropic from "@anthropic-ai/sdk";

const prisma = new PrismaClient();

// 使用 Anthropic API 生成产品描述
async function generateDescription(title: string, category: string | null, brand: string | null): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.warn("ANTHROPIC_API_KEY not set, using fallback description");
    return `Luxury ${category || "product"} ${brand ? `from ${brand}` : ""}. ${title}`;
  }

  try {
    const anthropic = new Anthropic({ apiKey });

    const prompt = `Generate a concise, elegant product description (2-3 sentences) for a luxury e-commerce site.

Product: ${title}
${category ? `Category: ${category}` : ""}
${brand ? `Brand: ${brand}` : ""}

Requirements:
- Professional and sophisticated tone
- Highlight luxury and quality
- 2-3 sentences maximum
- No markdown or special formatting
- Focus on craftsmanship and style`;

    const message = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 200,
      messages: [{
        role: "user",
        content: prompt,
      }],
    });

    const content = message.content[0];
    if (content.type === "text") {
      return content.text.trim();
    }

    throw new Error("Unexpected response format");
  } catch (error) {
    console.error("Failed to generate description:", error);
    return `Luxury ${category || "product"} ${brand ? `from ${brand}` : ""}. ${title}`;
  }
}

async function fillProductDescriptions() {
  console.log("Starting product description generation...");

  // Get products without descriptions
  const products = await prisma.product.findMany({
    where: {
      OR: [
        { descriptionEn: null },
        { descriptionEn: "" },
      ],
      isActive: true,
    },
    include: {
      category: true,
      brand: true,
    },
    take: 100, // Process in batches
  });

  console.log(`Found ${products.length} products without descriptions`);

  let updatedCount = 0;
  let failedCount = 0;

  for (const product of products) {
    try {
      console.log(`Generating description for: ${product.titleEn}`);

      const description = await generateDescription(
        product.titleEn,
        product.category?.nameEn || null,
        product.brand?.name || null
      );

      await prisma.product.update({
        where: { id: product.id },
        data: { descriptionEn: description },
      });

      updatedCount++;
      console.log(`✓ Updated: ${product.titleEn}`);

      // Rate limiting - wait 1 second between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      failedCount++;
      console.error(`✗ Failed to update ${product.titleEn}:`, error);
    }
  }

  console.log(`\nCompleted!`);
  console.log(`Updated: ${updatedCount}`);
  console.log(`Failed: ${failedCount}`);
}

fillProductDescriptions()
  .catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
