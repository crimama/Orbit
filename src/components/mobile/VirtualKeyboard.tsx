"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface VirtualKeyboardProps {
  onKey: (data: string) => void;
  visible: boolean;
}

type ModifierMode = "off" | "oneshot" | "locked";

const SPECIAL_KEYS = ["|", "~", "`", "/", "-", "{", "}", "[", "]"];
const SWIPE_COLLAPSE_THRESHOLD = 36;
const DOUBLE_TAP_MS = 280;
const PRESS_FEEDBACK_MS = 100;

function getModifierButtonClass(mode: ModifierMode, accentClass: string) {
  if (mode === "locked") {
    return `bg-neutral-100 text-neutral-950 underline underline-offset-2 ${accentClass}`;
  }

  if (mode === "oneshot") {
    return `${accentClass} text-white underline underline-offset-2`;
  }

  return "bg-neutral-800 text-neutral-300 active:bg-neutral-600";
}

export default function VirtualKeyboard({
  onKey,
  visible,
}: VirtualKeyboardProps) {
  const [ctrlMode, setCtrlMode] = useState<ModifierMode>("off");
  const [altMode, setAltMode] = useState<ModifierMode>("off");
  const [expanded, setExpanded] = useState(true);
  const [pressedKey, setPressedKey] = useState<string | null>(null);

  const pressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modifierTapRef = useRef({ ctrl: 0, alt: 0 });
  const swipeStartYRef = useRef<number | null>(null);
  const swipeCollapsedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (pressTimeoutRef.current) {
        clearTimeout(pressTimeoutRef.current);
      }
    };
  }, []);

  const schedulePressedReset = useCallback(() => {
    if (pressTimeoutRef.current) {
      clearTimeout(pressTimeoutRef.current);
    }

    pressTimeoutRef.current = setTimeout(() => {
      setPressedKey(null);
      pressTimeoutRef.current = null;
    }, PRESS_FEEDBACK_MS);
  }, []);

  const markPressed = useCallback((keyId: string) => {
    if (pressTimeoutRef.current) {
      clearTimeout(pressTimeoutRef.current);
      pressTimeoutRef.current = null;
    }

    setPressedKey(keyId);
  }, []);

  const sendKey = useCallback(
    (key: string) => {
      const ctrlActive = ctrlMode !== "off";
      const altActive = altMode !== "off";
      let data = key;

      if (ctrlActive && key.length === 1 && /[a-zA-Z]/.test(key)) {
        data = String.fromCharCode(key.toUpperCase().charCodeAt(0) - 64);
      }

      if (altActive) {
        data = "\x1b" + data;
      }

      if (ctrlMode === "oneshot") {
        setCtrlMode("off");
      }

      if (altMode === "oneshot") {
        setAltMode("off");
      }

      onKey(data);
    },
    [altMode, ctrlMode, onKey],
  );

  const handleModifierTouch = useCallback(
    (modifier: "ctrl" | "alt") => {
      const now = Date.now();
      const lastTap = modifierTapRef.current[modifier];
      const isDoubleTap = now - lastTap < DOUBLE_TAP_MS;

      modifierTapRef.current[modifier] = now;

      if (modifier === "ctrl") {
        setCtrlMode((current) => {
          if (isDoubleTap) {
            return current === "locked" ? "off" : "locked";
          }

          return current === "off" ? "oneshot" : "off";
        });
        return;
      }

      setAltMode((current) => {
        if (isDoubleTap) {
          return current === "locked" ? "off" : "locked";
        }

        return current === "off" ? "oneshot" : "off";
      });
    },
    [],
  );

  const handlePanelTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    swipeStartYRef.current = e.touches[0]?.clientY ?? null;
    swipeCollapsedRef.current = false;
  }, []);

  const handlePanelTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (!expanded || swipeStartYRef.current === null || swipeCollapsedRef.current) {
      return;
    }

    const deltaY = (e.touches[0]?.clientY ?? swipeStartYRef.current) - swipeStartYRef.current;

    if (deltaY > SWIPE_COLLAPSE_THRESHOLD) {
      setExpanded(false);
      swipeCollapsedRef.current = true;
    }
  }, [expanded]);

  const handlePanelTouchEnd = useCallback(() => {
    swipeStartYRef.current = null;
    swipeCollapsedRef.current = false;
  }, []);

  const handleKeyTouchStart = useCallback((keyId: string) => {
    markPressed(keyId);
  }, [markPressed]);

  const handleKeyTouchEnd = useCallback(() => {
    schedulePressedReset();
  }, [schedulePressedReset]);

  const getKeyButtonClass = useCallback(
    (keyId: string, extraClass = "") =>
      [
        "flex min-h-11 min-w-11 items-center justify-center rounded-md bg-neutral-800 px-3 text-xs font-medium text-neutral-200 transition-colors duration-100 select-none active:bg-neutral-600",
        pressedKey === keyId ? "bg-neutral-600 text-white" : "",
        extraClass,
      ]
        .filter(Boolean)
        .join(" "),
    [pressedKey],
  );

  if (!visible) return null;

  return (
    <div
      className="safe-area-pb border-t border-neutral-800 bg-[#0a0a0a] px-2 pt-1"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.5rem)" }}
      onTouchStart={handlePanelTouchStart}
      onTouchMove={handlePanelTouchMove}
      onTouchEnd={handlePanelTouchEnd}
      onTouchCancel={handlePanelTouchEnd}
    >
      <button
        type="button"
        aria-label={expanded ? "가상 키보드 접기" : "가상 키보드 펼치기"}
        className="mb-1 flex h-2.5 w-full items-center justify-center rounded-full"
        onTouchStart={(e) => {
          e.preventDefault();
          markPressed("toggle");
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          setExpanded((current) => !current);
          schedulePressedReset();
        }}
        onTouchCancel={handleKeyTouchEnd}
      >
        <span
          className={[
            "h-1 w-12 rounded-full bg-neutral-600 transition-colors duration-100",
            pressedKey === "toggle" ? "bg-neutral-400" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        />
      </button>

      {expanded ? (
        <>
          <div className="mb-1.5 flex items-stretch gap-1.5">
            <button
              type="button"
              className={getKeyButtonClass("esc")}
              onTouchStart={(e) => {
                e.preventDefault();
                handleKeyTouchStart("esc");
                sendKey("\x1b");
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                handleKeyTouchEnd();
              }}
              onTouchCancel={handleKeyTouchEnd}
            >
              Esc
            </button>
            <button
              type="button"
              className={getKeyButtonClass("tab")}
              onTouchStart={(e) => {
                e.preventDefault();
                handleKeyTouchStart("tab");
                sendKey("\t");
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                handleKeyTouchEnd();
              }}
              onTouchCancel={handleKeyTouchEnd}
            >
              Tab
            </button>
            <button
              type="button"
              className={getKeyButtonClass(
                "ctrl",
                getModifierButtonClass(ctrlMode, "bg-blue-600"),
              )}
              onTouchStart={(e) => {
                e.preventDefault();
                handleKeyTouchStart("ctrl");
                handleModifierTouch("ctrl");
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                handleKeyTouchEnd();
              }}
              onTouchCancel={handleKeyTouchEnd}
            >
              Ctrl
            </button>
            <button
              type="button"
              className={getKeyButtonClass(
                "alt",
                getModifierButtonClass(altMode, "bg-purple-600"),
              )}
              onTouchStart={(e) => {
                e.preventDefault();
                handleKeyTouchStart("alt");
                handleModifierTouch("alt");
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                handleKeyTouchEnd();
              }}
              onTouchCancel={handleKeyTouchEnd}
            >
              Alt
            </button>
            <div className="flex-1" />
            <button
              type="button"
              className={getKeyButtonClass("up", "min-w-12")}
              onTouchStart={(e) => {
                e.preventDefault();
                handleKeyTouchStart("up");
                sendKey("\x1b[A");
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                handleKeyTouchEnd();
              }}
              onTouchCancel={handleKeyTouchEnd}
            >
              &uarr;
            </button>
            <button
              type="button"
              className={getKeyButtonClass("down", "min-w-12")}
              onTouchStart={(e) => {
                e.preventDefault();
                handleKeyTouchStart("down");
                sendKey("\x1b[B");
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                handleKeyTouchEnd();
              }}
              onTouchCancel={handleKeyTouchEnd}
            >
              &darr;
            </button>
            <button
              type="button"
              className={getKeyButtonClass("left", "min-w-12")}
              onTouchStart={(e) => {
                e.preventDefault();
                handleKeyTouchStart("left");
                sendKey("\x1b[D");
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                handleKeyTouchEnd();
              }}
              onTouchCancel={handleKeyTouchEnd}
            >
              &larr;
            </button>
            <button
              type="button"
              className={getKeyButtonClass("right", "min-w-12")}
              onTouchStart={(e) => {
                e.preventDefault();
                handleKeyTouchStart("right");
                sendKey("\x1b[C");
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                handleKeyTouchEnd();
              }}
              onTouchCancel={handleKeyTouchEnd}
            >
              &rarr;
            </button>
          </div>

          <div className="flex items-stretch gap-1.5">
            {SPECIAL_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                className={getKeyButtonClass(`special-${key}`, "flex-1")}
                onTouchStart={(e) => {
                  e.preventDefault();
                  handleKeyTouchStart(`special-${key}`);
                  sendKey(key);
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  handleKeyTouchEnd();
                }}
                onTouchCancel={handleKeyTouchEnd}
              >
                {key}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
