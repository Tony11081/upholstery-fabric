# 产品数据增强 - 实施指南

## 概述

本次更新为 luxury-shop 添加了以下功能：
1. ✅ 品牌管理系统（Brand 模型）
2. ✅ 产品变体支持（颜色、尺寸选项）
3. ✅ 增强的搜索功能
4. ✅ 品牌筛选 UI
5. ✅ 产品详情页变体选择器

## 数据库变更

### 新增模型

1. **Brand** - 品牌表
   - id, name, slug, logo, description, isActive
   - 与 Product 一对多关系

2. **ProductVariant** - 产品变体表
   - id, productId, sku, color, size, material, price, inventory
   - 支持产品的颜色、尺寸等变体

### Product 模型更新
- 新增 `brandId` 字段
- 新增 `brand` 关系
- 新增 `variants` 关系

## 实施步骤

### 1. 生成并应用数据库迁移

```bash
cd /Users/chengyadong/Documents/uootd商店/luxury-shop

# 生成 Prisma 迁移
npx prisma migrate dev --name add_brands_and_variants

# 或者如果是生产环境
npx prisma migrate deploy
```

### 2. 运行数据迁移脚本

```bash
# 迁移品牌数据（从 tags 提取品牌信息）
npx tsx scripts/migrate-brands.ts

# 创建产品变体（从标题和描述提取颜色/尺寸）
npx tsx scripts/create-variants.ts
```

### 3. 重新生成 Prisma Client

```bash
npx prisma generate
```

### 4. 重启开发服务器

```bash
npm run dev
```

## 新增功能

### 品牌页面
- `/brands` - 所有品牌列表
- `/brands/[slug]` - 单个品牌的产品页面

### 产品变体
- 产品详情页现在支持颜色和尺寸选择
- 每个变体有独立的库存管理
- 变体可以有不同的价格（可选）

### 搜索增强
- 搜索现在包含品牌名称
- 搜索包含产品变体的颜色和尺寸
- 更准确的搜索结果

### UI 组件
- `BrandFilter` - 品牌筛选组件
- `VariantSelector` - 产品变体选择器

## 数据填充建议

### 完善产品信息

如果产品的 `titleEn` 或 `descriptionEn` 为空，建议：

1. 使用 AI 生成描述：
```bash
# 创建脚本使用 OpenAI/Anthropic API 生成产品描述
npx tsx scripts/generate-product-descriptions.ts
```

2. 手动在管理后台填写：
   - 访问 `/admin/products`
   - 编辑每个产品
   - 填写标题和描述

### 添加品牌 Logo

```sql
-- 示例：更新品牌 logo
UPDATE "Brand"
SET logo = 'https://example.com/brand-logo.png'
WHERE slug = 'brand-slug';
```

### 完善产品变体

如果自动提取的颜色/尺寸不准确：

1. 在管理后台手动编辑
2. 或使用 SQL 直接更新：

```sql
-- 添加新变体
INSERT INTO "ProductVariant" (id, "productId", color, size, inventory, "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'product-id', 'Black', 'M', 10, true, NOW(), NOW());
```

## 测试清单

- [ ] 品牌页面正常显示
- [ ] 品牌筛选功能正常
- [ ] 产品详情页显示变体选择器
- [ ] 选择不同变体时库存正确更新
- [ ] 搜索功能包含品牌和变体信息
- [ ] 添加到购物车时选择的变体正确

## 故障排除

### 迁移失败

如果 Prisma 迁移失败：

```bash
# 重置数据库（警告：会删除所有数据）
npx prisma migrate reset

# 或者手动修复
npx prisma db push --force-reset
```

### 品牌数据未迁移

检查 `lib/utils/brands.ts` 中的 `getBrandInfo` 函数是否正确识别品牌标签。

### 变体未创建

检查产品的 `titleEn` 和 `tags` 是否包含颜色/尺寸信息。可能需要手动添加标签：

```typescript
// 示例：添加颜色标签
await prisma.product.update({
  where: { id: 'product-id' },
  data: {
    tags: { push: ['color:black', 'size:M'] }
  }
});
```

## 后续优化建议

1. **图片优化**
   - 为每个变体添加独立图片
   - 实现图片懒加载

2. **库存管理**
   - 实现变体级别的库存预警
   - 添加自动补货提醒

3. **SEO 优化**
   - 为品牌页面添加结构化数据
   - 优化产品变体的 URL 结构

4. **性能优化**
   - 添加品牌和变体的缓存
   - 实现增量静态生成（ISR）

## 联系支持

如有问题，请查看：
- Prisma 文档: https://www.prisma.io/docs
- Next.js 文档: https://nextjs.org/docs
