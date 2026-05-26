"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const Progress = () => {
  const progressWrapRef = useRef<HTMLButtonElement>(null);
  const progressPathRef = useRef<SVGPathElement>(null);

  const path = usePathname();

  useEffect(() => {
    const progressWrap = progressWrapRef.current;
    const progressPath = progressPathRef.current;

    if (progressWrap && progressPath) {
      const pathLength = progressPath.getTotalLength();
      progressPath.style.transition = progressPath.style.transition = "none";
      progressPath.style.strokeDasharray = `${pathLength} ${pathLength}`;
      progressPath.style.strokeDashoffset = `${pathLength}`;
      progressPath.getBoundingClientRect();
      progressPath.style.transition = progressPath.style.transition = "stroke-dashoffset 10ms linear";

      const updateProgress = () => {
        const scroll = window.scrollY;
        const height = document.documentElement.scrollHeight - window.innerHeight;
        const progress = pathLength - (scroll * pathLength) / height;
        progressPath.style.strokeDashoffset = `${progress}`;
      };

      updateProgress();
      window.addEventListener("scroll", updateProgress);

      let lastScrollTop = 0;
      const delta = 0;

      const handleScroll = () => {
        const currentScroll = window.scrollY;

        if (Math.abs(lastScrollTop - currentScroll) <= delta) return;

        if (currentScroll > lastScrollTop) {
          progressWrap.classList.remove("active-progress");
        } else {
          progressWrap.classList.add("active-progress");
        }

        if (currentScroll === 0) {
          progressWrap.classList.remove("active-progress");
        }

        lastScrollTop = currentScroll;
      };

      window.addEventListener("scroll", handleScroll);

      progressWrap.addEventListener("click", (event) => {
        event.preventDefault();
        window.scrollTo({
          top: 0,
          behavior: "smooth",
        });
      });

      return () => {
        window.removeEventListener("scroll", updateProgress);
        window.removeEventListener("scroll", handleScroll);
      };
    }
  }, [path]);

  return (
    <button ref={progressWrapRef} className="progress-wrap" aria-label="scroll indicator" title="back to top">
      <span></span>
      <svg className="progress-circle svg-content" width="100%" height="100%" viewBox="-1 -1 102 102">
        <path ref={progressPathRef} d="M50,1 a49,49 0 0,1 0,98 a49,49 0 0,1 0,-98" />
      </svg>
    </button>
  );
};

export default Progress;
