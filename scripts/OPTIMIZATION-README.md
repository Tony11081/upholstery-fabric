# Product Optimization Script - 使用说明

## 功能

这个脚本会自动：
1. ✅ 扫描所有商品
2. 🎨 分析图片识别颜色变体
3. ✍️ 生成优化的英文标题
4. 📝 生成详细的英文描述
5. 💾 更新数据库

## 在 Dokploy 中运行

### 步骤 1：进入容器

```bash
# 在 Dokploy 控制台，进入 luxury-shop 容器的终端
# 或通过 SSH 连接到服务器后：
docker exec -it <container-name> /bin/sh
```

### 步骤 2：测试运行（推荐）

先用 dry-run 模式测试 3 个商品：

```bash
cd /app
npx tsx scripts/optimize-products.ts --dry-run --limit 3
```

这会：
- 处理前 3 个商品
- 显示优化结果
- **不会修改数据库**
- 生成结果文件供审核

### 步骤 3：审核结果

查看生成的结果文件：

```bash
cat optimization-results-*.json
```

检查：
- 标题是否合理
- 描述是否详细
- 颜色识别是否准确

### 步骤 4：正式运行

确认测试结果OK后，运行完整处理：

```bash
# 处理所有商品（约 9,143 个）
npx tsx scripts/optimize-products.ts

# 或分批处理（推荐）
npx tsx scripts/optimize-products.ts --limit 100
```

**预计耗时：**
- 每个商品约 3-5 秒
- 100 个商品约 5-8 分钟
- 全部 9,143 个约 8-12 小时

## 命令选项

```bash
# 测试模式（不修改数据库）
--dry-run

# 限制处理数量
--limit N

# 示例
npx tsx scripts/optimize-products.ts --dry-run --limit 10
npx tsx scripts/optimize-products.ts --limit 500
```

## 输出示例

```
🚀 Product Optimization Script
================================

Mode: LIVE (will update database)

📦 Fetching products from database...
✓ Found 9143 products to process

[1/9143] Processing: Louis Vuitton p110 16 10 Mini Bag
  ID: clx123abc
  Images: 8
  🔍 Analyzing images for colors...
  ✓ Found 2 color variant(s)
  ✍️  Generating optimized content...
  ✓ New title: Louis Vuitton Mini Speedy Bag 16cm - Monogram Canvas Crossbody
  ✓ Description length: 287 chars
  🎨 Colors: Classic Monogram, Monogram Eclipse
  ✅ Updated in database

[2/9143] Processing: Coach p165 size 11 Bag
  ...

📊 Summary
==========
Total products: 9143
Processed: 9143
Updated: 9143
Errors: 0

💾 Results saved to: ./optimization-results-2026-02-07T11-54-00.json
```

## 安全特性

1. **Rate Limiting**: 每个商品间隔 2 秒，避免 API 限流
2. **错误处理**: 单个商品失败不影响其他商品
3. **结果保存**: 所有结果保存到 JSON 文件
4. **Dry-run 模式**: 可以先测试不修改数据库

## 故障排除

### 问题：连接数据库失败

确保环境变量 `DATABASE_URL` 已设置：

```bash
echo $DATABASE_URL
```

### 问题：OpenClaw 连接失败

脚本使用本地 OpenClaw 网关（127.0.0.1:18789）。

如果在 Dokploy 容器内运行，需要确保：
1. OpenClaw gateway 在运行
2. 或修改脚本使用远程 API

### 问题：处理太慢

可以分批处理：

```bash
# 每次处理 100 个
npx tsx scripts/optimize-products.ts --limit 100

# 多次运行直到全部完成
```

## 注意事项

1. **备份数据库**：建议先备份数据库
2. **测试优先**：先用 --dry-run 测试
3. **分批处理**：建议分批处理，不要一次处理全部
4. **监控进度**：观察输出，确保正常运行

## 下一步

处理完成后：
1. 检查网站前台显示
2. 确认标题和描述正确
3. 测试几个商品页面
4. 如有问题，可以回滚数据库

## 关于颜色变体

当前脚本会识别颜色并记录在结果文件中，但不会创建独立的变体记录。

如需创建真正的颜色变体（可选择的选项），需要：
1. 在数据库添加 ProductVariant 表
2. 修改脚本创建变体记录
3. 更新前端显示颜色选择器

这可以作为第二阶段的改进。
