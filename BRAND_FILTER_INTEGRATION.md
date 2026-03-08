# 品牌筛选功能集成指南

## 已完成的工作

### 1. 后端 API ✅
- [x] 创建品牌 API: `/api/brands/route.ts`
- [x] 更新产品 API: `/api/products/route.ts` 支持 `brand` 参数
- [x] 更新数据查询函数: `lib/data/products.ts` 的 `getProducts` 函数

### 2. UI 组件 ✅
- [x] 更新 FilterModal 组件添加品牌选择器
- [x] 添加 `brand` 到 FilterState 类型

### 3. 产品分类脚本 ✅
- [x] 创建 `scripts/categorize-products.ts` 使用 AI 识别品牌和类别
- [x] 优化脚本只处理未分类的产品
- [x] 脚本正在后台运行中

## 需要完成的工作

### 更新 HomeClient 组件

需要在 `components/home/home-client.tsx` 中进行以下修改：

#### 1. 更新 FiltersState 类型
```typescript
type FiltersState = {
  category: string | null;
  brand: string | null;  // 添加这一行
  minPrice: string;
  maxPrice: string;
  availability: boolean;
};
```

#### 2. 更新初始状态
```typescript
const [filters, setFilters] = useState<FiltersState>({
  category: null,
  brand: null,  // 添加这一行
  minPrice: "",
  maxPrice: "",
  availability: false,
});
```

#### 3. 添加品牌列表状态
```typescript
const [brands, setBrands] = useState<string[]>([]);

useEffect(() => {
  fetch("/api/brands")
    .then((res) => res.json())
    .then((data) => setBrands(data.brands || []))
    .catch(() => setBrands([]));
}, []);
```

#### 4. 更新 queryParams
```typescript
const queryParams = useMemo(() => {
  const minPrice = filters.minPrice ? Number(filters.minPrice) : null;
  const maxPrice = filters.maxPrice ? Number(filters.maxPrice) : null;
  const tag = tab === "videos" ? "video" : tab === "editorial" ? "editorial" : undefined;

  return {
    category: filters.category ?? undefined,
    brand: filters.brand ?? undefined,  // 添加这一行
    sort,
    isNew: tab === "new",
    tag,
    minPrice,
    maxPrice,
    availability: filters.availability ? ("in_stock" as const) : undefined,
    limit: 30,
  };
}, [filters, sort, tab]);
```

#### 5. 更新 activeFilterCount
```typescript
const activeFilterCount =
  Number(Boolean(filters.category)) +
  Number(Boolean(filters.brand)) +  // 添加这一行
  Number(Boolean(filters.minPrice)) +
  Number(Boolean(filters.maxPrice)) +
  Number(Boolean(filters.availability));
```

#### 6. 更新 FilterModal 调用
```typescript
<FilterModal
  open={filterOpen}
  onOpenChange={setFilterOpen}
  categories={categories}
  brands={brands}  // 添加这一行
  initial={filters}
  onApply={setFilters}
  onClear={() =>
    setFilters({
      category: null,
      brand: null,  // 添加这一行
      minPrice: "",
      maxPrice: "",
      availability: false,
    })
  }
/>
```

#### 7. 添加品牌筛选芯片显示
在 activeFilterCount > 0 的条件渲染中添加：
```typescript
{filters.brand && (
  <FilterChip
    label={filters.brand}
    onClear={() => setFilters((prev) => ({ ...prev, brand: null }))}
  />
)}
```

## 测试步骤

1. 等待分类脚本完成（可以运行 `npx tsx scripts/check-recognition-progress.ts` 查看进度）
2. 重启 Next.js 开发服务器
3. 打开网站首页
4. 点击 Filter 按钮
5. 应该能看到 Brand 选择器，显示所有可用品牌
6. 选择品牌后应该能正确筛选产品

## 当前脚本状态

分类脚本正在后台运行，处理所有未分类的产品。可以通过以下命令查看进度：

```bash
cd luxury-shop
npx tsx scripts/check-recognition-progress.ts
```
