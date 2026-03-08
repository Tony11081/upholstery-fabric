import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth/admin";
import { isExtensionOrderSyncEnabled } from "@/lib/utils/env";

const normalizePaymentLink = (value?: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^www\./i.test(trimmed)) return `https://${trimmed}`;
  return null;
};

const hasAdminAccess = async (request: Request) => {
  const session = await getAdminSession();
  if (session) return true;
  const token = process.env.ADMIN_PAYMENT_LINK_TOKEN;
  if (!token) return false;
  const header = request.headers.get("x-admin-token");
  return header === token;
};

const syncDisabledResponse = () =>
  NextResponse.json({ error: "Not Found" }, { status: 404 });

// 获取待处理的订单（需要在 inflyway 创建支付）
export async function GET(request: Request) {
  if (!isExtensionOrderSyncEnabled) {
    return syncDisabledResponse();
  }

  const authorized = await hasAdminAccess(request);
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orders = await prisma.order.findMany({
    where: {
      status: "AWAITING_PAYMENT_LINK",
      OR: [
        { inflywayOrderId: null },
        {
          AND: [
            { paymentLinkUrl: null },
            { paypalInvoiceUrl: null },
            { paymentQrCode: null },
          ],
        },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      orderNumber: true,
      email: true,
      total: true,
      currency: true,
      createdAt: true,
      inflywayOrderId: true,
      paymentLinkUrl: true,
      paypalInvoiceUrl: true,
      paymentQrCode: true,
      shippingAddress: true,
      customer: {
        select: {
          email: true,
          name: true,
          phone: true,
        },
      },
      items: {
        select: {
          qty: true,
          price: true,
          currency: true,
          titleSnapshot: true,
          product: {
            select: {
              titleEn: true,
              slug: true,
            },
          },
        },
      },
    },
  });

  return NextResponse.json({ orders });
}

// 标记订单已在 inflyway 创建
export async function POST(request: Request) {
  if (!isExtensionOrderSyncEnabled) {
    return syncDisabledResponse();
  }

  const authorized = await hasAdminAccess(request);
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { orderId, inflywayOrderId, qrCodeUrl, paymentLinkUrl } = body;

  if (!orderId) {
    return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
  }

  const resolvedLink = normalizePaymentLink(paymentLinkUrl) ?? normalizePaymentLink(qrCodeUrl);
  const data = {
    inflywayOrderId,
    ...(resolvedLink ? { paymentLinkUrl: resolvedLink, paymentQrCode: null } : {}),
  };

  const order = await prisma.order.update({
    where: { id: orderId },
    data,
  });

  return NextResponse.json({ success: true, order });
}

// 清空待处理订单（标记为已取消，避免物理删除）
export async function DELETE(request: Request) {
  if (!isExtensionOrderSyncEnabled) {
    return syncDisabledResponse();
  }

  const authorized = await hasAdminAccess(request);
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await prisma.order.updateMany({
    where: {
      status: "AWAITING_PAYMENT_LINK",
      OR: [
        { inflywayOrderId: null },
        {
          AND: [
            { paymentLinkUrl: null },
            { paypalInvoiceUrl: null },
            { paymentQrCode: null },
          ],
        },
      ],
    },
    data: {
      status: "CANCELED",
    },
  });

  return NextResponse.json({ success: true, count: result.count });
}
