import type { JSX } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface IconProps {
  icon: LucideIcon;
  size?: 14 | 15 | 16 | 18 | 20;
  className?: string;
}

/**
 * A Lucide glyph at the product's one stroke weight, hidden from assistive
 * technology: an icon here sits beside a word and never carries meaning alone.
 */
export function Icon({ icon: Glyph, size = 16, className }: IconProps): JSX.Element {
  return <Glyph aria-hidden="true" size={size} strokeWidth={1.75} className={cn("shrink-0", className)} />;
}
