import { Prisma } from "@prisma/client";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { mockCategories, mockProducts } from "./mock-data";
import { allowMockDataFallback, isProd } from "@/lib/utils/env";
import { applyDiscount, getActiveDiscounts, resolveDiscountPercent } from "@/lib/utils/discounts";
import { slugify } from "@/lib/utils/slug";
import { getBrandInfo } from "@/lib/utils/brands";
import { getCatalogGroupKeywords, toFilterTag } from "@/lib/utils/catalog-filters";

export type ProductWithRelations = Prisma.ProductGetPayload<{
  include: { images: true; category: true; reviews: true; brand: true; variants: true };
}> & {
  discountedPrice?: number;
  discountPercent?: number;
};

const productImageOrderBy: Prisma.ProductImageOrderByWithRelationInput[] = [
  { isCover: "desc" },
  { sortOrder: "asc" },
];

const legacyBaseProductListSelect = {
  id: true,
  slug: true,
  titleEn: true,
  descriptionEn: true,
  price: true,
  currency: true,
  inventory: true,
  isNew: true,
  isBestSeller: true,
  tags: true,
  categoryId: true,
  images: {
    select: {
      url: true,
      alt: true,
      isCover: true,
      sortOrder: true,
    },
    orderBy: productImageOrderBy,
    take: 1,
  },
  category: {
    select: {
      id: true,
      nameEn: true,
      slug: true,
    },
  },
} satisfies Prisma.ProductSelect;

const productListSelect = {
  ...legacyBaseProductListSelect,
  brandId: true,
  brand: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
  variants: {
    select: {
      id: true,
      color: true,
      size: true,
      inventory: true,
      price: true,
    },
    where: {
      isActive: true,
    },
  },
} satisfies Prisma.ProductSelect;

const legacyProductListSelect = legacyBaseProductListSelect;

const legacyProductDetailSelect = {
  id: true,
  slug: true,
  titleEn: true,
  price: true,
  currency: true,
  descriptionEn: true,
  categoryId: true,
  tags: true,
  isNew: true,
  isBestSeller: true,
  isActive: true,
  qaStatus: true,
  qualityScore: true,
  qualityNotes: true,
  inventory: true,
  createdAt: true,
  updatedAt: true,
  images: {
    orderBy: { sortOrder: "asc" },
  },
  category: true,
  reviews: {
    where: { status: "APPROVED" },
    orderBy: { createdAt: "desc" },
  },
} satisfies Prisma.ProductSelect;

export type ProductListItem = Prisma.ProductGetPayload<{
  select: typeof productListSelect;
}> & {
  discountedPrice?: number;
  discountPercent?: number;
};

type LegacyProductListItem = Prisma.ProductGetPayload<{
  select: typeof legacyProductListSelect;
}>;

type LegacySelectedProductWithRelations = Prisma.ProductGetPayload<{
  select: typeof legacyProductDetailSelect;
}>;

export type CategoryWithChildren = Prisma.CategoryGetPayload<{
  include: { children: true };
}>;

export type CategoryWithRelations = Prisma.CategoryGetPayload<{
  include: { parent: true; children: true };
}>;

export type ProductSort =
  | "newest"
  | "price_asc"
  | "price_desc"
  | "popular"
  | "ready"
  | "category_mix";

export type ProductQueryOptions = {
  limit?: number;
  offset?: number;
  category?: string | null;
  categoryGroup?: string | null;
  brand?: string | null;
  tag?: string | null;
  color?: string | null;
  size?: string | null;
  material?: string | null;
  sort?: ProductSort | null;
  isNew?: boolean;
  minPrice?: number | null;
  maxPrice?: number | null;
  availability?: "in_stock" | null;
};

function toLegacyProductListItems(products: LegacyProductListItem[]): ProductListItem[] {
  return products.map((product) => ({
    ...product,
    brandId: null,
    brand: null,
    variants: [],
  })) as ProductListItem[];
}

