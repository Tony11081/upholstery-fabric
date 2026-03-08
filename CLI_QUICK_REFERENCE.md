# 🚀 UOOTD CLI 快速参考

## 安装

```bash
cd /Users/chengyadong/Documents/uootd商店/luxury-shop
./scripts/install-cli.sh
```

## 常用命令

| 命令 | 说明 | 示例 |
|------|------|------|
| `uootd stats` | 查看网站统计 | `uootd stats` |
| `uootd deploy` | 一键部署 | `uootd deploy` |
| `uootd products list` | 列出产品 | `uootd products list -l 20` |
| `uootd products optimize` | AI 优化产品 | `uootd products optimize` |
| `uootd products check` | 检查数据质量 | `uootd products check` |
| `uootd brands list` | 列出品牌 | `uootd brands list` |
| `uootd brands create` | 创建品牌 | `uootd brands create "Gucci"` |
| `uootd ai test` | 测试 AI 连接 | `uootd ai test` |
| `uootd ai status` | 查看 AI 进度 | `uootd ai status` |
| `uootd db migrate` | 数据库迁移 | `uootd db migrate` |
| `uootd db studio` | 打开数据库管理 | `uootd db studio` |
| `uootd dev start` | 启动开发服务器 | `uootd dev start` |

## 快捷别名

添加到 `~/.zshrc`:

```bash
alias shop='uootd'
alias shop-stats='uootd stats'
alias shop-optimize='uootd products optimize'
alias shop-deploy='uootd deploy'
```

## 工作流程

### 首次部署
```bash
uootd ai test          # 测试 AI
uootd deploy           # 完整部署
uootd stats            # 查看统计
```

### 日常管理
```bash
uootd products list    # 查看产品
uootd ai status        # 查看进度
uootd products optimize # 继续优化
```

### 添加新产品后
```bash
uootd products optimize # AI 优化
uootd products check    # 检查质量
uootd stats            # 查看统计
```

## 帮助

```bash
uootd --help                # 查看所有命令
uootd products --help       # 查看产品命令
uootd brands --help         # 查看品牌命令
```

## 完整文档

查看 `CLI_GUIDE.md` 获取详细文档。
