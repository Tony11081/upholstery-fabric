import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils/cn";

const buttonStyles = cva(
  "inline-flex items-center justify-center gap-2 font-medium transition active:translate-y-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ink focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60",
  {
    variants: {
      variant: {
        primary: "bg-ink text-surface hover:bg-ink/90",
        ghost: "bg-transparent border border-border text-ink hover:border-ink/60",
        subtle: "bg-contrast text-ink hover:bg-contrast/80",
        accent: "bg-accent text-ink hover:bg-accent-strong",
      },
      size: {
        sm: "text-xs px-3 py-2 rounded-full",
        md: "text-sm px-4 py-2.5 rounded-full",
        lg: "text-base px-5 py-3 rounded-full",
      },
      fullWidth: {
        true: "w-full",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonStyles> & { loading?: boolean; asChild?: boolean };

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, fullWidth, loading, asChild, children, ...props }, ref) => {
    const Component = asChild ? Slot : "button";
    const content = asChild ? (
      children
    ) : (
      <>
        {loading && <span className="h-2 w-2 animate-pulse rounded-full bg-surface" />}
        {children}
      </>
    );

    return (
      <Component
        ref={ref}
        className={cn(
          buttonStyles({
            variant,
            size,
            fullWidth,
          }),
          className,
        )}
        disabled={loading || props.disabled}
        {...props}
      >
        {content}
      </Component>
    );
  },
);

Button.displayName = "Button";
