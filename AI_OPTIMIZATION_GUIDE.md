# 🤖 AI 驱动的产品数据优化 - 快速开始

## 系统概述

本系统使用 **AI 图片识别技术**自动优化产品数据，包括：

✅ **智能标题生成** - 从图片识别品牌、型号、产品类型
✅ **自动描述生成** - 生成优雅的产品描述（2-3句）
✅ **品牌识别** - 自动识别并创建品牌
✅ **颜色提取** - 识别产品主要颜色
✅ **尺寸检测** - 从图片中识别尺寸信息
✅ **材质识别** - 识别产品材质（皮革、帆布等）
✅ **自动分类** - 智能分配产品分类

## 工作原理

```
产品图片 → AI 视觉识别 → 结构化数据 → 数据库更新
    ↓
  分析内容：
  - 品牌名称
  - 产品类型
  - 型号/系列
  - 颜色
  - 尺寸
  - 材质
    ↓
  自动创建：
  - Brand 记录
  - Category 记录
  - ProductVariant 记录
  - 优化的标题和描述
```

## 🚀 快速开始

### 前置要求

1. **OpenRouter API Key**（必需）
   ```bash
   # 在 .env.local 中添加
   OPENROUTER_API_KEY=your_api_key_here
   OPENROUTER_MODEL=openai/gpt-4o-mini  # 可选，默认值
   ```

2. **产品图片**
   - 确保产品有清晰的图片
   - 图片 URL 可访问

### 方法 1: 一键部署（推荐）

```bash
cd /Users/chengyadong/Documents/uootd商店/luxury-shop
./scripts/deploy-ai-optimization.sh
```

这个脚本会：
1. ✅ 应用数据库迁移
2. ✅ 提供两种优化模式选择
3. ✅ 自动运行 AI 优化

### 方法 2: 手动步骤

```bash
# 1. 应用数据库迁移
npx prisma migrate dev --name add_brands_and_variants
npx prisma generate

# 2. 运行 AI 优化（批量模式，推荐）
npx tsx scripts/ai-optimize-batch.ts

# 或者运行完整优化（一次性处理所有产品）
npx tsx scripts/ai-optimize-products.ts

# 3. 检查数据质量
npx tsx scripts/check-data-integrity.ts

# 4. 启动开发服务器
npm run dev
```

## 📊 优化模式对比

### 批量模式（推荐）

```bash
npx tsx scripts/ai-optimize-batch.ts
```

**特点：**
- ✅ 每次处理 10 个产品
- ✅ 支持断点续传
- ✅ 可随时中断（Ctrl+C）
- ✅ 进度自动保存到 `.ai-optimization-progress.json`
- ✅ 适合大量产品
- ✅ 节省 API 成本

**使用场景：**
- 首次运行，产品数量多
- 需要分批处理
- 想要控制 API 调用速度

**继续处理：**
```bash
# 再次运行即可从断点继续
npx tsx scripts/ai-optimize-batch.ts
```

### 完整模式

```bash
npx tsx scripts/ai-optimize-products.ts
```

**特点：**
- 一次性处理所有产品
- 适合产品数量少的情况
- 不支持断点续传

## 📈 AI 识别示例

### 输入
- 产品图片：Louis Vuitton 手提包
- 当前标题：`product-123`（或空）

### AI 分析输出
```json
{
  "title": "Louis Vuitton Speedy 30 Handbag",
  "description": "Iconic Louis Vuitton Speedy 30 in classic monogram canvas. Features signature leather handles and brass hardware. A timeless piece perfect for everyday luxury.",
  "brand": "Louis Vuitton",
  "category": "Handbag",
  "color": "Brown",
  "size": "30cm",
  "material": "Canvas",
  "confidence": 0.95
}
```

### 数据库更新
1. **Brand 表**
   - 创建或更新 "Louis Vuitton" 品牌

2. **Category 表**
   - 创建或更新 "Handbag" 分类

3. **Product 表**
   - titleEn: "Louis Vuitton Speedy 30 Handbag"
   - descriptionEn: "Iconic Louis Vuitton..."
   - brandId: [Louis Vuitton ID]
   - categoryId: [Handbag ID]

4. **ProductVariant 表**
   - color: "Brown"
   - size: "30cm"
   - material: "Canvas"
   - inventory: [从产品继承]

## 🔍 监控和调试

### 查看进度

