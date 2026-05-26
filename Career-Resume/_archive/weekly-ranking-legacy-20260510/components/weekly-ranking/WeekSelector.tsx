"use client";

import { useState, useRef, useEffect } from "react";
import { WeekOption } from "./types";

interface WeekSelectorProps {
  weeks: WeekOption[];
  selectedWeekId: string | null;
  onWeekChange: (weekId: string) => void;
}

const WeekSelector = ({ weeks, selectedWeekId, onWeekChange }: WeekSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedWeek = weeks.find(w => w.id === selectedWeekId);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (weekId: string) => {
    onWeekChange(weekId);
    setIsOpen(false);
  };

  return (
    <div className="leaderboard__filter">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '14px', color: '#888' }}>주차 선택:</span>
        <div ref={dropdownRef} style={{ position: 'relative', minWidth: '200px' }}>
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            style={{
              width: '100%',
              padding: '8px 16px',
              fontSize: '14px',
              borderRadius: '8px',
              border: '1px solid #333',
              backgroundColor: '#1a1a2e',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>{selectedWeek?.label || '주차 선택'}</span>
            <i
              className="ti ti-chevron-down"
              style={{
                transition: 'transform 0.2s',
                transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)'
              }}
            />
          </button>
          {isOpen && (
            <ul
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: '4px',
                padding: '4px 0',
                backgroundColor: '#1a1a2e',
                border: '1px solid #333',
                borderRadius: '8px',
                listStyle: 'none',
                maxHeight: '200px',
                overflowY: 'auto',
                zIndex: 1000,
              }}
            >
              {weeks.map((week) => (
                <li
                  key={week.id}
                  onClick={() => handleSelect(week.id)}
                  style={{
                    padding: '8px 16px',
                    cursor: 'pointer',
                    backgroundColor: week.id === selectedWeekId ? '#333' : 'transparent',
                    color: '#fff',
                    fontSize: '14px',
                    transition: 'background-color 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    if (week.id !== selectedWeekId) {
                      e.currentTarget.style.backgroundColor = '#2a2a3e';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (week.id !== selectedWeekId) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  {week.label}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default WeekSelector;