function toLegacySelectedProductWithRelations(
  product: LegacySelectedProductWithRelations,
): ProductWithRelations {
  return {
    ...product,
    brandId: null,
    brand: null,
    variants: [],
  } as ProductWithRelations;
}

async function findProductsWithSelectFallback(args: {
  where: Prisma.ProductWhereInput;
  orderBy: Prisma.ProductOrderByWithRelationInput[];
  take: number;
  skip: number;
}): Promise<ProductListItem[]> {
  try {
    return await prisma.product.findMany({
      ...args,
      select: productListSelect,
    });
  } catch (error) {
    console.warn(
      "Extended product list query failed, retrying legacy catalog query.",
      error instanceof Error ? error.message : error,
    );
    const products = await prisma.product.findMany({
      ...args,
      select: legacyProductListSelect,
    });
    return toLegacyProductListItems(products);
  }
}

export async function getProducts(options: ProductQueryOptions = {}): Promise<ProductListItem[]> {
  try {
    const where: Prisma.ProductWhereInput = { isActive: true, qaStatus: { not: "REJECTED" } };
    const andFilters: Prisma.ProductWhereInput[] = [];

    if (options.category) {
      andFilters.push({ category: { slug: options.category } });
    }

    if (options.brand) {
      const brandLabel = getBrandInfo({ tags: [options.brand] })?.label;
      andFilters.push({
        OR: [
          { tags: { has: options.brand } },
          ...(brandLabel ? [{ titleEn: { contains: brandLabel, mode: "insensitive" as const } }] : []),
        ],
      });
    }

    if (options.tag) {
      andFilters.push({ tags: { has: options.tag } });
    }

    if (options.categoryGroup && options.categoryGroup !== "all") {
      const keywords = getCatalogGroupKeywords(options.categoryGroup);
      if (keywords.length) {
        andFilters.push({
          OR: keywords.map((keyword) => ({
            OR: [
              { titleEn: { contains: keyword, mode: "insensitive" } },
              { descriptionEn: { contains: keyword, mode: "insensitive" } },
              { tags: { has: keyword } },
              { category: { slug: { contains: keyword, mode: "insensitive" } } },
              { category: { nameEn: { contains: keyword, mode: "insensitive" } } },
            ],
          })),
        });
      }
    }

    if (options.color) {
      const value = options.color.trim();
      if (value) {
        const colorTag = toFilterTag("color", value);
        const colorOr: Prisma.ProductWhereInput[] = [
          { titleEn: { contains: value, mode: "insensitive" } },
          { descriptionEn: { contains: value, mode: "insensitive" } },
          { tags: { has: value } },
        ];
        if (colorTag) colorOr.push({ tags: { has: colorTag } });
        andFilters.push({ OR: colorOr });
      }
    }

    if (options.size) {
      const value = options.size.trim();
      if (value) {
        const sizeTag = toFilterTag("size", value);
        const sizeOr: Prisma.ProductWhereInput[] = [
          { titleEn: { contains: value, mode: "insensitive" } },
          { descriptionEn: { contains: value, mode: "insensitive" } },
          { tags: { has: value } },
        ];
        if (sizeTag) sizeOr.push({ tags: { has: sizeTag } });
        andFilters.push({ OR: sizeOr });
      }
    }

    if (options.material) {
      const value = options.material.trim();
      if (value) {
        const materialTag = toFilterTag("material", value);
        const materialOr: Prisma.ProductWhereInput[] = [
          { titleEn: { contains: value, mode: "insensitive" } },
          { descriptionEn: { contains: value, mode: "insensitive" } },
          { tags: { has: value } },
        ];
        if (materialTag) materialOr.push({ tags: { has: materialTag } });
        andFilters.push({ OR: materialOr });
      }
    }

    if (options.isNew) {
      where.isNew = true;
    }

    if (options.minPrice || options.maxPrice) {
      where.price = {};
      if (options.minPrice) {
        where.price.gte = new Prisma.Decimal(options.minPrice);
      }
      if (options.maxPrice) {
        where.price.lte = new Prisma.Decimal(options.maxPrice);
      }
    }

    if (options.availability === "in_stock") {
      where.inventory = { gt: 0 };
    }

    if (andFilters.length) {
      where.AND = andFilters;
    }

    const orderBy: Prisma.ProductOrderByWithRelationInput[] = [];
    const useCategoryMix = options.sort === "category_mix";

    switch (options.sort) {
      case "price_asc":
        orderBy.push({ price: "asc" });
        break;
      case "price_desc":
        orderBy.push({ price: "desc" });
        break;
      case "popular":
        orderBy.push({ isBestSeller: "desc" }, { inventory: "desc" }, { createdAt: "desc" });
        break;
      case "ready":
        orderBy.push({ inventory: "desc" }, { isBestSeller: "desc" });
        where.inventory = { gt: 0 };
        break;
      case "category_mix":
        orderBy.push({ createdAt: "desc" });
        break;
      case "newest":
      default:
        orderBy.push({ createdAt: "desc" });
        break;
    }

    if (!options.sort) {
      orderBy.push({ isBestSeller: "desc" }, { isNew: "desc" });
    }

    const products = await findProductsWithSelectFallback({
      where,
      orderBy,
      take: options.limit ?? 24,
      skip: options.offset ?? 0,
    });
    const discounted = await applyDiscounts(products);
    if (useCategoryMix && !options.category) {
      return mixProductsByCategory(discounted);
    }
    return discounted;
  } catch (error) {
    if (isProd && !allowMockDataFallback) {
      throw error;
    }
    console.warn("Prisma unavailable, using mock products.", error instanceof Error ? error.message : error);
    return filterMockProducts(options);
  }
}

