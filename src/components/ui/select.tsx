import * as React from "react";
import { cn } from "@/lib/utils";

// A native select: better on phones than a custom listbox, and accessible by default.
function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="select"
      className={cn("h-11 w-full rounded-sm border border-ink/30 bg-paper-raised px-2 text-base text-ink", className)}
      {...props}
    />
  );
}

export { NativeSelect };
