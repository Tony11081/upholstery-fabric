require('dotenv').config();
require('dotenv').config({ path: '.env.local' });

const XLSX = require('xlsx');
const { PrismaClient } = require('@prisma/client');
const OpenAI = require('openai').default;

const prisma = new PrismaClient();
const openRouterApiKey = process.env.OPENROUTER_API_KEY || '';
if (!openRouterApiKey) {
  throw new Error('OPENROUTER_API_KEY is required');
}
const openai = new OpenAI({
  apiKey: openRouterApiKey,
  baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
});
const model = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';

// Brand detection
const BRANDS = {
  '香奈儿': 'Chanel', 'chanel': 'Chanel',
  'lv': 'Louis Vuitton', 'LV': 'Louis Vuitton', '路易威登': 'Louis Vuitton',
  'gucci': 'Gucci', '古驰': 'Gucci',
  'prada': 'Prada', '普拉达': 'Prada',
  'dior': 'Dior', '迪奥': 'Dior',
  'hermes': 'Hermes', '爱马仕': 'Hermes',
  'ysl': 'YSL', '圣罗兰': 'YSL',
  'burberry': 'Burberry', '巴宝莉': 'Burberry',
  'fendi': 'Fendi', '芬迪': 'Fendi',
  'celine': 'Celine', '赛琳': 'Celine',
  'balenciaga': 'Balenciaga', '巴黎世家': 'Balenciaga',
  'bottega': 'Bottega Veneta', 'bv': 'Bottega Veneta',
  'coach': 'Coach', '蔻驰': 'Coach',
  'mk': 'Michael Kors', 'michael kors': 'Michael Kors',
  'mcm': 'MCM',
  'versace': 'Versace', '范思哲': 'Versace',
  'givenchy': 'Givenchy', '纪梵希': 'Givenchy',
  'valentino': 'Valentino', '华伦天奴': 'Valentino',
  'loewe': 'Loewe', '罗意威': 'Loewe',
  'chloe': 'Chloe', '蔻依': 'Chloe',
  'miumiu': 'Miu Miu', 'miu miu': 'Miu Miu',
  'tory burch': 'Tory Burch',
  'kate spade': 'Kate Spade',
  'longchamp': 'Longchamp', '珑骧': 'Longchamp',
};

// Product type keywords
const PRODUCT_TYPES = {
  '包': 'Bag', '袋': 'Bag', '手提': 'Handbag', '单肩': 'Shoulder Bag',
  '双肩': 'Backpack', '背包': 'Backpack', '钱包': 'Wallet', '卡包': 'Card Holder',
  '托特': 'Tote', '斜挎': 'Crossbody', '腰包': 'Belt Bag', '手拿': 'Clutch',
  '旅行': 'Travel Bag', '购物': 'Shopping Bag', '水桶': 'Bucket Bag',
  '枕头': 'Pillow Bag', '饺子': 'Dumpling Bag', '贝壳': 'Shell Bag',
  '链条': 'Chain Bag', '邮差': 'Messenger Bag', '相机': 'Camera Bag',
  '牛仔': 'Denim', '帆布': 'Canvas', '皮革': 'Leather',
};

function detectBrand(text) {
  const lower = text.toLowerCase();
  for (const [key, brand] of Object.entries(BRANDS)) {
    if (lower.includes(key.toLowerCase())) return brand;
  }
  return null;
}

function detectProductType(text) {
  for (const [key, type] of Object.entries(PRODUCT_TYPES)) {
    if (text.includes(key)) return type;
  }
  return 'Bag';
}

function extractSize(text) {
  const match = text.match(/(\d+)\s*[xX×*]\s*(\d+)/);
  if (match) return `${match[1]} x ${match[2]} cm`;
  const match2 = text.match(/尺寸[：:\s]*(\d+)\s*(\d+)?/);
  if (match2) return match2[2] ? `${match2[1]} x ${match2[2]} cm` : `${match2[1]} cm`;
  return null;
}

function generateEnglishTitle(desc, brand) {
  const productType = detectProductType(desc);
  const brandName = brand || 'Designer';

  // Add material/style modifiers
  let modifiers = [];
  if (desc.includes('牛仔')) modifiers.push('Denim');
  if (desc.includes('帆布')) modifiers.push('Canvas');
  if (desc.includes('皮')) modifiers.push('Leather');
  if (desc.includes('迷你') || desc.includes('mini')) modifiers.push('Mini');
  if (desc.includes('大号') || desc.includes('大')) modifiers.push('Large');
  if (desc.includes('中号')) modifiers.push('Medium');
  if (desc.includes('小号')) modifiers.push('Small');

  const modifierStr = modifiers.length > 0 ? modifiers.join(' ') + ' ' : '';
  return `${brandName} ${modifierStr}${productType}`;
}

function generateDescription(desc, brand, size) {
  let parts = ['Elegant designer bag with premium craftsmanship.'];

  if (desc.includes('容量') || desc.includes('大')) parts.push('Spacious interior.');
  if (desc.includes('轻便')) parts.push('Lightweight design.');
  if (desc.includes('做旧') || desc.includes('复古')) parts.push('Vintage-inspired finish.');
  if (desc.includes('走秀') || desc.includes('秀款')) parts.push('Runway collection.');
  if (desc.includes('经典')) parts.push('Classic design.');
  if (desc.includes('时尚') || desc.includes('时髦')) parts.push('Trendy style.');
  if (size) parts.push(`Size: ${size}.`);

  return parts.join(' ');
}

function generateSlug(title, id) {
  return title.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') + '-' + id.slice(-6);
}

