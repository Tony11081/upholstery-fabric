# 购物网站 + Inflyway 订单同步系统

## 更新记录

- **2026-01-24 (最新稳定版)**: 🎯 **修复插件 ID 配置 + 商品选择优化** - 插件可正常接收消息并创建订单
- 2026-01-24: **修复支付链接未保存到数据库的关键问题**，新增支付链接更新 API，优化等待页面 UI（进度指示器 + 动态进度条）。
- 2026-01-23: 落地方案 B（预热常驻 + MutationObserver + 并发提升 + 断路器 + 进度提示），并补齐订单备注包含商品标题。
- 2026-01-23: 标记"稳定测试版1"与"导入商品插件稳定版"，便于回撤。
- 2026-01-21: 新增插件日志（后台缓存 + 管理后台查看/清空），用于排查订单同步问题；扩展增加 storage 权限。

## 稳定版本标记

### ✅ **stable-20260124** (当前稳定版本)
**标签**: `stable-20260124`
**提交**: `38b2098`
**日期**: 2026-01-24

### 🎯 **stable-2026-01-24-plugin-fix** (历史稳定版本)
**标签**: `stable-2026-01-24-plugin-fix`
**提交**: `d10a64a`
**日期**: 2026-01-24

**此版本特性**:
- ✅ 修复插件 ID 配置错误（.env.local 中的 NEXT_PUBLIC_INFLYWAY_EXTENSION_ID）
- ✅ 插件 ID 正确设置为 `nkkjieipgllgfafamnjbchdeejmbjmfh`
- ✅ 优化商品选择等待时间（18次循环，每次600ms）
- ✅ 优化商品选择后等待时间（750ms）
- ✅ 插件可正常接收 CREATE_ORDER 消息
- ✅ 订单创建流程稳定运行

**关键修改文件**:
1. `luxury-shop/.env.local` - 修复插件 ID
2. `chrome-extension -Test/background.js` - 优化等待时间（行 1383, 1386, 1403）

**回滚到此版本**:
```bash
cd e:\购物网站
git checkout stable-2026-01-24-plugin-fix
```

**验证此版本**:
```bash
# 1. 重启 Next.js 服务器
cd e:\购物网站\luxury-shop
npm run dev

# 2. 访问测试页面
# http://localhost:3001/test-checkout

# 3. 点击 "Proceed to payment" 按钮
# 4. 插件应立即开始运行并创建订单
```

---

### 其他稳定版本

- **稳定测试版1**: 订单同步 + Inflyway 创建流程稳定基线。
- **导入商品插件稳定版**: Szwego 导入流程稳定基线。

## 2026-01-24 重要更新详情

### 问题背景

在之前的版本中，Chrome 插件成功创建 Inflyway 订单并返回支付链接后，前端只将链接存储在本地状态中，**未保存到数据库**。这导致客户在等待页面轮询数据库时无法获取支付链接，造成订单无法完成支付。

### 解决方案

#### 1. 修复支付链接保存问题

**文件：** `components/checkout/payment-step.tsx`

**修改内容：**
- 插件返回支付链接后，立即调用新的 API 端点保存到数据库
- 使用 `orderNumber` + `email` 进行验证，确保安全性
- 同时保存 `paymentLinkUrl` 和 `inflywayOrderId` 字段

```typescript
// 保存支付链接到数据库
if (resolvedLink && nextOrderNumber && address?.email) {
  fetch("/api/order/update-payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      orderNumber: nextOrderNumber,
      email: address.email,
      paymentLinkUrl: resolvedLink,
      inflywayOrderId: response.inflywayOrderId,
    }),
  }).catch((err) => {
    console.error("Failed to save payment link:", err);
  });
}
```

#### 2. 新增支付链接更新 API

**文件：** `app/api/order/update-payment/route.ts`（新建）

**功能：**
- POST `/api/order/update-payment` 端点
- 验证订单号和邮箱是否匹配（安全性）
- 更新数据库中的 `paymentLinkUrl` 和 `inflywayOrderId`
- 完整的错误处理和日志记录
- 支持链接格式标准化（自动添加 https:// 前缀）

