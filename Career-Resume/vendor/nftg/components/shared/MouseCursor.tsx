import React, { useEffect, useRef } from "react";

const CustomCursor: React.FC = () => {
  const cursorOuterRef = useRef<HTMLDivElement>(null);
  const cursorInnerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cursorInner = cursorInnerRef.current;
    const cursorOuter = cursorOuterRef.current;

    if (!cursorInner || !cursorOuter) return;

    const moveCursor = (e: MouseEvent) => {
      const { clientX: x, clientY: y } = e;
      cursorOuter.style.transform = `translate(${x}px, ${y}px)`;
      cursorInner.style.transform = `translate(${x}px, ${y}px)`;
      cursorOuter.style.visibility = "visible";
      cursorInner.style.visibility = "visible";
    };

    document.addEventListener("mousemove", moveCursor);

    const handleMouseEnter = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("button:not(.not-cursor), a:not(.not-cursor), .cursor-pointer")) {
        cursorInner.classList.add("cursor-hover");
        cursorOuter.classList.add("cursor-hover");
      }
      if (target.closest("h1, h2, h3, h4, h5, h6, .cursor-lg")) {
        cursorInner.classList.add("cursor-big");
        cursorOuter.classList.add("cursor-big");
      }
      if (target.closest(".draggable-cursor")) {
        cursorInner.classList.add("drag-cursor");
        cursorOuter.classList.add("drag-cursor");
      }
      if (target.closest(".viewable-cursor")) {
        cursorInner.classList.add("view-cursor");
        cursorOuter.classList.add("view-cursor");
      }
      if (target.closest(".not-cursor")) {
        cursorOuter.classList.add("not-cursor-outer");
      }
    };

    const handleMouseLeave = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("button, a, .cursor-pointer")) {
        if (!target.closest(".cursor-pointer")) {
          cursorInner.classList.remove("cursor-hover");
          cursorOuter.classList.remove("cursor-hover");
        }
      }
      cursorInner.classList.remove("cursor-big", "drag-cursor", "view-cursor");
      cursorOuter.classList.remove("cursor-big", "drag-cursor", "view-cursor", "not-cursor-outer");
    };

    document.addEventListener("mouseover", handleMouseEnter);
    document.addEventListener("mouseout", handleMouseLeave);

    return () => {
      document.removeEventListener("mousemove", moveCursor);
      document.removeEventListener("mouseover", handleMouseEnter);
      document.removeEventListener("mouseout", handleMouseLeave);
    };
  }, []);

  return (
    <>
      <div ref={cursorOuterRef} className="mouseCursor cursor-outer"></div>
      <div ref={cursorInnerRef} className="mouseCursor cursor-inner"></div>
    </>
  );
};

export default CustomCursor;
