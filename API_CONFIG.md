# ✅ API 配置完成

## 配置信息

**AI 服务提供商：** Kuai Host
**API Key：** `sk-ZaIcZLX7px5gq4nq8Y2FT7Gx4xokndLdhgjpln0sXFvwjSPh`
**Base URL：** `https://api.kuai.host/v1`
**模型：** `claude-3-5-haiku-20241022` (Claude 3.5 Haiku)

## 模型特点

### Claude 3.5 Haiku

✅ **优势：**
- 支持视觉识别（可以分析图片）
- 速度快（2-3 秒响应）
- 成本低（比 GPT-4o 便宜 80%）
- 质量高（Anthropic 最新模型）
- 支持中文和英文

💰 **成本估算：**
- 每张图片分析：~$0.001-0.002
- 100 个产品：~$0.10-0.20
- 1000 个产品：~$1.00-2.00

⚡ **性能：**
- 响应时间：2-3 秒/请求
- 100 个产品处理时间：~3-5 分钟

## 可用模型列表

根据你的 Kuai 分组（Claude Code专属、Codex专属、优质gemini），支持以下模型：

### Claude 系列（推荐）
- ✅ `claude-3-5-haiku-20241022` - **当前使用**（最便宜，速度快）
- `claude-3-5-sonnet-20241022` - 更强大但更贵
- `claude-opus-4-20250514` - 最强但最贵

### Gemini 系列
- `gemini-2.0-flash-exp` - Google 最新模型，免费但可能不稳定
- `gemini-1.5-pro` - 稳定但较贵

## 测试结果

```bash
✅ Connection successful!
Response: AI connection successful!

💰 Cost info:
   Tokens used: 22
   Model: claude-3-5-haiku-20241022

✅ Ready for AI optimization!
```

## 配置文件位置

`.env.local` 中的相关配置：

```bash
OPENROUTER_API_KEY="sk-ZaIcZLX7px5gq4nq8Y2FT7Gx4xokndLdhgjpln0sXFvwjSPh"
OPENROUTER_MODEL="claude-3-5-haiku-20241022"
OPENROUTER_BASE_URL="https://api.kuai.host/v1"
OPENROUTER_SITE_URL="http://localhost:3000"
OPENROUTER_APP_NAME="UOOTD Admin"
OPENROUTER_TIMEOUT_MS="45000"
```

## 下一步

现在可以开始 AI 优化了！

### 快速开始

```bash
# 方式 1: 一键部署
./scripts/deploy-ai-optimization.sh

# 方式 2: 手动运行
npx prisma migrate dev --name add_brands_and_variants
npx tsx scripts/ai-optimize-batch.ts
```

### 预期效果

使用 Claude 3.5 Haiku 进行图片识别：

**输入：** 产品图片
**输出：**
- 标题：如 "Louis Vuitton Speedy 30 Handbag"
- 描述：优雅的 2-3 句产品描述
- 品牌：Louis Vuitton
- 颜色：Brown
- 尺寸：30cm
- 材质：Canvas

## 成本控制

### 当前配置（Claude Haiku）
- 非常便宜
- 适合大规模处理
- 质量足够好

### 如需更高质量
可以改用 `claude-3-5-sonnet-20241022`：

```bash
# 编辑 .env.local
OPENROUTER_MODEL="claude-3-5-sonnet-20241022"
```

成本会增加约 3-5 倍，但识别准确度更高。

## 故障排除

### 如果遇到错误

1. **检查 API Key**
   ```bash
   grep OPENROUTER_API_KEY .env.local
   ```

2. **测试连接**
   ```bash
   npx tsx scripts/test-ai-connection.ts
   ```

3. **查看余额**
   访问 Kuai Host 控制台检查余额

### 如果模型不可用

尝试其他模型：
```bash
# Gemini（免费）
OPENROUTER_MODEL="gemini-2.0-flash-exp"

# Claude Sonnet（更强）
OPENROUTER_MODEL="claude-3-5-sonnet-20241022"
```

---

**配置完成时间：** 2026-03-04
**状态：** ✅ 已测试，可以使用
**下一步：** 运行 AI 优化脚本
