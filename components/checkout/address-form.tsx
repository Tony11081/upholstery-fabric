"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useBagStore } from "@/lib/state/bag-store";
import { useCheckoutStore, type Address, type ShippingMethod } from "@/lib/state/checkout-store";
import { trackEvent } from "@/lib/analytics/client";
import {
  CALLING_CODE_OPTIONS,
  COUNTRY_OPTIONS,
  resolveCountryCode,
  resolveDialCodeByCountry,
} from "@/lib/utils/countries";
import { useDisplayPreferenceStore } from "@/lib/state/display-preference-store";
import { useDisplayPricing } from "@/lib/hooks/use-display-pricing";
import { calculateShipping } from "@/lib/utils/shipping";
import { PaymentMethods } from "@/components/ui/payment-methods";
import { useToast } from "@/lib/hooks/useToast";
import { getCheckoutTrustCopy, getShippingDisplayProfile } from "@/lib/utils/display-content";
import { formatPrice } from "@/lib/utils/format";

type PaymentLinkResponse = {
  ok: boolean;
  orderNumber?: string;
  paymentLinkUrl?: string;
  trackUrl?: string;
  checkoutProvider?: string;
  checkoutHost?: string;
  status?: "success" | "processing" | "error";
  error?: string;
  message?: string;
};

const splitPhone = (value?: string | null) => {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return { code: "", number: "" };
  const match = trimmed.match(/^\+(\d+)\s*(.*)$/);
  if (match) {
    return { code: `+${match[1]}`, number: match[2] || "" };
  }
  const parts = trimmed.split(/\s+/);
  if (parts.length > 1 && parts[0]?.startsWith("+")) {
    return { code: parts[0], number: parts.slice(1).join(" ") };
  }
  return { code: "", number: trimmed };
};

const normalizeDialCode = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("+") ? trimmed : `+${trimmed}`;
};

const splitName = (value?: string | null) => {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return { firstName: "", lastName: "" };
  const parts = trimmed.split(/\s+/);
  const firstName = parts.shift() ?? "";
  const lastName = parts.join(" ");
  return { firstName, lastName };
};

const normalizePaymentLink = (value?: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^www\./i.test(trimmed)) return `https://${trimmed}`;
  return null;
};

const REDIRECT_COUNTDOWN_SECONDS = 3;
const REDIRECT_FALLBACK_TIMEOUT_MS = 12000;

