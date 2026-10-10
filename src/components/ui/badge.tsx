import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-sm px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wider", {
  variants: {
    variant: {
      default: "border border-ink/25 text-ink-muted",
      highlight: "bg-saffron text-[#1f2a24]",
    },
  },
  defaultVariants: { variant: "default" },
});

function Badge({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
