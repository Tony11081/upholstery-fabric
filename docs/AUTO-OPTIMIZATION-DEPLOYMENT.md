# 🚀 自动商品优化系统 - 部署指南

## 系统概述

这是一个完全自动化的商品优化系统，通过 Bridge Worker 实现：

```
新商品上传 → 自动创建优化任务 → Bridge Worker 处理 → 自动更新商品
```

## 功能

✅ **自动识别颜色变体** - 分析商品图片，识别多个颜色
✅ **优化英文标题** - 生成 SEO 友好的专业标题
✅ **生成详细描述** - 创建吸引人的商品描述
✅ **实时处理** - 新商品上传后自动优化
✅ **批量处理** - 可以批量优化现有商品

---

## 部署步骤

### 第 1 步：更新数据库 Schema

```bash
cd /app

# 运行 migration 添加新的 job 类型
npx prisma migrate dev --name add_product_optimization

# 或直接运行 SQL
psql $DATABASE_URL < prisma/migrations/add_product_optimization_job_type.sql

# 生成 Prisma Client
npx prisma generate
```

### 第 2 步：重启 Bridge Worker

Bridge Worker 已更新，支持商品优化任务。

在 Dokploy 中：

```bash
# 停止旧的 worker（如果在运行）
pkill -f openclaw-bridge-worker

# 启动新的 worker
cd /app
OPENCLAW_BRIDGE_SITE_URL="https://luxuryootd.com" \
OPENCLAW_BRIDGE_TOKEN="a1cbb3f82298e637aa1df62624cd6090583a3500f97c36c69a26301b4341251f" \
OPENCLAW_LOCAL_BASE_URL="http://127.0.0.1:18789/v1" \
OPENCLAW_LOCAL_TOKEN="3ebbfbee52e1ab8231f60a343cacc4e822f19edc93969de3" \
npx tsx scripts/openclaw-bridge-worker.ts &

# 或使用 pm2（推荐）
pm2 start "npx tsx scripts/openclaw-bridge-worker.ts" --name openclaw-bridge
pm2 save
```

### 第 3 步：测试系统

#### 测试 1：手动优化单个商品

```bash
curl -X POST https://luxuryootd.com/api/admin/optimize-products \
  -H "Content-Type: application/json" \
  -d '{
    "action": "queue",
    "productId": "你的商品ID"
  }'
```

#### 测试 2：查看优化状态

```bash
curl "https://luxuryootd.com/api/admin/optimize-products?productId=你的商品ID"
```

#### 测试 3：批量优化未优化的商品

```bash
curl -X POST https://luxuryootd.com/api/admin/optimize-products \
  -H "Content-Type: application/json" \
  -d '{
    "action": "auto",
    "limit": 10
  }'
```

---

## 使用方式

### 方式 1：自动优化（推荐）

在商品创建/导入时自动触发：

```typescript
// 在你的商品创建代码中
import { queueProductOptimization } from '@/lib/product-auto-optimize';

async function createProduct(data) {
  // 创建商品
  const product = await prisma.product.create({ data });
  
  // 自动排队优化
  await queueProductOptimization(product.id);
  
  return product;
}
```

### 方式 2：批量优化现有商品

```bash
# 优化前 100 个未优化的商品
curl -X POST https://luxuryootd.com/api/admin/optimize-products \
  -H "Content-Type: application/json" \
  -d '{"action": "auto", "limit": 100}'
```

### 方式 3：定时自动优化

添加到 cron 或定时任务：

```bash
# 每小时优化 50 个商品
0 * * * * curl -X POST https://luxuryootd.com/api/admin/optimize-products \
  -H "Content-Type: application/json" \
  -d '{"action": "auto", "limit": 50}'
```

---

## API 文档

### POST /api/admin/optimize-products

**排队优化单个商品：**
```json
{
  "action": "queue",
  "productId": "clx123abc"
}
```

**响应：**
```json
{
  "success": true,
  "job": {
    "id": "job_123",
    "productId": "clx123abc",
    "status": "PENDING",
    "createdAt": "2026-02-07T..."
  }
}
```