**API 请求示例：**
```json
{
  "orderNumber": "ORD-20260124-XXXX",
  "email": "customer@example.com",
  "paymentLinkUrl": "https://inflyway.com/pay/xxxxx",
  "inflywayOrderId": "FLY12345"
}
```

**安全机制：**
- 必须同时提供 `orderNumber` 和 `email`
- 数据库查询时验证两者匹配
- 如果订单不存在或邮箱不匹配，返回 404 错误

#### 3. 优化等待页面 UI

**文件：** `components/order/awaiting-payment-client.tsx`

**新增功能：**

1. **三步进度指示器**
   - 步骤 1：Order received（已完成，绿色勾选）
   - 步骤 2：Creating checkout（进行中，脉冲动画）
   - 步骤 3：Link ready（待完成，灰色）

2. **动态进度条**
   - 根据倒计时显示进度（从 10% 到 100%）
   - 渐变色彩效果（from-ink/60 to-ink）
   - 流光动画效果（shimmer animation）

3. **智能状态消息**
   - 60-45 秒："Connecting to secure payment gateway..."
   - 45-30 秒："Generating your checkout link..."
   - 30-15 秒："Almost ready..."
   - 15-0 秒："Finalizing your secure checkout..."

4. **CSS 动画**
   ```css
   @keyframes shimmer {
     0% { transform: translateX(-100%); }
     100% { transform: translateX(100%); }
   }
   ```

**效果：**
- 减少客户焦虑感
- 降低弃单率
- 提供清晰的进度反馈
- 保持 60 秒倒计时不变（用户要求）

### 技术细节

#### 数据流程

```
1. 客户点击 "Proceed to payment"
   ↓
2. Chrome 插件创建 Inflyway 订单
   ↓
3. 插件返回 paymentLinkUrl + orderNumber
   ↓
4. 前端调用 /api/order/update-payment 保存到数据库 ← 新增
   ↓
5. 客户等待页面轮询数据库
   ↓
6. 获取 paymentLinkUrl 并显示给客户
```

#### 数据库字段

```prisma
model Order {
  id               String   @id @default(cuid())
  orderNumber      String   @unique
  email            String
  paymentLinkUrl   String?  // 支付链接
  inflywayOrderId  String?  // Inflyway 订单 ID
  paymentQrCode    String?  // 支付二维码（如果有）
  // ... 其他字段
}
```

### 测试验证

**测试步骤：**
1. 访问 `http://localhost:3000/test-checkout`
2. 点击 "Proceed to payment"
3. 等待插件创建订单
4. 验证支付链接是否显示在等待页面
5. 检查数据库中 `paymentLinkUrl` 字段是否已保存

**预期结果：**
- ✅ 插件成功创建订单
- ✅ 支付链接保存到数据库
- ✅ 客户等待页面显示支付链接
- ✅ 进度指示器和进度条正常显示
- ✅ 状态消息根据倒计时动态变化

### 影响范围

**修改的文件：**
1. `components/checkout/payment-step.tsx` - 添加 API 调用
2. `app/api/order/update-payment/route.ts` - 新建 API 端点
3. `components/order/awaiting-payment-client.tsx` - UI 优化

**不影响：**
- Chrome 插件逻辑（无需修改）
- 现有订单流程（向后兼容）
- 其他支付方式（Stripe 等）

### 回滚方案

如果出现问题，可以快速回滚：

```bash
cd e:\购物网站\luxury-shop
git log --oneline -5  # 查看最近的提交
git revert 498573c    # 回滚到上一个版本
```

或者手动删除 API 调用：
```typescript
// 注释掉 payment-step.tsx 中的这段代码
// if (resolvedLink && nextOrderNumber && address?.email) {
//   fetch("/api/order/update-payment", { ... });
// }
```

## 项目概述

这是一个奢侈品电商平台，集成了 Chrome 插件实现与 Inflyway.com 的订单自动同步功能。客户在购物网站下单后，系统会自动在 Inflyway.com 创建订单并生成支付二维码，客户扫码支付后自动完成订单。

## 技术栈

### 购物网站
- **Next.js 16** + **React 19** + **TypeScript**
- **PostgreSQL** + **Prisma ORM**
- **Tailwind CSS v4**
- **Zustand** 状态管理

