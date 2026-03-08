#!/bin/bash

# 产品数据增强 - 一键部署脚本
# 此脚本将自动完成所有数据库迁移和数据填充

set -e  # 遇到错误立即退出

echo "🚀 开始部署产品数据增强功能..."
echo ""

# 检查是否在正确的目录
if [ ! -f "package.json" ]; then
    echo "❌ 错误：请在项目根目录运行此脚本"
    exit 1
fi

# 1. 格式化 Prisma schema
echo "📝 格式化 Prisma schema..."
npx prisma format

# 2. 生成并应用数据库迁移
echo ""
echo "🗄️  生成数据库迁移..."
npx prisma migrate dev --name add_brands_and_variants

# 3. 重新生成 Prisma Client
echo ""
echo "🔄 重新生成 Prisma Client..."
npx prisma generate

# 4. 运行品牌迁移脚本
echo ""
echo "🏷️  迁移品牌数据..."
npx tsx scripts/migrate-brands.ts

# 5. 创建产品变体
echo ""
echo "🎨 创建产品变体..."
npx tsx scripts/create-variants.ts

# 6. 完成
echo ""
echo "✅ 部署完成！"
echo ""
echo "📋 后续步骤："
echo "1. 运行 'npm run dev' 启动开发服务器"
echo "2. 访问 /brands 查看品牌页面"
echo "3. 访问任意产品页面查看变体选择器"
echo "4. 测试搜索功能（现在包含品牌和变体）"
echo ""
echo "📖 详细文档请查看 IMPLEMENTATION_GUIDE.md"