export async function getFeaturedProducts(limit = 12) {
  return getProducts({ limit, sort: "popular" });
}

async function getProductBySlugInternal(slug: string): Promise<ProductWithRelations | null> {
  const normalized = slug.trim();
  const slugified = slugify(normalized) || normalized;
  const baseSlug = slugified.replace(/-\d+$/, "");
  const candidateSlugs = Array.from(new Set([normalized, slugified, baseSlug].filter(Boolean)));
  try {
    const include: Prisma.ProductInclude = {
      images: { orderBy: { sortOrder: "asc" } },
      category: true,
      brand: true,
      variants: { where: { isActive: true }, orderBy: { createdAt: "asc" } },
      reviews: { where: { status: "APPROVED" }, orderBy: { createdAt: "desc" } },
    };
    const loadProduct = async (queryInclude: Prisma.ProductInclude) => {
      let product = normalized
        ? await prisma.product.findUnique({
            where: { slug: normalized },
            include: queryInclude,
          })
        : null;
      if (!product && candidateSlugs.length > 0) {
        product = await prisma.product.findFirst({
          where: {
            OR: candidateSlugs.map((candidate) => ({
              slug: { equals: candidate, mode: "insensitive" },
            })),
          },
          include: queryInclude,
        });
      }
      return product;
    };

    const loadLegacyProduct = async () => {
      let product = normalized
        ? await prisma.product.findUnique({
            where: { slug: normalized },
            select: legacyProductDetailSelect,
          })
        : null;
      if (!product && candidateSlugs.length > 0) {
        product = await prisma.product.findFirst({
          where: {
            OR: candidateSlugs.map((candidate) => ({
              slug: { equals: candidate, mode: "insensitive" },
            })),
          },
          select: legacyProductDetailSelect,
        });
      }
      return product;
    };

    let product: ProductWithRelations | null;
    try {
      product = (await loadProduct(include)) as ProductWithRelations | null;
    } catch (error) {
      console.warn(
        "Extended product detail query failed, retrying legacy product query.",
        error instanceof Error ? error.message : error,
      );
      const legacyProduct = await loadLegacyProduct();
      product = legacyProduct ? toLegacySelectedProductWithRelations(legacyProduct) : null;
    }

    if (!product || !product.isActive || product.qaStatus === "REJECTED") {
      // Product not in DB, try mock data fallback
      if (!isProd || allowMockDataFallback) {
        const fallback = filterMockProducts({}).find((p) => candidateSlugs.includes(p.slug));
        return fallback ?? null;
      }
      return null;
    }
    const [withDiscount] = await applyDiscounts([product]);
    return withDiscount ?? null;
  } catch (error) {
    if (isProd && !allowMockDataFallback) {
      throw error;
    }
    const fallback = filterMockProducts({}).find((p) => candidateSlugs.includes(p.slug));
    return fallback ?? null;
  }
}

