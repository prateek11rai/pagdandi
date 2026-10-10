import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-sm border border-ink/30 bg-paper-raised px-3 text-base text-ink placeholder:text-ink-muted disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
