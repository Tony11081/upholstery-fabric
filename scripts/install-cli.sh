#!/bin/bash

# UOOTD CLI 全局安装脚本

echo "🚀 安装 UOOTD CLI..."
echo ""

# 检查是否在项目目录
if [ ! -f "package.json" ]; then
    echo "❌ 错误：请在项目根目录运行此脚本"
    exit 1
fi

# 全局链接
echo "📦 创建全局链接..."
npm link

echo ""
echo "✅ 安装完成！"
echo ""
echo "现在你可以在任何地方使用 'uootd' 命令："
echo ""
echo "  uootd --help          查看所有命令"
echo "  uootd stats           查看网站统计"
echo "  uootd products list   列出产品"
echo "  uootd ai test         测试 AI 连接"
echo "  uootd deploy          一键部署"
echo ""