### Chrome 插件
- **Manifest V3**
- **Content Scripts** - 操作 Inflyway.com 页面
- **Background Service Worker** - 消息转发

## 核心功能

### 自动订单同步流程

1. **客户下单**
   - 客户在购物网站添加商品到购物车
   - 填写收货地址和配送信息
   - 点击 "Proceed to payment" 按钮

2. **自动创建订单**（后台静默执行）
   - 计算订单总金额
   - 通过 Chrome 插件发送到 Inflyway.com
   - 插件自动操作 Inflyway.com 页面：
     - 点击"创建快捷订单"
     - 选择商品（如无商品则自动创建"Handmade"商品）
     - 填写订单金额
     - 提交订单

3. **显示支付二维码**
   - 页面显示 "Scan to Pay"
   - 展示 Inflyway.com 生成的支付二维码
   - 客户扫码完成支付

4. **自动检测支付状态**
   - 每 3 秒轮询一次 Inflyway.com 订单状态
   - 检测订单是否显示"已支付"
   - 支付成功后自动跳转到成功页面

## 项目结构

```
购物网站/
├── luxury-shop/                    # 购物网站主项目
│   ├── app/
│   │   ├── checkout/
│   │   │   ├── payment/           # 付款页面
│   │   │   └── payment-test/      # 付款测试通道
│   │   └── test-checkout/         # 测试页面（跳转到 payment-test）
│   ├── components/
│   │   └── checkout/
│   │       └── payment-step.tsx   # 付款组件（已集成插件）
│   └── .env.local                 # 环境变量
│
└── chrome-extension/               # Chrome 插件
    ├── manifest.json              # 插件配置
    ├── background.js              # 后台服务（消息转发）
    ├── content.js                 # 内容脚本（页面操作）
    └── README.md                  # 插件说明文档
```

## 安装和配置

### 1. 安装 Chrome 插件

1. 打开 Chrome 浏览器，访问 `chrome://extensions/`
2. 开启右上角的"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择 `chrome-extension` 文件夹
5. 记下插件 ID（例如：`gfecpempdkjbofcacodbnghjfdlbgifp`）

### 2. 配置购物网站

插件 ID 已通过环境变量配置：
- `NEXT_PUBLIC_INFLYWAY_EXTENSION_ID`（生产通道）
- `NEXT_PUBLIC_INFLYWAY_EXTENSION_ID_TEST`（测试通道）

当前生产默认 ID：`gfecpempdkjbofcacodbnghjfdlbgifp`

### 3. 启动购物网站

```bash
cd luxury-shop
npm install
npm run dev
```

访问：`http://localhost:3000`

## 测试流程

### 快速测试

1. 访问测试页面：`http://localhost:3000/test-checkout`
2. 页面会自动：
   - 添加 $0.10 测试商品到购物车
   - 填写测试地址和配送信息
   - 跳转到付款测试通道页面
3. 点击 "Proceed to payment" 按钮
4. 等待二维码显示
5. 扫码测试支付流程

### 完整测试

1. 在购物网站正常浏览商品
2. 添加商品到购物车
3. 进入结账流程
4. 填写真实地址信息
5. 完成支付流程

## 付款测试通道（避免改动生产代码）

1. 在 `.env.local` 设置 `NEXT_PUBLIC_INFLYWAY_EXTENSION_ID_TEST`（测试插件 ID）。
2. 使用 `/test-checkout` 进入测试通道（自动跳转到 `/checkout/payment-test`）。
3. 测试通过后，仅切换 `NEXT_PUBLIC_INFLYWAY_EXTENSION_ID` 并重启/重新部署即可生效。

## 关键代码说明

### 购物网站 - 付款组件

文件：`luxury-shop/components/checkout/payment-step.tsx`

