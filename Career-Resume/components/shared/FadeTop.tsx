"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import { useEffect } from "react";

const FadeTop: React.FC = () => {
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const fadeWrappers = document.querySelectorAll(".fade-wrapper");

    fadeWrappers.forEach((wrapper) => {
      const fadeItems = wrapper.querySelectorAll(".fade-top");

      fadeItems.forEach((element, index) => {
        const delay = index * 0.2;

        gsap.from(element, {
          opacity: 0,
          y: 160,
          duration: 1,
          delay: delay,
          scrollTrigger: {
            trigger: element,
            start: "top 100%",
          },
        });
      });
    });
  }, []);

  return null;
};

export default FadeTop;
