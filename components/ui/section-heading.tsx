import { cn } from "@/lib/utils/cn";
import type { ReactNode } from "react";

type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  className,
}: SectionHeadingProps) {
  return (
    <div className={cn("flex flex-col gap-3 md:flex-row md:items-center md:justify-between", className)}>
      <div className="space-y-2">
        {eyebrow && (
          <p className="text-xs uppercase tracking-[0.2em] text-muted">
            {eyebrow}
          </p>
        )}
        <h2 className="font-display text-2xl leading-tight">{title}</h2>
        {description && <p className="max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