export const getProductBySlug = cache(getProductBySlugInternal);

const SEARCH_TERM_SPLIT = /[^a-z0-9]+/g;

function buildSearchTerms(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  const terms = new Set<string>();
  const addTerm = (value: string | null | undefined) => {
    if (!value) return;
    const normalized = value.trim().toLowerCase();
    if (!normalized) return;
    if (normalized.length < 2 && !/^\d+$/.test(normalized)) return;
    terms.add(normalized);
  };

  addTerm(trimmed);

  const slug = slugify(trimmed);
  if (slug) {
    addTerm(slug);
    slug.split("-").forEach(addTerm);
  }

  trimmed
    .toLowerCase()
    .split(SEARCH_TERM_SPLIT)
    .forEach(addTerm);

  return Array.from(terms);
}

function buildProductSearchFilters(
  terms: string[],
  options: { includeExtendedRelations?: boolean } = {},
): Prisma.ProductWhereInput[] {
  if (terms.length === 0) return [];

  const filters: Prisma.ProductWhereInput[] = [];
  const exactTagTerms = new Set<string>();
  const includeExtendedRelations = options.includeExtendedRelations ?? true;
  for (const term of terms) {
    const brandTag = getBrandInfo({ tags: [term], titleEn: term })?.tag;
    const colorTag = toFilterTag("color", term);
    const sizeTag = toFilterTag("size", term);
    const materialTag = toFilterTag("material", term);
    [term, brandTag, colorTag, sizeTag, materialTag]
      .filter((value): value is string => Boolean(value))
      .forEach((value) => exactTagTerms.add(value));
    filters.push(
      { titleEn: { contains: term, mode: "insensitive" } },
      { descriptionEn: { contains: term, mode: "insensitive" } },
      { slug: { contains: term, mode: "insensitive" } },
      { category: { slug: { contains: term, mode: "insensitive" } } },
      { category: { nameEn: { contains: term, mode: "insensitive" } } },
    );
    if (includeExtendedRelations) {
      filters.push(
        { brand: { name: { contains: term, mode: "insensitive" } } },
        { brand: { slug: { contains: term, mode: "insensitive" } } },
        { variants: { some: { color: { contains: term, mode: "insensitive" } } } },
        { variants: { some: { size: { contains: term, mode: "insensitive" } } } },
      );
    }
  }
  filters.push({ tags: { hasSome: Array.from(exactTagTerms) } });
  return filters;
}

export async function searchProducts(
  query: string,
  options: { limit?: number; offset?: number } = {},
): Promise<ProductListItem[]> {
  const terms = buildSearchTerms(query);
  if (terms.length === 0) return [];

  try {
    const searchArgs = {
      orderBy: [{ isBestSeller: "desc" }, { isNew: "desc" }] satisfies Prisma.ProductOrderByWithRelationInput[],
      take: options.limit ?? 24,
      skip: options.offset ?? 0,
    };
    let products: ProductListItem[];
    try {
      products = await findProductsWithSelectFallback({
        where: {
          OR: buildProductSearchFilters(terms),
          isActive: true,
          qaStatus: { not: "REJECTED" },
        },
        ...searchArgs,
      });
    } catch (error) {
      console.warn(
        "Extended search query failed, retrying legacy search query.",
        error instanceof Error ? error.message : error,
      );
      products = await findProductsWithSelectFallback({
        where: {
          OR: buildProductSearchFilters(terms, { includeExtendedRelations: false }),
          isActive: true,
          qaStatus: { not: "REJECTED" },
        },
        ...searchArgs,
      });
    }
    return await applyDiscounts(products);
  } catch {
    if (isProd && !allowMockDataFallback) {
      throw new Error("Search unavailable");
    }
    const matches = filterMockProducts({ limit: mockProducts().length }).filter((p) => {
      const title = p.titleEn.toLowerCase();
      const description = (p.descriptionEn ?? "").toLowerCase();
      const tags = p.tags.map((tag) => tag.toLowerCase());
      return terms.some(
        (term) =>
          title.includes(term) ||
          description.includes(term) ||
          tags.some((tag) => tag.includes(term)),
      );
    });
    const offset = options.offset ?? 0;
    const limit = options.limit ?? 24;
    return matches.slice(offset, offset + limit);
  }
}

