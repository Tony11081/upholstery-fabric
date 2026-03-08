# 🧪 测试商品优化系统 - 快速指南

## 在 Dokploy 中运行测试

### 第 1 步：进入容器

```bash
# 在 Dokploy 控制台，进入 luxury-shop 容器
docker exec -it <luxury-shop-container> /bin/sh

# 或通过 SSH
ssh your-server
docker ps | grep luxury-shop
docker exec -it <container-id> /bin/sh
```

### 第 2 步：确保 Bridge Worker 在运行

```bash
# 检查是否在运行
ps aux | grep openclaw-bridge-worker

# 如果没有运行，启动它
cd /app
OPENCLAW_BRIDGE_SITE_URL="https://luxuryootd.com" \
OPENCLAW_BRIDGE_TOKEN="a1cbb3f82298e637aa1df62624cd6090583a3500f97c36c69a26301b4341251f" \
OPENCLAW_LOCAL_BASE_URL="http://127.0.0.1:18789/v1" \
OPENCLAW_LOCAL_TOKEN="3ebbfbee52e1ab8231f60a343cacc4e822f19edc93969de3" \
npx tsx scripts/openclaw-bridge-worker.ts > /tmp/bridge-worker.log 2>&1 &

# 查看日志确认启动
tail -f /tmp/bridge-worker.log
# 应该看到：
# [openclaw-bridge-worker] workerId=openclaw-bridge-xxxxx
# [openclaw-bridge-worker] siteUrl=https://luxuryootd.com
# [openclaw-bridge-worker] Ready to process jobs...
```

### 第 3 步：更新数据库 Schema

```bash
cd /app

# 生成 Prisma Client（包含新的 PRODUCT_OPTIMIZATION 类型）
npx prisma generate

# 如果需要运行 migration
npx prisma migrate deploy
```

### 第 4 步：运行测试脚本

```bash
cd /app
npx tsx scripts/test-optimization.ts
```

**输出示例：**
```
🧪 Testing Product Optimization System
=====================================

📦 Selecting 10 products for testing...
✓ Found 10 products

Selected products:
  1. Louis Vuitton p110 16 10 Mini Bag (clx123abc)
     Images: 8, Current desc length: 45 chars
  2. Coach p165 size 11 Bag (clx456def)
     Images: 10, Current desc length: 38 chars
  ...

🚀 Creating optimization jobs...
  ✓ Queued: Louis Vuitton p110 16 10 Mini Bag...
  ✓ Queued: Coach p165 size 11 Bag...
  ...

✓ Created 10 optimization jobs

⏳ Monitoring progress (this may take 5-10 minutes)...

  ✅ [1/10] Completed: Louis Vuitton p110 16 10 Mini Bag...
     Progress: 1 done, 0 failed, 9 pending (15s elapsed)
  ✅ [2/10] Completed: Coach p165 size 11 Bag...
     Progress: 2 done, 0 failed, 8 pending (28s elapsed)
  ...

✓ All jobs completed in 127 seconds

📊 Results Summary
==================

Total: 10
Completed: 10
Failed: 0
Success rate: 100%

Detailed Results:
-----------------

✅ clx123abc
   Old title: Louis Vuitton p110 16 10 Mini Bag
   New title: Louis Vuitton Mini Speedy Bag 16cm - Monogram Canvas Crossbody
   Description: Authentic Louis Vuitton Mini Speedy crossbody bag in iconic monogram canvas...
   Colors found: 2
     - Classic Monogram (Brown): Brown canvas with tan leather trim and gold hardware
     - Monogram Eclipse (Black): Black/grey canvas with black leather trim and silver hardware

✅ clx456def
   Old title: Coach p165 size 11 Bag
   New title: Coach Mini Bucket Bag 11cm - Signature Canvas Crossbody
   Description: Elegant Coach mini bucket bag featuring signature "C" monogram canvas...
   Colors found: 4
     - Blue Signature (Blue): Light blue canvas with black leather trim
     - Black Signature (Black): Charcoal grey canvas with black leather trim
     - Solid Black (Black): Smooth black leather with rhinestone charm
     - Tan/Pink (Brown): Classic tan canvas with pink leather top panel

...

🎉 Test completed!

Next steps:
1. Check the optimized products on the website
2. If satisfied, run batch optimization for all products
```

---

## 验证结果

### 在网站上查看优化后的商品

访问测试的商品页面，确认：
- ✅ 标题更专业、更详细
- ✅ 描述更丰富、更吸引人
- ✅ 英文内容质量高

### 查看数据库

```sql
-- 查看优化后的商品
SELECT id, "titleEn", LENGTH("descriptionEn") as desc_length
FROM "Product"
WHERE id IN ('clx123abc', 'clx456def', ...)
ORDER BY "updatedAt" DESC;
```

---

## 如果测试成功

### 批量优化所有商品

```bash
# 方式 1：通过 API（推荐）
curl -X POST https://luxuryootd.com/api/admin/optimize-products \
  -H "Content-Type: application/json" \
  -d '{"action": "auto", "limit": 100}'

# 方式 2：运行脚本
cd /app
npx tsx scripts/optimize-products.ts --limit 100

# 方式 3：设置 cron 自动处理
# 每小时优化 50 个商品
0 * * * * cd /app && curl -X POST https://luxuryootd.com/api/admin/optimize-products \
  -H "Content-Type: application/json" \
  -d '{"action": "auto", "limit": 50}'
```

---

## 故障排除

### 问题：Bridge Worker 无法启动

**检查：**
```bash
# 查看错误日志
cat /tmp/bridge-worker.log

# 常见问题：
# 1. 端口 18789 未监听 - OpenClaw gateway 未运行
# 2. DATABASE_URL 未设置 - 检查环境变量
# 3. 权限问题 - 检查文件权限
```

### 问题：任务一直 PENDING

**检查：**
```bash
# 1. Bridge Worker 是否在运行
ps aux | grep openclaw-bridge-worker

# 2. 查看 Worker 日志
tail -f /tmp/bridge-worker.log

# 3. 检查任务队列
psql $DATABASE_URL -c "SELECT * FROM \"AiBridgeJob\" WHERE type = 'PRODUCT_OPTIMIZATION' ORDER BY \"createdAt\" DESC LIMIT 5;"
```

### 问题：优化失败

**查看错误：**
```bash
# 查看失败任务的错误信息
psql $DATABASE_URL -c "SELECT id, error FROM \"AiBridgeJob\" WHERE type = 'PRODUCT_OPTIMIZATION' AND status = 'FAILED' ORDER BY \"createdAt\" DESC LIMIT 5;"
```

---

## 预期时间

- **测试 10 个商品**：约 2-3 分钟
- **每个商品处理时间**：5-10 秒
- **批量 100 个**：约 10-15 分钟
- **全部 9,143 个**：约 12-24 小时（可并行加速）

---

## 下一步

测试成功后：
1. ✅ 确认优化效果满意
2. 🚀 开始批量优化所有商品
3. 🔄 设置自动优化新商品
4. 📊 监控系统运行状态

**准备好了吗？开始测试！** 🧪
