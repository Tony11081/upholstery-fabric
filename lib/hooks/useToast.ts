"use client";

import { useMemo } from "react";
import { useToastStore } from "@/lib/state/toast-store";

export function useToast() {
  const push = useToastStore((s) => s.push);
  return useMemo(
    () => ({
      toast: push,
      success: (title: string, description?: string) =>
        push({
          title,
          description,
          variant: "success",
        }),
      error: (title: string, description?: string) =>
        push({
          title,
          description,
          variant: "error",
        }),
      info: (title: string, description?: string) =>
        push({
          title,
          description,
          variant: "info",
        }),
    }),
    [push],
  );
}
