import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { cookies } from "next/headers";
import { authOptions } from "./options";
import { parseAdminEmails } from "@/lib/auth/admin";

function decodeCookie(value?: string) {
  if (!value) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export async function getAuthSession() {
  const session = await getServerSession(authOptions);
  if (session?.user?.email) {
    return session;
  }

  const token = process.env.ADMIN_PAYMENT_LINK_TOKEN;
  if (!token) {
    return session;
  }

  const cookieStore = await cookies();
  const tokenCookie = decodeCookie(cookieStore.get("admin_payment_token")?.value);
  if (tokenCookie !== token) {
    return session;
  }

  const adminEmail = parseAdminEmails()[0];
  if (!adminEmail) {
    return session;
  }

  return {
    user: {
      id: "token-admin",
      name: "Admin",
      email: adminEmail,
    },
  } as Session;
}
