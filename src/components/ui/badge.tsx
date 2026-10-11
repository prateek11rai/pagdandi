import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Inline-flex, so in a baseline-aligned row it sits on the text baseline next to the words around it.
const badgeVariants = cva(
  "inline-flex h-5 items-center whitespace-nowrap rounded-[4px] px-1.5 align-baseline text-[11px] font-semibold uppercase leading-none tracking-wider",
  {
    variants: {
      variant: {
        default: "border border-ink/25 text-ink-muted",
        highlight: "bg-saffron text-ink",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
