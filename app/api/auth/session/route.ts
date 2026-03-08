import type { Session } from "next-auth";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { authOptions } from "@/lib/auth/options";
import { parseAdminEmails } from "@/lib/auth/admin";

function decodeCookie(value?: string) {
  if (!value) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

async function tokenSession() {
  const token = process.env.ADMIN_PAYMENT_LINK_TOKEN;
  if (!token) return null;
  const cookieStore = await cookies();
  const headerStore = await headers();
  const tokenCookie = decodeCookie(cookieStore.get("admin_payment_token")?.value);
  const tokenHeader = headerStore.get("x-admin-token");
  const tokenAllowed = tokenCookie === token || tokenHeader === token;
  if (!tokenAllowed) return null;

  const adminEmail = parseAdminEmails()[0];
  if (!adminEmail) return null;

  const session: Session = {
    user: {
      id: "token-admin",
      name: "Admin",
      email: adminEmail,
    },
    expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
  };

  return session;
}

export async function GET() {
  const noStoreHeaders = { "Cache-Control": "no-store, max-age=0" };
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.email) {
      return NextResponse.json(session, { headers: noStoreHeaders });
    }
  } catch (error) {
    console.warn("[auth/session] fallback to token session", error);
  }

  const fallbackSession = await tokenSession();
  return NextResponse.json(fallbackSession ?? {}, { headers: noStoreHeaders });
}
