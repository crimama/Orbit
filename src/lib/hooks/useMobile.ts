"use client";

import { useState, useEffect } from "react";

interface MobileState {
  isMobile: boolean;
  isTablet: boolean;
}

const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1024;

function getState(): MobileState {
  if (typeof window === "undefined") {
    return { isMobile: false, isTablet: false };
  }
  const width = window.innerWidth;
  return {
    isMobile: width < MOBILE_BREAKPOINT,
    isTablet: width >= MOBILE_BREAKPOINT && width < TABLET_BREAKPOINT,
  };
}

export function useMobile(): MobileState {
  const [state, setState] = useState<MobileState>(getState);

  useEffect(() => {
    const mobileQuery = window.matchMedia(
      `(max-width: ${MOBILE_BREAKPOINT - 1}px)`,
    );
    const tabletQuery = window.matchMedia(
      `(min-width: ${MOBILE_BREAKPOINT}px) and (max-width: ${TABLET_BREAKPOINT - 1}px)`,
    );

    function handleChange() {
      setState(getState());
    }

    mobileQuery.addEventListener("change", handleChange);
    tabletQuery.addEventListener("change", handleChange);

    // Set initial state on client
    handleChange();

    return () => {
      mobileQuery.removeEventListener("change", handleChange);
      tabletQuery.removeEventListener("change", handleChange);
    };
  }, []);

  return state;
}
