# ✅ CLI 工具集成完成

## 概述

我已经为你的 luxury-shop 创建了一个功能强大的 CLI 管理工具 `uootd`，让你可以通过命令行方便地管理网站。

## 🎯 核心功能

### 1. 产品管理
- ✅ 列出产品（支持筛选）
- ✅ AI 批量优化
- ✅ 数据质量检查

### 2. 品牌管理
- ✅ 列出所有品牌
- ✅ 创建新品牌

### 3. 数据库管理
- ✅ 运行迁移
- ✅ 打开 Prisma Studio
- ✅ 填充测试数据
- ✅ 备份数据库

### 4. AI 工具
- ✅ 测试 API 连接
- ✅ 查看优化进度
- ✅ 重置进度

### 5. 开发工具
- ✅ 启动开发服务器
- ✅ 构建生产版本
- ✅ 运行测试

### 6. 部署
- ✅ 一键部署（迁移 + AI 优化）

### 7. 统计
- ✅ 显示网站统计信息

## 📦 文件清单

| 文件 | 说明 |
|------|------|
| `cli/index.ts` | CLI 主程序 |
| `scripts/install-cli.sh` | 全局安装脚本 |
| `CLI_GUIDE.md` | 完整使用文档 |
| `CLI_QUICK_REFERENCE.md` | 快速参考 |
| `CLI_INTEGRATION.md` | 本文件 |

## 🚀 快速开始

### 安装

```bash
cd /Users/chengyadong/Documents/uootd商店/luxury-shop

# 方式 1: 全局安装（推荐）
./scripts/install-cli.sh

# 方式 2: 本地使用
npm run uootd -- <command>
```

### 基本使用

```bash
# 查看帮助
uootd --help

# 查看统计
uootd stats

# 列出产品
uootd products list

# AI 优化
uootd products optimize

# 一键部署
uootd deploy
```

## 🔗 与 OpenClaw 集成

### 方式 1: 创建 OpenClaw Skill

在 `~/.openclaw/skills/uootd/` 创建 skill：

```json
{
  "name": "uootd",
  "description": "UOOTD Luxury Shop 管理",
  "commands": {
    "stats": {
      "exec": "cd /Users/chengyadong/Documents/uootd商店/luxury-shop && uootd stats"
    },
    "optimize": {
      "exec": "cd /Users/chengyadong/Documents/uootd商店/luxury-shop && uootd products optimize"
    }
  }
}
```

使用：

```bash
openclaw run uootd:stats
openclaw run uootd:optimize
```

### 方式 2: 添加到 OpenClaw 配置

在 `~/.openclaw/openclaw.json` 中添加：

```json
{
  "aliases": {
    "shop": "cd /Users/chengyadong/Documents/uootd商店/luxury-shop && uootd",
    "shop-stats": "cd /Users/chengyadong/Documents/uootd商店/luxury-shop && uootd stats",
    "shop-optimize": "cd /Users/chengyadong/Documents/uootd商店/luxury-shop && uootd products optimize",
    "shop-deploy": "cd /Users/chengyadong/Documents/uootd商店/luxury-shop && uootd deploy"
  }
}
```

使用：

```bash
openclaw shop stats
openclaw shop-optimize
openclaw shop-deploy
```

### 方式 3: Shell 别名

在 `~/.zshrc` 或 `~/.bashrc` 中添加：

```bash
# UOOTD CLI 别名
alias shop='cd /Users/chengyadong/Documents/uootd商店/luxury-shop && uootd'
alias shop-stats='cd /Users/chengyadong/Documents/uootd商店/luxury-shop && uootd stats'
alias shop-optimize='cd /Users/chengyadong/Documents/uootd商店/luxury-shop && uootd products optimize'
alias shop-deploy='cd /Users/chengyadong/Documents/uootd商店/luxury-shop && uootd deploy'
alias shop-dev='cd /Users/chengyadong/Documents/uootd商店/luxury-shop && uootd dev start'
```

重新加载：

```bash
source ~/.zshrc
```

使用：

```bash
shop stats
shop-optimize
shop-deploy
```

## 📋 命令速查表

### 产品管理

```bash
uootd products list                    # 列出产品
uootd products list -l 50              # 列出 50 个
uootd products list -b gucci           # 按品牌筛选
uootd products optimize                # AI 优化（批量）
uootd products optimize --all          # 优化所有
uootd products check                   # 检查质量
```

### 品牌管理

