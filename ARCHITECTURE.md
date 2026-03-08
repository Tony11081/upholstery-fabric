# 系统架构 - 产品数据增强

## 数据模型关系图

```
┌─────────────────┐
│     Brand       │
│─────────────────│
│ id              │
│ name            │
│ slug            │
│ logo            │
│ description     │
│ isActive        │
└────────┬────────┘
         │
         │ 1:N
         │
         ▼
┌─────────────────┐         ┌──────────────────┐
│    Product      │◄────────│   Category       │
│─────────────────│  N:1    │──────────────────│
│ id              │         │ id               │
│ slug            │         │ nameEn           │
│ titleEn         │         │ slug             │
│ descriptionEn   │         │ parentId         │
│ price           │         │ status           │
│ brandId         │         └──────────────────┘
│ categoryId      │
│ inventory       │
│ tags[]          │
└────────┬────────┘
         │
         │ 1:N
         │
         ▼
┌─────────────────┐
│ ProductVariant  │
│─────────────────│
│ id              │
│ productId       │
│ sku             │
│ color           │
│ size            │
│ material        │
│ price           │
│ inventory       │
└─────────────────┘
```

## 搜索流程

```
用户输入搜索词
      │
      ▼
┌─────────────────────────────┐
│  buildSearchTerms()         │
│  - 分词                      │
│  - 生成 slug                 │
│  - 标准化                    │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ buildProductSearchFilters() │
│  - 品牌匹配                  │
│  - 颜色/尺寸标签             │
│  - 分类匹配                  │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│  Prisma 查询                 │
│  - titleEn                  │
│  - descriptionEn            │
│  - brand.name               │
│  - category.nameEn          │
│  - variants.color           │
│  - variants.size            │
│  - tags                     │
└──────────┬──────────────────┘
           │
           ▼
      返回结果
```

## 页面结构

```
/
├── /brands
│   ├── page.tsx (品牌列表)
│   └── /[slug]
│       └── page.tsx (品牌详情 + 产品列表)
│
├── /categories
│   └── /[slug]
│       └── page.tsx (分类产品列表)
│
├── /product
│   └── /[slug]
│       └── page.tsx (产品详情 + 变体选择器)
│
└── /search
    └── /results
        └── page.tsx (搜索结果)
```

## 组件层次

```
HomePage
├── BrandFilter (品牌筛选)
├── CategoryFilter (分类筛选)
└── ProductGrid
    └── ProductCard (产品卡片)

ProductDetailPage
├── ProductImages (产品图片)
├── ProductInfo (产品信息)
│   ├── Brand (品牌显示)
│   ├── Category (分类显示)
│   └── VariantSelector (变体选择器)
│       ├── ColorSelector (颜色选择)
│       └── SizeSelector (尺寸选择)
└── RelatedProducts (相关产品)

BrandPage
├── BrandHeader (品牌信息)
└── ProductGrid (品牌产品列表)
```

## 数据流

```
1. 用户访问产品页面
         │
         ▼
2. getProductBySlug()
   - 查询产品
   - 包含 brand
   - 包含 variants
   - 包含 category
         │
         ▼
3. 渲染产品详情
   - 显示品牌名称
   - 显示变体选择器
   - 根据选择更新库存
         │
         ▼
4. 用户选择变体
   - 更新选中的颜色/尺寸
   - 显示对应库存
   - 更新价格（如果变体有独立价格）
         │
         ▼
5. 添加到购物车
   - 包含选中的变体信息
   - 验证库存
```

## 迁移流程

```
原始数据
├── Product.tags[] (包含品牌、颜色、尺寸)
└── Product.titleEn (可能包含颜色、尺寸)
         │
         ▼
migrate-brands.ts
├── 从 tags 提取品牌
├── 创建 Brand 记录
└── 更新 Product.brandId
         │
         ▼
create-variants.ts
├── 从 tags 提取颜色/尺寸
├── 从 titleEn 提取颜色/尺寸
├── 创建 ProductVariant 记录
└── 分配库存
         │
         ▼
generate-product-descriptions.ts (可选)
├── 检测空描述
├── 使用 AI 生成描述
└── 更新 Product.descriptionEn
         │
         ▼
结构化数据
├── Brand (独立品牌表)
├── Product (关联 brandId)
└── ProductVariant (颜色、尺寸变体)
```

## API 端点

```
GET /api/search?q=keyword
├── 搜索产品
├── 包含品牌匹配
├── 包含变体匹配
└── 返回产品列表

GET /brands
└── 获取所有品牌

GET /brands/[slug]
└── 获取品牌详情和产品

GET /product/[slug]
├── 获取产品详情
├── 包含品牌信息
└── 包含所有变体
```

## 性能优化

```
数据库层
├── Brand.slug 索引
├── Product.brandId 索引
├── ProductVariant.productId 索引
├── ProductVariant.color 索引
└── ProductVariant.size 索引

应用层
├── React.cache() 缓存查询
├── Next.js ISR (revalidate: 60)
└── 产品列表分页

前端
├── 图片懒加载
├── 变体选择器客户端状态
└── 搜索防抖
```
