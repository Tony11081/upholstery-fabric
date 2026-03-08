# ✅ 执行清单 - AI 产品数据优化

## 📋 部署前检查

- [ ] 项目目录正确：`/Users/chengyadong/Documents/uootd商店/luxury-shop`
- [ ] Node.js 和 npm 已安装
- [ ] 数据库连接正常（PostgreSQL）
- [ ] `.env.local` 文件存在
- [ ] `OPENROUTER_API_KEY` 已设置
- [ ] 产品有图片（至少一张）

## 🔧 环境配置

### 1. 设置 API Key

```bash
# 编辑 .env.local
nano .env.local

# 添加以下内容
OPENROUTER_API_KEY=your_api_key_here
OPENROUTER_MODEL=openai/gpt-4o-mini
```

- [ ] API Key 已添加
- [ ] 模型已配置

### 2. 测试 API 连接

```bash
npx tsx scripts/test-ai-connection.ts
```

- [ ] 连接测试通过
- [ ] 看到 "AI connection successful!" 消息

## 🚀 部署步骤

### 方式 A: 一键部署（推荐）

```bash
./scripts/deploy-ai-optimization.sh
```

- [ ] 脚本执行成功
- [ ] 数据库迁移完成
- [ ] 选择了优化模式（批量/完整）
- [ ] AI 优化开始运行

### 方式 B: 手动部署

#### 步骤 1: 数据库迁移

```bash
npx prisma migrate dev --name add_brands_and_variants
```

- [ ] 迁移文件生成
- [ ] 数据库更新成功

#### 步骤 2: 生成 Prisma Client

```bash
npx prisma generate
```

- [ ] Client 生成成功

#### 步骤 3: 运行 AI 优化

**批量模式（推荐）：**

```bash
npx tsx scripts/ai-optimize-batch.ts
```

- [ ] 第一批处理完成（10 个产品）
- [ ] 进度文件已创建（`.ai-optimization-progress.json`）
- [ ] 多次运行直到所有产品处理完成

**完整模式：**

```bash
npx tsx scripts/ai-optimize-products.ts
```

- [ ] 所有产品处理完成

## 📊 验证和测试

### 1. 检查数据质量

```bash
npx tsx scripts/check-data-integrity.ts
```

**期望结果：**
- [ ] 数据质量评分 > 80
- [ ] 品牌关联率 > 90%
- [ ] 变体覆盖率 > 85%
- [ ] 缺少标题的产品 < 5
- [ ] 缺少描述的产品 < 10

### 2. 启动开发服务器

```bash
npm run dev
```

- [ ] 服务器启动成功
- [ ] 访问 http://localhost:3000

### 3. 测试品牌功能

访问：`http://localhost:3000/brands`

- [ ] 品牌列表显示正常
- [ ] 品牌数量正确
- [ ] 点击品牌进入详情页
- [ ] 品牌产品列表显示正常

### 4. 测试产品页面

访问任意产品页面：

- [ ] 产品标题清晰（AI 生成）
- [ ] 产品描述优雅（AI 生成）
- [ ] 品牌信息显示
- [ ] 分类信息显示
- [ ] 变体选择器显示（如果有颜色/尺寸）
- [ ] 选择不同变体时库存更新

### 5. 测试搜索功能

在搜索框测试：

- [ ] 搜索品牌名称（如 "Gucci"）→ 结果准确
- [ ] 搜索颜色（如 "black"）→ 匹配变体
- [ ] 搜索尺寸（如 "medium"）→ 匹配变体
- [ ] 搜索产品类型（如 "handbag"）→ 匹配分类

### 6. 测试筛选功能

- [ ] 品牌筛选器显示
- [ ] 点击品牌筛选有效
- [ ] 分类筛选有效

## 📈 数据质量检查

### 查看处理进度

```bash
cat .ai-optimization-progress.json
```

**检查项：**
- [ ] `processedIds` 数量正确
- [ ] `stats.success` 比例 > 80%
- [ ] `stats.failed` 比例 < 10%

### 抽查产品质量

随机检查 10 个产品：

- [ ] 标题准确且专业
- [ ] 描述优雅且信息完整
- [ ] 品牌识别正确
- [ ] 颜色识别准确
- [ ] 尺寸信息合理

### 品牌数据检查

```bash
# 在 Prisma Studio 中查看
npx prisma studio
```

- [ ] Brand 表有数据
- [ ] 品牌名称正确
- [ ] 品牌 slug 正确
- [ ] 产品关联正确

### 变体数据检查

- [ ] ProductVariant 表有数据
- [ ] 颜色信息准确
- [ ] 尺寸信息准确
- [ ] 库存分配合理

## 🔄 持续优化

### 处理新产品

```bash
# 定期运行批量优化
npx tsx scripts/ai-optimize-batch.ts
```

- [ ] 设置定时任务（可选）

### 手动调整

对于 AI 识别不准确的产品：

- [ ] 在管理后台手动修正
- [ ] 访问 `/admin/products`
- [ ] 编辑产品信息

## 🐛 问题排查

### 如果 API 连接失败

- [ ] 检查 API Key 是否正确
- [ ] 检查网络连接
- [ ] 尝试不同的模型
- [ ] 查看 OpenRouter 账户余额

### 如果识别不准确

- [ ] 检查图片质量
- [ ] 尝试更强大的模型（gpt-4o）
- [ ] 调整 prompt
- [ ] 手动修正

### 如果进度丢失

```bash
# 查看进度文件
cat .ai-optimization-progress.json

# 如需重新开始
rm .ai-optimization-progress.json
```

### 如果数据库错误

```bash
# 重置数据库（警告：会删除数据）
npx prisma migrate reset

# 重新运行迁移
npx prisma migrate dev
```

## 📚 文档参考

完成后阅读：

- [ ] `README_AI.md` - 系统总览
- [ ] `AI_OPTIMIZATION_GUIDE.md` - 详细指南
- [ ] `BEFORE_AFTER_COMPARISON.md` - 改进对比
- [ ] `ARCHITECTURE.md` - 系统架构

## ✅ 部署完成确认

最终检查：

- [ ] 所有产品已处理
- [ ] 数据质量评分 > 80
- [ ] 品牌页面正常
- [ ] 产品页面正常
- [ ] 搜索功能正常
- [ ] 变体选择器正常
- [ ] 无控制台错误
- [ ] 性能正常

## 🎉 部署成功！

恭喜！你的 AI 驱动的产品数据优化系统已经成功部署。

### 下一步：

1. 监控数据质量
2. 收集用户反馈
3. 持续优化 AI prompt
4. 定期处理新产品
5. 准备生产环境部署

---

**部署日期：** _______________
**部署人员：** _______________
**数据质量评分：** _____ / 100
**处理产品数：** _____
**备注：** _______________
