/**
 * 处理商品Excel并上传到网站
 */
const XLSX = require('xlsx');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// 品牌识别
function detectBrand(text) {
  const brands = {
    '香奈儿': 'Chanel',
    'chanel': 'Chanel',
    'lv': 'Louis Vuitton',
    'louis vuitton': 'Louis Vuitton',
    '路易威登': 'Louis Vuitton',
    'gucci': 'Gucci',
    '古驰': 'Gucci',
    'hermes': 'Hermès',
    '爱马仕': 'Hermès',
    'prada': 'Prada',
    '普拉达': 'Prada',
    'dior': 'Dior',
    '迪奥': 'Dior',
  };

  const lowerText = text.toLowerCase();
  for (const [key, value] of Object.entries(brands)) {
    if (lowerText.includes(key.toLowerCase())) {
      return value;
    }
  }
  return null;
}

// 提取尺寸
function extractSize(text) {
  const match = text.match(/尺寸[：:]\s*(\d+)\s*[x×*]?\s*(\d+)?/i) ||
                text.match(/(\d{2,3})\s+(\d{2,3})/);
  if (match) {
    return match[2] ? `${match[1]} x ${match[2]} cm` : `${match[1]} cm`;
  }
  return null;
}

// 提取货号
function extractSku(text) {
  const match = text.match(/货号[：:]?\s*(\w+)/i);
  return match ? match[1] : null;
}

// 生成英文标题
function generateEnglishTitle(chineseDesc, brand) {
  const productTypes = {
    '旅行袋': 'Travel Bag',
    '托特': 'Tote Bag',
    '手提包': 'Handbag',
    '枕头包': 'Pillow Bag',
    '垃圾袋': 'Bucket Bag',
    '斜挎包': 'Crossbody Bag',
    '单肩包': 'Shoulder Bag',
    '双肩包': 'Backpack',
    '钱包': 'Wallet',
    '卡包': 'Card Holder',
  };

  let productType = 'Bag';
  for (const [cn, en] of Object.entries(productTypes)) {
    if (chineseDesc.includes(cn)) {
      productType = en;
      break;
    }
  }

  // 检测材质
  let material = '';
  if (chineseDesc.includes('牛仔')) material = 'Denim ';
  else if (chineseDesc.includes('皮革') || chineseDesc.includes('皮')) material = 'Leather ';
  else if (chineseDesc.includes('帆布')) material = 'Canvas ';

  return brand ? `${brand} ${material}${productType}` : `${material}${productType}`;
}

// 生成英文描述
function generateEnglishDescription(chineseDesc, size) {
  let desc = 'Elegant designer bag with premium craftsmanship. ';

  if (chineseDesc.includes('容量') || chineseDesc.includes('大')) {
    desc += 'Spacious interior for everyday essentials. ';
  }
  if (chineseDesc.includes('轻便')) {
    desc += 'Lightweight design for comfortable carrying. ';
  }
  if (chineseDesc.includes('做旧') || chineseDesc.includes('复古')) {
    desc += 'Vintage-inspired distressed finish. ';
  }
  if (chineseDesc.includes('走秀')) {
    desc += 'Runway collection piece. ';
  }

  if (size) {
    desc += `Size: ${size}.`;
  }

  return desc.trim();
}

// 生成slug
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

// 处理单个产品
function processProduct(row, index) {
  const desc = row['商品名称/描述'] || '';
  const price = row['售价'] || 0;
  const productId = row['商品Id'] || '';

  const brand = detectBrand(desc);
  const size = extractSize(desc);
  const sku = extractSku(desc);

  const titleEn = generateEnglishTitle(desc, brand);
  const descriptionEn = generateEnglishDescription(desc, size);
  const slug = slugify(titleEn) + '-' + (index + 1);

  // 生成标签
  const tags = [];
  if (brand) tags.push(brand.toLowerCase().replace(/\s+/g, '-'));
  if (desc.includes('牛仔')) tags.push('denim');
  if (desc.includes('皮')) tags.push('leather');
  if (desc.includes('旅行')) tags.push('travel');
  if (desc.includes('托特')) tags.push('tote');
  tags.push('designer', 'luxury');

  return {
    titleEn,
    titleCn: desc.substring(0, 100),
    descriptionEn,
    slug,
    price,
    currency: 'USD',
    inventory: 10,
    tags: tags.slice(0, 6),
    categorySlug: 'bags',
    isNew: true,
    isActive: true,
    sku,
    originalId: productId,
  };
}

async function main() {
  console.log('=== 处理商品Excel ===\n');

  // 读取Excel
  const workbook = XLSX.readFile('C:/Users/Administrator/Desktop/商品_0111185316141.xlsx');
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet);

  // 过滤有效数据
  const validProducts = data.filter(row => row['商品名称/描述'] && row['售价']);
  console.log(`找到 ${validProducts.length} 个有效产品\n`);

  // 处理产品
  const products = validProducts.map((row, i) => processProduct(row, i));

  // 显示处理结果
  console.log('=== 处理结果 ===\n');
  products.forEach((p, i) => {
    console.log(`产品 ${i + 1}:`);
    console.log(`  中文: ${p.titleCn.substring(0, 50)}...`);
    console.log(`  英文: ${p.titleEn}`);
    console.log(`  描述: ${p.descriptionEn.substring(0, 80)}...`);
    console.log(`  价格: $${p.price}`);
    console.log(`  标签: ${p.tags.join(', ')}`);
    console.log('');
  });

  // 获取或创建分类
  let category = await prisma.category.findUnique({ where: { slug: 'bags' } });
  if (!category) {
    category = await prisma.category.create({
      data: { slug: 'bags', nameEn: 'Bags', status: 'ACTIVE' }
    });
    console.log('创建分类: bags\n');
  }

  // 上传到数据库
  console.log('=== 上传到数据库 ===\n');
  let success = 0;
  let failed = 0;

  for (const product of products) {
    try {
      // 检查slug是否存在
      let slug = product.slug;
      let counter = 1;
      while (await prisma.product.findUnique({ where: { slug } })) {
        slug = `${product.slug}-${counter}`;
        counter++;
      }

      await prisma.product.create({
        data: {
          titleEn: product.titleEn,
          slug,
          descriptionEn: product.descriptionEn,
          categoryId: category.id,
          price: product.price,
          currency: product.currency,
          inventory: product.inventory,
          tags: product.tags,
          isNew: product.isNew,
          isActive: product.isActive,
          qaStatus: 'PENDING',
        }
      });
      console.log(`✓ 上传成功: ${product.titleEn}`);
      success++;
    } catch (e) {
      console.log(`✗ 上传失败: ${product.titleEn} - ${e.message}`);
      failed++;
    }
  }

  console.log(`\n=== 完成 ===`);
  console.log(`成功: ${success}, 失败: ${failed}`);

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
