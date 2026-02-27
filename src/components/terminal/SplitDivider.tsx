"use client";

import { useCallback, useRef } from "react";

interface SplitDividerProps {
  direction: "horizontal" | "vertical";
  onRatioChange: (ratio: number) => void;
}

export default function SplitDivider({ direction, onRatioChange }: SplitDividerProps) {
  const dividerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const parent = dividerRef.current?.parentElement;
      if (!parent) return;

      const rect = parent.getBoundingClientRect();

      const onMouseMove = (ev: MouseEvent) => {
        let ratio: number;
        if (direction === "horizontal") {
          ratio = (ev.clientX - rect.left) / rect.width;
        } else {
          ratio = (ev.clientY - rect.top) / rect.height;
        }
        onRatioChange(Math.max(0.1, Math.min(0.9, ratio)));
      };

      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor =
        direction === "horizontal" ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [direction, onRatioChange],
  );

  const handleDoubleClick = useCallback(() => {
    onRatioChange(0.5);
  }, [onRatioChange]);

  const isHorizontal = direction === "horizontal";

  return (
    <div
      ref={dividerRef}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      className={`flex-shrink-0 bg-neutral-800 hover:bg-blue-600 transition-colors ${
        isHorizontal ? "w-1 cursor-col-resize" : "h-1 cursor-row-resize"
      }`}
    />
  );
}
