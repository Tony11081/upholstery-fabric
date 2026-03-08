import { OrderStatus, Prisma, PrismaClient, TrackingStatus } from "@prisma/client";
import { scoreProductQuality } from "../lib/utils/quality";
import {
  importedBrandSeeds,
  importedCategorySeeds,
  importedProductSeeds,
} from "./data/wouwww-catalog";

const prisma = new PrismaClient();

type SeedCategory = {
  name: string;
  slug: string;
  parentSlug?: string;
};

type SeedBrand = {
  name: string;
  slug: string;
  description: string;
};

type SeedProduct = {
  slug: string;
  title: string;
  price: number;
  currency: string;
  description: string;
  categorySlug: string;
  brandSlug: string;
  tags: string[];
  isNew: boolean;
  isBestSeller: boolean;
  inventory: number;
  sourceHandle: string;
  variant: {
    sku: string;
    size: string;
    price: number;
    inventory: number;
  };
  images: Array<{
    url: string;
    alt?: string;
    isCover?: boolean;
  }>;
};

const DEFAULT_FABRIC_SIZE = "1 yard";

function isLeatherLikeCategory(categorySlug: string) {
  return categorySlug === "leather" || categorySlug === "vinyl";
}

function resolveCatalogPrice(categorySlug: string) {
  return isLeatherLikeCategory(categorySlug) ? 45 : 35;
}

const categorySeeds: SeedCategory[] = importedCategorySeeds.map((category) => ({
  name: category.name,
  slug: category.slug,
  ...("parentSlug" in category ? { parentSlug: category.parentSlug } : {}),
}));

const brandSeeds: SeedBrand[] = importedBrandSeeds.map((brand) => ({
  name: brand.name,
  slug: brand.slug,
  description: brand.description,
}));

const productSeeds: SeedProduct[] = importedProductSeeds.map((product) => ({
  slug: product.slug,
  title: product.title,
  price: resolveCatalogPrice(product.categorySlug),
  currency: product.currency,
  description: product.description,
  categorySlug: product.categorySlug,
  brandSlug: product.brandSlug,
  tags: [...product.tags],
  isNew: product.isNew,
  isBestSeller: product.isBestSeller,
  inventory: product.inventory,
  sourceHandle: product.sourceHandle,
  variant: {
    sku: product.variant.sku,
    size: DEFAULT_FABRIC_SIZE,
    price: resolveCatalogPrice(product.categorySlug),
    inventory: product.variant.inventory,
  },
  images: product.images.map((image) => ({
    url: image.url,
    alt: image.alt,
    isCover: image.isCover,
  })),
}));

