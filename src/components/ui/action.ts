import { cn } from "@/lib/utils";

// The pill-shaped actions: "Get daily updates" (primary), "Print the one-page plan", "Download the audio intro".
export function actionClass(primary = false, className?: string): string {
  return cn(
    "inline-flex items-center gap-2 rounded-[9px] border px-3 py-2 text-sm no-underline",
    primary
      ? "border-moss bg-moss text-white hover:bg-moss-strong hover:text-white"
      : "border-rule bg-paper-raised text-ink hover:border-moss hover:text-ink",
    className,
  );
}
