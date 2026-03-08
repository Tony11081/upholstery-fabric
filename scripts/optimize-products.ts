#!/usr/bin/env tsx
/**
 * Product Optimization Script
 * 
 * This script:
 * 1. Scans all products in the database
 * 2. Analyzes product images to detect color variants
 * 3. Generates optimized English titles and descriptions
 * 4. Updates the database with improved content
 * 
 * Usage:
 *   npx tsx scripts/optimize-products.ts [--dry-run] [--limit N]
 */

import { PrismaClient } from '@prisma/client';
import Anthropic from '@anthropic-ai/sdk';

const prisma = new PrismaClient();

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const limitIndex = args.indexOf('--limit');
const limit = limitIndex >= 0 ? parseInt(args[limitIndex + 1]) : undefined;

// Initialize Anthropic client (using local OpenClaw gateway)
const anthropic = new Anthropic({
  apiKey: process.env.OPENCLAW_LOCAL_TOKEN || '3ebbfbee52e1ab8231f60a343cacc4e822f19edc93969de3',
  baseURL: process.env.OPENCLAW_LOCAL_BASE_URL || 'http://127.0.0.1:18789/v1',
});

interface ColorVariant {
  name: string;
  color: string;
  description: string;
}

interface OptimizedProduct {
  titleEn: string;
  descriptionEn: string;
  colors: ColorVariant[];
}

async function analyzeProductImages(imageUrls: string[]): Promise<ColorVariant[]> {
  if (imageUrls.length === 0) return [];

  const prompt = `Analyze this product image and identify all distinct color variants shown.

For each color variant, provide:
1. A concise color name (e.g., "Black", "Brown", "Blue Signature", "Tan/Pink")
2. The main color (single word: Black, Brown, Blue, Pink, etc.)
3. A brief description of the shade/material

Return ONLY a JSON array in this exact format:
[
  {
    "name": "Classic Monogram",
    "color": "Brown",
    "description": "Brown canvas with tan leather trim and gold hardware"
  },
  {
    "name": "Monogram Eclipse",
    "color": "Black",
    "description": "Black/grey canvas with black leather trim and silver hardware"
  }
]

If only one color is shown, return an array with one item.
If no clear product is visible, return an empty array: []`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-7-sonnet-20250219',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'url',
                url: imageUrls[0], // Analyze first image
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
    });

    const content = response.content[0];
    if (content.type === 'text') {
      // Extract JSON from response
      const jsonMatch = content.text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    }
  } catch (error) {
    console.error('Error analyzing images:', error);
  }

  return [];
}

async function generateOptimizedContent(
  currentTitle: string,
  currentDescription: string | null,
  imageUrls: string[],
  colors: ColorVariant[]
): Promise<OptimizedProduct> {
  const colorInfo = colors.length > 0
    ? `Available in ${colors.length} color${colors.length > 1 ? 's' : ''}: ${colors.map(c => c.name).join(', ')}`
    : '';

  const prompt = `You are an expert e-commerce copywriter for a luxury fashion marketplace.

Current product:
Title: ${currentTitle}
Description: ${currentDescription || 'None'}
${colorInfo}

Generate optimized English content:

1. TITLE (50-80 characters):
   - Include brand, product type, and key feature
   - SEO-friendly but natural
   - Example: "Louis Vuitton Mini Speedy Bag 16cm - Monogram Canvas Crossbody"

2. DESCRIPTION (150-300 words):
   - Start with brand and product type
   - Highlight key features and materials
   - Include dimensions if mentioned
   - Mention color options if multiple
   - Professional, compelling tone
   - Focus on quality and authenticity

Return ONLY a JSON object in this exact format:
{
  "titleEn": "Your optimized title here",
  "descriptionEn": "Your detailed description here"
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-7-sonnet-20250219',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type === 'text') {
      // Extract JSON from response
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return {
          ...result,
          colors,
        };
      }
    }
  } catch (error) {
    console.error('Error generating content:', error);
  }

  // Fallback
  return {
    titleEn: currentTitle,
    descriptionEn: currentDescription || '',
    colors,
  };
}

async function processProduct(product: any, index: number, total: number) {
  console.log(`\n[${index + 1}/${total}] Processing: ${product.titleEn}`);
  console.log(`  ID: ${product.id}`);
  console.log(`  Images: ${product.images.length}`);

  // Get image URLs
  const imageUrls = product.images
    .sort((a: any, b: any) => a.sortOrder - b.sortOrder)
    .map((img: any) => img.url);

  if (imageUrls.length === 0) {
    console.log('  ⚠️  No images, skipping');
    return null;
  }

  // Analyze images for color variants
  console.log('  🔍 Analyzing images for colors...');
  const colors = await analyzeProductImages(imageUrls);
  console.log(`  ✓ Found ${colors.length} color variant(s)`);

  // Generate optimized content
  console.log('  ✍️  Generating optimized content...');
  const optimized = await generateOptimizedContent(
    product.titleEn,
    product.descriptionEn,
    imageUrls,
    colors
  );

  console.log(`  ✓ New title: ${optimized.titleEn}`);
  console.log(`  ✓ Description length: ${optimized.descriptionEn.length} chars`);

  if (colors.length > 1) {
    console.log(`  🎨 Colors: ${colors.map(c => c.name).join(', ')}`);
  }

  return {
    productId: product.id,
    optimized,
  };
}

async function main() {
  console.log('🚀 Product Optimization Script');
  console.log('================================\n');
  console.log(`Mode: ${isDryRun ? 'DRY RUN (no changes)' : 'LIVE (will update database)'}`);
  if (limit) {
    console.log(`Limit: Processing first ${limit} products`);
  }
  console.log('');

  // Fetch products
  console.log('📦 Fetching products from database...');
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      qaStatus: 'APPROVED',
    },
    include: {
      images: {
        orderBy: {
          sortOrder: 'asc',
        },
      },
    },
    take: limit,
    orderBy: {
      createdAt: 'desc',
    },
  });

  console.log(`✓ Found ${products.length} products to process\n`);

  if (products.length === 0) {
    console.log('No products to process. Exiting.');
    return;
  }

  // Process products
  const results = [];
  let processed = 0;
  let updated = 0;
  let errors = 0;

  for (let i = 0; i < products.length; i++) {
    try {
      const result = await processProduct(products[i], i, products.length);
      if (result) {
        results.push(result);
        processed++;

        // Update database if not dry run
        if (!isDryRun) {
          await prisma.product.update({
            where: { id: result.productId },
            data: {
              titleEn: result.optimized.titleEn,
              descriptionEn: result.optimized.descriptionEn,
              // Note: Color variants would need a separate variants table
              // For now, we're just updating the main product content
            },
          });
          updated++;
          console.log('  ✅ Updated in database');
        }
      }

      // Rate limiting: wait 2 seconds between products
      if (i < products.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error(`  ❌ Error processing product:`, error);
      errors++;
    }
  }

  // Summary
  console.log('\n\n📊 Summary');
  console.log('==========');
  console.log(`Total products: ${products.length}`);
  console.log(`Processed: ${processed}`);
  console.log(`Updated: ${updated}`);
  console.log(`Errors: ${errors}`);

  if (isDryRun) {
    console.log('\n⚠️  DRY RUN MODE - No changes were made to the database');
    console.log('Run without --dry-run to apply changes');
  }

  // Save results to file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultsFile = `./optimization-results-${timestamp}.json`;
  await Bun.write(resultsFile, JSON.stringify(results, null, 2));
  console.log(`\n💾 Results saved to: ${resultsFile}`);
}

main()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
