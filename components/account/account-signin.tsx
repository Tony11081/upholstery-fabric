"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/lib/hooks/useToast";

type AccountSignInProps = {
  callbackUrl: string;
  emailEnabled: boolean;
  googleEnabled: boolean;
};

export function AccountSignIn({
  callbackUrl,
  emailEnabled,
  googleEnabled,
}: AccountSignInProps) {
  const [email, setEmail] = useState("");
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const toast = useToast();

  const handleEmailSignIn = async () => {
    if (!emailEnabled) {
      toast.error("Email sign-in is unavailable right now.");
      return;
    }
    if (!email.trim()) {
      toast.error("Enter your email to receive a secure link.");
      return;
    }
    setLoadingEmail(true);
    try {
      const result = await signIn("email", {
        email: email.trim(),
        callbackUrl,
        redirect: false,
      });
      if (result?.error) {
        throw new Error(result.error);
      }
      toast.success("Check your inbox for a secure sign-in link.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to send a sign-in link.");
    } finally {
      setLoadingEmail(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!googleEnabled) {
      toast.error("Google sign-in is unavailable right now.");
      return;
    }
    setLoadingGoogle(true);
    try {
      await signIn("google", { callbackUrl });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to start Google sign-in.");
      setLoadingGoogle(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <Input
          label="Email"
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Button
          type="button"
          className="w-full rounded-full"
          onClick={handleEmailSignIn}
          loading={loadingEmail}
          disabled={!emailEnabled}
        >
          Send secure sign-in link
        </Button>
        {!emailEnabled && (
          <p className="text-xs text-muted">Email sign-in is unavailable right now.</p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-3 text-xs uppercase tracking-[0.18em] text-muted">
          <span className="h-px flex-1 bg-border" />
          or
          <span className="h-px flex-1 bg-border" />
        </div>
        <Button
          type="button"
          variant="ghost"
          className="w-full rounded-full"
          onClick={handleGoogleSignIn}
          loading={loadingGoogle}
          disabled={!googleEnabled}
        >
          Continue with Google
        </Button>
        {!googleEnabled && (
          <p className="text-xs text-muted">Google sign-in is unavailable right now.</p>
        )}
      </div>
    </div>
  );
}
