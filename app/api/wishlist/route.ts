import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth/session";

async function requireUser() {
  const session = await getAuthSession();
  const email = session?.user?.email?.toLowerCase();
  if (!email) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name: session?.user?.name ?? null },
    select: { id: true },
  });
  return { userId: user.id };
}

function getProductId(request: Request, body?: { productId?: string }) {
  if (body?.productId) {
    return body.productId;
  }
  const url = new URL(request.url);
  return url.searchParams.get("productId") ?? undefined;
}

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const items = await prisma.wishlistItem.findMany({
    where: { userId: auth.userId },
    select: { productId: true },
  });
  return NextResponse.json({ productIds: items.map((item) => item.productId) });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => null)) as { productId?: string } | null;
  const productId = getProductId(request, body ?? undefined);
  if (!productId) {
    return NextResponse.json({ error: "Missing productId" }, { status: 400 });
  }

  await prisma.wishlistItem.upsert({
    where: { userId_productId: { userId: auth.userId, productId } },
    update: {},
    create: { userId: auth.userId, productId },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => null)) as { productId?: string } | null;
  const productId = getProductId(request, body ?? undefined);
  if (!productId) {
    return NextResponse.json({ error: "Missing productId" }, { status: 400 });
  }

  await prisma.wishlistItem.deleteMany({
    where: { userId: auth.userId, productId },
  });

  return NextResponse.json({ ok: true });
}
