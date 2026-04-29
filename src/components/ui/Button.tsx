"use client";

import { forwardRef } from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "accent";
  size?: "sm" | "md" | "lg";
}

const variantClasses: Record<string, string> = {
  primary:
    "bg-orbit-accent-primary text-black hover:bg-orbit-accent-hover disabled:opacity-50",
  secondary:
    "border border-orbit-border-default bg-orbit-bg-tertiary text-orbit-text-primary hover:bg-neutral-800 disabled:opacity-50",
  ghost:
    "text-orbit-text-secondary hover:bg-orbit-bg-tertiary hover:text-orbit-text-primary",
  danger: "bg-red-600/20 text-red-400 hover:bg-red-600/30 disabled:opacity-50",
  accent:
    "bg-orbit-accent-primary text-black hover:bg-orbit-accent-hover disabled:opacity-50",
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
