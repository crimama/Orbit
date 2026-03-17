"use client";

import { useCallback, useRef } from "react";

interface SplitDividerProps {
  direction: "horizontal" | "vertical";
  onDeltaChange: (delta: number) => void;
  onReset?: () => void;
}

export default function SplitDivider({
  direction,
  onDeltaChange,
  onReset,
}: SplitDividerProps) {
  const dividerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const parent = dividerRef.current?.parentElement;
      if (!parent) return;

      const rect = parent.getBoundingClientRect();
      let previousPosition =
        direction === "horizontal" ? e.clientX : e.clientY;

      const onMouseMove = (ev: MouseEvent) => {
        const nextPosition =
          direction === "horizontal" ? ev.clientX : ev.clientY;
        const size = direction === "horizontal" ? rect.width : rect.height;
        if (size <= 0) return;

        const delta = (nextPosition - previousPosition) / size;
        previousPosition = nextPosition;
        onDeltaChange(delta);
      };

      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        document.documentElement.classList.remove("orbit-resizing");
      };

      document.body.style.cursor =
        direction === "horizontal" ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";
      document.documentElement.classList.add("orbit-resizing");
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [direction, onDeltaChange],
  );

  const handleDoubleClick = useCallback(() => {
    onReset?.();
  }, [onReset]);

  const isHorizontal = direction === "horizontal";

  return (
    <div
      ref={dividerRef}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      className={`flex-shrink-0 bg-neutral-800 transition-colors hover:bg-blue-600 ${
        isHorizontal ? "w-1 cursor-col-resize" : "h-1 cursor-row-resize"
      }`}
    />
  );
}
