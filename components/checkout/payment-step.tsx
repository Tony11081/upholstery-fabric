"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import { useBagStore } from "@/lib/state/bag-store";
import { useCheckoutStore } from "@/lib/state/checkout-store";
import { useToast } from "@/lib/hooks/useToast";
import { absoluteUrl } from "@/lib/utils/site";

type PaymentLinkResponse = {
  ok: boolean;
  orderNumber?: string;
  paymentLinkUrl?: string;
  inflywayOrderId?: string;
  status?: "success" | "processing" | "error";
  error?: string;
  message?: string;
};

type PaymentStepProps = {
  channelLabel?: string;
};

export function PaymentStep({
  channelLabel,
}: PaymentStepProps = {}) {
  const router = useRouter();
  const items = useBagStore((s) => s.items);
  const address = useCheckoutStore((s) => s.address);
  const shipping = useCheckoutStore((s) => s.shipping);
  const [loading, setLoading] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [paymentLinkUrl, setPaymentLinkUrl] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [qrDecoding, setQrDecoding] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [progressIndex, setProgressIndex] = useState(0);
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);
  const [redirectFailed, setRedirectFailed] = useState(false);
  const { toast } = useToast();
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
  const qrDecoderRef = useRef<typeof import("jsqr").default | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);
  const autoStartRef = useRef(false);
  const redirectIntervalRef = useRef<number | null>(null);
  const redirectFallbackRef = useRef<number | null>(null);
  const autoWhatsappOpenedRef = useRef(false);
  const itemsKey = useMemo(
    () =>
      items
        .map(
          (item) =>
            `${item.productId ?? item.slug ?? item.title}:${item.quantity}:${item.price}`,
        )
        .join("|"),
    [items],
  );
  const autoStartKey = useMemo(
    () => `${itemsKey}:${address?.email ?? ""}:${address?.postalCode ?? ""}`,
    [itemsKey, address?.email, address?.postalCode],
  );
  const progressSteps = useMemo(
    () => [
      "Preparing your order",
      "Generating secure checkout link",
      "Finalizing confirmation",
    ],
    []
  );

  useEffect(() => {
    if (!loading) return;
    setProgressIndex(0);
    let current = 0;
    const interval = window.setInterval(() => {
      current = Math.min(progressSteps.length - 1, current + 1);
      setProgressIndex(current);
    }, 1500);
    return () => window.clearInterval(interval);
  }, [loading, progressSteps.length]);

  useEffect(() => {
    if (!loading) {
      idempotencyKeyRef.current = null;
    }
  }, [itemsKey, loading]);

  useEffect(() => {
    autoStartRef.current = false;
  }, [autoStartKey]);

  useEffect(() => {
    autoWhatsappOpenedRef.current = false;
  }, [paymentLinkUrl]);

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const getQrDecoder = useCallback(async () => {
    if (qrDecoderRef.current) return qrDecoderRef.current;
    const { default: jsQR } = await import("jsqr");
    qrDecoderRef.current = jsQR;
    return jsQR;
  }, []);

  const decodeQrFromImage = useCallback(
    async (imageUrl: string) => {
      const img = new Image();
      img.crossOrigin = "anonymous";

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to load QR image"));
        img.src = imageUrl;
      });

      const maxSide = 720;
      const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
      const width = Math.max(1, Math.floor(img.naturalWidth * scale));
      const height = Math.max(1, Math.floor(img.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return null;

      ctx.drawImage(img, 0, 0, width, height);
      const imageData = ctx.getImageData(0, 0, width, height);
      const jsQR = await getQrDecoder();
      const result = jsQR(imageData.data, imageData.width, imageData.height);
      return result?.data ?? null;
    },
    [getQrDecoder],
  );

  const normalizeQrLink = useCallback((payload: string) => {
    const trimmed = payload.trim();
    if (!trimmed) return null;
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return trimmed;
    if (/^www\\./i.test(trimmed)) return `https://${trimmed}`;
    return null;
  }, []);

  const normalizePaymentLink = useCallback((value?: string | null) => {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (/^www\./i.test(trimmed)) return `https://${trimmed}`;
    return null;
  }, []);

  const clearRedirectTimers = useCallback(() => {
    if (redirectIntervalRef.current) {
      window.clearInterval(redirectIntervalRef.current);
      redirectIntervalRef.current = null;
    }
    if (redirectFallbackRef.current) {
      window.clearTimeout(redirectFallbackRef.current);
      redirectFallbackRef.current = null;
    }
  }, []);

  useEffect(() => {
    clearRedirectTimers();
    setRedirectCountdown(null);
    setRedirectFailed(false);
    if (!paymentLinkUrl) return;

    let remaining = 3;
    setRedirectCountdown(remaining);
    redirectIntervalRef.current = window.setInterval(() => {
      remaining -= 1;
      setRedirectCountdown(remaining);
      if (remaining <= 0) {
        clearRedirectTimers();
        try {
          window.location.assign(paymentLinkUrl);
        } catch (error) {
          console.error("Auto redirect failed", error);
          setRedirectFailed(true);
          return;
        }
        redirectFallbackRef.current = window.setTimeout(() => {
          setRedirectFailed(true);
        }, 2500);
      }
    }, 1000);

    return () => {
      clearRedirectTimers();
    };
  }, [paymentLinkUrl, clearRedirectTimers]);

  const handleQrLongPress = useCallback(async () => {
    if (!qrCodeUrl || qrDecoding) return;
    setQrDecoding(true);
    try {
      const payload = await decodeQrFromImage(qrCodeUrl);
      if (!payload) {
        toast({
          title: "QR not detected",
          description: "Please try again.",
          variant: "error",
        });
        return;
      }

      const link = normalizeQrLink(payload);
      if (link) {
        window.location.href = link;
        return;
      }

      if (navigator.clipboard) {
        await navigator.clipboard.writeText(payload);
      }
      toast({
        title: "QR text copied",
        description: payload,
        variant: "info",
      });
    } catch (error) {
      console.error("Failed to decode QR", error);
      toast({
        title: "Failed to decode QR",
        description: "Please try again.",
        variant: "error",
      });
    } finally {
      setQrDecoding(false);
    }
  }, [decodeQrFromImage, normalizeQrLink, qrCodeUrl, qrDecoding, toast]);

  const handleQrTouchStart = useCallback(() => {
    clearLongPressTimer();
    longPressTriggeredRef.current = false;
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      handleQrLongPress();
    }, 500);
  }, [handleQrLongPress]);

  const handleQrTouchEnd = useCallback(() => {
    clearLongPressTimer();
  }, []);

  const handleQrContextMenu = useCallback((event: MouseEvent<HTMLImageElement>) => {
    if (longPressTriggeredRef.current) {
      event.preventDefault();
      longPressTriggeredRef.current = false;
    }
  }, []);

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
          | { order?: { paymentLinkUrl?: string | null; paypalInvoiceUrl?: string | null; paymentQrCode?: string | null } }
          | null;
        const link = normalizePaymentLink(
          data?.order?.paymentLinkUrl ??
            data?.order?.paypalInvoiceUrl ??
            data?.order?.paymentQrCode
        );
        if (link) return link;
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
      return null;
    },
    [normalizePaymentLink]
  );

  const handleCheckout = useCallback(async () => {
    if (loading) return;
    setCreateError(null);
    setLoading(true);

    try {
      if (!address) {
        throw new Error("Missing address details");
      }

      // 生成幂等性 key
      if (!idempotencyKeyRef.current) {
        if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
          idempotencyKeyRef.current = crypto.randomUUID();
        } else {
          idempotencyKeyRef.current = `client_${Date.now()}_${Math.random()
            .toString(36)
            .slice(2, 8)}`;
        }
      }

      // 调用后端 API 创建支付链接
      const res = await fetch("/api/checkout/payment-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            options: item.options,
          })),
          address: {
            email: address.email,
            fullName: address.fullName,
            phone: address.phone,
            country: address.country,
            address1: address.address1,
            address2: address.address2 || "",
            city: address.city,
            state: address.state,
            postalCode: address.postalCode,
          },
          shipping: shipping
            ? { method: shipping.id ?? shipping.label, price: shipping.price }
            : undefined,
          idempotencyKey: idempotencyKeyRef.current,
        }),
      });

      const data = (await res.json().catch(() => null)) as PaymentLinkResponse | null;

      if (!res.ok || !data?.ok) {
        const message = data?.message ?? data?.error ?? "Unable to create payment link";
        throw new Error(message);
      }

      // 设置订单号和支付链接
      if (data.orderNumber) {
        setOrderNumber(data.orderNumber);
      }

      if (data.paymentLinkUrl) {
        setPaymentLinkUrl(normalizePaymentLink(data.paymentLinkUrl));
        setCreateError(null);
        idempotencyKeyRef.current = null;
        return;
      }

      if (data.orderNumber && data.status === "processing" && address?.email) {
        const resolved = await pollForPaymentLink(data.orderNumber, address.email);
        if (resolved) {
          setPaymentLinkUrl(normalizePaymentLink(resolved));
          setCreateError(null);
          idempotencyKeyRef.current = null;
          return;
        }
      }

      throw new Error("No payment link returned");
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Failed to create checkout link.");
      toast({
        title: "Unable to start checkout",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [
    address,
    items,
    loading,
    pollForPaymentLink,
    shipping,
    toast,
    normalizePaymentLink,
  ]);

  useEffect(() => {
    if (!address || !shipping || items.length === 0) return;
    if (paymentLinkUrl || loading || autoStartRef.current) return;
    autoStartRef.current = true;
    handleCheckout();
  }, [address, shipping, items.length, paymentLinkUrl, loading, handleCheckout]);

  const handleOpenCheckout = useCallback(() => {
    if (!paymentLinkUrl) return;
    clearRedirectTimers();
    setRedirectFailed(false);
    window.location.assign(paymentLinkUrl);
  }, [paymentLinkUrl, clearRedirectTimers]);

  const whatsapp = process.env.NEXT_PUBLIC_CONCIERGE_WHATSAPP ?? "";
  const whatsappLink = useMemo(() => {
    if (!whatsapp) return "";
    const digits = whatsapp.replace(/[^\d+]/g, "");
    return `https://wa.me/${digits.replace(/^\+/, "")}`;
  }, [whatsapp]);
  const whatsappMessage = useMemo(() => {
    if (!whatsappLink) return "";
    const itemLines = items.map((item) => {
      const link = item.slug ? absoluteUrl(`/product/${item.slug}`) : "";
      const linkPart = link ? `: ${link}` : "";
      return `- ${item.title} x${item.quantity}${linkPart}`;
    });
    const lines = [
      "Hi! The checkout link failed to generate.",
      address?.email ? `Email: ${address.email}` : "",
      "Items:",
      ...itemLines,
    ].filter(Boolean);
    return encodeURIComponent(lines.join("\n"));
  }, [address?.email, items, whatsappLink]);
  const whatsappCtaLink = useMemo(() => {
    if (!whatsappLink) return "";
    if (!whatsappMessage) return whatsappLink;
    return `${whatsappLink}?text=${whatsappMessage}`;
  }, [whatsappLink, whatsappMessage]);

  useEffect(() => {
    if (!redirectFailed || !whatsappCtaLink) return;
    if (autoWhatsappOpenedRef.current) return;
    autoWhatsappOpenedRef.current = true;
    window.open(whatsappCtaLink, "_blank", "noopener,noreferrer");
  }, [redirectFailed, whatsappCtaLink]);

  useEffect(() => {
    if (!redirectFailed || !paymentLinkUrl) return;
    if (!navigator?.clipboard) return;
    navigator.clipboard.writeText(paymentLinkUrl).catch(() => null);
  }, [redirectFailed, paymentLinkUrl]);

  return (
    <div className="space-y-4">
      {channelLabel ? (
        <div className="inline-flex items-center rounded-full border border-dashed border-border px-3 py-1 text-xs font-medium uppercase tracking-wide text-muted">
          {channelLabel}
        </div>
      ) : null}
      {paymentLinkUrl ? (
        <div className="rounded-xl border border-border bg-contrast px-6 py-8 text-center">
          <h3 className="mb-4 text-lg font-medium">Checkout link ready</h3>
          {redirectCountdown !== null && (
            <p className="mb-3 text-sm text-muted">
              Redirecting to the official checkout page in {Math.max(0, redirectCountdown)} seconds…
            </p>
          )}
          <p className="mb-4 break-all text-sm text-ink">{paymentLinkUrl}</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button
              size="lg"
              className="rounded-full"
              onClick={handleOpenCheckout}
            >
              Open secure checkout
            </Button>
            <Button
              size="lg"
              variant="ghost"
              className="rounded-full"
              onClick={async () => {
                if (navigator.clipboard) {
                  await navigator.clipboard.writeText(paymentLinkUrl);
                }
              }}
            >
              Copy checkout link
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted">
            If you&apos;re not redirected automatically, use the button above.
          </p>
        </div>
      ) : qrCodeUrl ? (
        <div className="rounded-xl border border-border bg-contrast px-6 py-8 text-center">
          <h3 className="mb-4 text-lg font-medium">Scan to complete checkout</h3>
          <img
            src={qrCodeUrl}
            alt="Checkout QR code"
            className="mx-auto mb-4 h-64 w-64 select-none"
            onTouchStart={handleQrTouchStart}
            onTouchEnd={handleQrTouchEnd}
            onTouchCancel={handleQrTouchEnd}
            onTouchMove={handleQrTouchEnd}
            onContextMenu={handleQrContextMenu}
            draggable={false}
          />
          <p className="text-sm text-muted">Scan the QR code to open secure checkout.</p>
          <p className="text-xs text-muted">
            Long-press the QR to open the checkout link.
            {qrDecoding ? " Decoding..." : ""}
          </p>
        </div>
      ) : (
        <>
          {loading && (
            <div className="rounded-xl border border-border bg-contrast px-4 py-3 text-center">
              <div className="text-[10px] uppercase tracking-[0.3em] text-muted">
                Order Status
              </div>
              <div className="mt-2 text-base font-medium text-ink">
                {progressSteps[progressIndex] ?? "Processing"}
              </div>
              <div className="mt-3 flex items-center justify-center gap-1">
                {progressSteps.map((_, index) => (
                  <span
                    key={`progress-${index}`}
                    className={`h-1.5 w-6 rounded-full ${
                      index <= progressIndex ? "bg-ink" : "bg-border"
                    }`}
                  />
                ))}
              </div>
              <p className="mt-3 text-xs text-muted">
                This usually takes 10-20 seconds. You can keep browsing while we finish.
              </p>
            </div>
          )}
          {!loading && (
            <Button
              size="lg"
              className="w-full rounded-full"
              onClick={handleCheckout}
              disabled={!address || !shipping || items.length === 0}
            >
              Get secure checkout link
            </Button>
          )}
          {createError && (
            <div className="rounded-xl border border-border bg-contrast px-4 py-3 text-sm text-muted">
              <p className="text-ink">We couldn't create the checkout link.</p>
              {whatsappCtaLink ? (
                <a
                  href={whatsappCtaLink}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-2 inline-flex items-center text-sm font-medium text-ink underline underline-offset-4"
                >
                  Contact WhatsApp support to place the order
                </a>
              ) : (
                <p className="mt-2 text-xs text-muted">Please contact support to place the order.</p>
              )}
            </div>
          )}
          {(!address || !shipping || items.length === 0) && (
            <p className="text-xs text-muted">
              Add items, enter delivery details, and choose shipping before continuing.
            </p>
          )}
        </>
      )}
      {redirectFailed && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 py-6 md:items-center">
          <div
            className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-surface p-6 text-left shadow-[var(--shadow-soft)]"
            role="dialog"
            aria-modal="true"
          >
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">Need help?</p>
              <h4 className="text-lg font-semibold text-ink">We couldn't open the checkout page</h4>
              <p className="text-sm text-muted">
                Please contact WhatsApp support and we&apos;ll assist you right away.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              {whatsappCtaLink ? (
                <Button asChild size="lg" className="rounded-full">
                  <a href={whatsappCtaLink} target="_blank" rel="noreferrer noopener">
                    Contact WhatsApp support
                  </a>
                </Button>
              ) : (
                <Button size="lg" className="rounded-full" onClick={() => setRedirectFailed(false)}>
                  Close
                </Button>
              )}
              <Button
                variant="ghost"
                size="lg"
                className="rounded-full"
                onClick={() => setRedirectFailed(false)}
              >
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
