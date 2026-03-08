#!/bin/bash

# AI 驱动的产品数据优化 - 一键部署脚本
# 使用 AI 图片识别来优化产品标题、描述、品牌、颜色和尺寸

set -e

echo "🤖 AI 驱动的产品数据优化系统"
echo "================================"
echo ""

# 检查是否在正确的目录
if [ ! -f "package.json" ]; then
    echo "❌ 错误：请在项目根目录运行此脚本"
    exit 1
fi

# 检查环境变量
if [ -z "$OPENROUTER_API_KEY" ]; then
    echo "⚠️  警告：OPENROUTER_API_KEY 未设置"
    echo "   请在 .env.local 中设置 OPENROUTER_API_KEY"
    echo "   或运行: export OPENROUTER_API_KEY=your_key"
    echo ""
    read -p "是否继续？(y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo "📋 部署步骤："
echo "1. 格式化 Prisma schema"
echo "2. 生成数据库迁移"
echo "3. 重新生成 Prisma Client"
echo "4. 运行 AI 图片识别优化（批量处理）"
echo ""
read -p "开始部署？(Y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Nn]$ ]]; then
    exit 0
fi

# 1. 格式化 Prisma schema
echo ""
echo "📝 [1/4] 格式化 Prisma schema..."
npx prisma format

# 2. 生成并应用数据库迁移
echo ""
echo "🗄️  [2/4] 生成数据库迁移..."
npx prisma migrate dev --name add_brands_and_variants

# 3. 重新生成 Prisma Client
echo ""
echo "🔄 [3/4] 重新生成 Prisma Client..."
npx prisma generate

# 4. 运行 AI 优化
echo ""
echo "🤖 [4/4] 运行 AI 图片识别优化..."
echo ""
echo "⚠️  注意："
echo "   - 这将使用 AI 分析产品图片"
echo "   - 自动提取品牌、颜色、尺寸等信息"
echo "   - 生成优化的标题和描述"
echo "   - 支持断点续传，可以随时中断"
echo ""
read -p "开始 AI 优化？(Y/n) " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    echo ""
    echo "选择优化模式："
    echo "1. 批量模式（推荐）- 每次处理 10 个产品，支持断点续传"
    echo "2. 完整模式 - 一次性处理所有产品"
    echo ""
    read -p "选择模式 (1/2): " -n 1 -r
    echo

    if [[ $REPLY == "1" ]]; then
        echo ""
        echo "🚀 启动批量 AI 优化..."
        echo "💡 提示：可以随时按 Ctrl+C 中断，下次运行会从断点继续"
        echo ""
        npx tsx scripts/ai-optimize-batch.ts

        echo ""
        echo "✅ 批量处理完成！"
        echo ""
        echo "📊 查看进度："
        echo "   cat .ai-optimization-progress.json"
        echo ""
        echo "🔄 继续处理下一批："
        echo "   npx tsx scripts/ai-optimize-batch.ts"
    else
        echo ""
        echo "🚀 启动完整 AI 优化..."
        npx tsx scripts/ai-optimize-products.ts
    fi
fi

# 完成
echo ""
echo "✅ 部署完成！"
echo ""
echo "📋 后续步骤："
echo "1. 运行 'npm run dev' 启动开发服务器"
echo "2. 访问 /brands 查看品牌页面"
echo "3. 访问产品页面查看 AI 优化的标题和描述"
echo "4. 查看产品变体选择器（颜色/尺寸）"
echo ""
echo "🔍 检查数据质量："
echo "   npx tsx scripts/check-data-integrity.ts"
echo ""
echo "📖 详细文档："
echo "   - QUICK_START.md - 快速开始指南"
echo "   - IMPLEMENTATION_GUIDE.md - 实施指南"
echo "   - ARCHITECTURE.md - 系统架构"
