import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export function ScrollToTop() {
  const location = useLocation();

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (location.hash) {
        const target = document.getElementById(location.hash.slice(1));
        if (target) {
          target.scrollIntoView({ block: "start" });
          return;
        }
      }

      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [location.key, location.hash]);

  return null;
}