export async function getProductsByCategory(
  slug: string,
  limit = 24,
): Promise<ProductListItem[]> {
  return getProducts({ category: slug, limit });
}

function buildMockCategoryTree() {
  const base = mockCategories()
    .filter((category) => category.status === "ACTIVE")
    .map((category) => ({
      ...category,
      children: [] as typeof category[],
    }));
  const map = new Map(base.map((category) => [category.id, category]));
  base.forEach((category) => {
    if (category.parentId) {
      map.get(category.parentId)?.children.push(category);
    }
  });
  return { categories: base, map };
}

export async function getCategories(): Promise<CategoryWithChildren[]> {
  try {
    return await prisma.category.findMany({
      where: { status: "ACTIVE" },
      include: { children: { where: { status: "ACTIVE" } } },
      orderBy: [{ parentId: "asc" }, { nameEn: "asc" }],
    });
  } catch (error) {
    if (isProd && !allowMockDataFallback) {
      throw error;
    }
    console.warn("Prisma unavailable, using mock categories.", error instanceof Error ? error.message : error);
    return buildMockCategoryTree().categories as CategoryWithChildren[];
  }
}

export async function getCategoryBySlug(slug: string): Promise<CategoryWithRelations | null> {
  try {
    return await prisma.category.findFirst({
      where: { slug, status: "ACTIVE" },
      include: { parent: true, children: { where: { status: "ACTIVE" } } },
    });
  } catch (error) {
    if (isProd && !allowMockDataFallback) {
      throw error;
    }
    const { categories, map } = buildMockCategoryTree();
    const fallback = categories.find((category) => category.slug === slug);
    if (!fallback) return null;
    const parent = fallback.parentId ? map.get(fallback.parentId) ?? null : null;
    return {
      ...fallback,
      parent,
      children: fallback.children ?? [],
    } as CategoryWithRelations;
  }
}

export async function getProductStats() {
  try {
    const [total, newCount, latestUpdate] = await Promise.all([
      prisma.product.count(),
      prisma.product.count({ where: { isNew: true } }),
      prisma.product.findFirst({ select: { updatedAt: true }, orderBy: { updatedAt: "desc" } }),
    ]);

    return {
      total,
      newCount,
      lastUpdated: latestUpdate?.updatedAt ?? null,
    };
  } catch {
    if (isProd && !allowMockDataFallback) {
      throw new Error("Stats unavailable");
    }
    const products = filterMockProducts({});
    const total = products.length;
    const newCount = products.filter((p) => p.isNew).length;
    const lastUpdated = new Date();
    return { total, newCount, lastUpdated };
  }
}

