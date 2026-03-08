# 产品上传工具使用说明

## 功能
1. **自动翻译中文** - 将中文标题/描述翻译成英文
2. **从图片生成标题** - 使用AI分析图片生成产品信息
3. **自动分类** - 根据产品信息自动分配分类
4. **批量上传** - 将处理后的产品上传到网站

## 配置

### 1. 配置OpenRouter API (用于AI功能)

编辑 `.env` 文件,添加:
```
OPENROUTER_API_KEY=你的API密钥
```

获取API密钥: https://openrouter.ai/keys

### 2. 配置网站地址

```
SITE_URL=http://localhost:3000
ADMIN_EMAIL=admin@example.com
```

## 使用方法

### 方法1: CSV文件导入

1. 准备CSV文件,放入 `products-input/` 目录
2. CSV格式参考 `sample-products.csv`

CSV字段说明:
| 字段 | 说明 | 必填 |
|------|------|------|
| title | 英文标题 | 否(可从中文翻译) |
| title_cn | 中文标题 | 否 |
| description | 英文描述 | 否 |
| description_cn | 中文描述 | 否 |
| price | 价格 | 是 |
| currency | 货币(默认USD) | 否 |
| category | 分类slug | 否(可自动分类) |
| tags | 标签(用\|分隔) | 否(可自动生成) |
| image_urls | 图片URL(用\|分隔) | 否 |
| inventory | 库存数量 | 否(默认10) |

3. 运行处理:
```bash
cd luxury-shop
node scripts/product-uploader.js
```

4. 检查输出文件 `products-output/products-xxx.json`

5. 上传到网站:
```bash
node scripts/product-uploader.js --upload products-output/products-xxx.json
```

### 方法2: 图片文件夹导入

1. 将产品图片放入 `products-input/` 目录
2. 支持格式: jpg, jpeg, png, webp, gif
3. 运行处理(AI会自动分析图片生成标题和分类)

### 方法3: 通过Admin后台导入

1. 启动网站: `npm run dev`
2. 访问 http://localhost:3000/admin/products
3. 点击"Import"按钮
4. 上传CSV/Excel文件
5. 勾选"AI assist"启用AI处理

## 分类列表

| slug | 名称 |
|------|------|
| bags | 包包 |
| wallets | 钱包 |
| shoes | 鞋子 |
| heels | 高跟鞋 |
| sneakers | 运动鞋 |
| clothing | 服装 |
| tops | 上衣 |
| pants | 裤子 |
| dresses | 裙子 |
| outerwear | 外套 |
| accessories | 配饰 |
| jewelry | 首饰 |
| watches | 手表 |
| eyewear | 眼镜 |
| scarves | 围巾 |

## 常见问���

### Q: AI功能不工作?
A: 检查 `OPENROUTER_API_KEY` 是否正确配置

### Q: 上传失败?
A: 确保网站正在运行,且已登录Admin账户

### Q: 中文没有翻译?
A: 确保CSV文件使用UTF-8编码

## 示例

### 只有中文标题的产品
```csv
title,title_cn,price,image_urls
,香奈儿经典翻盖包,2999,https://example.com/chanel.jpg
```
AI会自动翻译成英文并分类

### 只有图片的产品
将图片放入 `products-input/` 目录,AI会自动:
- 识别产品类型
- 生成英文标题
- 分配分类
- 生成标签
