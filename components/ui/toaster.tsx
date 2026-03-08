"use client";

import * as Toast from "@radix-ui/react-toast";
import { X } from "lucide-react";
import { useToastStore } from "@/lib/state/toast-store";
import { cn } from "@/lib/utils/cn";

const variantStyles = {
  info: "border-border bg-surface text-ink before:bg-ink/10",
  success: "border-border bg-surface text-ink before:bg-accent/70",
  error: "border-border bg-surface text-ink before:bg-ink/40",
};

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <Toast.Provider swipeDirection="right">
      {toasts.map((toast) => (
        <Toast.Root
          key={toast.id}
          open
          duration={toast.duration ?? 4000}
          onOpenChange={(open) => {
            if (!open) dismiss(toast.id);
          }}
          className={cn(
            "relative grid grid-cols-[1fr_auto] items-start gap-4 rounded-2xl border py-3 pr-4 pl-5 shadow-[var(--shadow-soft)] before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:rounded-l-2xl before:content-['']",
            variantStyles[toast.variant ?? "info"],
          )}
        >
          <div className="space-y-1">
            <Toast.Title className="text-sm font-semibold">{toast.title}</Toast.Title>
            {toast.description && (
              <Toast.Description className="text-xs text-muted">
                {toast.description}
              </Toast.Description>
            )}
          </div>
          <Toast.Action asChild altText="Dismiss">
            <button
              type="button"
              className="rounded-full p-1 text-muted transition hover:text-ink"
              onClick={() => dismiss(toast.id)}
            >
              <X size={14} />
            </button>
          </Toast.Action>
        </Toast.Root>
      ))}
      <Toast.Viewport className="fixed bottom-4 right-4 z-[9999] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-3 md:bottom-6 md:right-6 md:w-[360px]" />
    </Toast.Provider>
  );
}
