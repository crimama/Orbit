"use client";

import type { ReactNode } from "react";
import { useMobile } from "@/lib/hooks/useMobile";
import VirtualKeyboard from "./VirtualKeyboard";

interface MobileLayoutProps {
  children: ReactNode;
  onTerminalKey?: (data: string) => void;
}

export default function MobileLayout({
  children,
  onTerminalKey,
}: MobileLayoutProps) {
  const { isMobile } = useMobile();

  if (!isMobile) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-[100dvh] flex-col">
      <div className="min-h-0 flex-1">{children}</div>
      <VirtualKeyboard
        visible={true}
        onKey={onTerminalKey ?? (() => {})}
      />
    </div>
  );
}
