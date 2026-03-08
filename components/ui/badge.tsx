import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const badgeStyles = cva(
  "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em]",
  {
    variants: {
      tone: {
        accent: "border-transparent bg-accent text-ink",
        outline: "border-border bg-transparent text-muted",
        solid: "border-transparent bg-ink text-surface",
      },
      muted: {
        true: "opacity-80",
      },
    },
    defaultVariants: {
      tone: "outline",
    },
  },
);

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeStyles>;

export function Badge({ className, tone, muted, ...props }: BadgeProps) {
  return <span className={cn(badgeStyles({ tone, muted }), className)} {...props} />;
}
