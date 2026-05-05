"use client";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

gsap.registerPlugin(ScrollTrigger);

const FadeLeft: React.FC = () => {
  const path = usePathname();

  useEffect(() => {
    if (window.innerWidth >= 992) {
      const fadeItems = document.querySelectorAll<HTMLElement>(".fade-left");

      fadeItems.forEach((element, index) => {
        const delay = index * 0.2;

        gsap.set(element, {
          opacity: 0,
          x: 160,
        });

        ScrollTrigger.create({
          trigger: element,
          start: "top 100%",
          end: "bottom 20%",
          scrub: 0.5,
          onEnter: () => {
            gsap.to(element, {
              opacity: 1,
              x: 0,
              duration: 1,
              delay: delay,
            });
          },
          once: true,
        });
      });
    }
  }, [path]);

  return null;
};

export default FadeLeft;
