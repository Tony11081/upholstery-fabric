# 购物网站订单同步插件 - 安装和使用说明

## 功能说明
当客户在购物网站点击付款按钮时，自动将订单金额发送到 inflyway.com 并创建快捷订单。

## 安装步骤

### 1. 安装 Chrome 插件

1. 打开 Chrome 浏览器，输入 `chrome://extensions/`
2. 打开右上角的"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择 `chrome-extension` 文件夹
5. 插件安装成功后，记下插件 ID（类似：`abcdefghijklmnopqrstuvwxyz123456`）

### 2. 配置插件 ID

1. 打开文件：`luxury-shop/components/checkout/payment-step.tsx`
2. 找到第 36 行：`'YOUR_EXTENSION_ID_HERE'`
3. 替换为你的插件 ID（从步骤 1.5 获取）
4. 保存文件

### 3. 更新 manifest.json（可选）

如果你的购物网站不是运行在 localhost，需要修改：

1. 打开 `chrome-extension/manifest.json`
2. 修改 `host_permissions` 和 `externally_connectable.matches`
3. 将 `http://localhost:*/*` 替换为你的网站域名，例如：
   ```json
   "host_permissions": [
     "https://inflyway.com/*",
     "https://your-shop-domain.com/*"
   ],
   "externally_connectable": {
     "matches": ["https://your-shop-domain.com/*"]
   }
   ```

## 使用流程

1. **打开 inflyway.com**
   - 在 Chrome 中打开 `https://inflyway.com/kamelnet/#/kn/fly-link/orders`
   - 保持该标签页打开（可以最小化）

2. **客户下单**
   - 客户在购物网站添加商品到购物车
   - 进入结账流程，填写地址和配送信息
   - 点击"Proceed to payment"按钮

3. **自动创建订单**
   - 插件自动计算订单总金额
   - 在 inflyway.com 页面自动点击"创建快捷订单"按钮
   - 自动填写金额并提交

## 工作原理

```
购物网站 → Chrome 插件 → inflyway.com
  (点击付款)   (接收消息)    (自动创建订单)
```

1. 客户点击付款按钮
2. 网站计算订单总金额
3. 通过 `chrome.runtime.sendMessage` 发送给插件
4. 插件的 background.js 接收消息
5. 转发给 inflyway.com 页面的 content.js
6. content.js 自动操作页面创建订单

## 调试

### 查看插件日志
1. 打开 `chrome://extensions/`
2. 找到"购物网站订单同步"插件
3. 点击"service worker"查看 background 日志
4. 在 inflyway.com 页面按 F12，查看 Console 日志

### 常见问题

**Q: 点击付款后没有反应？**
- 检查插件是否已启用
- 检查 inflyway.com 标签页是否打开
- 按 F12 查看控制台是否有错误信息

**Q: 插件找不到"创建快捷订单"按钮？**
- 确认 inflyway.com 页面已完全加载
- 检查页面结构是否有变化
- 可能需要调整 content.js 中的选择器

**Q: 金额没有自动填写？**
- inflyway.com 的表单可能有变化
- 需要检查实际的输入框选择器
- 可以在 content.js 的 `fillOrderForm` 函数中添加更多选择器

## 文件说明

- `manifest.json` - 插件配置文件
- `background.js` - 后台服务，接收和转发消息
- `content.js` - 内容脚本，操作 inflyway.com 页面
- `payment-step.tsx` - 购物网站付款组件（已修改）

## 注意事项

1. 插件需要保持启用状态
2. inflyway.com 标签页需要保持打开
3. 如果 inflyway.com 页面结构变化，可能需要更新 content.js
4. 建议先在测试环境验证功能
