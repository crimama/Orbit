"use client";

import type { ReactNode } from "react";
import { useMobile } from "@/lib/hooks/useMobile";

interface MobileLayoutProps {
  children: ReactNode;
}

export default function MobileLayout({ children }: MobileLayoutProps) {
  const { isMobile } = useMobile();

  if (!isMobile) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-[100dvh] flex-col">
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