**批量优化：**
```json
{
  "action": "auto",
  "limit": 10
}
```

**响应：**
```json
{
  "success": true,
  "queued": 10,
  "jobs": [
    { "id": "job_1", "productId": "prod_1", "status": "PENDING" },
    ...
  ]
}
```

**查看状态：**
```json
{
  "action": "status",
  "productId": "clx123abc"
}
```

**响应：**
```json
{
  "success": true,
  "status": "done",
  "jobId": "job_123",
  "result": {
    "productId": "clx123abc",
    "titleEn": "Louis Vuitton Mini Speedy Bag 16cm - Monogram Canvas Crossbody",
    "descriptionEn": "Authentic Louis Vuitton...",
    "colors": [
      {
        "name": "Classic Monogram",
        "color": "Brown",
        "description": "Brown canvas with tan leather trim"
      }
    ]
  }
}
```

### GET /api/admin/optimize-products?productId=xxx

查看商品优化状态。

---

## 监控和调试

### 查看 Bridge Worker 日志

```bash
# 如果用 pm2
pm2 logs openclaw-bridge

# 或查看进程输出
ps aux | grep openclaw-bridge-worker
```

### 查看任务队列

```sql
-- 查看待处理任务
SELECT * FROM "AiBridgeJob" 
WHERE type = 'PRODUCT_OPTIMIZATION' 
AND status = 'PENDING' 
ORDER BY "createdAt" DESC 
LIMIT 10;

-- 查看失败任务
SELECT * FROM "AiBridgeJob" 
WHERE type = 'PRODUCT_OPTIMIZATION' 
AND status = 'FAILED' 
ORDER BY "createdAt" DESC 
LIMIT 10;

-- 查看处理统计
SELECT status, COUNT(*) 
FROM "AiBridgeJob" 
WHERE type = 'PRODUCT_OPTIMIZATION' 
GROUP BY status;
```

### 常见问题

**问题：任务一直是 PENDING 状态**
- 检查 Bridge Worker 是否在运行
- 检查 Worker 日志是否有错误
- 确认 DATABASE_URL 配置正确

**问题：优化结果不理想**
- 检查商品图片质量
- 确认图片 URL 可访问
- 查看 job.error 字段了解具体错误

**问题：处理太慢**
- 每个商品约需 5-10 秒
- 可以运行多个 Worker 实例并行处理
- 调整 Bridge Worker 的轮询间隔

---

## 性能优化

### 并行处理

运行多个 Worker 实例：

```bash
# Worker 1
OPENCLAW_BRIDGE_WORKER_ID="worker-1" npx tsx scripts/openclaw-bridge-worker.ts &

# Worker 2
OPENCLAW_BRIDGE_WORKER_ID="worker-2" npx tsx scripts/openclaw-bridge-worker.ts &

# Worker 3
OPENCLAW_BRIDGE_WORKER_ID="worker-3" npx tsx scripts/openclaw-bridge-worker.ts &
```

### 批量处理策略

```bash
# 分批优化所有商品（每批 100 个）
for i in {1..92}; do
  curl -X POST https://luxuryootd.com/api/admin/optimize-products \
    -H "Content-Type: application/json" \
    -d '{"action": "auto", "limit": 100}'
  sleep 300  # 等待 5 分钟
done
```

---

## 下一步改进

1. **添加颜色变体表** - 创建真正的可选择颜色选项
2. **图片质量检测** - 自动检测低质量图片
3. **多语言支持** - 生成多语言描述
4. **SEO 优化** - 自动生成 meta tags
5. **A/B 测试** - 测试不同的标题和描述

---

## 总结

✅ **系统已就绪**
- Bridge Worker 支持商品优化
- API 端点已创建
- 可以手动或自动触发

✅ **完全自动化**
- 新商品自动优化
- 批量处理现有商品
- 实时更新数据库

✅ **可扩展**
- 支持并行处理
- 可添加更多优化功能
- 易于监控和调试

**现在就可以开始使用！** 🚀
