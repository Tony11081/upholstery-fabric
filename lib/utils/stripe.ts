import Stripe from "stripe";

export const STRIPE_API_VERSION: Stripe.LatestApiVersion = "2025-12-15.clover";

export function getStripeSecret() {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  return secret;
}

export function createStripeClient() {
  return new Stripe(getStripeSecret(), { apiVersion: STRIPE_API_VERSION });
}

export function generateOrderNumber() {
  const now = new Date();
  return `UOOTD-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${Math.floor(
    Math.random() * 90000 + 10000,
  )}`;
}

export function safeJson(value: unknown) {
  return value ? JSON.parse(JSON.stringify(value)) : {};
}

export function generateRequestNumber() {
  const now = new Date();
  return `UOOTD-RQ-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${Math.floor(
    Math.random() * 90000 + 10000,
  )}`;
}
