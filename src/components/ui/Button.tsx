"use client";

import { forwardRef } from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "accent";
  size?: "sm" | "md" | "lg";
}

const variantClasses: Record<string, string> = {
  primary:
    "bg-neutral-700 text-neutral-200 hover:bg-neutral-600 disabled:opacity-50",
  secondary:
    "border border-neutral-700 bg-neutral-900 text-neutral-300 hover:bg-neutral-800 disabled:opacity-50",
  ghost: "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200",
  danger: "text-neutral-400 hover:bg-red-900/30 hover:text-red-400",
  accent: "bg-accent text-white hover:bg-accent-hover disabled:opacity-50",
};

const sizeClasses: Record<string, string> = {
  sm: "px-1.5 py-0.5 text-xs rounded",
  md: "px-3 py-1.5 text-sm rounded",
  lg: "min-h-[48px] px-4 py-3 text-sm font-semibold rounded-xl",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className = "", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`inline-flex items-center justify-center transition-colors ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
export default Button;
