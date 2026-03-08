"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { CheckCircle2, Clock, MessageCircle, PhoneCall, QrCode, ShieldCheck, Truck, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/utils/format";
import { useToast } from "@/lib/hooks/useToast";
import { resolveImageUrl } from "@/lib/utils/image";
import { absoluteUrl } from "@/lib/utils/site";

type OrderItem = {
  id: string;
  qty: number;
  price: number | string;
  currency: string;
  titleSnapshot?: string | null;
  product?: {
    titleEn: string;
    images: Array<{ url: string; alt?: string | null }>;
    slug?: string | null;
  };
};

type AwaitingOrder = {
  orderNumber: string;
  email: string;
  createdAt?: string | Date | null;
  subtotal?: number | string;
  shippingTotal?: number | string;
  total?: number | string;
  currency?: string;
  paymentQrCode?: string | null;
  paymentLinkUrl?: string | null;
  paypalInvoiceUrl?: string | null;
  items: OrderItem[];
};

type Props = {
  orderNumber: string;
  email: string;
};

export function AwaitingPaymentClient({ orderNumber, email }: Props) {
  const searchParams = useSearchParams();
  const [order, setOrder] = useState<AwaitingOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEmbeddedPayment, setShowEmbeddedPayment] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeFallback, setIframeFallback] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);
  const [redirectCanceled, setRedirectCanceled] = useState(false);
  const [redirectTriggered, setRedirectTriggered] = useState(false);
  const [qrDecodedLink, setQrDecodedLink] = useState<string | null>(null);
  const [qrDecoding, setQrDecoding] = useState(false);
  const [whatsappLabel, setWhatsappLabel] = useState("Contact WhatsApp to buy");
  const [showConciergeCta, setShowConciergeCta] = useState(false);
  const [waitingCountdown, setWaitingCountdown] = useState<number | null>(null);
  const qrDecoderRef = useRef<typeof import("jsqr").default | null>(null);
  const { toast } = useToast();
  const resolvedOrderNumber = (orderNumber || searchParams.get("orderNumber") || "").trim();
  const resolvedEmail = (email || searchParams.get("email") || "").trim();

  const fetchOrder = useCallback(
    async (silent?: boolean) => {
      if (!resolvedOrderNumber || !resolvedEmail) return;
      if (!silent) {
        setLoading(true);
      }
      setError(null);
      try {
        const res = await fetch("/api/order/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderNumber: resolvedOrderNumber, email: resolvedEmail }),
        });
        const data = (await res.json().catch(() => null)) as
          | { order?: AwaitingOrder; error?: string; message?: string; requestId?: string }
          | null;
        if (!res.ok || !data?.order) {
          const message = data?.message ?? data?.error ?? "Order not found";
          const requestId = data?.requestId ? ` (ref: ${data.requestId})` : "";
          throw new Error(`${message}${requestId}`);
        }
        setOrder(data.order);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to load order details.";
        setError(message);
        if (!silent) {
          toast({
            title: "Unable to load order",
            description: message,
            variant: "error",
          });
        }
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [resolvedEmail, resolvedOrderNumber, toast],
  );

  const linkFromQr = useMemo(() => {
    const candidate = order?.paymentQrCode?.trim();
    if (!candidate) return null;
    if (/^https?:\/\//i.test(candidate) || /^www\./i.test(candidate)) {
      return candidate.startsWith("http") ? candidate : `https://${candidate}`;
    }
    return null;
  }, [order?.paymentQrCode]);
  const paymentLinkUrl = order?.paymentLinkUrl ?? order?.paypalInvoiceUrl ?? linkFromQr ?? null;
  const checkoutLinkUrl = paymentLinkUrl ?? qrDecodedLink;
  const hasQr = Boolean(order?.paymentQrCode && !linkFromQr);
  const hasLink = Boolean(checkoutLinkUrl);
  const subtotal = useMemo(() => Number(order?.subtotal ?? 0), [order?.subtotal]);
  const shippingTotal = useMemo(() => Number(order?.shippingTotal ?? 0), [order?.shippingTotal]);
  const total = useMemo(
    () => Number(order?.total ?? subtotal + shippingTotal),
    [order?.total, shippingTotal, subtotal],
  );
  const paymentHost = useMemo(() => {
    if (!checkoutLinkUrl) return "";
    try {
      const base = typeof window !== "undefined" ? window.location.origin : "https://example.com";
      return new URL(checkoutLinkUrl, base).hostname;
    } catch {
      return "";
    }
  }, [checkoutLinkUrl]);
  const embedAllowed = useMemo(() => {
    if (!checkoutLinkUrl || typeof window === "undefined") return false;
    try {
      const link = new URL(checkoutLinkUrl, window.location.origin);
      return link.origin === window.location.origin;
    } catch {
      return false;
    }
  }, [checkoutLinkUrl]);
  const currency = order?.currency ?? "USD";
  const createdAtLabel = order?.createdAt ? format(new Date(order.createdAt), "PPP") : "--";
  const statusLabel = hasLink ? "Checkout link ready" : "Preparing checkout link";
  const supportEmail =
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL ??
    process.env.NEXT_PUBLIC_CONCIERGE_EMAIL ??
    "";
  const whatsapp = process.env.NEXT_PUBLIC_CONCIERGE_WHATSAPP ?? "";
  const whatsappLink = useMemo(() => {
    if (!whatsapp) return "";
    const digits = whatsapp.replace(/[^\d+]/g, "");
    return `https://wa.me/${digits.replace(/^\+/, "")}`;
  }, [whatsapp]);
  const whatsappMessage = useMemo(() => {
    if (!whatsappLink) return "";
    const items = order?.items ?? [];
    const itemLines = items.length
      ? items.map((item) => {
          const title = item.titleSnapshot ?? item.product?.titleEn ?? "Item";
          const link = item.product?.slug ? absoluteUrl(`/product/${item.product.slug}`) : "";
          const linkPart = link ? `: ${link}` : "";
          return `- ${title} x${item.qty}${linkPart}`;
        })
      : [];
    const amountLine = Number.isFinite(total) ? `Amount: ${formatPrice(total, currency)}` : "";
    const lines = [
      "Hi! The secure checkout link is not showing on the waiting page.",
      `Order: ${resolvedOrderNumber}`,
      resolvedEmail ? `Email: ${resolvedEmail}` : "",
      amountLine,
      itemLines.length ? "Items:" : "",
      ...itemLines,
    ].filter(Boolean);
    return encodeURIComponent(lines.join("\n"));
  }, [currency, order?.items, resolvedEmail, resolvedOrderNumber, total, whatsappLink]);
  const whatsappCtaLink = useMemo(() => {
    if (!whatsappLink) return "";
    if (!whatsappMessage) return whatsappLink;
    return `${whatsappLink}?text=${whatsappMessage}`;
  }, [whatsappLink, whatsappMessage]);
  const whatsappLabelMap = useMemo(
    () => [
      { prefix: "zh", label: "\u8054\u7cfb WhatsApp \u5ba2\u670d\u8d2d\u4e70" },
      { prefix: "en", label: "Contact WhatsApp to buy" },
      { prefix: "es", label: "Contacta por WhatsApp para comprar" },
      { prefix: "fr", label: "Contacter WhatsApp pour acheter" },
      { prefix: "de", label: "WhatsApp kontaktieren zum Kauf" },
      { prefix: "it", label: "Contatta WhatsApp per acquistare" },
      { prefix: "pt", label: "Contato no WhatsApp para comprar" },
      { prefix: "ru", label: "\u0421\u0432\u044f\u0437\u0430\u0442\u044c\u0441\u044f \u0432 WhatsApp \u0434\u043b\u044f \u043f\u043e\u043a\u0443\u043f\u043a\u0438" },
      { prefix: "ja", label: "WhatsApp\u3067\u8cfc\u5165\u76f8\u8ac7" },
      { prefix: "ko", label: "WhatsApp\uc73c\ub85c \uad6c\ub9e4 \ubb38\uc758" },
      { prefix: "ar", label: "\u062a\u0648\u0627\u0635\u0644 \u0639\u0628\u0631 \u0648\u0627\u062a\u0633\u0627\u0628 \u0644\u0644\u0634\u0631\u0627\u0621" },
    ],
    [],
  );
  const trustItems = [
    {
      icon: ShieldCheck,
      title: "Secure hosted checkout",
      body: "Complete checkout on the hosted page linked to your order.",
    },
    {
      icon: Truck,
      title: "Tracked delivery",
      body: "Tracking details are shared as soon as your order ships.",
    },
    {
      icon: PhoneCall,
      title: "Concierge support",
      body: "Reach us anytime for checkout or delivery help.",
    },
  ];

  const formatCountdown = useCallback((value: number) => {
    const minutes = Math.floor(value / 60)
      .toString()
      .padStart(2, "0");
    const seconds = Math.max(0, value % 60)
      .toString()
      .padStart(2, "0");
    return `${minutes}:${seconds}`;
  }, []);

  useEffect(() => {
    if (!resolvedOrderNumber || !resolvedEmail) return;
    void fetchOrder();
  }, [fetchOrder, resolvedEmail, resolvedOrderNumber]);

  useEffect(() => {
    const locale =
      (typeof document !== "undefined" && document.documentElement.lang) ||
      (typeof navigator !== "undefined" ? navigator.language : "") ||
      "";
    const normalized = locale.toLowerCase();
    const matched = whatsappLabelMap.find((entry) => normalized.startsWith(entry.prefix));
    setWhatsappLabel(matched?.label ?? "Contact WhatsApp to buy");
  }, [whatsappLabelMap]);

  useEffect(() => {
    if (!whatsappCtaLink) {
      setShowConciergeCta(false);
      return;
    }
    if (error) {
      setShowConciergeCta(true);
      return;
    }
    if (hasLink) {
      setShowConciergeCta(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setShowConciergeCta(true);
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [error, hasLink, whatsappCtaLink]);

  const stopAutoRedirect = useCallback(
    (remember?: boolean) => {
      setRedirectCanceled(true);
      setRedirectCountdown(null);
      if (!remember) return;
      setRedirectTriggered(true);
      if (typeof window !== "undefined" && resolvedOrderNumber) {
        sessionStorage.setItem(`checkout-redirected:${resolvedOrderNumber}`, "1");
      }
    },
    [resolvedOrderNumber],
  );

  useEffect(() => {
    if (!checkoutLinkUrl) {
      setShowEmbeddedPayment(false);
      setIframeLoaded(false);
      setIframeFallback(false);
      setRedirectCountdown(null);
      setRedirectCanceled(false);
      setRedirectTriggered(false);
      return;
    }
    if (embedAllowed) {
      setShowEmbeddedPayment(true);
    } else {
      setShowEmbeddedPayment(false);
    }
    setIframeLoaded(false);
    setIframeFallback(false);
  }, [checkoutLinkUrl, embedAllowed]);

  useEffect(() => {
    if (checkoutLinkUrl) {
      setWaitingCountdown(null);
      return;
    }
    if (!resolvedOrderNumber || !resolvedEmail) return;
    setWaitingCountdown((prev) => (prev === null ? 60 : prev));
  }, [checkoutLinkUrl, resolvedEmail, resolvedOrderNumber]);

  useEffect(() => {
    if (waitingCountdown === null || waitingCountdown <= 0) return;
    const timer = window.setTimeout(() => {
      setWaitingCountdown((prev) => (prev === null ? prev : Math.max(prev - 1, 0)));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [waitingCountdown]);

  useEffect(() => {
    if (!checkoutLinkUrl || redirectCanceled || redirectTriggered) return;
    if (redirectCountdown !== null) return;
    if (typeof window === "undefined" || !resolvedOrderNumber) return;
    const key = `checkout-redirected:${resolvedOrderNumber}`;
    if (sessionStorage.getItem(key) === "1") return;
    setRedirectCountdown(5);
  }, [checkoutLinkUrl, redirectCanceled, redirectCountdown, redirectTriggered, resolvedOrderNumber]);

  useEffect(() => {
    if (!checkoutLinkUrl || redirectCountdown === null || redirectCanceled) return;
    if (redirectCountdown <= 0) {
      stopAutoRedirect(true);
      window.location.assign(checkoutLinkUrl);
      return;
    }
    const timer = window.setTimeout(() => {
      setRedirectCountdown((prev) => (prev === null ? prev : prev - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [checkoutLinkUrl, redirectCanceled, redirectCountdown, stopAutoRedirect]);

  useEffect(() => {
    if (!checkoutLinkUrl) return;
    setIframeLoaded(false);
    setIframeFallback(false);
  }, [checkoutLinkUrl, showEmbeddedPayment]);

  useEffect(() => {
    if (!checkoutLinkUrl || !showEmbeddedPayment || iframeLoaded) return;
    const timer = setTimeout(() => setIframeFallback(true), 8000);
    return () => clearTimeout(timer);
  }, [iframeLoaded, checkoutLinkUrl, showEmbeddedPayment]);

  useEffect(() => {
    if (!resolvedOrderNumber || !resolvedEmail || hasLink) return;
    const interval = setInterval(() => {
      void fetchOrder(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchOrder, hasLink, resolvedEmail, resolvedOrderNumber]);

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

  const normalizeQrLink = (payload: string) => {
    const trimmed = payload.trim();
    if (!trimmed) return null;
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return trimmed;
    if (/^www\./i.test(trimmed)) return `https://${trimmed}`;
    return null;
  };

  useEffect(() => {
    const qrCode = order?.paymentQrCode;
    if (!qrCode || paymentLinkUrl || qrDecodedLink || qrDecoding) return;
    let canceled = false;
    setQrDecoding(true);
    (async () => {
      try {
        const payload = await decodeQrFromImage(qrCode);
        if (!payload || canceled) return;
        const link = normalizeQrLink(payload);
        if (link) {
          setQrDecodedLink(link);
        }
      } catch (err) {
        console.error("Failed to decode QR", err);
      } finally {
        if (!canceled) {
          setQrDecoding(false);
        }
      }
    })();
    return () => {
      canceled = true;
    };
  }, [decodeQrFromImage, order?.paymentQrCode, paymentLinkUrl, qrDecodedLink, qrDecoding]);

  if (!resolvedOrderNumber || !resolvedEmail) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-surface p-6 text-center shadow-[var(--shadow-soft)]">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Missing details</p>
        <h1 className="mt-2 font-display text-3xl">Unable to load request</h1>
        <p className="mt-3 text-sm text-muted">
          We need your order number and email to show secure checkout details.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 sm:gap-6 px-4 sm:px-0">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Order status & next steps</p>
          <h1 className="font-display text-2xl sm:text-3xl leading-tight">Confirm delivery details</h1>
          <p className="text-xs sm:text-sm text-muted">
            You will enter delivery details and complete checkout on the secure hosted page below. Your secure checkout
            link appears automatically. Keep this tab open or refresh anytime.
          </p>
        </div>

      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-contrast px-4 py-3 text-sm text-muted">
          <XCircle className="h-4 w-4 text-ink" />
          <span>{error}</span>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5 shadow-[var(--shadow-soft)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted">Order</p>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-semibold">{resolvedOrderNumber}</h2>
              <Badge tone="outline" muted>{resolvedEmail}</Badge>
            </div>
            <p className="text-xs sm:text-sm text-muted">Placed {createdAtLabel}</p>
          </div>
          <div className="rounded-xl border border-border bg-contrast px-3 py-2 sm:px-4 sm:py-3 text-right">
            <div className="flex items-center justify-end gap-2 text-xs uppercase tracking-[0.18em] text-muted">
              {hasQr ? <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 text-ink" /> : <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-ink" />}
              <span>{statusLabel}</span>
            </div>
            <p className="mt-1 text-base sm:text-lg font-semibold">{formatPrice(total, currency)}</p>
            <p className="text-xs text-muted">Total</p>
          </div>
        </div>
        <div className="mt-4 space-y-2 text-xs sm:text-sm text-muted">
          <div className="flex items-center justify-between">
            <span>Subtotal</span>
            <span className="text-ink">{formatPrice(subtotal, currency)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Shipping</span>
            <span className="text-ink">{formatPrice(shippingTotal, currency)}</span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-contrast p-4 sm:p-6 text-center shadow-[var(--shadow-soft)]">
        <div className="flex items-center justify-center gap-2 text-xs uppercase tracking-[0.18em] text-muted">
          <QrCode className="h-4 w-4 text-ink" />
          <span>Secure checkout</span>
        </div>

        {/* 步骤进度指示器 */}
        {!checkoutLinkUrl && (
          <div className="mx-auto mt-6 flex max-w-md items-center justify-between px-2 sm:px-0">
            <div className="flex flex-col items-center gap-1 sm:gap-2">
              <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-ink text-surface">
                <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <span className="text-[10px] sm:text-xs text-ink text-center leading-tight">Order<br className="sm:hidden" /> received</span>
            </div>
            <div className="flex-1 border-t-2 border-dashed border-border mx-1 sm:mx-2" />
            <div className="flex flex-col items-center gap-1 sm:gap-2">
              <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full border-2 border-ink bg-surface">
                <div className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-ink animate-pulse" />
              </div>
              <span className="text-[10px] sm:text-xs font-medium text-ink text-center leading-tight">Creating<br className="sm:hidden" /> checkout</span>
            </div>
            <div className="flex-1 border-t-2 border-dashed border-border mx-1 sm:mx-2" />
            <div className="flex flex-col items-center gap-1 sm:gap-2">
              <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full border-2 border-border bg-surface text-muted">
                <span className="text-xs sm:text-sm">3</span>
              </div>
              <span className="text-[10px] sm:text-xs text-muted text-center leading-tight">Link<br className="sm:hidden" /> ready</span>
            </div>
          </div>
        )}

        {/* 动态进度条 */}
        {!checkoutLinkUrl && waitingCountdown !== null && (
          <div className="mx-auto mt-6 max-w-md px-4 sm:px-0">
            <div className="relative h-2 overflow-hidden rounded-full bg-surface">
              <div
                className="absolute left-0 top-0 h-full bg-gradient-to-r from-ink/60 to-ink transition-all duration-1000 ease-out"
                style={{ width: `${Math.max(10, 100 - (waitingCountdown / 60) * 100)}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
              </div>
            </div>
            <p className="mt-3 text-[10px] sm:text-xs text-muted text-center">
              {waitingCountdown > 45 && "Connecting to secure payment gateway..."}
              {waitingCountdown <= 45 && waitingCountdown > 30 && "Generating your checkout link..."}
              {waitingCountdown <= 30 && waitingCountdown > 15 && "Almost ready..."}
              {waitingCountdown <= 15 && "Finalizing your secure checkout..."}
            </p>
          </div>
        )}

        <div className="mx-auto mt-3 flex w-44 items-center justify-center gap-2">
          <span className="tech-dot" />
          <span className="tech-track">
            <span className="tech-bar" />
          </span>
        </div>
        <p className="mt-2 text-[11px] uppercase tracking-[0.22em] text-muted">
          {checkoutLinkUrl ? "Checkout link ready" : "Preparing secure checkout link"}
        </p>
        {showConciergeCta && whatsappCtaLink ? (
          <div className="cta-shell mt-3 rounded-2xl border border-border bg-surface px-4 py-4 text-left shadow-[var(--shadow-soft)]">
            <div className="scan-track" aria-hidden="true">
              <span className="scan-line" />
            </div>
            <div className="flex items-start gap-3">
              <span className="cta-pulse" aria-hidden="true" />
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted">Concierge backup</p>
                <p className="text-sm font-semibold text-ink">Checkout link not showing?</p>
                <p className="text-xs text-muted">
                  Tap below to chat with our WhatsApp concierge. We can place the order for you and send a secure
                  checkout link.
                </p>
              </div>
            </div>
            <Button asChild size="lg" className="cta-tech mt-3 w-full gap-2 rounded-full sm:w-auto">
              <a href={whatsappCtaLink} target="_blank" rel="noreferrer noopener">
                <MessageCircle className="h-4 w-4" />
                {whatsappLabel}
              </a>
            </Button>
          </div>
        ) : null}
        {checkoutLinkUrl ? (
          <>
            {redirectCountdown !== null && !redirectCanceled && !redirectTriggered && (
              <div className="relative mt-4 overflow-hidden rounded-xl border border-border bg-surface px-4 py-3 text-left shadow-[var(--shadow-soft)]">
                <div className="scan-track" aria-hidden="true">
                  <span className="scan-line" />
                </div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted">Auto-open checkout</p>
                <p className="mt-1 text-sm text-ink">
                  Opening secure checkout in{" "}
                  <span className="font-semibold">{redirectCountdown}s</span>.
                </p>
                <p className="mt-1 text-xs text-muted">
                  You will enter delivery details and complete checkout on the secure page. After
                  checkout, you can return here to continue shopping.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      if (!checkoutLinkUrl) return;
                      stopAutoRedirect(true);
                      window.location.assign(checkoutLinkUrl);
                    }}
                  >
                    Open checkout
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => stopAutoRedirect()}>
                    Stay here
                  </Button>
                </div>
              </div>
            )}
            <h3 className="mt-3 text-lg font-medium">Secure checkout link ready</h3>
            <p className="mt-2 text-sm text-muted">
              Open the secure hosted checkout page to confirm delivery details and place your order. Some providers do not
              allow embedded checkout, so opening in a new tab is recommended.
            </p>
            {!paymentLinkUrl && qrDecodedLink ? (
              <p className="mt-2 text-xs text-muted">
                Checkout link detected from the secure payload for a faster redirect.
              </p>
            ) : null}
            {paymentHost ? (
              <p className="mt-2 text-xs text-muted">
                Hosted checkout provider: <span className="text-ink">{paymentHost}</span>
              </p>
            ) : null}
            {showEmbeddedPayment && (
              <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-soft)]">
                <div className="relative">
                  {!iframeLoaded && (
                    <div className="absolute inset-0 flex items-center justify-center bg-surface/80 text-xs uppercase tracking-[0.18em] text-muted">
                      Loading checkout page...
                    </div>
                  )}
                  <iframe
                    src={checkoutLinkUrl}
                    title="Checkout page"
                    className="h-[520px] w-full border-0 md:h-[600px]"
                    onLoad={() => setIframeLoaded(true)}
                    onError={() => {
                      setIframeLoaded(true);
                      setIframeFallback(true);
                    }}
                  />
                </div>
              </div>
            )}
            {iframeFallback && showEmbeddedPayment && (
              <p className="mt-3 text-xs text-muted">
                If the embedded page does not load, open the checkout page directly.
              </p>
            )}
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button asChild className="rounded-full" size="lg">
                <a
                  href={checkoutLinkUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  onClick={() => stopAutoRedirect(true)}
                >
                  Open secure checkout
                </a>
              </Button>
              <Button
                className="rounded-full"
                variant="ghost"
                size="lg"
                onClick={async () => {
                  try {
                    if (!navigator.clipboard) {
                      throw new Error("Clipboard unavailable");
                    }
                    await navigator.clipboard.writeText(checkoutLinkUrl);
                    toast({
                      title: "Link copied",
                      description: "Secure checkout link copied to clipboard.",
                      variant: "success",
                    });
                  } catch (error) {
                    toast({
                      title: "Unable to copy link",
                      description: "Please open the checkout page and copy the link from your browser.",
                      variant: "error",
                    });
                  }
                }}
              >
                Copy secure checkout link
              </Button>
              {!embedAllowed && (
                <Button
                  className="rounded-full"
                  variant="ghost"
                  size="lg"
                  onClick={() => setShowEmbeddedPayment((prev) => !prev)}
                >
                  {showEmbeddedPayment ? "Hide embedded view" : "Try embedded view"}
                </Button>
              )}
            </div>
          </>
        ) : (
          <>
            <h3 className="mt-3 text-lg font-medium">Creating your secure checkout</h3>
            <p className="mt-2 text-sm text-muted">
              We're generating your secure checkout link now. This usually takes 20-30 seconds. You can keep browsing while we finish - this page refreshes automatically every 5 seconds.
            </p>
            {waitingCountdown !== null && (
              <div className="mt-4 rounded-2xl border border-border bg-surface px-4 py-4 text-center shadow-[var(--shadow-soft)]">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted">Estimated wait</p>
                <p className="mt-2 text-4xl font-semibold text-ink tabular-nums">
                  {formatCountdown(waitingCountdown)}
                </p>
                <p className="mt-2 text-xs text-muted">
                  We will keep checking while your secure checkout link is prepared.
                </p>
              </div>
            )}
            {hasQr && qrDecoding ? (
              <p className="mt-2 text-xs text-muted">Checking for a secure checkout link...</p>
            ) : null}
            </>
          )}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button
            className="rounded-full"
            size="lg"
            loading={loading}
            onClick={() => fetchOrder()}
          >
            Refresh order status
          </Button>
          <Button
            className="rounded-full"
            variant="ghost"
            size="lg"
            onClick={() => window.location.assign("/")}
          >
            Continue shopping
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Confidence</p>
          <h3 className="font-display text-xl">Shop with confidence</h3>
          <p className="text-sm text-muted">
            Your order is protected by your email and order number.
          </p>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {trustItems.map((item) => (
            <div key={item.title} className="rounded-xl border border-border bg-contrast p-4 text-left">
              <item.icon className="text-ink" size={18} />
              <p className="mt-3 text-sm font-medium text-ink">{item.title}</p>
              <p className="mt-1 text-xs text-muted">{item.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted">
          <Link href="/help" className="underline underline-offset-4">
            Help center
          </Link>
          <span>|</span>
          <Link href="/policies" className="underline underline-offset-4">
            Policies
          </Link>
          {supportEmail ? (
            <>
              <span>|</span>
              <a href={`mailto:${supportEmail}`} className="underline underline-offset-4">
                {supportEmail}
              </a>
            </>
          ) : null}
        </div>
      </div>

      {order?.items?.length ? (
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-soft)]">
          <p className="text-xs uppercase tracking-[0.18em] text-muted">Items in your order</p>
          <div className="mt-3 divide-y divide-border">
            {order.items.map((item) => {
              const cover = item.product?.images?.[0];
              const coverUrl = resolveImageUrl(cover?.url);
              return (
                <div key={item.id} className="flex items-center gap-4 py-3 text-sm">
                  {coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={coverUrl}
                      alt={cover?.alt ?? item.titleSnapshot ?? item.product?.titleEn ?? "Product"}
                      className="h-14 w-12 rounded-md border border-border object-cover"
                    />
                  ) : null}
                  <div className="flex flex-1 flex-col">
                    <span className="font-medium">{item.titleSnapshot ?? item.product?.titleEn ?? "Item"}</span>
                    <span className="text-xs text-muted">Qty {item.qty}</span>
                  </div>
                  <span className="text-sm font-semibold">
                    {formatPrice(Number(item.price) || 0, item.currency)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
      <style jsx>{`
        .scan-track {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 2px;
          overflow: hidden;
          pointer-events: none;
          background: linear-gradient(
            90deg,
            rgba(15, 23, 42, 0.08),
            rgba(15, 23, 42, 0.2),
            rgba(15, 23, 42, 0.08)
          );
        }

        .scan-line {
          position: absolute;
          top: 0;
          left: -40%;
          width: 40%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(15, 23, 42, 0.5),
            transparent
          );
          animation: scan 2.4s ease-in-out infinite;
        }

        @keyframes scan {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(350%);
          }
        }

        .tech-track {
          position: relative;
          display: block;
          width: 100px;
          height: 6px;
          border-radius: 999px;
          overflow: hidden;
          background: rgba(15, 23, 42, 0.08);
        }

        .tech-bar {
          position: absolute;
          top: 0;
          left: -45%;
          width: 45%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(15, 23, 42, 0.6),
            transparent
          );
          animation: tech-sweep 2.6s ease-in-out infinite;
        }

        .tech-dot {
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.75);
          box-shadow: 0 0 0 0 rgba(15, 23, 42, 0.25);
          animation: tech-pulse 2s ease-in-out infinite;
        }

        .cta-shell {
          position: relative;
          overflow: hidden;
        }

        .cta-pulse {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.75);
          box-shadow: 0 0 0 0 rgba(15, 23, 42, 0.2);
          animation: tech-pulse 2s ease-in-out infinite;
        }

        .cta-tech {
          position: relative;
          overflow: hidden;
          background: linear-gradient(120deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.95));
          color: #f8fafc;
          box-shadow: 0 12px 28px rgba(15, 23, 42, 0.18);
        }

        .cta-tech::after {
          content: "";
          position: absolute;
          top: 0;
          left: -40%;
          width: 40%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(248, 250, 252, 0.35), transparent);
          animation: cta-sweep 3.6s ease-in-out infinite;
        }

        @keyframes cta-sweep {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(320%);
          }
        }

        @keyframes tech-sweep {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(320%);
          }
        }

        @keyframes tech-pulse {
          0%,
          100% {
            box-shadow: 0 0 0 0 rgba(15, 23, 42, 0.25);
            opacity: 0.7;
          }
          50% {
            box-shadow: 0 0 0 6px rgba(15, 23, 42, 0.05);
            opacity: 1;
          }
        }

        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }

        .animate-shimmer {
          animation: shimmer 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