export async function getLiveSuggestions(query: string) {
  const terms = buildSearchTerms(query);
  if (terms.length === 0) return { products: [], categories: [] };

  try {
    const loadSuggestions = async (includeExtendedRelations = true) =>
      Promise.all([
        findProductsWithSelectFallback({
          where: {
            OR: buildProductSearchFilters(terms, { includeExtendedRelations }),
            isActive: true,
            qaStatus: { not: "REJECTED" },
          },
          orderBy: [{ isBestSeller: "desc" }, { isNew: "desc" }],
          take: 6,
          skip: 0,
        }),
        prisma.category.findMany({
          where: {
            OR: terms.map((term) => ({ nameEn: { contains: term, mode: "insensitive" } })),
            status: "ACTIVE",
          },
          take: 6,
        }),
      ]);

    let products: ProductListItem[];
    let categories: Awaited<ReturnType<typeof prisma.category.findMany>>;
    try {
      [products, categories] = await loadSuggestions();
    } catch (error) {
      console.warn(
        "Extended suggestion query failed, retrying legacy suggestion query.",
        error instanceof Error ? error.message : error,
      );
      [products, categories] = await loadSuggestions(false);
    }

    const directBrandTags = terms
      .map((term) => getBrandInfo({ tags: [term], titleEn: term })?.tag)
      .filter((tag): tag is string => Boolean(tag));
    const brandTags = Array.from(
      new Set(
        [...directBrandTags, ...products
          .map((product) => getBrandInfo({ tags: product.tags, titleEn: product.titleEn }))
          .filter((brand): brand is NonNullable<typeof brand> => Boolean(brand))
          .filter((brand) =>
            terms.some((term) =>
              brand.tag.toLowerCase().includes(term) || brand.label.toLowerCase().includes(term),
            ),
          )
          .map((brand) => brand.tag)],
      ),
    ).slice(0, 6);

    const discountedProducts = await applyDiscounts(products);
    return { products: discountedProducts, categories, brands: brandTags };
  } catch {
    if (isProd) {
      throw new Error("Suggestions unavailable");
    }
    const products = filterMockProducts({ limit: 6 }).filter((p) => {
      const title = p.titleEn.toLowerCase();
      const tags = p.tags.map((tag) => tag.toLowerCase());
      return terms.some((term) => title.includes(term) || tags.some((tag) => tag.includes(term)));
    });
    const categories = mockCategories().filter((c) => {
      const name = c.nameEn.toLowerCase();
      return terms.some((term) => name.includes(term));
    });
    const directBrandTags = terms
      .map((term) => getBrandInfo({ tags: [term], titleEn: term })?.tag)
      .filter((tag): tag is string => Boolean(tag));
    const brandTags = Array.from(
      new Set(
        [...directBrandTags, ...products
          .map((product) => getBrandInfo({ tags: product.tags, titleEn: product.titleEn }))
          .filter((brand): brand is NonNullable<typeof brand> => Boolean(brand))
          .filter((brand) =>
            terms.some((term) =>
              brand.tag.toLowerCase().includes(term) || brand.label.toLowerCase().includes(term),
            ),
          )
          .map((brand) => brand.tag)],
      ),
    ).slice(0, 6);
    return { products, categories, brands: brandTags };
  }
}

