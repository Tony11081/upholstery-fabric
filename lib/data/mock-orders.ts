import { OrderStatus, TrackingStatus } from "@prisma/client";

export const mockOrder = {
  orderNumber: "UOOTD-24001",
  email: "guest@uootd.com",
  createdAt: new Date(),
  status: OrderStatus.SHIPPED,
  subtotal: 3170,
  shippingTotal: 30,
  taxTotal: 0,
  total: 3200,
  currency: "USD",
  shippingAddress: {
    fullName: "Guest Client",
    line1: "18 Rue de Rivoli",
    city: "Paris",
    country: "France",
    postalCode: "75001",
    phone: "+33 1 23 45 67 89",
  },
  items: [
    {
      id: "mock-item-1",
      qty: 1,
      price: 1890,
      currency: "USD",
      titleSnapshot: "Sculpted Wool Coat",
      product: {
        id: "p-coat",
        slug: "sculpted-wool-coat",
        titleEn: "Sculpted Wool Coat",
        price: 1890,
        currency: "USD",
        isNew: true,
        isBestSeller: false,
        inventory: 8,
        images: [
          {
            id: "img-coat-1",
            url: "https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?auto=format&fit=crop&w=1200&q=80",
            alt: "Minimalist wool coat draped on a hanger",
            label: "cover",
            sortOrder: 0,
            isCover: true,
            productId: "p-coat",
          },
        ],
      },
    },
    {
      id: "mock-item-2",
      qty: 1,
      price: 1280,
      currency: "USD",
      titleSnapshot: "Atelier Shoulder Bag",
      product: {
        id: "p-bag",
        slug: "atelier-shoulder-bag",
        titleEn: "Atelier Shoulder Bag",
        price: 1280,
        currency: "USD",
        isNew: false,
        isBestSeller: true,
        inventory: 18,
        images: [
          {
            id: "img-bag-1",
            url: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1200&q=80",
            alt: "Champagne leather shoulder bag on a marble plinth",
            label: "cover",
            sortOrder: 0,
            isCover: true,
            productId: "p-bag",
          },
        ],
      },
    },
  ],
  shipments: [
    {
      id: "mock-ship-1",
      carrier: "DHL",
      trackingNumber: "MOCK-TRACK",
      status: TrackingStatus.IN_TRANSIT,
      statusHistory: [
        {
          timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          status: TrackingStatus.LABEL_CREATED,
          message: "Label created",
        },
        {
          timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          status: TrackingStatus.IN_TRANSIT,
          message: "Departed Paris facility",
        },
        {
          timestamp: new Date().toISOString(),
          status: TrackingStatus.IN_TRANSIT,
          message: "Arrived at regional hub",
        },
      ],
    },
  ],
};
