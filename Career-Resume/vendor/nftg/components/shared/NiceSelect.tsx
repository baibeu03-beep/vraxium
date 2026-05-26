"use client";
import NiceSelect from "nice-select2";
import { useEffect, useRef } from "react";

interface Option {
  value: string;
  text: string;
}

interface NiceSelectProps {
  options: Option[];
  placeholder?: string;
  onChange?: (selectedValue: string) => void;
  defaultValue?: string;
}

const NiceSelectComponent: React.FC<NiceSelectProps> = ({ options, placeholder, onChange, defaultValue }) => {
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (selectRef.current) {
      const select = new NiceSelect(selectRef.current, {
        placeholder: placeholder || "Select an option",
      });

      if (onChange) {
        selectRef.current.addEventListener("change", (e) => {
          onChange((e.target as HTMLSelectElement).value);
        });
      }

      if (defaultValue) {
        select.update(defaultValue);
      }

      return () => {
        select.destroy();
      };
    }
  }, [placeholder, onChange, defaultValue]);

  return (
    <select ref={selectRef} defaultValue={defaultValue}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.text}
        </option>
      ))}
    </select>
  );
};

export default NiceSelectComponent;
