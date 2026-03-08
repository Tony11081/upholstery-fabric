import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils/cn";

type SurfaceProps = React.HTMLAttributes<HTMLDivElement> & {
  asChild?: boolean;
};

export function Surface({ className, children, asChild, ...props }: SurfaceProps) {
  const Component = asChild ? Slot : "div";

  return (
    <Component
      className={cn("rounded-lg border border-border bg-surface shadow-[var(--shadow-soft)]", className)}
      {...props}
    >
      {children}
    </Component>
  );
}