export function AddressForm() {
  const items = useBagStore((s) => s.items);
  const stored = useCheckoutStore((s) => s.address);
  const setAddress = useCheckoutStore((s) => s.setAddress);
  const setShipping = useCheckoutStore((s) => s.setShipping);
  const setDisplayCountry = useDisplayPreferenceStore((s) => s.setCountry);
  const { toast } = useToast();
  const [form, setForm] = useState<Address>(() => {
    if (stored) {
      return {
        ...stored,
        country: resolveCountryCode(stored.country),
      };
    }
    return {
      fullName: "",
      email: "",
      phone: "",
      country: resolveCountryCode("US"),
      address1: "",
      address2: "",
      city: "",
      state: "",
      postalCode: "",
    };
  });
  const initialName = splitName(form.fullName);
  const [firstName, setFirstName] = useState(initialName.firstName);
  const [lastName, setLastName] = useState(initialName.lastName);
  const countryValue = resolveCountryCode(form.country);
  const initialPhone = splitPhone(form.phone);
  const [phoneCode, setPhoneCode] = useState(() =>
    initialPhone.code || resolveDialCodeByCountry(countryValue),
  );
  const [phoneNumber, setPhoneNumber] = useState(initialPhone.number);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingAddress, setPendingAddress] = useState<Address | null>(null);
  const [creatingLink, setCreatingLink] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);
  const [redirectLink, setRedirectLink] = useState<string | null>(null);
  const [redirectFailed, setRedirectFailed] = useState(false);
  const [createdOrderNumber, setCreatedOrderNumber] = useState<string | null>(null);
  const [createdTrackUrl, setCreatedTrackUrl] = useState<string | null>(null);
  const [checkoutProvider, setCheckoutProvider] = useState<string | null>(null);
  const [checkoutHost, setCheckoutHost] = useState<string | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);
  const redirectFallbackTimerRef = useRef<number | null>(null);
  const redirectLifecycleCleanupRef = useRef<(() => void) | null>(null);
  const whatsappOpenedRef = useRef(false);
  const { profile, formatAmount } = useDisplayPricing();
  const whatsapp = process.env.NEXT_PUBLIC_CONCIERGE_WHATSAPP ?? "";
  const whatsappLink = useMemo(() => {
    if (!whatsapp) return "";
    const digits = whatsapp.replace(/[^\d+]/g, "");
    if (!digits) return "";
    return `https://wa.me/${digits.replace(/^\+/, "")}`;
  }, [whatsapp]);
  const trustCopy = useMemo(() => getCheckoutTrustCopy(profile.locale), [profile.locale]);
  const previewSubtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [items],
  );
  const previewShippingTotal = useMemo(() => calculateShipping(previewSubtotal), [previewSubtotal]);
  const previewTotal = useMemo(
    () => Number((previewSubtotal + previewShippingTotal).toFixed(2)),
    [previewShippingTotal, previewSubtotal],
  );
  const shippingProfile = useMemo(
    () => getShippingDisplayProfile(pendingAddress?.country ?? countryValue),
    [countryValue, pendingAddress?.country],
  );

  const handleChange = (key: keyof Address) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [key]: e.target.value });
  };

  useEffect(() => {
    if (!phoneCode || phoneCode === resolveDialCodeByCountry(countryValue)) {
      setPhoneCode(resolveDialCodeByCountry(countryValue));
    }
  }, [countryValue, phoneCode]);

  useEffect(() => {
    setDisplayCountry(countryValue);
  }, [countryValue, setDisplayCountry]);

  const clearRedirectTimers = useCallback(() => {
    if (countdownIntervalRef.current) {
      window.clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (redirectFallbackTimerRef.current) {
      window.clearTimeout(redirectFallbackTimerRef.current);
      redirectFallbackTimerRef.current = null;
    }
    if (redirectLifecycleCleanupRef.current) {
      redirectLifecycleCleanupRef.current();
      redirectLifecycleCleanupRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearRedirectTimers();
    };
  }, [clearRedirectTimers]);

  const copyPaymentLink = useCallback(async (link: string) => {
    if (!navigator?.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // Ignore clipboard errors in redirect fallback path.
    }
  }, []);

  const openWhatsAppFallback = useCallback(
    (link?: string | null) => {
      if (!whatsappLink || whatsappOpenedRef.current) return;
      whatsappOpenedRef.current = true;
      const message = encodeURIComponent(
        [
          "Hi, checkout redirect failed.",
          pendingAddress?.email ? `Email: ${pendingAddress.email}` : "",
          link ? `Payment link: ${link}` : "",
        ]
          .filter(Boolean)
          .join("\n")
      );
      const target = `${whatsappLink}?text=${message}`;
      const opened = window.open(target, "_blank", "noopener,noreferrer");
      if (!opened) {
        window.location.assign(target);
      }
    },
    [pendingAddress?.email, whatsappLink]
  );

  const startRedirectCountdown = useCallback(
    (link: string, email?: string) => {
      clearRedirectTimers();
      setRedirectLink(link);
      setRedirectFailed(false);
      setRedirectCountdown(REDIRECT_COUNTDOWN_SECONDS);
      trackEvent(
        "payment_redirect_countdown_started",
        {
          seconds: REDIRECT_COUNTDOWN_SECONDS,
          fallbackTimeoutMs: REDIRECT_FALLBACK_TIMEOUT_MS,
          provider: "inflyway",
        },
        email,
      );
      let remain = REDIRECT_COUNTDOWN_SECONDS;
      countdownIntervalRef.current = window.setInterval(() => {
        remain -= 1;
        setRedirectCountdown(remain);
        if (remain <= 0) {
          clearRedirectTimers();
          void copyPaymentLink(link);
          trackEvent(
            "payment_redirect_attempted",
            {
              provider: "inflyway",
              fallbackTimeoutMs: REDIRECT_FALLBACK_TIMEOUT_MS,
            },
            email,
          );
          let settled = false;
          const markSettled = () => {
            if (settled) return false;
            settled = true;
            return true;
          };
          const handlePageHide = () => {
            if (!markSettled()) return;
            if (redirectFallbackTimerRef.current) {
              window.clearTimeout(redirectFallbackTimerRef.current);
              redirectFallbackTimerRef.current = null;
            }
            cleanupLifecycle();
            trackEvent(
              "payment_redirect_navigated",
              {
                provider: "inflyway",
              },
              email,
            );
          };
          const handleVisibilityChange = () => {
            if (document.visibilityState === "hidden") {
              handlePageHide();
            }
          };
          const cleanupLifecycle = () => {
            window.removeEventListener("pagehide", handlePageHide);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            if (redirectLifecycleCleanupRef.current === cleanupLifecycle) {
              redirectLifecycleCleanupRef.current = null;
            }
          };
          redirectLifecycleCleanupRef.current = cleanupLifecycle;
          window.addEventListener("pagehide", handlePageHide);
          document.addEventListener("visibilitychange", handleVisibilityChange);
          window.location.assign(link);
          redirectFallbackTimerRef.current = window.setTimeout(() => {
            if (!markSettled()) return;
            cleanupLifecycle();
            setRedirectFailed(true);
            void copyPaymentLink(link);
            trackEvent(
              "payment_redirect_failed",
              {
                reason: `client_redirect_timeout_${REDIRECT_FALLBACK_TIMEOUT_MS}ms`,
                fallback: "whatsapp_clipboard",
                timeoutMs: REDIRECT_FALLBACK_TIMEOUT_MS,
              },
              email,
            );
            openWhatsAppFallback(link);
          }, REDIRECT_FALLBACK_TIMEOUT_MS);
        }
      }, 1000);
    },
    [clearRedirectTimers, copyPaymentLink, openWhatsAppFallback]
  );

  const pollForPaymentLink = useCallback(
    async (orderNumber: string, email: string) => {
      const maxAttempts = 30;
      const intervalMs = 2000;
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const res = await fetch("/api/order/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderNumber, email }),
        });
        const data = (await res.json().catch(() => null)) as
          | {
              order?: {
                paymentLinkUrl?: string | null;
                paypalInvoiceUrl?: string | null;
                paymentQrCode?: string | null;
              };
            }
          | null;
        const resolved = normalizePaymentLink(
          data?.order?.paymentLinkUrl ??
            data?.order?.paypalInvoiceUrl ??
            data?.order?.paymentQrCode
        );
        if (resolved) return resolved;
        await new Promise((resolve) => window.setTimeout(resolve, intervalMs));
      }
      return null;
    },
    []
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ").trim();
    const phone = [normalizeDialCode(phoneCode), phoneNumber.trim()]
      .filter(Boolean)
      .join(" ")
      .trim();
    const nextAddress = {
      ...form,
      fullName,
      country: countryValue,
      phone,
    };
    clearRedirectTimers();
    setConfirmError(null);
    setRedirectCountdown(null);
    setRedirectLink(null);
    setRedirectFailed(false);
    setCreatedOrderNumber(null);
    setCreatedTrackUrl(null);
    setCheckoutProvider(null);
    setCheckoutHost(null);
    idempotencyKeyRef.current = null;
    whatsappOpenedRef.current = false;
    setPendingAddress(nextAddress);
    setConfirmOpen(true);
    trackEvent(
      "checkout_address_review_opened",
      {
        items: items.length,
        country: nextAddress.country,
      },
      nextAddress.email,
    );
  };

  const confirmAddress = async () => {
    if (!pendingAddress || creatingLink) return;
    if (items.length === 0) {
      setConfirmError("Your bag is empty.");
      return;
    }

    setCreatingLink(true);
    setConfirmError(null);
    setRedirectFailed(false);
    whatsappOpenedRef.current = false;

    try {
      const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const shippingPrice = calculateShipping(subtotal);
      const total = Number((subtotal + shippingPrice).toFixed(2));
      const shippingMethod: ShippingMethod = {
        id: "standard",
        label: shippingPrice === 0 ? "Complimentary UPS shipping" : "UPS worldwide shipping",
        eta: "5-9 business days (UPS)",
        price: shippingPrice,
      };

      setAddress(pendingAddress);
      setShipping(shippingMethod);
      trackEvent("checkout_started", { step: "address" }, pendingAddress.email);
      trackEvent(
        "payment_link_requested",
        {
          itemCount: items.length,
          total,
          currency: "USD",
          country: pendingAddress.country,
        },
        pendingAddress.email,
      );

      if (!idempotencyKeyRef.current) {
        idempotencyKeyRef.current =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `addr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      }

      const response = await fetch("/api/checkout/payment-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            options: item.options,
          })),
          address: pendingAddress,
          shipping: {
            method: shippingMethod.id ?? shippingMethod.label,
            price: shippingMethod.price,
          },
          idempotencyKey: idempotencyKeyRef.current,
        }),
      });

      const data = (await response.json().catch(() => null)) as PaymentLinkResponse | null;
      if (!response.ok || !data?.ok) {
        throw new Error(data?.message ?? data?.error ?? "Unable to create payment link");
      }

      if (data.orderNumber) {
        setCreatedOrderNumber(data.orderNumber);
      }
      if (data.trackUrl) {
        setCreatedTrackUrl(data.trackUrl);
      }
      setCheckoutProvider(data.checkoutProvider ?? null);
      setCheckoutHost(data.checkoutHost ?? null);

      let paymentLink = normalizePaymentLink(data.paymentLinkUrl);
      if (!paymentLink && data.orderNumber && data.status === "processing") {
        paymentLink = await pollForPaymentLink(data.orderNumber, pendingAddress.email);
      }
      if (!paymentLink) {
        const pendingMessage =
          "Payment link is still preparing. Please open the order status page; we will continue syncing automatically.";
        setConfirmError(pendingMessage);
        trackEvent(
          "payment_link_pending",
          {
            orderNumber: data.orderNumber ?? null,
            status: data.status ?? "processing",
          },
          pendingAddress.email,
        );
        return;
      }

      setConfirmError(null);
      trackEvent(
        "payment_link_created",
        {
          orderNumber: data?.orderNumber ?? null,
          status: data?.status ?? "success",
          provider: "inflyway",
        },
        pendingAddress.email,
      );
      startRedirectCountdown(paymentLink, pendingAddress.email);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to start checkout";
      setConfirmError(message);
      trackEvent(
        "payment_link_request_failed",
        {
          reason: message,
          provider: "inflyway",
        },
        pendingAddress.email,
      );
      toast({
        title: "Unable to start checkout",
        description: message,
        variant: "error",
      });
    } finally {
      setCreatingLink(false);
    }
  };

  const countryLabel =
    COUNTRY_OPTIONS.find((option) => option.code === pendingAddress?.country)?.label ??
    pendingAddress?.country ??
    "";
  const addressLine = pendingAddress
    ? [
        pendingAddress.address1,
        pendingAddress.address2,
        [pendingAddress.city, pendingAddress.state, pendingAddress.postalCode]
          .filter(Boolean)
          .join(", "),
        countryLabel,
      ]
        .filter(Boolean)
        .join("\n")
    : "";
  const orderStatusUrl = useMemo(() => {
    if (createdTrackUrl) return createdTrackUrl;
    if (!createdOrderNumber || !pendingAddress?.email) return "";
    return `/order/waiting?orderNumber=${encodeURIComponent(createdOrderNumber)}&email=${encodeURIComponent(
      pendingAddress.email,
    )}`;
  }, [createdOrderNumber, createdTrackUrl, pendingAddress?.email]);

  return (
    <>
      <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="First name"
          required
          value={firstName}
          onChange={(event) => setFirstName(event.target.value)}
          autoComplete="given-name"
        />
        <Input
          label="Last name"
          required
          value={lastName}
          onChange={(event) => setLastName(event.target.value)}
          autoComplete="family-name"
        />
      </div>
      <Input label="Email" type="email" required value={form.email} onChange={handleChange("email")} />
      <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
        <label className="flex flex-col gap-2 text-sm text-ink">
          <span className="font-medium text-ink">Country code</span>
          <div className="flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-3 transition focus-within:border-ink focus-within:shadow-[var(--shadow-float)]">
            <select
              className="w-full bg-transparent text-sm text-ink focus:outline-none"
              value={phoneCode}
              onChange={(event) => setPhoneCode(event.target.value)}
              autoComplete="tel-country-code"
              required
            >
              {CALLING_CODE_OPTIONS.map((option) => (
                <option key={`${option.label}`} value={option.dialCode}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </label>
        <Input
          label="Phone number"
          required
          value={phoneNumber}
          onChange={(event) => setPhoneNumber(event.target.value)}
          placeholder="555 123 4567"
          inputMode="tel"
          autoComplete="tel-national"
        />
      </div>
      <label className="flex flex-col gap-2 text-sm text-ink">
        <span className="font-medium text-ink">Country/Region</span>
        <div className="flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-3 transition focus-within:border-ink focus-within:shadow-[var(--shadow-float)]">
          <select
            className="w-full bg-transparent text-sm text-ink focus:outline-none"
            value={countryValue}
            onChange={(event) => {
              const nextCountry = event.target.value;
              setForm({ ...form, country: nextCountry });
              setDisplayCountry(nextCountry);
            }}
            autoComplete="country"
            required
          >
            {COUNTRY_OPTIONS.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </label>
      <Input label="Street address" required value={form.address1} onChange={handleChange("address1")} />
      <Input label="Apartment, suite, etc." value={form.address2} onChange={handleChange("address2")} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Input label="City" required value={form.city} onChange={handleChange("city")} />
        <Input label="State/Province/Region" required value={form.state} onChange={handleChange("state")} />
        <Input label="ZIP/Postal code" required value={form.postalCode} onChange={handleChange("postalCode")} />
      </div>
      <Button type="submit" size="lg" className="rounded-full">
        Review & continue
      </Button>
      </form>

      {confirmOpen && pendingAddress && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 py-6 md:items-center">
          <div
            className="w-full max-w-xl space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-soft)]"
            role="dialog"
            aria-modal="true"
          >
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">Confirm details</p>
              <h3 className="font-display text-2xl">{trustCopy.title}</h3>
              <p className="text-sm text-muted">
                {trustCopy.intro}
              </p>
              <p className="text-xs text-muted">
                {trustCopy.consistencyHint}
              </p>
            </div>

            <div className="rounded-xl border border-border bg-contrast p-4 text-sm">
              <p className="font-medium text-ink">{pendingAddress.fullName}</p>
              <p className="text-muted">{pendingAddress.email}</p>
              <p className="text-muted">{pendingAddress.phone}</p>
              <p className="mt-3 whitespace-pre-line text-muted">{addressLine}</p>
            </div>

            <div className="rounded-xl border border-border bg-contrast p-4 text-sm text-muted">
              <p className="text-xs uppercase tracking-[0.18em] text-muted">{trustCopy.paymentProviderTitle}</p>
              <p className="mt-1 text-sm text-ink">{checkoutProvider ?? "Inflyway Hosted Checkout"}</p>
              <p className="mt-1 text-xs text-muted">{trustCopy.paymentProviderBody}</p>
              {checkoutHost ? <p className="mt-1 text-xs text-muted">Host: {checkoutHost}</p> : null}
              {createdOrderNumber ? <p className="mt-2 text-xs text-ink">Order: {createdOrderNumber}</p> : null}
              <p className="mt-2 text-xs text-muted">
                Amount: {formatPrice(previewTotal, "USD")} ({formatAmount(previewTotal, "USD").text})
              </p>
              <p className="mt-1 text-xs text-muted">
                Shipping: {shippingProfile.carrier}, ETA {shippingProfile.eta}
              </p>
              <p className="mt-1 text-xs text-muted">{shippingProfile.note}</p>
            </div>

            <div className="rounded-xl border border-border bg-contrast p-4 text-sm text-muted">
              <p className="text-xs uppercase tracking-[0.18em] text-muted">{trustCopy.orderStatusTitle}</p>
              <p className="mt-1 text-xs text-muted">{trustCopy.orderStatusBody}</p>
              {orderStatusUrl ? (
                <a
                  href={orderStatusUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:border-ink/50"
                  onClick={() =>
                    trackEvent(
                      "checkout_order_status_opened",
                      { orderNumber: createdOrderNumber ?? null },
                      pendingAddress.email,
                    )
                  }
                >
                  {trustCopy.statusButton}
                </a>
              ) : null}
            </div>

            <div className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
              {creatingLink
                ? "Creating your secure payment link..."
                : redirectCountdown !== null
                  ? `Payment link ready. Redirecting in ${redirectCountdown} second${redirectCountdown === 1 ? "" : "s"}...`
                  : "Confirm once. We will redirect you directly without another checkout page."}
            </div>

            {confirmError ? (
              <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">
                {confirmError}
              </div>
            ) : null}

            {redirectFailed ? (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                Redirect failed. We copied your payment link and opened WhatsApp support.
              </div>
            ) : null}

            {redirectFailed && redirectLink ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  variant="accent"
                  size="sm"
                  className="rounded-full"
                  onClick={() => startRedirectCountdown(redirectLink, pendingAddress.email)}
                >
                  Retry redirect
                </Button>
                {whatsappLink ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-full"
                    onClick={() => openWhatsAppFallback(redirectLink)}
                  >
                    Contact WhatsApp
                  </Button>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">Payment methods</p>
              <PaymentMethods variant="inline" />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                size="lg"
                className="rounded-full"
                onClick={() => void confirmAddress()}
                disabled={creatingLink || redirectCountdown !== null}
              >
                {creatingLink
                  ? "Creating link..."
                  : redirectCountdown !== null
                    ? `Redirecting in ${redirectCountdown}s`
                    : "Confirm & auto redirect"}
              </Button>
              <Button
                variant="ghost"
                size="lg"
                className="rounded-full"
                onClick={() => {
                  clearRedirectTimers();
                  setConfirmOpen(false);
                }}
                disabled={creatingLink}
              >
                Edit details
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
