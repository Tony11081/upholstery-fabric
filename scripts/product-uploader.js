/**
 * 本地产品处理和上传工具
 * 功能: 自动翻译中文、从图片生成标题、自动分类、上传到网站
 *
 * 使用方法:
 * 1. 配置 .env 中的 OPENROUTER_API_KEY
 * 2. 准备产品CSV文件或图片文件夹
 * 3. 运行: node scripts/product-uploader.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// 配置
const CONFIG = {
  // OpenRouter API配置
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || '',
  OPENROUTER_MODEL: process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4',
  OPENROUTER_BASE_URL: 'https://openrouter.ai/api/v1',

  // 网站API配置
  SITE_URL: process.env.SITE_URL || 'http://localhost:3000',
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin@example.com',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || '',

  // 处理配置
  INPUT_DIR: './products-input',
  OUTPUT_DIR: './products-output',
  UPLOAD_DIR: './public/uploads',
};

// 分类映射(中文->英文slug)
const CATEGORY_MAP = {
  '包': 'bags',
  '包包': 'bags',
  '手提包': 'bags',
  '钱包': 'wallets',
  '鞋': 'shoes',
  '鞋子': 'shoes',
  '高跟鞋': 'heels',
  '运动鞋': 'sneakers',
  '衣服': 'clothing',
  '上衣': 'tops',
  '裤子': 'pants',
  '裙子': 'dresses',
  '外套': 'outerwear',
  '配饰': 'accessories',
  '首饰': 'jewelry',
  '手表': 'watches',
  '眼镜': 'eyewear',
  '围巾': 'scarves',
};

// 品牌映射
const BRAND_MAP = {
  'lv': 'Louis Vuitton',
  'louis vuitton': 'Louis Vuitton',
  'gucci': 'Gucci',
  'chanel': 'Chanel',
  'hermes': 'Hermès',
  'prada': 'Prada',
  'dior': 'Dior',
  'fendi': 'Fendi',
  'burberry': 'Burberry',
  'balenciaga': 'Balenciaga',
  'bottega': 'Bottega Veneta',
  'celine': 'Celine',
  'ysl': 'Saint Laurent',
  'saint laurent': 'Saint Laurent',
};

/**
 * 调用OpenRouter API进行AI处理
 */
async function callOpenRouter(messages, imageUrl = null) {
  if (!CONFIG.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY未配置');
  }

  const content = imageUrl
    ? [
        { type: 'text', text: messages[messages.length - 1].content },
        { type: 'image_url', image_url: { url: imageUrl } }
      ]
    : messages[messages.length - 1].content;

  const requestBody = {
    model: CONFIG.OPENROUTER_MODEL,
    messages: [
      ...messages.slice(0, -1),
      { role: 'user', content }
    ],
  };

  return new Promise((resolve, reject) => {
    const url = new URL(`${CONFIG.OPENROUTER_BASE_URL}/chat/completions`);
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.OPENROUTER_API_KEY}`,
        'HTTP-Referer': CONFIG.SITE_URL,
        'X-Title': 'Product Uploader',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) {
            reject(new Error(json.error.message || 'API错误'));
          } else {
            resolve(json.choices[0].message.content);
          }
        } catch (e) {
          reject(new Error(`解析响应失败: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(JSON.stringify(requestBody));
    req.end();
  });
}

/**
 * 翻译中文文本到英文
 */
async function translateToEnglish(text) {
  if (!text || !/[\u4e00-\u9fa5]/.test(text)) {
    return text; // 没有中文,直接返回
  }

  const response = await callOpenRouter([
    {
      role: 'system',
      content: 'You are a luxury product translator. Translate Chinese to elegant American English. Return only the translation, no explanations.'
    },
    {
      role: 'user',
      content: `Translate this luxury product text to English:\n${text}`
    }
  ]);

  return response.trim();
}

/**
 * 从图片生成产品标题和描述
 */
async function generateFromImage(imageUrl) {
  const response = await callOpenRouter([
    {
      role: 'system',
      content: 'You are a luxury product expert. Analyze product images and identify brand, category, and generate descriptions. Return JSON only.'
    },
    {
      role: 'user',
      content: `Identify this luxury product and provide JSON:
{
  "brand": "Brand Name (e.g., Louis Vuitton, Gucci, Chanel, Dior, Hermès, Prada, Fendi, Balenciaga, Bottega Veneta, Celine, Bvlgari, Miu Miu)",
  "category": "Product Type (e.g., Handbag, Wallet, Card Holder, Ring, Bracelet, Necklace, Shoulder Bag, Clutch)",
  "title_en": "Brand + Product Type (e.g., Louis Vuitton Wallet)",
  "description_en": "Brief luxury description (max 200 chars)",
  "tags": ["brand", "category", "other keywords"]
}

Respond ONLY with valid JSON, no other text.`
    }
  ], imageUrl);

  // 提取JSON
  const match = response.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error('AI响应中没有JSON');
  }
  return JSON.parse(match[0]);
}

