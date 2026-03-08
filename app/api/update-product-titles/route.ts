import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    const { limit = 10 } = await request.json();

    // 获取标题为默认值的产品
    const products = await prisma.product.findMany({
      where: {
        OR: [
          { titleEn: 'Designer Bag' },
          { titleEn: 'Designer Luxury Bag' }
        ]
      },
      take: limit,
      include: { images: true }
    });

    let updated = 0;
    let failed = 0;

    for (const product of products) {
      if (!product.images || product.images.length === 0) {
        failed++;
        continue;
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const analyzeResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/analyze-image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl: product.images[0].url }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (analyzeResponse.ok) {
          const { title } = await analyzeResponse.json();
          if (title && title !== 'Designer Bag' && title !== 'Designer Luxury Bag') {
            await prisma.product.update({
              where: { id: product.id },
              data: { titleEn: title }
            });
            updated++;
          }
        } else {
          failed++;
        }
      } catch (error) {
        console.error(`Failed to update product ${product.id}:`, error);
        failed++;
      }
    }

    return NextResponse.json({
      success: true,
      processed: products.length,
      updated,
      failed
    }, { headers: corsHeaders });
  } catch (error) {
    console.error('Update titles error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update titles'
    }, { status: 500, headers: corsHeaders });
  }
}
