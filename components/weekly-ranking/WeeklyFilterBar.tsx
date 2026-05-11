"use client";

import { useEffect, useRef, useState } from "react";

interface FilterOption {
  value: string;
  label: string;
}

interface WeeklyFilterBarProps {
  totalCount: number;
  sortValue: string;
  seasonValue: string;
  leagueValue: string;
  sortOptions: FilterOption[];
  seasonOptions: FilterOption[];
  leagueOptions: FilterOption[];
  resultCount: number;
  onSortChange: (v: string) => void;
  onSeasonChange: (v: string) => void;
  onLeagueChange: (v: string) => void;
  onReset: () => void;
}

// 한글 라벨이 잘리지 않도록 charWidth/extraPadding을 넉넉히.
// select별 minWidth는 호출부에서 별도로 지정해 더 넉넉한 하한을 보장.
const getSelectWidthByLongestLabel = (
  options: FilterOption[],
  minWidth = 128,
  charWidth = 15,
  extraPadding = 64
) => {
  const longestLabel = options.reduce(
    (longest, option) =>
      option.label.length > longest.length ? option.label : longest,
    ""
  );

  return Math.max(minWidth, longestLabel.length * charWidth + extraPadding);
};

interface WeeklyFilterSelectProps {
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
  width: number;
}

// Weekly 전용 React select.
// 공용 nice-select2 라이브러리의 DOM 조작과 React state 충돌을 회피.
// 시각 스타일은 `.nice-select` cosmetic 규칙(_all-sections.scss)을 그대로 cascade.
const WeeklyFilterSelect = ({
  options,
  value,
  onChange,
  width,
}: WeeklyFilterSelectProps) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const selectedOption =
    options.find((option) => option.value === value) ?? options[0];

  // 외부 클릭 시 닫힘. onBlur 만으로는 mousedown vs focus 타이밍에서 누락이 생겨
  // document mousedown 리스너로 보강. setOpen 만 사용 — DOM 직접 조작 금지.
  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (event: globalThis.MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={`nice-select weekly-react-select${open ? " open" : ""}`}
      tabIndex={0}
      style={{ width, minWidth: width }}
      onClick={() => setOpen((prev) => !prev)}
    >
      <span className="current">{selectedOption?.label ?? ""}</span>

      <div
        className="nice-select-dropdown"
        // 옵션 click이 trigger의 onClick(toggle)으로 bubble되어 다시 열리는 것 방지.
        onClick={(event) => event.stopPropagation()}
      >
        <ul className="list">
          {options.map((option) => (
            <li
              key={option.value}
              data-value={option.value}
              className={`option${option.value === value ? " selected focus" : ""}`}
              // mousedown에서 처리 — preventDefault로 focus shift 차단,
              // 1회 클릭 즉시 onChange + 닫힘 보장.
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onChange(option.value);
                setOpen(false);
              }}
              onClick={(event) => event.stopPropagation()}
            >
              {option.label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

const WeeklyFilterBar = ({
  totalCount,
  sortValue,
  seasonValue,
  leagueValue,
  sortOptions,
  seasonOptions,
  leagueOptions,
  resultCount,
  onSortChange,
  onSeasonChange,
  onLeagueChange,
  onReset,
}: WeeklyFilterBarProps) => {
  // select별 별도 minWidth — 가장 긴 옵션이 잘리지 않도록.
  // 정렬: "리그 크루 수" / 시즌: "2026년, 봄 시즌" / 리그: "심화 진행" · "휴식(공식)"
  const sortSelectWidth = getSelectWidthByLongestLabel(sortOptions, 150);
  const seasonSelectWidth = getSelectWidthByLongestLabel(seasonOptions, 180);
  const leagueSelectWidth = getSelectWidthByLongestLabel(leagueOptions, 150);

  return (
    <div className="tournaments weekly-filter-wrap">
      <div className="tournaments__filter fade-top">
        <button
          type="button"
          className="weekly-filter-reset-btn"
          onClick={onReset}
        >
          RESET
        </button>

        <div className="weekly-filter-readonly">
          <span className="weekly-filter-dot" aria-hidden="true">●</span>
          <span className="weekly-filter-label">전체 수</span>
          <span className="weekly-filter-value">{totalCount}</span>
        </div>

        <div className="weekly-filter-group">
          <div className="weekly-filter-group-label">
            <span className="weekly-filter-dot" aria-hidden="true">●</span>
            <span className="weekly-filter-group-text">정렬</span>
          </div>
          <WeeklyFilterSelect
            options={sortOptions}
            value={sortValue}
            onChange={onSortChange}
            width={sortSelectWidth}
          />
        </div>

        <div className="weekly-filter-group">
          <div className="weekly-filter-group-label">
            <span className="weekly-filter-dot" aria-hidden="true">●</span>
            <span className="weekly-filter-group-text">시즌</span>
          </div>
          <WeeklyFilterSelect
            options={seasonOptions}
            value={seasonValue}
            onChange={onSeasonChange}
            width={seasonSelectWidth}
          />
        </div>

        <div className="weekly-filter-group">
          <div className="weekly-filter-group-label">
            <span className="weekly-filter-dot" aria-hidden="true">●</span>
            <span className="weekly-filter-group-text">리그</span>
          </div>
          <WeeklyFilterSelect
            options={leagueOptions}
            value={leagueValue}
            onChange={onLeagueChange}
            width={leagueSelectWidth}
          />
        </div>

        <div className="weekly-filter-readonly">
          <span className="weekly-filter-dot" aria-hidden="true">●</span>
          <span className="weekly-filter-label">검색 결과</span>
          <span className="weekly-filter-value">{resultCount}</span>
        </div>
      </div>
    </div>
  );
};

export default WeeklyFilterBar;
