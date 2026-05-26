"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect } from "react";

const TextStroke = () => {
  const pathname = usePathname();

  const updateStrokedText = useCallback(() => {
    const strokedText = document.querySelectorAll(".stroked-text");
    strokedText.forEach((element) => {
      const originalText = (element as HTMLElement).innerText;
      element.setAttribute("data-text", originalText);
    });
  }, []);

  useEffect(() => {
    // Run on initial load and subsequent route changes
    updateStrokedText();

    // Set up a MutationObserver to watch for changes in the DOM
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "childList") {
          updateStrokedText();
        }
      });
    });

    // Start observing the document with the configured parameters
    observer.observe(document.body, { childList: true, subtree: true });

    // Clean up the observer when the component unmounts
    return () => observer.disconnect();
  }, [pathname, updateStrokedText]);

  return null;
};

export default TextStroke;
