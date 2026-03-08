import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import EmailProvider from "next-auth/providers/email";
import GoogleProvider from "next-auth/providers/google";
import type { JWT } from "next-auth/jwt";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { resolveAuthEmailProviderConfig } from "@/lib/utils/email-config";

function normalizeOrigin(value?: string) {
  if (!value) return undefined;
  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}

function resolveSessionStrategy(): "jwt" | "database" {
  const raw = (process.env.AUTH_SESSION_STRATEGY ?? "jwt").trim().toLowerCase();
  return raw === "database" ? "database" : "jwt";
}

const emailProviderConfig = resolveAuthEmailProviderConfig();
const canonicalAuthOrigin =
  normalizeOrigin(process.env.NEXTAUTH_URL) ??
  normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL);
const fallbackSiteOrigin = normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL);
const explicitRedirectOrigins = (process.env.AUTH_REDIRECT_ORIGINS ?? "")
  .split(",")
  .map((value) => normalizeOrigin(value))
  .filter((value): value is string => Boolean(value));
const adminEmail = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean)[0];
const adminPassword = process.env.ADMIN_PASSWORD ?? "";
const sessionStrategy = resolveSessionStrategy();

const providers: Array<
  ReturnType<typeof CredentialsProvider> | ReturnType<typeof EmailProvider> | ReturnType<typeof GoogleProvider>
> = [
  CredentialsProvider({
    name: "Password",
    credentials: {
      password: { label: "Password", type: "password" },
    },
    authorize: async (credentials) => {
      if (!adminEmail || !adminPassword) return null;
      const passwordInput = credentials?.password ?? "";
      if (!passwordInput) return null;
      const inputBuffer = Buffer.from(passwordInput);
      const secretBuffer = Buffer.from(adminPassword);
      if (inputBuffer.length !== secretBuffer.length) return null;
      if (!timingSafeEqual(inputBuffer, secretBuffer)) return null;

      const user = await prisma.user.upsert({
        where: { email: adminEmail },
        create: { email: adminEmail, name: "Admin" },
        update: {},
      });

      return {
        id: user.id,
        name: user.name ?? "Admin",
        email: user.email,
      };
    },
  }),
];

if (emailProviderConfig.enabled && emailProviderConfig.server) {
  providers.push(
    EmailProvider({
      server: emailProviderConfig.server,
      from: emailProviderConfig.from,
    }),
  );
}

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  );
}

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.AUTH_DEBUG === "1",
  session: {
    strategy: sessionStrategy,
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: "/account",
  },
  providers,
  callbacks: {
    session: async ({ session, user, token }) => {
      if (session.user) {
        const resolvedUser =
          user ??
          (token
            ? {
                id: token.sub,
                name: token.name,
                email: token.email,
                image: (token as JWT & { picture?: string }).picture,
              }
            : null);
        if (resolvedUser) {
          session.user.id = resolvedUser.id ?? session.user.id;
          session.user.name = resolvedUser.name ?? session.user.name;
          session.user.email = resolvedUser.email ?? session.user.email;
          session.user.image = resolvedUser.image ?? session.user.image;
        }
      }
      return session;
    },
    redirect: async ({ url, baseUrl }) => {
      const allowedOrigins = new Set(
        [baseUrl, canonicalAuthOrigin, fallbackSiteOrigin, ...explicitRedirectOrigins].filter(
          (value): value is string => Boolean(value),
        ),
      );
      if (url.startsWith("/")) {
        return `${baseUrl}${url}`;
      }
      try {
        const target = new URL(url);
        if (allowedOrigins.has(target.origin)) {
          return url;
        }
      } catch {
        // ignore and fallback
      }
      return `${baseUrl}/account`;
    },
  },
} satisfies NextAuthOptions;