/**
 * 自动分类产品
 */
async function categorizeProduct(title, description = '') {
  // 先尝试本地匹配
  const text = `${title} ${description}`.toLowerCase();

  for (const [keyword, slug] of Object.entries(CATEGORY_MAP)) {
    if (text.includes(keyword)) {
      return slug;
    }
  }

  // 使用AI分类
  const response = await callOpenRouter([
    {
      role: 'system',
      content: 'You are a luxury product categorizer. Return only the category slug, nothing else.'
    },
    {
      role: 'user',
      content: `Categorize this product into one of these categories:
bags, wallets, shoes, heels, sneakers, clothing, tops, pants, dresses, outerwear, accessories, jewelry, watches, eyewear, scarves

Product: ${title}
${description ? `Description: ${description}` : ''}

Return only the category slug.`
    }
  ]);

  return response.trim().toLowerCase().replace(/[^a-z-]/g, '');
}

/**
 * 生成产品标签
 */
async function generateTags(title, description = '', category = '') {
  const response = await callOpenRouter([
    {
      role: 'system',
      content: 'You are a luxury product tagger. Return only comma-separated lowercase tags, nothing else.'
    },
    {
      role: 'user',
      content: `Generate 3-5 relevant tags for this luxury product:
Title: ${title}
Category: ${category}
${description ? `Description: ${description}` : ''}

Return only comma-separated lowercase tags.`
    }
  ]);

  return response.trim().toLowerCase().split(',').map(t => t.trim()).filter(Boolean);
}

/**
 * 生成URL友好的slug
 */
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

/**
 * 处理单个产品
 */
async function processProduct(product) {
  console.log(`处理产品: ${product.title || product.image || 'unknown'}`);

  const result = {
    titleEn: '',
    descriptionEn: '',
    slug: '',
    categorySlug: '',
    tags: [],
    price: product.price || 0,
    currency: product.currency || 'USD',
    inventory: product.inventory || 10,
    images: [],
    isNew: true,
    isActive: true,
  };

  // 1. 如果有图片,从图片生成信息
  if (product.image && !product.title) {
    try {
      const imageInfo = await generateFromImage(product.image);
      result.titleEn = imageInfo.title_en;
      result.descriptionEn = imageInfo.description_en;
      // 将品牌和类别添加到tags中
      result.tags = [imageInfo.brand, imageInfo.category, ...(imageInfo.tags || [])].filter(Boolean);
      result.images = [{ url: product.image, alt: result.titleEn }];
      console.log(`  识别: ${imageInfo.brand} - ${imageInfo.category}`);
    } catch (e) {
      console.error('  从图片生成失败:', e.message);
    }
  }

  // 2. 翻译中文标题
  if (product.title) {
    result.titleEn = await translateToEnglish(product.title);
  }

  // 3. 翻译中文描述
  if (product.description) {
    result.descriptionEn = await translateToEnglish(product.description);
  }

  // 4. 自动分类
  if (!result.categorySlug && result.titleEn) {
    result.categorySlug = await categorizeProduct(result.titleEn, result.descriptionEn);
  }

  // 5. 生成标签
  if (result.tags.length === 0 && result.titleEn) {
    result.tags = await generateTags(result.titleEn, result.descriptionEn, result.categorySlug);
  }

  // 6. 生成slug
  result.slug = slugify(result.titleEn);

  // 7. 处理图片
  if (product.images) {
    result.images = product.images.map(url => ({ url, alt: result.titleEn }));
  } else if (product.image && result.images.length === 0) {
    result.images = [{ url: product.image, alt: result.titleEn }];
  }

  console.log(`  完成: ${result.titleEn} -> ${result.categorySlug}`);
  return result;
}

/**
 * 上传产品到网站
 */
