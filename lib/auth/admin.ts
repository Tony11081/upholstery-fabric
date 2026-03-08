import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { cookies, headers } from "next/headers";
import { authOptions } from "@/lib/auth/options";

export function parseAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email?: string | null) {
  if (!email) return false;
  const allowlist = parseAdminEmails();
  return allowlist.includes(email.trim().toLowerCase());
}

function decodeCookie(value?: string) {
  if (!value) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export async function getAdminSession() {
  const session = await getServerSession(authOptions);
  if (session?.user?.email && isAdminEmail(session.user.email)) {
    return session;
  }

  const token = process.env.ADMIN_PAYMENT_LINK_TOKEN;
  if (!token) return null;

  const cookieStore = await cookies();
  const tokenCookie = decodeCookie(cookieStore.get("admin_payment_token")?.value);
  const headerStore = await headers();
  const tokenHeader = headerStore.get("x-admin-token");
  const tokenAllowed = tokenCookie === token || tokenHeader === token;

  if (!tokenAllowed) return null;

  const adminEmail = parseAdminEmails()[0];
  if (!adminEmail) return null;

  return {
    user: {
      id: "token-admin",
      name: "Admin",
      email: adminEmail,
    },
  } as Session;
}
