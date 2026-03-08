import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import OpenAI from "openai";

dotenv.config();
dotenv.config({ path: ".env.local" });

const prisma = new PrismaClient();
const openRouterApiKey = process.env.OPENROUTER_API_KEY ?? "";
if (!openRouterApiKey) {
  throw new Error("OPENROUTER_API_KEY is required");
}
const openai = new OpenAI({
  apiKey: openRouterApiKey,
  baseURL: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
});
const model = process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini";

const mode = process.argv[2] || "check";

async function checkProgress() {
  const total = await prisma.product.count({
    where: { isActive: true, qaStatus: "APPROVED" },
  });

  const defaultTitle = await prisma.product.count({
    where: { isActive: true, qaStatus: "APPROVED", titleEn: "Designer Bag" },
  });

  const recognized = total - defaultTitle;

  console.log(`\n📊 识别进度:`);
  console.log(`总产品数: ${total}`);
  console.log(`已识别: ${recognized} (${((recognized / total) * 100).toFixed(1)}%)`);
  console.log(`未识别: ${defaultTitle} (${((defaultTitle / total) * 100).toFixed(1)}%)\n`);
}

async function cleanErrors() {
  const errorPatterns = [
    "I don't see", "I can't identify", "I don't have", "I cannot",
    "cannot identify", "unable to", "could you clarify", "please share",
    "I'm sorry", "I can't assist",
  ];

  const products = await prisma.product.findMany({
    where: {
      OR: errorPatterns.map((pattern) => ({ titleEn: { contains: pattern } })),
    },
  });

  console.log(`\n🧹 找到 ${products.length} 个错误响应需要清理`);

  for (const product of products) {
    await prisma.product.update({
      where: { id: product.id },
      data: { titleEn: "Designer Bag" },
    });
  }

  console.log(`✅ 已清理 ${products.length} 个错误响应\n`);
}

async function runRecognition() {
  console.log("\n🚀 开始识别产品图片...\n");

  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      qaStatus: "APPROVED",
      titleEn: "Designer Bag",
    },
    include: { images: { take: 1 } },
  });

  console.log(`找到 ${products.length} 个待识别产品\n`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    console.log(`[${i + 1}/${products.length}] ${product.slug}`);

    if (!product.images[0]) {
      console.log(`   ⚠️  无图片，跳过`);
      failCount++;
      continue;
    }

    const imageUrl = product.images[0].url;
    const productName = await identifyProduct(imageUrl);

    if (productName) {
      await prisma.product.update({
        where: { id: product.id },
        data: { titleEn: productName },
      });
      console.log(`   ✅ ${productName}`);
      successCount++;
    } else {
      console.log(`   ❌ 识别失败`);
      failCount++;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log(`\n✅ 完成！成功: ${successCount}, 失败: ${failCount}\n`);
}

async function identifyProduct(imageUrl: string): Promise<string | null> {
  try {
    const resolvedUrl = resolveImageUrl(imageUrl);
    if (!resolvedUrl) return null;

    const base64Image = await downloadImageAsBase64(resolvedUrl);
    if (!base64Image) return null;

    const response = await openai.chat.completions.create({
      model,
      max_tokens: 200,
      messages: [{
        role: "user",
        content: [
          { type: "image_url", image_url: { url: base64Image } },
          {
            type: "text",
            text: "Identify this luxury product. Provide ONLY the brand name and product type in English (e.g., 'Louis Vuitton Wallet', 'Gucci Handbag'). Be concise.",
          },
        ],
      }],
    });

    const productName = response.choices[0]?.message?.content?.trim();
    return productName && isValidProductName(productName) ? productName : null;
  } catch (error) {
    return null;
  }
}

function resolveImageUrl(url: string): string | null {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/api/image?url=")) {
    try {
      return decodeURIComponent(url.split("url=")[1]);
    } catch {
      return null;
    }
  }
  return null;
}

async function downloadImageAsBase64(imageUrl: string): Promise<string | null> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString("base64");
    const contentType = response.headers.get("content-type") || "image/jpeg";
    return `data:${contentType};base64,${base64}`;
  } catch {
    return null;
  }
}

function isValidProductName(text: string): boolean {
  const invalidPatterns = [
    /I don't see/i, /I can't identify/i, /I don't have/i, /I cannot/i,
    /cannot identify/i, /unable to/i, /could you clarify/i, /please share/i,
    /I'm sorry/i, /I can't assist/i,
  ];
  return !invalidPatterns.some((pattern) => pattern.test(text));
}

async function main() {
  console.log(`\n🎯 产品名称识别工具\n`);

  switch (mode) {
    case "check":
      await checkProgress();
      break;
    case "clean":
      await cleanErrors();
      await checkProgress();
      break;
    case "run":
      await runRecognition();
      await checkProgress();
      break;
    default:
      console.log("用法: npx tsx product-name-manager.ts [check|clean|run]");
      console.log("  check - 检查识别进度");
      console.log("  clean - 清理错误响应");
      console.log("  run   - 运行图片识别");
  }

  await prisma.$disconnect();
}

main();
