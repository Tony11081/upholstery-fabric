"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/lib/hooks/useToast";

const STORAGE_KEY = "adminPaymentToken";
const COOKIE_NAME = "admin_payment_token";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export function AdminTokenGate() {
  const toast = useToast();
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const stored = typeof window === "undefined" ? null : window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setToken(stored);
    }
  }, []);

  const saveToken = () => {
    const trimmed = token.trim();
    if (!trimmed) {
      toast.error("Enter your access token");
      return;
    }
    setSaving(true);
    try {
      window.localStorage.setItem(STORAGE_KEY, trimmed);
      document.cookie = `${COOKIE_NAME}=${encodeURIComponent(trimmed)}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
      toast.success("Token saved");
      window.location.reload();
    } finally {
      setSaving(false);
    }
  };

  const clearToken = () => {
    window.localStorage.removeItem(STORAGE_KEY);
    document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
    toast.success("Token cleared");
    window.location.reload();
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 rounded-2xl border border-border bg-surface p-6 text-center shadow-[var(--shadow-soft)]">
      <p className="text-xs uppercase tracking-[0.2em] text-muted">Admin token</p>
      <h2 className="font-display text-2xl">Temporary access</h2>
      <p className="text-sm text-muted">
        Enter the ADMIN_PAYMENT_LINK_TOKEN to access the admin tools.
      </p>
      <div className="space-y-3 text-left">
        <Input
          label="Access token"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          placeholder="Paste token"
        />
        <Button type="button" className="w-full rounded-full" onClick={saveToken} loading={saving}>
          Save token
        </Button>
        <Button type="button" variant="ghost" className="w-full rounded-full" onClick={clearToken}>
          Clear token
        </Button>
      </div>
    </div>
  );
}