```bash
# 查看批量处理进度
cat .ai-optimization-progress.json

# 输出示例：
{
  "processedIds": ["id1", "id2", "id3"],
  "lastProcessedAt": "2026-03-04T10:30:00Z",
  "stats": {
    "total": 50,
    "success": 45,
    "failed": 3,
    "skipped": 2
  }
}
```

### 检查数据质量

```bash
npx tsx scripts/check-data-integrity.ts
```

输出：
```
🔍 检查数据完整性...

📦 总产品数: 100
🏷️  总品牌数: 25 (活跃: 25)
🔗 已关联品牌的产品: 95/100 (95%)
🎨 总变体数: 120
🎨 有变体的产品: 90/100 (90%)
⚠️  缺少标题的产品: 0
⚠️  缺少描述的产品: 5
⚠️  缺少分类的产品: 3

📈 数据质量评分: 87/100
   ✅ 数据质量良好
```

### 重置进度（重新开始）

```bash
rm .ai-optimization-progress.json
npx tsx scripts/ai-optimize-batch.ts
```

## ⚙️ 配置选项

### 调整批量大小

编辑 `scripts/ai-optimize-batch.ts`:

```typescript
const BATCH_SIZE = 10; // 改为 5, 20 等
const DELAY_BETWEEN_REQUESTS = 2000; // 请求间隔（毫秒）
```

### 更换 AI 模型

在 `.env.local` 中：

```bash
# 使用更强大的模型（更准确但更贵）
OPENROUTER_MODEL=openai/gpt-4o

# 使用更便宜的模型
OPENROUTER_MODEL=openai/gpt-4o-mini

# 使用 Claude
OPENROUTER_MODEL=anthropic/claude-3-haiku
```

### 调整置信度阈值

编辑脚本中的：

```typescript
if (analysis.confidence < 0.5) {  // 改为 0.7 更严格
  return null;
}
```

## 🧪 测试功能

启动服务器后：

```bash
npm run dev
```

### 1. 查看优化后的产品

访问任意产品页面，查看：
- ✅ AI 生成的标题
- ✅ AI 生成的描述
- ✅ 品牌信息
- ✅ 颜色和尺寸选择器

### 2. 测试品牌页面

```
http://localhost:3000/brands
http://localhost:3000/brands/louis-vuitton
```

### 3. 测试搜索

搜索框输入：
- 品牌名称（"Gucci"）
- 颜色（"black"）
- 尺寸（"medium"）

### 4. 测试变体选择

在产品详情页：
- 选择不同颜色
- 选择不同尺寸
- 观察库存变化

## 💰 成本估算

使用 OpenRouter + GPT-4o-mini：

- **每张图片分析**: ~$0.001 - $0.002
- **100 个产品**: ~$0.10 - $0.20
- **1000 个产品**: ~$1.00 - $2.00

**节省成本技巧：**
1. 使用批量模式，避免重复处理
2. 只处理需要优化的产品
3. 使用更便宜的模型（gpt-4o-mini）

## 🐛 常见问题

### Q: AI 识别不准确怎么办？

**A:**
1. 检查图片质量（清晰度、角度）
2. 尝试更强大的模型（gpt-4o）
3. 手动在管理后台修正

### Q: 某些产品没有被处理？

**A:**
1. 检查产品是否有图片
2. 查看 `.ai-optimization-progress.json` 确认状态
3. 查看控制台错误信息

### Q: 如何只处理特定产品？

**A:** 修改查询条件：

```typescript
const products = await prisma.product.findMany({
  where: {
    isActive: true,
    // 添加条件
    categoryId: "specific-category-id",
    // 或
    brandId: null, // 只处理没有品牌的
  },
});
```

### Q: API 调用太慢？

**A:**
1. 减少 `DELAY_BETWEEN_REQUESTS`
2. 增加 `BATCH_SIZE`
3. 使用更快的模型

### Q: 想要更详细的日志？

**A:** 脚本已包含详细日志，查看控制台输出。

## 📚 相关文档

- `IMPLEMENTATION_GUIDE.md` - 详细实施指南
- `ARCHITECTURE.md` - 系统架构
- `scripts/ai-optimize-products.ts` - 完整优化脚本
- `scripts/ai-optimize-batch.ts` - 批量优化脚本

## 🎯 下一步

1. ✅ 运行 AI 优化
2. ✅ 检查数据质量
3. ✅ 测试所有功能
4. ✅ 手动调整不准确的数据
5. ✅ 部署到生产环境

祝你使用愉快！🎊
