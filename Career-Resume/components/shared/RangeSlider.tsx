"use client";
import React, { Dispatch, SetStateAction, useEffect, useRef } from "react";

interface RangeSliderProps {
  max: number;
  value: number;
  disabled?: boolean;
  setValue: Dispatch<SetStateAction<number>>;
}

const RangeSlider: React.FC<RangeSliderProps> = ({ max, value, disabled = false, setValue }) => {
  const rangeSliderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const rangeSlider = rangeSliderRef.current;
    if (rangeSlider) {
      rangeSlider.style.setProperty("--value", value.toString());
      rangeSlider.style.setProperty("--max", max.toString());

      const input = rangeSlider.querySelector('input[type="range"]') as HTMLInputElement;

      const handleInput = (event: Event) => {
        const inputValue = (event.target as HTMLInputElement).value;
        rangeSlider.style.setProperty("--value", inputValue);
        rangeSlider.style.setProperty("--text-value", JSON.stringify(inputValue));
      };

      input.addEventListener("input", handleInput);

      return () => {
        input.removeEventListener("input", handleInput);
      };
    }
  }, [max, value]);

  return (
    <div
      className="range-slider"
      style={
        {
          "--value": value,
          "--min": 0,
          "--max": max,
        } as React.CSSProperties
      }
      ref={rangeSliderRef}
    >
      <input
        type="range"
        min="0"
        onChange={(e) => {
          setValue(Number(e.target.value));
        }}
        max={max}
        step="1"
        defaultValue={value}
        disabled={disabled}
      />
      <div className="range-slider__progress"></div>
    </div>
  );
};

export default RangeSlider;
