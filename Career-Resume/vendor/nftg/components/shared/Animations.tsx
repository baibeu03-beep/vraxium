"use client";
import dynamic from "next/dynamic";
const SplitTextAnimations = dynamic(() => import("./TitleAnimations"), { ssr: false });
const TextStroke = dynamic(() => import("./TextStroke"), { ssr: false });
const FadeLeft = dynamic(() => import("./FadeLeft"), { ssr: false });
const FadeRight = dynamic(() => import("./FadeRight"), { ssr: false });
const Animations = () => {
  return (
    <>
      <TextStroke />
      <SplitTextAnimations />
      <FadeLeft />
      <FadeRight />
    </>
  );
};

export default Animations;
