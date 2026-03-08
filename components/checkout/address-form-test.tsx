"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Address } from "@/lib/state/checkout-store";
import {
  CALLING_CODE_OPTIONS,
  COUNTRY_OPTIONS,
  resolveCountryCode,
  resolveDialCodeByCountry,
} from "@/lib/utils/countries";

type AddressFormTestProps = {
  initial?: Address | null;
  submitLabel?: string;
  loading?: boolean;
  onSubmit: (address: Address) => void;
  onCancel?: () => void;
};

const splitFullName = (value: string | undefined | null) => {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return { firstName: "", lastName: "" };
  const parts = trimmed.split(/\s+/);
  const firstName = parts.shift() ?? "";
  const lastName = parts.join(" ") || "";
  return { firstName, lastName };
};

const splitPhone = (value: string | undefined | null) => {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return { code: "", number: "" };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { code: "", number: parts[0] };
  const [code, ...rest] = parts;
  return { code, number: rest.join(" ") };
};

const normalizeDialCode = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("+") ? trimmed : `+${trimmed}`;
};

export function AddressFormTest({
  initial,
  submitLabel = "Confirm & get payment link",
  loading,
  onSubmit,
  onCancel,
}: AddressFormTestProps) {
  const initialName = splitFullName(initial?.fullName);
  const initialPhone = splitPhone(initial?.phone);
  const [email, setEmail] = useState(initial?.email ?? "");
  const [firstName, setFirstName] = useState(initialName.firstName);
  const [lastName, setLastName] = useState(initialName.lastName);
  const [phoneCode, setPhoneCode] = useState(initialPhone.code);
  const [phoneNumber, setPhoneNumber] = useState(initialPhone.number);
  const [country, setCountry] = useState(resolveCountryCode(initial?.country));
  const [address1, setAddress1] = useState(initial?.address1 ?? "");
  const [address2, setAddress2] = useState(initial?.address2 ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [postalCode, setPostalCode] = useState(initial?.postalCode ?? "");
  const [state, setState] = useState(initial?.state ?? "");

  useEffect(() => {
    if (!phoneCode || phoneCode === resolveDialCodeByCountry(country)) {
      setPhoneCode(resolveDialCodeByCountry(country));
    }
  }, [country, phoneCode]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ").trim();
    const phone = [normalizeDialCode(phoneCode), phoneNumber.trim()].filter(Boolean).join(" ").trim();
    onSubmit({
      fullName,
      email: email.trim(),
      phone,
      country: country.trim(),
      address1: address1.trim(),
      address2: address2.trim(),
      city: city.trim(),
      state: state.trim(),
      postalCode: postalCode.trim(),
    });
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="rounded-xl border border-border bg-contrast px-4 py-3">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Delivery details</p>
        <p className="mt-2 text-sm text-ink">
          Enter the shipping details. After you confirm, you will move to the waiting step for
          your secure payment link.
        </p>
        <p className="mt-2 text-xs text-muted">
          We only use this information for delivery updates and order confirmation.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-5">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Email</p>
            <Input
              label="Email address"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
            />
          </div>

          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Name</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="First name"
                autoComplete="given-name"
                required
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                placeholder="Jane"
              />
              <Input
                label="Last name"
                autoComplete="family-name"
                required
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                placeholder="Doe"
              />
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Contact</p>
            <div className="grid gap-3 sm:grid-cols-[150px_1fr]">
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
                placeholder="2025550123"
                inputMode="tel"
                autoComplete="tel-national"
              />
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Shipping address</p>
            <label className="flex flex-col gap-2 text-sm text-ink">
              <span className="font-medium text-ink">Country/Region</span>
              <div className="flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-3 transition focus-within:border-ink focus-within:shadow-[var(--shadow-float)]">
                <select
                  className="w-full bg-transparent text-sm text-ink focus:outline-none"
                  value={country}
                  onChange={(event) => setCountry(event.target.value)}
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
            <Input
              label="Address line 1"
              required
              value={address1}
              onChange={(event) => setAddress1(event.target.value)}
              autoComplete="address-line1"
              placeholder="Street address, P.O. box, company"
            />
            <Input
              label="Address line 2 (optional)"
              value={address2}
              onChange={(event) => setAddress2(event.target.value)}
              autoComplete="address-line2"
              placeholder="Apartment, suite, unit, building"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="City"
                required
                value={city}
                onChange={(event) => setCity(event.target.value)}
                autoComplete="address-level2"
                placeholder="City"
              />
              <Input
                label="Postal code"
                required
                value={postalCode}
                onChange={(event) => setPostalCode(event.target.value)}
                autoComplete="postal-code"
                placeholder="ZIP / Postal"
              />
            </div>
            <Input
              label="State/Province (optional)"
              value={state}
              onChange={(event) => setState(event.target.value)}
              autoComplete="address-level1"
              placeholder="State / Province"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button type="submit" size="lg" className="w-full rounded-full sm:w-auto" loading={loading}>
          {submitLabel}
        </Button>
        {onCancel ? (
          <Button
            type="button"
            variant="ghost"
            size="lg"
            className="w-full rounded-full sm:w-auto"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
