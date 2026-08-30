"use client";

import { useEffect } from "react";

const HEIGHT_PROPERTY = "--app-visual-viewport-height";
const KEYBOARD_PROPERTY = "--app-keyboard-inset";
const KEYBOARD_ATTRIBUTE = "data-app-keyboard-open";

export function MobileViewportSync() {
  useEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    let animationFrame = 0;

    const syncViewport = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        const visibleHeight = viewport?.height ?? window.innerHeight;
        const viewportOffset = viewport?.offsetTop ?? 0;
        const keyboardInset = Math.max(0, window.innerHeight - visibleHeight - viewportOffset);
        const activeElement = document.activeElement;
        const isEditing =
          activeElement instanceof HTMLElement &&
          activeElement.matches('input, textarea, select, [contenteditable="true"]');
        const isMobileWidth = window.matchMedia("(max-width: 767px)").matches;

        root.style.setProperty(HEIGHT_PROPERTY, `${Math.round(visibleHeight)}px`);
        root.style.setProperty(KEYBOARD_PROPERTY, `${Math.round(keyboardInset)}px`);
        root.toggleAttribute(KEYBOARD_ATTRIBUTE, keyboardInset > 96 || (isMobileWidth && isEditing));
      });
    };

    syncViewport();
    window.addEventListener("resize", syncViewport, { passive: true });
    window.addEventListener("orientationchange", syncViewport, { passive: true });
    window.addEventListener("focusin", syncViewport, { passive: true });
    window.addEventListener("focusout", syncViewport, { passive: true });
    viewport?.addEventListener("resize", syncViewport, { passive: true });
    viewport?.addEventListener("scroll", syncViewport, { passive: true });

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", syncViewport);
      window.removeEventListener("orientationchange", syncViewport);
      window.removeEventListener("focusin", syncViewport);
      window.removeEventListener("focusout", syncViewport);
      viewport?.removeEventListener("resize", syncViewport);
      viewport?.removeEventListener("scroll", syncViewport);
      root.style.removeProperty(HEIGHT_PROPERTY);
      root.style.removeProperty(KEYBOARD_PROPERTY);
      root.removeAttribute(KEYBOARD_ATTRIBUTE);
    };
  }, []);

  return null;
}
