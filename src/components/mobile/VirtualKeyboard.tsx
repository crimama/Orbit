"use client";

import { useState, useCallback } from "react";

interface VirtualKeyboardProps {
  onKey: (data: string) => void;
  visible: boolean;
}

export default function VirtualKeyboard({
  onKey,
  visible,
}: VirtualKeyboardProps) {
  const [ctrlActive, setCtrlActive] = useState(false);
  const [altActive, setAltActive] = useState(false);

  const sendKey = useCallback(
    (key: string) => {
      let data = key;

      if (ctrlActive) {
        // Ctrl+key: send ASCII control character (A=1, B=2, ..., Z=26)
        if (key.length === 1 && /[a-zA-Z]/.test(key)) {
          data = String.fromCharCode(
            key.toUpperCase().charCodeAt(0) - 64,
          );
        }
        setCtrlActive(false);
      }

      if (altActive) {
        // Alt+key: send ESC prefix
        data = "\x1b" + key;
        setAltActive(false);
      }

      onKey(data);
    },
    [ctrlActive, altActive, onKey],
  );

  if (!visible) return null;

  const toggleBtnClass = (active: boolean) =>
    `rounded px-3 py-2 text-xs font-medium transition-colors ${
      active
        ? "bg-neutral-500 text-white"
        : "bg-neutral-800 text-neutral-400 active:bg-neutral-700"
    }`;

  const keyBtnClass =
    "rounded bg-neutral-800 px-3 py-2 text-xs text-neutral-300 active:bg-neutral-700 transition-colors";

  return (
    <div className="border-t border-neutral-800 bg-[#0a0a0a] px-2 pb-2 pt-1.5 safe-area-pb">
      {/* Row 1: Modifiers and arrows */}
      <div className="mb-1 flex gap-1">
        <button
          type="button"
          className={keyBtnClass}
          onTouchStart={(e) => {
            e.preventDefault();
            sendKey("\x1b");
          }}
        >
          Esc
        </button>
        <button
          type="button"
          className={keyBtnClass}
          onTouchStart={(e) => {
            e.preventDefault();
            sendKey("\t");
          }}
        >
          Tab
        </button>
        <button
          type="button"
          className={toggleBtnClass(ctrlActive)}
          onTouchStart={(e) => {
            e.preventDefault();
            setCtrlActive(!ctrlActive);
          }}
        >
          Ctrl
        </button>
        <button
          type="button"
          className={toggleBtnClass(altActive)}
          onTouchStart={(e) => {
            e.preventDefault();
            setAltActive(!altActive);
          }}
        >
          Alt
        </button>
        <div className="flex-1" />
        <button
          type="button"
          className={keyBtnClass}
          onTouchStart={(e) => {
            e.preventDefault();
            sendKey("\x1b[A");
          }}
        >
          &uarr;
        </button>
        <button
          type="button"
          className={keyBtnClass}
          onTouchStart={(e) => {
            e.preventDefault();
            sendKey("\x1b[B");
          }}
        >
          &darr;
        </button>
        <button
          type="button"
          className={keyBtnClass}
          onTouchStart={(e) => {
            e.preventDefault();
            sendKey("\x1b[D");
          }}
        >
          &larr;
        </button>
        <button
          type="button"
          className={keyBtnClass}
          onTouchStart={(e) => {
            e.preventDefault();
            sendKey("\x1b[C");
          }}
        >
          &rarr;
        </button>
      </div>

      {/* Row 2: Special characters */}
      <div className="flex gap-1">
        {["|", "~", "`", "/", "-", "{", "}", "[", "]"].map((key) => (
          <button
            key={key}
            type="button"
            className={`flex-1 ${keyBtnClass}`}
            onTouchStart={(e) => {
              e.preventDefault();
              sendKey(key);
            }}
          >
            {key}
          </button>
        ))}
      </div>
    </div>
  );
}