```typescript
// 点击付款按钮
const handleCheckout = async () => {
  setLoading(true);
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // 发送消息给 Chrome 插件
  chrome.runtime.sendMessage(
    'gfecpempdkjbofcacodbnghjfdlbgifp',
    { type: 'CREATE_ORDER', amount: total },
    (response) => {
      if (response?.success && response.qrCodeUrl) {
        setQrCodeUrl(response.qrCodeUrl);
        setOrderNumber(response.orderNumber);
        startPaymentPolling(response.orderNumber);
      }
    }
  );
};

// 轮询检查支付状态
const startPaymentPolling = (orderNum: string) => {
  const interval = setInterval(() => {
    chrome.runtime.sendMessage(
      'gfecpempdkjbofcacodbnghjfdlbgifp',
      { type: 'CHECK_PAYMENT_STATUS', orderNumber: orderNum },
      (response) => {
        if (response?.isPaid) {
          clearInterval(interval);
          router.push("/order/success");
        }
      }
    );
  }, 3000);
};
```

### Chrome 插件 - 内容脚本

文件：`chrome-extension/content.js`

主要功能：
- 自动点击"创建快捷订单"按钮
- 选择或创建商品
- 填写订单金额
- 提取支付二维码
- 检查订单支付状态

### Chrome 插件 - 后台服务

文件：`chrome-extension/background.js`

主要功能：
- 接收购物网站的消息
- 查找或创建 Inflyway.com 标签页
- 转发消息到内容脚本
- 返回执行结果

## 工作原理

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│  购物网站    │ ──────> │ Chrome 插件   │ ──────> │ Inflyway.com│
│             │  消息    │              │  操作    │             │
│ 点击付款     │         │ Background   │         │ 创建订单     │
│             │         │ + Content    │         │ 生成二维码   │
│             │ <────── │              │ <────── │             │
│ 显示���维码   │  返回    │              │  提取    │             │
└─────────────┘         └──────────────┘         └─────────────┘
       │                                                 │
       │                                                 │
       └──────────> 轮询检查支付状态 <───────────────────┘
                    (每 3 秒一次)
```

## 注意事项

1. **插件必须保持启用**
   - 在 `chrome://extensions/` 确认插件已启用

2. **Inflyway.com 访问**
   - 插件会在后台标签页打开 Inflyway.com
   - 确保网络可以访问该网站

3. **订单金额**
   - 系统会自动计算购物车总金额
   - 金额单位为美元（USD）

4. **支付状态检测**
   - 轮询间隔为 3 秒
   - 检测 Inflyway.com 订单列表中的"已支付"状态

## 紧急安全收款兜底（当前稳定状态）

当付款链接/跳转异常或插件不稳定时，直接切换到当前兜底状态收款（以二维码/复制链接为主，不依赖跳转）。

切换步骤：
1. 保持 Chrome 插件启用，必要时在 `chrome://extensions/` 点击“重新加载”。
2. 按当前流程创建支付，等待二维码/支付链接生成并展示给客户。
3. 提示客户扫码或复制链接完成付款；付款完成后可继续购物。

## 常见问题

### Q: 点击付款后没有反应？
- 检查 Chrome 插件是否已安装并启用
- 按 F12 查看浏览器控制台是否有错误
- 确认插件 ID 配置正确

### Q: 二维码没有显示？
- 检查 Inflyway.com 是否可以正常访问
- 查看插件的 Service Worker 日志（chrome://extensions/）
- 可能需要调整 content.js 中的选择器

### Q: 支付后没有自动跳转？
- 确认 Inflyway.com 订单状态已更新为"已支付"
- 检查轮询功能是否正常运行
- 查看浏览器控制台日志

## 开发说明

### 修改插件逻辑

如果 Inflyway.com 页面结构发生变化，需要修改：
- `chrome-extension/content.js` - 更新选择器和操作流程

### 修改轮询间隔

在 `payment-step.tsx` 第 76 行修改：
```typescript
}, 3000);  // 改为其他毫秒数
```

### 禁用支付状态检测

注释掉 `payment-step.tsx` 中的 `startPaymentPolling` 调用

## 环境变量

文件：`luxury-shop/.env.local`

```
PAYMENT_MODE=stripe
```

## 版本信息

- 购物网站版本：1.0.0
- Chrome 插件版本：1.0
- 最后更新：2026-01-11

## 技术支持

如有问题，请检查：
1. Chrome 控制台日志
2. 插件 Service Worker 日志
3. Inflyway.com 页面是否正常加载
