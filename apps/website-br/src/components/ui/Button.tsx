import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  asChild?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-teal-600 text-white hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400",
  secondary:
    "border-2 border-stone-800 text-stone-800 hover:bg-stone-100 dark:border-stone-200 dark:text-stone-200 dark:hover:bg-stone-800",
  ghost:
    "text-stone-600 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-lg px-6 py-3 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          variantStyles[variant],
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
