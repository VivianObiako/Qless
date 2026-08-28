import type { JSX, ReactNode } from "react";
import Link from "next/link";
import { controlClasses, type ButtonSize, type ButtonVariant } from "@/components/Button";

interface LinkButtonProps {
  href: string;
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
}

/**
 * A navigation that looks like a control. It is an anchor, not a button with an
 * onClick — going somewhere should survive a middle click, a long press and a
 * keyboard, and only a real link does all three.
 *
 * Defaults to `contrast` rather than `paper`: cream on the dark shell and cream
 * on a light one are not the same idea, and the second is nearly invisible.
 */
export function LinkButton({
  href,
  children,
  variant = "contrast",
  size = "lg",
  fullWidth = false,
  className,
}: LinkButtonProps): JSX.Element {
  return (
    <Link href={href} className={controlClasses(variant, size, fullWidth, className)}>
      {children}
    </Link>
  );
}