async function uploadProduct(product) {
  const url = new URL(`${CONFIG.SITE_URL}/api/admin/products`);

  const requestBody = {
    titleEn: product.titleEn,
    slug: product.slug,
    descriptionEn: product.descriptionEn,
    price: product.price,
    currency: product.currency,
    inventory: product.inventory,
    tags: product.tags,
    isNew: product.isNew,
    isActive: product.isActive,
    images: product.images,
  };

  // 如果有分类,需要先获取或创建分类ID
  if (product.categorySlug) {
    // 这里简化处理,实际需要先查询分类
    requestBody.categoryId = null; // 需要实现分类查询
  }

  return new Promise((resolve, reject) => {
    const protocol = url.protocol === 'https:' ? https : http;
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 3000),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `admin_session=${CONFIG.ADMIN_EMAIL}`, // 简化的认证
      },
    };

    const req = protocol.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject(new Error(json.error || `HTTP ${res.statusCode}`));
          } else {
            resolve(json);
          }
        } catch (e) {
          reject(new Error(`解析响应失败: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(JSON.stringify(requestBody));
    req.end();
  });
}

/**
 * 从CSV文件读取产品
 */
function readProductsFromCsv(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());

  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const products = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const product = {};

    headers.forEach((header, idx) => {
      product[header] = values[idx]?.trim() || '';
    });

    products.push(product);
  }

  return products;
}

/**
 * 从图片文件夹读取产品
 */
function readProductsFromImages(dirPath) {
  const files = fs.readdirSync(dirPath);
  const imageExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

  return files
    .filter(file => imageExts.includes(path.extname(file).toLowerCase()))
    .map(file => ({
      image: path.join(dirPath, file),
      title: '', // 从图片生成
    }));
}

/**
 * 主函数
 */
async function main() {
  console.log('=== 产品处理和上传工具 ===\n');

  // 检查配置
  if (!CONFIG.OPENROUTER_API_KEY) {
    console.log('警告: OPENROUTER_API_KEY未配置,AI功能将不可用');
  }

  // 创建目录
  if (!fs.existsSync(CONFIG.INPUT_DIR)) {
    fs.mkdirSync(CONFIG.INPUT_DIR, { recursive: true });
    console.log(`创建输入目录: ${CONFIG.INPUT_DIR}`);
    console.log('请将产品CSV文件或图片放入此目录\n');
    return;
  }

  if (!fs.existsSync(CONFIG.OUTPUT_DIR)) {
    fs.mkdirSync(CONFIG.OUTPUT_DIR, { recursive: true });
  }

  // 读取产品
  let products = [];

  // 检查CSV文件
  const csvFiles = fs.readdirSync(CONFIG.INPUT_DIR).filter(f => f.endsWith('.csv'));
  for (const csvFile of csvFiles) {
    const csvProducts = readProductsFromCsv(path.join(CONFIG.INPUT_DIR, csvFile));
    console.log(`从 ${csvFile} 读取 ${csvProducts.length} 个产品`);
    products.push(...csvProducts);
  }

  // 检查图片文件
  const imageProducts = readProductsFromImages(CONFIG.INPUT_DIR);
  if (imageProducts.length > 0) {
    console.log(`从图片读取 ${imageProducts.length} 个产品`);
    products.push(...imageProducts);
  }

  if (products.length === 0) {
    console.log('没有找到产品数据');
    return;
  }

  console.log(`\n共 ${products.length} 个产品待处理\n`);

  // 处理产品
  const processedProducts = [];
  for (const product of products) {
    try {
      const processed = await processProduct(product);
      processedProducts.push(processed);
    } catch (e) {
      console.error(`处理失败: ${e.message}`);
    }
  }

  // 保存处理结果
  const outputFile = path.join(CONFIG.OUTPUT_DIR, `products-${Date.now()}.json`);
  fs.writeFileSync(outputFile, JSON.stringify(processedProducts, null, 2));
  console.log(`\n处理结果已保存到: ${outputFile}`);

  // 询问是否上传
  console.log('\n处理完成! 请检查输出文件,然后运行以下命令上传:');
  console.log(`node scripts/product-uploader.js --upload ${outputFile}`);
}

// 上传模式
async function uploadMode(filePath) {
  console.log('=== 上传产品到网站 ===\n');

  if (!fs.existsSync(filePath)) {
    console.error(`文件不存在: ${filePath}`);
    return;
  }

  const products = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  console.log(`准备上传 ${products.length} 个产品\n`);

  let success = 0;
  let failed = 0;

  for (const product of products) {
    try {
      console.log(`上传: ${product.titleEn}`);
      await uploadProduct(product);
      success++;
      console.log('  ✓ 成功');
    } catch (e) {
      failed++;
      console.error(`  ✗ 失败: ${e.message}`);
    }
  }

  console.log(`\n上传完成: ${success} 成功, ${failed} 失败`);
}

// 命令行参数处理
const args = process.argv.slice(2);
if (args[0] === '--upload' && args[1]) {
  uploadMode(args[1]);
} else {
  main();
}