function generateTags(desc, brand) {
  const tags = [];
  if (brand) tags.push(brand.toLowerCase().replace(/\s+/g, '-'));

  if (desc.includes('牛仔')) tags.push('denim');
  if (desc.includes('帆布')) tags.push('canvas');
  if (desc.includes('皮')) tags.push('leather');
  if (desc.includes('链条')) tags.push('chain');
  if (desc.includes('迷你')) tags.push('mini');

  tags.push('designer', 'luxury');
  return [...new Set(tags)];
}

// AI识别图片中的品牌和类别
async function identifyProductFromImage(imageUrl) {
  try {
    const resolvedUrl = resolveImageUrl(imageUrl);
    if (!resolvedUrl) return null;

    const base64Image = await downloadImageAsBase64(resolvedUrl);
    if (!base64Image) return null;

    const response = await openai.chat.completions.create({
      model,
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: base64Image } },
          {
            type: 'text',
            text: `Identify this luxury product and provide JSON:
{
  "brand": "Brand Name",
  "category": "Product Type",
  "fullName": "Brand + Product Type"
}

Brand examples: Louis Vuitton, Gucci, Chanel, Hermès, Prada, Dior, Fendi, Balenciaga, Bottega Veneta, Celine, Bvlgari, Miu Miu
Category examples: Handbag, Wallet, Card Holder, Ring, Bracelet, Shoulder Bag, Clutch

Respond ONLY with valid JSON, no other text.`,
          },
        ],
      }],
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) return null;

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const productInfo = JSON.parse(jsonMatch[0]);

    if (!productInfo.brand || !productInfo.category || !isValidResponse(productInfo.brand)) {
      return null;
    }

    return productInfo;
  } catch (error) {
    console.error('  AI识别失败:', error.message);
    return null;
  }
}

function resolveImageUrl(url) {
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/api/image?url=')) {
    try {
      return decodeURIComponent(url.split('url=')[1]);
    } catch {
      return null;
    }
  }
  return null;
}

async function downloadImageAsBase64(imageUrl) {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    return `data:${contentType};base64,${base64}`;
  } catch {
    return null;
  }
}

function isValidResponse(text) {
  const invalidPatterns = [
    /I don't see/i, /I can't/i, /I cannot/i, /unable to/i,
    /I'm sorry/i, /could you/i, /please/i,
  ];
  return !invalidPatterns.some((pattern) => pattern.test(text));
}

async function main() {
  console.log('=== 批量上传产品 (防重复) ===\n');

  // Read Excel
  const wb = XLSX.readFile('C:\\Users\\Administrator\\Desktop\\200个.xlsx');
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws);

  // Filter valid products
  const products = rows.filter(row => row['商品名称/描述'] && row['售价']);
  console.log(`找到 ${products.length} 个有效产品\n`);

  // Get existing product slugs from database
  const existingProducts = await prisma.product.findMany({
    select: { slug: true }
  });
  const existingSlugs = new Set(existingProducts.map(p => p.slug));
  console.log(`数据库已有 ${existingSlugs.size} 个产品\n`);

  // Ensure category exists
  let category = await prisma.category.findFirst({ where: { slug: 'bags' } });
  if (!category) {
    category = await prisma.category.create({
      data: { name: 'Bags', slug: 'bags', imageUrl: '' }
    });
    console.log('创建分类: bags\n');
  }

  let uploaded = 0, skipped = 0, failed = 0;

  for (const row of products) {
    const desc = row['商品名称/描述'];
    const price = row['售价'];
    const productId = row['商品Id'] || `P${Date.now()}`;
    const imageUrl = row['图片地址'] || row['图片'] || row['image'] || '';

    // 先尝试AI识别图片
    let brand = null;
    let titleEn = null;
    let tags = [];

    if (imageUrl) {
      console.log(`🔍 识别: ${desc.substring(0, 30)}...`);
      const aiResult = await identifyProductFromImage(imageUrl);
      if (aiResult) {
        brand = aiResult.brand;
        titleEn = aiResult.fullName;
        tags = [aiResult.brand, aiResult.category];
        console.log(`  ✅ ${brand} - ${aiResult.category}`);
      } else {
        console.log(`  ⚠️  AI失败，使用关键词`);
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // 如果AI识别失败，使用关键词匹配
    if (!brand) brand = detectBrand(desc);

    const size = extractSize(desc);
    if (!titleEn) titleEn = generateEnglishTitle(desc, brand);
    const descEn = generateDescription(desc, brand, size);
    const slug = generateSlug(titleEn, productId);
    if (tags.length === 0) tags = generateTags(desc, brand);

    // Check duplicate by slug
    if (existingSlugs.has(slug)) {
      skipped++;
      continue;
    }

    try {
      await prisma.product.create({
        data: {
          titleEn: titleEn,
          slug: slug,
          descriptionEn: descEn,
          price: price,
          currency: 'USD',
          inventory: 10,
          tags: tags,
          categoryId: category.id,
          isNew: true,
          isActive: true,
        }
      });

      existingSlugs.add(slug);
      uploaded++;

      if (uploaded % 20 === 0) {
        console.log(`已上传 ${uploaded} 个...`);
      }
    } catch (err) {
      failed++;
      console.log(`失败: ${desc.slice(0, 30)}... - ${err.message}`);
    }
  }

  console.log(`\n=== 完成 ===`);
  console.log(`新上传: ${uploaded}`);
  console.log(`跳过(已存在): ${skipped}`);
  console.log(`失败: ${failed}`);

  await prisma.$disconnect();
}

main().catch(console.error);
