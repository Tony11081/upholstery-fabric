import { NextRequest, NextResponse } from 'next/server';
import { isAiChatConfigured, openRouterChat } from '@/lib/ai/openrouter';

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
    const { imageUrl } = await request.json();

    if (!imageUrl) {
      return NextResponse.json({ error: 'Missing imageUrl' }, { status: 400, headers: corsHeaders });
    }

    // 下载图片并转换为 base64
    const imageResponse = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.szwego.com/',
      },
    });
    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');
    const mimeType = imageResponse.headers.get('content-type') || 'image/jpeg';
    const dataUrl = `data:${mimeType};base64,${base64Image}`;

    if (!isAiChatConfigured()) {
      return NextResponse.json({ success: false, title: 'Designer Luxury Bag' }, { status: 200, headers: corsHeaders });
    }

    const titleRaw = await openRouterChat({
      model: process.env.AI_IMAGE_MODEL,
      maxTokens: 50,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: dataUrl }
          },
          {
            type: 'text',
            text: 'Look at this luxury bag image. Identify the brand and product type, then respond with ONLY a short title in this format: "[Brand] [Product Type]". Examples: "Dior Oblique Bag", "Chanel Flap Bag", "Gucci Crossbody". Just the title, nothing else.'
          }
        ]
      }],
    });

    const title = titleRaw?.replace(/<\|begin_of_box\|>|<\|end_of_box\|>/g, '').trim() || 'Designer Luxury Bag';
    console.log('Generated title:', title);

    return NextResponse.json({ success: true, title }, { headers: corsHeaders });
  } catch (error) {
    console.error('Image analysis error:', error);
    return NextResponse.json({
      success: false,
      title: 'Designer Luxury Bag'
    }, { status: 200, headers: corsHeaders });
  }
}