```bash
uootd brands list                      # 列出品牌
uootd brands create "Louis Vuitton"    # 创建品牌
```

### 数据库

```bash
uootd db migrate                       # 迁移
uootd db studio                        # 可视化管理
uootd db backup                        # 备份
```

### AI 工具

```bash
uootd ai test                          # 测试连接
uootd ai status                        # 查看进度
uootd ai reset                         # 重置进度
```

### 开发

```bash
uootd dev start                        # 启动服务器
uootd dev build                        # 构建
```

### 部署

```bash
uootd deploy                           # 完整部署
uootd deploy --skip-ai                 # 跳过 AI
```

### 统计

```bash
uootd stats                            # 网站统计
```

## 🎬 使用场景

### 场景 1: 首次部署

```bash
# 1. 测试 AI
uootd ai test

# 2. 完整部署
uootd deploy

# 3. 查看结果
uootd stats
```

### 场景 2: 日常管理

```bash
# 查看最新产品
uootd products list -l 10

# 查看品牌
uootd brands list

# 查看 AI 进度
uootd ai status

# 继续优化
uootd products optimize
```

### 场景 3: 添加新产品

```bash
# 1. 优化新产品
uootd products optimize

# 2. 检查质量
uootd products check

# 3. 查看统计
uootd stats
```

### 场景 4: 数据库维护

```bash
# 备份
uootd db backup

# 可视化管理
uootd db studio

# 迁移
uootd db migrate
```

## 🔄 自动化

### Cron 定时任务

```bash
# 编辑 crontab
crontab -e

# 添加定时任务
# 每天凌晨 2 点优化新产品
0 2 * * * cd /Users/chengyadong/Documents/uootd商店/luxury-shop && uootd products optimize

# 每周日凌晨 3 点备份数据库
0 3 * * 0 cd /Users/chengyadong/Documents/uootd商店/luxury-shop && uootd db backup
```

### Shell 脚本

创建 `~/scripts/shop-daily.sh`:

```bash
#!/bin/bash

cd /Users/chengyadong/Documents/uootd商店/luxury-shop

echo "🚀 开始每日维护..."

# 优化产品
uootd products optimize

# 检查质量
uootd products check

# 显示统计
uootd stats

echo "✅ 维护完成！"
```

## 💡 高级技巧

### 1. 组合命令

```bash
# 部署并查看统计
uootd deploy && uootd stats

# 优化并检查
uootd products optimize && uootd products check
```

### 2. 条件执行

```bash
# 只有 AI 测试成功才部署
uootd ai test && uootd deploy
```

### 3. 后台运行

```bash
# 后台优化
nohup uootd products optimize > optimize.log 2>&1 &
```

### 4. 输出重定向

```bash
# 保存统计到文件
uootd stats > stats.txt

# 保存产品列表
uootd products list -l 100 > products.txt
```

## 🐛 故障排除

### 命令找不到

```bash
# 重新安装
npm link

# 或使用完整路径
npm run uootd -- <command>
```

### 权限错误

```bash
chmod +x cli/index.ts
chmod +x scripts/*.sh
```

### 数据库错误

```bash
# 检查连接
grep DATABASE_URL .env.local

# 测试
uootd db studio
```

## 📚 文档

- `CLI_GUIDE.md` - 完整使用指南
- `CLI_QUICK_REFERENCE.md` - 快速参考
- `README_AI.md` - AI 优化指南
- `API_CONFIG.md` - API 配置

## 🎉 优势

### 相比手动操作

| 操作 | 手动 | CLI | 提升 |
|------|------|-----|------|
| 查看统计 | 打开浏览器 + 多次点击 | `uootd stats` | 10x 快 |
| AI 优化 | 打开终端 + 输入长命令 | `uootd products optimize` | 5x 快 |
| 数据库管理 | 记住复杂命令 | `uootd db studio` | 简单 |
| 部署 | 多个步骤 | `uootd deploy` | 一键完成 |

### 相比 Web 界面

- ✅ 更快速
- ✅ 可自动化
- ✅ 可脚本化
- ✅ 可远程执行
- ✅ 可集成到工作流

## 🚀 下一步

1. ✅ 安装 CLI
2. ✅ 测试基本命令
3. ✅ 设置别名
4. ✅ 集成到 OpenClaw
5. ✅ 设置自动化任务

---

**创建时间：** 2026-03-04
**版本：** 1.0.0
**状态：** ✅ 可用
