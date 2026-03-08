import { InventoryAlertStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { buildBackInStockEmail } from "@/lib/email/templates";
import { absoluteUrl } from "@/lib/utils/site";
import { maskEmail } from "@/lib/utils/api";

type InventoryAlertInput = {
  productId: string;
  email: string;
};

type BackInStockProduct = {
  id: string;
  slug: string;
  titleEn: string;
};

export async function createInventoryAlert({ productId, email }: InventoryAlertInput) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error("Email is required");
  }

  const alert = await prisma.inventoryAlert.upsert({
    where: {
      productId_email: {
        productId,
        email: normalizedEmail,
      },
    },
    update: {
      status: InventoryAlertStatus.PENDING,
    },
    create: {
      productId,
      email: normalizedEmail,
      status: InventoryAlertStatus.PENDING,
    },
  });

  return alert;
}

export async function notifyBackInStock(product: BackInStockProduct) {
  const alerts = await prisma.inventoryAlert.findMany({
    where: {
      productId: product.id,
      status: InventoryAlertStatus.PENDING,
    },
  });

  if (!alerts.length) {
    return { sent: 0 };
  }

  const productUrl = absoluteUrl(`/product/${product.slug}`);
  const template = buildBackInStockEmail({
    productTitle: product.titleEn,
    productUrl,
  });

  let sent = 0;
  for (const alert of alerts) {
    try {
      await sendEmail({
        to: alert.email,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });

      await prisma.inventoryAlert.update({
        where: { id: alert.id },
        data: {
          status: InventoryAlertStatus.NOTIFIED,
          notifiedAt: new Date(),
        },
      });
      sent += 1;
    } catch (error) {
      console.error("[inventory-alert]", {
        productId: product.id,
        alertId: alert.id,
        email: maskEmail(alert.email),
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { sent };
}
