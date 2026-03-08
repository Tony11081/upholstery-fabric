"use client";

type PaymentMethodsProps = {
  variant?: "inline" | "stacked";
};

type MethodGroup = "cards" | "wallets" | "bank";

type PaymentMethod = {
  key: string;
  label: string;
  group: MethodGroup;
  src?: string;
  node?: React.ReactNode;
};

const LogoShell = ({ children }: { children: React.ReactNode }) => (
  <div className="flex h-8 items-center justify-center rounded-md border border-border bg-surface px-2">
    {children}
  </div>
);

const LogoImage = ({ src, label }: { src: string; label: string }) => (
  <img
    src={src}
    alt={label}
    className="h-6 w-auto"
    loading="lazy"
    decoding="async"
    referrerPolicy="no-referrer"
  />
);

const BoletoLogo = () => (
  <svg role="img" aria-label="Boleto" viewBox="0 0 96 24" className="h-6 w-auto">
    <rect x="4" y="4" width="28" height="16" rx="3" fill="#F3F4F6" stroke="#111827" />
    <path
      d="M9 7v10M13 7v10M17 7v10M21 7v10M25 7v10"
      stroke="#111827"
      strokeWidth="1"
    />
    <text
      x="40"
      y="15"
      fontFamily="Inter, Arial, sans-serif"
      fontSize="9.5"
      fontWeight="700"
      fill="#111827"
      letterSpacing="0.12em"
    >
      BOLETO
    </text>
  </svg>
);

const PAYMENT_METHODS: PaymentMethod[] = [
  {
    key: "visa",
    label: "Visa",
    group: "cards",
    src: "/payment-logos/visa.svg",
  },
  {
    key: "mastercard",
    label: "Mastercard",
    group: "cards",
    src: "/payment-logos/mastercard.svg",
  },
  {
    key: "amex",
    label: "American Express",
    group: "cards",
    src: "/payment-logos/amex.svg",
  },
  {
    key: "discover",
    label: "Discover",
    group: "cards",
    src: "/payment-logos/discover.svg",
  },
  {
    key: "diners",
    label: "Diners",
    group: "cards",
    src: "/payment-logos/diners.svg",
  },
  {
    key: "elo",
    label: "Elo",
    group: "cards",
    src: "/payment-logos/elo.svg",
  },
  {
    key: "hipercard",
    label: "Hipercard",
    group: "cards",
    src: "/payment-logos/hipercard.svg",
  },
  {
    key: "applepay",
    label: "Apple Pay",
    group: "wallets",
    src: "/payment-logos/apple-pay.svg",
  },
  {
    key: "googlepay",
    label: "Google Pay",
    group: "wallets",
    src: "/payment-logos/google-pay.svg",
  },
  {
    key: "pix",
    label: "PIX",
    group: "wallets",
    src: "/payment-logos/pix.svg",
  },
  { key: "boleto", label: "Boleto", group: "bank", node: <BoletoLogo /> },
  {
    key: "oxxo",
    label: "OXXO",
    group: "bank",
    src: "/payment-logos/oxxo.svg",
  },
];

export function PaymentMethods({ variant = "inline" }: PaymentMethodsProps) {
  if (variant === "stacked") {
    const cards = PAYMENT_METHODS.filter((method) => method.group === "cards");
    const wallets = PAYMENT_METHODS.filter((method) => method.group === "wallets");
    const bank = PAYMENT_METHODS.filter((method) => method.group === "bank");
    return (
      <div className="space-y-3">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Cards</p>
          <div className="flex flex-wrap gap-2">
            {cards.map((method) => (
              <LogoShell key={method.key}>
                {method.src ? <LogoImage src={method.src} label={method.label} /> : method.node}
              </LogoShell>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Wallets</p>
          <div className="flex flex-wrap gap-2">
            {wallets.map((method) => (
              <LogoShell key={method.key}>
                {method.src ? <LogoImage src={method.src} label={method.label} /> : method.node}
              </LogoShell>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Bank transfer</p>
          <div className="flex flex-wrap gap-2">
            {bank.map((method) => (
              <LogoShell key={method.key}>
                {method.src ? <LogoImage src={method.src} label={method.label} /> : method.node}
              </LogoShell>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {PAYMENT_METHODS.map((method) => (
        <LogoShell key={method.key}>
          {method.src ? <LogoImage src={method.src} label={method.label} /> : method.node}
        </LogoShell>
      ))}
    </div>
  );
}
