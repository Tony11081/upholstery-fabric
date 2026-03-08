# 🖥️ UOOTD CLI 管理工具

## 简介

UOOTD CLI 是一个强大的命令行工具，让你可以通过终端方便地管理 luxury-shop 网站。

## 安装

### 方式 1: 本地使用

```bash
cd /Users/chengyadong/Documents/uootd商店/luxury-shop
npm run uootd -- <command>
```

### 方式 2: 全局安装（推荐）

```bash
cd /Users/chengyadong/Documents/uootd商店/luxury-shop
./scripts/install-cli.sh

# 或者手动
npm link
```

安装后可以在任何地方使用：

```bash
uootd <command>
```

## 命令列表

### 📦 产品管理

#### 列出产品

```bash
uootd products list                    # 列出最近 20 个产品
uootd products list -l 50              # 列出 50 个产品
uootd products list -b gucci           # 列出 Gucci 品牌产品
uootd products list -c handbag         # 列出手提包分类产品
```

#### AI 优化产品

```bash
uootd products optimize                # 批量优化（10 个/批）
uootd products optimize --all          # 一次性优化所有产品
```

#### 检查数据质量

```bash
uootd products check                   # 运行数据完整性检查
```

### 🏷️ 品牌管理

#### 列出品牌

```bash
uootd brands list                      # 列出所有品牌
```

#### 创建品牌

```bash
uootd brands create "Louis Vuitton"    # 创建品牌
uootd brands create "Gucci" -s gucci   # 创建品牌并指定 slug
```

### 🗄️ 数据库管理

#### 迁移

```bash
uootd db migrate                       # 运行数据库迁移
```

#### Prisma Studio

```bash
uootd db studio                        # 打开可视化数据库管理界面
```

#### 备份

```bash
uootd db backup                        # 备份数据库到 backups/ 目录
```

### 🤖 AI 工具

#### 测试连接

```bash
uootd ai test                          # 测试 AI API 连接
```

#### 查看进度

```bash
uootd ai status                        # 查看 AI 优化进度
```

#### 重置进度

```bash
uootd ai reset                         # 重置优化进度，重新开始
```

### 💻 开发工具

#### 启动开发服务器

```bash
uootd dev start                        # 启动 Next.js 开发服务器
```

#### 构建

```bash
uootd dev build                        # 构建生产版本
```

### 🚀 部署

#### 一键部署

```bash
uootd deploy                           # 完整部署（迁移 + AI 优化）
uootd deploy --skip-ai                 # 部署但跳过 AI 优化
```

### 📊 统计信息

```bash
uootd stats                            # 显示网站统计信息
```

## 使用示例

### 场景 1: 首次部署

```bash
# 1. 测试 AI 连接
uootd ai test

# 2. 运行完整部署
uootd deploy

# 3. 查看统计
uootd stats
```

### 场景 2: 日常管理

```bash
# 查看最新产品
uootd products list -l 10

# 查看品牌列表
uootd brands list

# 查看 AI 优化进度
uootd ai status

# 继续优化剩余产品
uootd products optimize
```

### 场景 3: 添加新产品后

```bash
# 1. 运行 AI 优化
uootd products optimize

# 2. 检查数据质量
uootd products check

# 3. 查看统计
uootd stats
```

### 场景 4: 数据库管理

```bash
# 备份数据库
uootd db backup

# 打开可视化管理界面
uootd db studio

# 运行迁移
uootd db migrate
```

## 高级用法

### 组合使用

```bash
# 列出 Gucci 品牌的前 5 个产品
uootd products list -b gucci -l 5

# 部署并跳过 AI 优化
uootd deploy --skip-ai
```

### 在脚本中使用

```bash
#!/bin/bash

# 自动化部署脚本
echo "开始部署..."

# 测试 AI
uootd ai test || exit 1

# 运行部署
uootd deploy

# 显示统计
uootd stats

echo "部署完成！"
```

### 定时任务

```bash
# 添加到 crontab，每天凌晨 2 点优化新产品
0 2 * * * cd /Users/chengyadong/Documents/uootd商店/luxury-shop && uootd products optimize
```

## 与 OpenClaw 集成

你可以将 UOOTD CLI 集成到 OpenClaw 中：

### 方式 1: 创建 OpenClaw Skill

```bash
# 在 ~/.openclaw/skills/ 创建 uootd skill
mkdir -p ~/.openclaw/skills/uootd
```

创建 `~/.openclaw/skills/uootd/skill.json`:

```json
{
  "name": "uootd",
  "description": "UOOTD Luxury Shop 管理工具",
  "version": "1.0.0",
  "commands": {
    "stats": {
      "description": "显示网站统计",
      "exec": "cd /Users/chengyadong/Documents/uootd商店/luxury-shop && uootd stats"
    },
    "optimize": {
      "description": "AI 优化产品",
      "exec": "cd /Users/chengyadong/Documents/uootd商店/luxury-shop && uootd products optimize"
    },
    "check": {
      "description": "检查数据质量",
      "exec": "cd /Users/chengyadong/Documents/uootd商店/luxury-shop && uootd products check"
    }
  }
}
```

然后在 OpenClaw 中使用：

```bash
openclaw run uootd:stats
openclaw run uootd:optimize
openclaw run uootd:check
```

### 方式 2: 直接在 OpenClaw 中调用

在 OpenClaw 的配置中添加别名：

```json
{
  "aliases": {
    "shop-stats": "cd /Users/chengyadong/Documents/uootd商店/luxury-shop && uootd stats",
    "shop-optimize": "cd /Users/chengyadong/Documents/uootd商店/luxury-shop && uootd products optimize",
    "shop-deploy": "cd /Users/chengyadong/Documents/uootd商店/luxury-shop && uootd deploy"
  }
}
```

## 故障排除

### 命令找不到

```bash
# 确保已安装
npm link

# 或使用完整路径
npm run uootd -- <command>
```

### 权限错误

```bash
# 给脚本执行权限
chmod +x cli/index.ts
chmod +x scripts/*.sh
```

### 数据库连接错误

```bash
# 检查 DATABASE_URL
grep DATABASE_URL .env.local

# 测试连接
uootd db studio
```

### AI API 错误

```bash
# 测试 API 连接
uootd ai test

# 检查配置
grep OPENROUTER .env.local
```

## 快捷键和别名

在 `~/.zshrc` 或 `~/.bashrc` 中添加：

```bash
# UOOTD CLI 别名
alias shop='uootd'
alias shop-stats='uootd stats'
alias shop-optimize='uootd products optimize'
alias shop-check='uootd products check'
alias shop-deploy='uootd deploy'
alias shop-dev='uootd dev start'
```

重新加载配置：

```bash
source ~/.zshrc
```

然后可以使用：

```bash
shop stats
shop-optimize
shop-deploy
```

## 更新日志

### v1.0.0 (2026-03-04)
- ✅ 初始版本
- ✅ 产品管理命令
- ✅ 品牌管理命令
- ✅ 数据库管理命令
- ✅ AI 工具命令
- ✅ 开发工具命令
- ✅ 部署命令
- ✅ 统计命令

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可

MIT License