function decimal(value: number) {
  return new Prisma.Decimal(value);
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function requireProductId(productIds: Record<string, string>, slug: string) {
  const id = productIds[slug];
  if (!id) {
    throw new Error(`Missing seeded product id for ${slug}`);
  }
  return id;
}

async function main() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  console.log("Resetting existing data...");
  await prisma.automationLog.deleteMany();
  await prisma.automationRule.deleteMany();
  await prisma.experimentEvent.deleteMany();
  await prisma.experimentAssignment.deleteMany();
  await prisma.experiment.deleteMany();
  await prisma.couponAssignment.deleteMany();
  await prisma.coupon.deleteMany();
  await prisma.aftercareCase.deleteMany();
  await prisma.consultationRequest.deleteMany();
  await prisma.review.deleteMany();
  await prisma.dropReservation.deleteMany();
  await prisma.contentProduct.deleteMany();
  await prisma.contentPost.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.referral.deleteMany();
  await prisma.referralCode.deleteMany();
  await prisma.followUpTask.deleteMany();
  await prisma.customerNote.deleteMany();
  await prisma.customerEvent.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.vipTier.deleteMany();
  await prisma.verificationToken.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.shipment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.wishlistItem.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.product.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();

  const vipTiers = await prisma.vipTier.createMany({
    data: [
      {
        name: "Member",
        level: 1,
        minSpend: decimal(0),
        pointsPerDollar: decimal(1),
        supportChannel: "Standard concierge",
      },
      {
        name: "Insider",
        level: 2,
        minSpend: decimal(2500),
        pointsPerDollar: decimal(1.25),
        earlyAccessDays: 2,
        birthdayGift: "Private drop invite",
        supportChannel: "Priority concierge",
      },
      {
        name: "Ambassador",
        level: 3,
        minSpend: decimal(7500),
        pointsPerDollar: decimal(1.5),
        earlyAccessDays: 5,
        birthdayGift: "Personalized sourcing gift",
        supportChannel: "Dedicated advisor",
      },
    ],
  });
  console.log(`Seeded ${vipTiers.count} VIP tiers.`);

  const categoryIds: Record<string, string> = {};
  for (const category of categorySeeds) {
    const created = await prisma.category.create({
      data: {
        nameEn: category.name,
        slug: category.slug,
        parentId: category.parentSlug ? categoryIds[category.parentSlug] : null,
        status: "ACTIVE",
      },
    });
    categoryIds[category.slug] = created.id;
  }

  const brandIds: Record<string, string> = {};
  for (const brand of brandSeeds) {
    const created = await prisma.brand.create({
      data: {
        name: brand.name,
        slug: brand.slug,
        description: brand.description,
        isActive: true,
      },
    });
    brandIds[brand.slug] = created.id;
  }

  const productIds: Record<string, string> = {};
  for (const product of productSeeds) {
    const quality = scoreProductQuality({
      title: product.title,
      description: product.description,
      images: product.images.map((image) => ({
        url: image.url,
        alt: image.alt,
        isCover: image.isCover,
      })),
    });
    const qualityNotes = quality.notes.length ? quality.notes.join("; ") : null;
    const created = await prisma.product.create({
      data: {
        slug: product.slug,
        titleEn: product.title,
        price: decimal(product.price),
        currency: product.currency,
        descriptionEn: product.description,
        categoryId: categoryIds[product.categorySlug] ?? null,
        brandId: brandIds[product.brandSlug] ?? null,
        tags: [...product.tags],
        isNew: product.isNew,
        isBestSeller: product.isBestSeller,
        isActive: true,
        qaStatus: "APPROVED",
        qualityScore: quality.score,
        qualityNotes,
        inventory: product.inventory,
        images: {
          create: product.images.map((image, index) => ({
            url: image.url,
            alt: image.alt ?? product.title,
            isCover: image.isCover ?? index === 0,
            sortOrder: index,
          })),
        },
        variants: {
          create: {
            sku: product.variant.sku,
            size: product.variant.size,
            price: decimal(product.variant.price),
            inventory: product.variant.inventory,
            isActive: true,
          },
        },
      },
    });
    productIds[product.slug] = created.id;
  }

  const consultationProducts = [
    productSeeds.find((product) => product.brandSlug === "louis-vuitton"),
    productSeeds.find((product) => product.brandSlug === "gucci"),
    productSeeds.find((product) => product.brandSlug === "dior"),
  ].filter(isDefined);

  const wishlistProducts = [
    productSeeds.find((product) => product.brandSlug === "fendi"),
    productSeeds.find((product) => product.categorySlug === "lining"),
  ].filter(isDefined);

  const orderProducts = [
    productSeeds.find((product) => product.brandSlug === "gucci"),
    productSeeds.find((product) => product.brandSlug === "louis-vuitton"),
  ].filter(isDefined);

  if (consultationProducts.length < 3 || wishlistProducts.length < 2 || orderProducts.length < 2) {
    throw new Error("Imported catalog is missing required showcase products.");
  }

  const demoUser = await prisma.user.create({
    data: {
      email: "demo@upholsteryfabric.net",
      name: "Avery Curator",
      image: consultationProducts[0].images[0]?.url ?? null,
    },
  });

  const demoCustomer = await prisma.customer.create({
    data: {
      email: "demo@upholsteryfabric.net",
      name: "Avery Curator",
      tags: ["vip", "atelier", "fabric-sourcing"],
      segment: "VIP",
      source: "seed",
      lifetimeValue: decimal(1260),
      orderCount: 2,
    },
  });

  const guestCustomer = await prisma.customer.create({
    data: {
      email: "guest@upholsteryfabric.net",
      name: "Guest Client",
      source: "seed",
    },
  });

  await prisma.consultationRequest.create({
    data: {
      customerId: demoCustomer.id,
      name: "Avery Curator",
      email: demoCustomer.email,
      phone: "+1 555 301 2200",
      channel: "WHATSAPP",
      preferredAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      notes: `Looking for ${consultationProducts.map((product) => product.title).join(", ")} with swatch support and coordinated lining options.`,
      status: "PENDING",
      metadata: { source: "seed" },
    },
  });

  await prisma.wishlistItem.createMany({
    data: wishlistProducts.map((product) => ({
      userId: demoUser.id,
      productId: requireProductId(productIds, product.slug),
    })),
  });

  const orderSubtotal = orderProducts.reduce((sum, product) => sum + product.price, 0);
  const shippingTotal = 28;
  const taxTotal = Math.round(orderSubtotal * 0.08);
  const orderTotal = orderSubtotal + shippingTotal + taxTotal;

  const today = new Date();
  const iso = (value: Date) => value.toISOString();

  const order = await prisma.order.create({
    data: {
      orderNumber: "ATF-24001",
      email: guestCustomer.email,
      customerId: guestCustomer.id,
      status: OrderStatus.SHIPPED,
      subtotal: decimal(orderSubtotal),
      shippingTotal: decimal(shippingTotal),
      taxTotal: decimal(taxTotal),
      total: decimal(orderTotal),
      currency: "USD",
      shippingAddress: {
        fullName: "Guest Client",
        line1: "18 Rue de Rivoli",
        city: "Paris",
        country: "France",
        postalCode: "75001",
        phone: "+33 1 23 45 67 89",
      },
      billingAddress: {
        fullName: "Guest Client",
        line1: "18 Rue de Rivoli",
        city: "Paris",
        country: "France",
        postalCode: "75001",
      },
      items: {
        create: orderProducts.map((product) => ({
          productId: requireProductId(productIds, product.slug),
          qty: 1,
          price: decimal(product.price),
          currency: product.currency,
          titleSnapshot: product.title,
        })),
      },
      shipments: {
        create: [
          {
            carrier: "DHL",
            trackingNumber: "DHL8736421",
            status: TrackingStatus.IN_TRANSIT,
            statusHistory: [
              {
                timestamp: iso(new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000)),
                status: TrackingStatus.LABEL_CREATED,
                message: "Label created",
              },
              {
                timestamp: iso(new Date(today.getTime() - 24 * 60 * 60 * 1000)),
                status: TrackingStatus.IN_TRANSIT,
                message: "Departed Paris facility",
              },
              {
                timestamp: iso(today),
                status: TrackingStatus.IN_TRANSIT,
                message: "Arrived at regional hub",
              },
            ],
            estimatedDelivery: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000),
          },
        ],
      },
    },
  });

  await prisma.review.create({
    data: {
      productId: requireProductId(productIds, consultationProducts[0].slug),
      customerId: demoCustomer.id,
      rating: 5,
      title: "Excellent structure and image match",
      body: "The fabric hand matched the listing photos well, and the yardage shipped as one continuous cut. Strong option for sampling and small-batch production.",
      status: "APPROVED",
      publishedAt: new Date(),
    },
  });

  await prisma.contentPost.create({
    data: {
      slug: "atelier-fabric-archive",
      title: "Atelier Fabric Archive",
      excerpt: "A fresh intake of monogram jacquards, coated fabrics, denims, liners, and upholstery-ready materials.",
      body: "Curated stock for custom bag makers, fashion studios, sourcing agents, and upholstery workshops.",
      type: "DROP",
      status: "PUBLISHED",
      publishAt: new Date(),
      products: {
        create: consultationProducts.slice(0, 2).map((product, index) => ({
          productId: requireProductId(productIds, product.slug),
          sortOrder: index + 1,
        })),
      },
    },
  });

  await prisma.customerEvent.create({
    data: {
      customerId: demoCustomer.id,
      email: demoCustomer.email,
      event: "order_completed",
      source: "seed",
      metadata: { orderNumber: order.orderNumber },
    },
  });

  await prisma.automationRule.createMany({
    data: [
      {
        name: "Post-purchase fabric handling guide",
        trigger: "POST_PURCHASE",
        channel: "EMAIL",
        active: true,
        delayMinutes: 60 * 24,
        template: {
          subject: "Your fabric handling guide is ready",
          headline: "Storage and handling for your new textile",
          body: "We have prepared pressing, lining, and cutting notes for your selected fabric lot.",
          ctaLabel: "View handling guide",
          ctaUrl: `${siteUrl}/editorial`,
        },
      },
      {
        name: "Matching lining and trim suggestions",
        trigger: "POST_PURCHASE",
        channel: "EMAIL",
        active: true,
        delayMinutes: 60 * 24 * 3,
        template: {
          subject: "Matching fabrics just for you",
          headline: "Complete the sourcing set",
          body: "Explore compatible linings, vinyls, and jacquards curated around your last order.",
          ctaLabel: "Browse matching fabrics",
          ctaUrl: `${siteUrl}/search?sort=popular`,
        },
      },
      {
        name: "Archive restock reminder",
        trigger: "POST_PURCHASE",
        channel: "EMAIL",
        active: true,
        delayMinutes: 60 * 24 * 7,
        template: {
          subject: "Fresh archive fabrics are now online",
          headline: "New catalog additions just landed",
          body: "Recent sourcing drops have been added across jacquard, lining, leather, and upholstery categories.",
          ctaLabel: "Browse new arrivals",
          ctaUrl: `${siteUrl}/search?sort=newest`,
        },
      },
    ],
  });

  console.log(
    `Seeded ${brandSeeds.length} brands, ${categorySeeds.length} categories, and ${productSeeds.length} imported products.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
