"use client";

import { forwardRef } from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: "default" | "compact";
}

const variantClasses: Record<string, string> = {
  default:
    "w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-200 placeholder-neutral-600 outline-none focus:border-border-focus",
  compact:
    "w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-200 placeholder-neutral-600 outline-none focus:border-border-focus",
};

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ variant = "default", className = "", ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`${variantClasses[variant]} ${className}`}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";
export default Input;