export function filterMockProducts(options: ProductQueryOptions): ProductWithRelations[] {
  const products = mockProducts();
  let filtered = [...products];

  filtered = filtered.filter((product) => product.isActive !== false);
  if (options.category) {
    filtered = filtered.filter((p) => p.category?.slug === options.category);
  }
  if (options.categoryGroup && options.categoryGroup !== "all") {
    const keywords = getCatalogGroupKeywords(options.categoryGroup).map((entry) => entry.toLowerCase());
    if (keywords.length) {
      filtered = filtered.filter((product) => {
        const haystack = [
          product.titleEn,
          product.descriptionEn ?? "",
          product.category?.slug ?? "",
          product.category?.nameEn ?? "",
          ...product.tags,
        ]
          .join(" ")
          .toLowerCase();
        return keywords.some((keyword) => haystack.includes(keyword));
      });
    }
  }
  if (options.tag) {
    filtered = filtered.filter((p) => p.tags.includes(options.tag!));
  }
  if (options.color) {
    const colorTag = toFilterTag("color", options.color);
    const needle = options.color.toLowerCase();
    filtered = filtered.filter((product) => {
      const text = `${product.titleEn} ${product.descriptionEn ?? ""}`.toLowerCase();
      return (
        text.includes(needle) ||
        product.tags.some((tag) => tag.toLowerCase() === needle || tag.toLowerCase() === colorTag)
      );
    });
  }
  if (options.size) {
    const sizeTag = toFilterTag("size", options.size);
    const needle = options.size.toLowerCase();
    filtered = filtered.filter((product) => {
      const text = `${product.titleEn} ${product.descriptionEn ?? ""}`.toLowerCase();
      return (
        text.includes(needle) ||
        product.tags.some((tag) => tag.toLowerCase() === needle || tag.toLowerCase() === sizeTag)
      );
    });
  }
  if (options.material) {
    const materialTag = toFilterTag("material", options.material);
    const needle = options.material.toLowerCase();
    filtered = filtered.filter((product) => {
      const text = `${product.titleEn} ${product.descriptionEn ?? ""}`.toLowerCase();
      return (
        text.includes(needle) ||
        product.tags.some((tag) => tag.toLowerCase() === needle || tag.toLowerCase() === materialTag)
      );
    });
  }
  if (options.isNew) {
    filtered = filtered.filter((p) => p.isNew);
  }
  if (options.minPrice) {
    filtered = filtered.filter((p) => Number(p.price) >= options.minPrice!);
  }
  if (options.maxPrice) {
    filtered = filtered.filter((p) => Number(p.price) <= options.maxPrice!);
  }
  if (options.availability === "in_stock") {
    filtered = filtered.filter((p) => p.inventory > 0);
  }

  const sortValue = options.sort ?? "newest";
  filtered.sort((a, b) => {
    switch (sortValue) {
      case "price_asc":
        return Number(a.price) - Number(b.price);
      case "price_desc":
        return Number(b.price) - Number(a.price);
      case "popular":
        return Number(b.isBestSeller) - Number(a.isBestSeller) || b.inventory - a.inventory;
      case "ready":
        return b.inventory - a.inventory;
      case "category_mix":
        return (b.createdAt?.getTime?.() ?? 0) - (a.createdAt?.getTime?.() ?? 0);
      case "newest":
      default:
        return (b.createdAt?.getTime?.() ?? 0) - (a.createdAt?.getTime?.() ?? 0);
    }
  });

  if (options.sort === "category_mix" && !options.category) {
    filtered = mixProductsByCategory(filtered);
  }

  const offset = options.offset ?? 0;
  const limit = options.limit ?? 24;
  return filtered.slice(offset, offset + limit);
}

type DiscountableProduct = {
  id: string;
  categoryId: string | null;
  price: Prisma.Decimal | number;
};

type Discounted<T> = T & {
  discountedPrice?: number;
  discountPercent?: number;
};

async function applyDiscounts<T extends DiscountableProduct>(products: T[]): Promise<Discounted<T>[]> {
  if (products.length === 0) return [];
  const discounts = await getActiveDiscounts();
  return products.map((product) => {
    const basePrice = Number(product.price);
    const percent = resolveDiscountPercent(product.id, product.categoryId, discounts);
    if (!percent) return product as Discounted<T>;
    return {
      ...product,
      discountPercent: percent,
      discountedPrice: applyDiscount(basePrice, percent),
    };
  });
}

function mixProductsByCategory<T extends { category?: { slug?: string | null } | null }>(items: T[]): T[] {
  if (items.length < 2) return items;

  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const key = item.category?.slug ?? "uncategorized";
    const list = grouped.get(key) ?? [];
    list.push(item);
    grouped.set(key, list);
  }

  const categories = Array.from(grouped.keys());
  for (let i = categories.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [categories[i], categories[j]] = [categories[j], categories[i]];
  }

  const output: T[] = [];
  let remaining = items.length;

  while (remaining > 0) {
    let added = false;
    for (const category of categories) {
      const list = grouped.get(category);
      if (!list || list.length === 0) continue;
      output.push(list.shift()!);
      remaining -= 1;
      added = true;
    }
    if (!added) break;
  }

  return output;
}
