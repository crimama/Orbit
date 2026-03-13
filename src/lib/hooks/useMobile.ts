"use client";

import { useState, useEffect } from "react";

interface MobileState {
  isMobile: boolean;
  isTablet: boolean;
  isLandscape: boolean;
  isStandalone: boolean;
  prefersReducedMotion: boolean;
}

const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1024;

/** SSR-safe default — must match server render to prevent hydration mismatch. */
const SSR_DEFAULT: MobileState = {
  isMobile: false,
  isTablet: false,
  isLandscape: false,
  isStandalone: false,
  prefersReducedMotion: false,
};

function getState(): MobileState {
  if (typeof window === "undefined") return SSR_DEFAULT;

  const width = window.innerWidth;
  const navigatorWithStandalone = window.navigator as Navigator & {
    standalone?: boolean;
  };

  return {
    isMobile: width < MOBILE_BREAKPOINT,
    isTablet: width >= MOBILE_BREAKPOINT && width < TABLET_BREAKPOINT,
    isLandscape: window.matchMedia("(orientation: landscape)").matches,
    isStandalone:
      window.matchMedia("(display-mode: standalone)").matches ||
      navigatorWithStandalone.standalone === true,
    prefersReducedMotion: window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches,
  };
}

export function useMobile(): MobileState {
  // Always start with SSR defaults so server & client first render match.
  const [state, setState] = useState<MobileState>(SSR_DEFAULT);

  useEffect(() => {
    const mobileQuery = window.matchMedia(
      `(max-width: ${MOBILE_BREAKPOINT - 1}px)`,
    );
    const tabletQuery = window.matchMedia(
      `(min-width: ${MOBILE_BREAKPOINT}px) and (max-width: ${TABLET_BREAKPOINT - 1}px)`,
    );
    const landscapeQuery = window.matchMedia("(orientation: landscape)");
    const standaloneQuery = window.matchMedia("(display-mode: standalone)");
    const reducedMotionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );

    function handleChange() {
      setState(getState());
    }

    // Immediately set actual values after mount (triggers re-render).
    handleChange();

    mobileQuery.addEventListener("change", handleChange);
    tabletQuery.addEventListener("change", handleChange);
    landscapeQuery.addEventListener("change", handleChange);
    standaloneQuery.addEventListener("change", handleChange);
    reducedMotionQuery.addEventListener("change", handleChange);

    return () => {
      mobileQuery.removeEventListener("change", handleChange);
      tabletQuery.removeEventListener("change", handleChange);
      landscapeQuery.removeEventListener("change", handleChange);
      standaloneQuery.removeEventListener("change", handleChange);
      reducedMotionQuery.removeEventListener("change", handleChange);
    };
  }, []);

  return state;
}
